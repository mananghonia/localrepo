from datetime import datetime, timedelta
import logging
import re
import smtplib

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.utils.crypto import get_random_string
from mongoengine.queryset.visitor import Q

from expenses.models import Activity, Expense
from realtime import pubsub as realtime_pubsub

from .models import EmailOTP, User, FriendInvite, Friendship, FriendSettlement, Notification


OTP_ALLOWED_CHARS = '0123456789'
GROUP_FALLBACK_LABEL = 'Personal split'
SETTLEMENT_FROM_EMAIL = 'splitwise676@gmail.com'
logger = logging.getLogger(__name__)


class OTPDeliveryError(Exception):
    """Raised when the OTP email cannot be delivered."""
    pass


class InviteDeliveryError(Exception):
    """Raised when the invite email cannot be delivered."""
    pass


class SettlementError(Exception):
    """Raised when a settlement cannot be completed."""
    pass

def _now():
    return datetime.utcnow()


def _otp_expiration():
    minutes = int(getattr(settings, 'SIGNUP_OTP_EXPIRATION_MINUTES', 10))
    return _now() + timedelta(minutes=minutes)


def issue_signup_otp(email: str, name: str = '') -> None:
    sanitized_email = email.strip().lower()
    EmailOTP.objects(
        email=sanitized_email,
        purpose=EmailOTP.PURPOSE_SIGNUP,
        used=False,
    ).update(set__used=True)

    code = get_random_string(length=6, allowed_chars=OTP_ALLOWED_CHARS)
    otp = EmailOTP(
        email=sanitized_email,
        purpose=EmailOTP.PURPOSE_SIGNUP,
        code_hash=make_password(code),
        expires_at=_otp_expiration(),
    )
    otp.save()

    message_lines = [
        f"Hi {name or 'there'},",
        '',
        f"Your verification code is {code}.",
        "It expires in {minutes} minutes.".format(
            minutes=int(getattr(settings, 'SIGNUP_OTP_EXPIRATION_MINUTES', 10))
        ),
        '',
        'If you did not request this code, you can safely ignore this message.',
    ]
    try:
        send_mail(
            subject='Your Splitwise verification code',
            message='\n'.join(message_lines),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[sanitized_email],
            fail_silently=False,
        )
    except smtplib.SMTPException as exc:
        logger.exception("Failed to send OTP email to %s", sanitized_email)
        raise OTPDeliveryError("Unable to send verification email right now. Please try again later.") from exc


def verify_signup_otp(email: str, code: str) -> bool:
    sanitized_email = email.strip().lower()
    bypass_code = getattr(settings, 'BYPASS_SIGNUP_OTP_CODE', '')
    if settings.DEBUG and bypass_code and code == bypass_code:
        return True

    lookup = EmailOTP.objects(
        email=sanitized_email,
        purpose=EmailOTP.PURPOSE_SIGNUP,
        used=False,
        expires_at__gt=_now(),
    ).order_by('-created_at').first()

    if not lookup:
        return False

    if not check_password(code, lookup.code_hash):
        return False

    lookup.mark_used()
    return True


def build_unique_username(seed: str) -> str:
    base = ''.join(char for char in seed.lower() if char.isalnum()) or 'user'
    candidate = base
    counter = 1
    while User.objects(username=candidate).first():
        candidate = f"{base}{counter}"
        counter += 1
    return candidate


def ensure_friendship(user_a: User, user_b: User) -> None:
    if not user_a or not user_b:
        return
    if user_a.id == user_b.id:
        return

    for owner, friend in ((user_a, user_b), (user_b, user_a)):
        Friendship.objects(user=owner, friend=friend).update_one(
            set__friend=friend,
            set_on_insert__created_at=_now(),
            set_on_insert__group_balances={},
            set_on_insert__group_labels={},
            set_on_insert__group_snapshot_version=1,
            upsert=True,
        )


def attach_pending_invites_to_user(user: User) -> None:
    if not user:
        return
    FriendInvite.objects(invitee_email=user.email, invitee_user=None).update(set__invitee_user=user)


def send_friend_invite_email(invite: FriendInvite) -> None:
    target_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/friends?section=invites"
    inviter_name = invite.inviter.name
    message_lines = [
        f"{inviter_name} invited you to join their Balance Studio circle.",
        '',
        "Log in or sign up to respond to the invite.",
        target_url,
    ]
    try:
        send_mail(
            subject=f"{inviter_name} sent you a Balance Studio invite",
            message='\n'.join(message_lines),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invite.invitee_email],
            fail_silently=False,
        )
    except smtplib.SMTPException as exc:
        logger.exception("Failed to send friend invite email to %s", invite.invitee_email)
        raise InviteDeliveryError("Could not send invite email right now.") from exc


def record_notification(target: User, actor: User, kind: str, title: str, body: str = '', data: dict | None = None):
    if not target or not actor:
        return None
    if str(target.id) == str(actor.id):
        return None
    notification = Notification(
        user=target,
        actor=actor,
        kind=kind,
        title=title or 'Balance update',
        body=body or '',
        data=data or {},
    )
    notification.save()
    try:
        unread_count = Notification.objects(user=target, is_read=False).count()
    except Exception:
        unread_count = None
    realtime_pubsub.notify_notification_refresh(target, unread_count, event='new')
    return notification


def _round_currency(value) -> float:
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return 0.0


def normalize_group_label(raw: str) -> str:
    return (raw or '').strip() or GROUP_FALLBACK_LABEL


def slugify_group_label(raw: str) -> str:
    label = normalize_group_label(raw).lower()
    slug = re.sub(r'[^a-z0-9]+', '-', label).strip('-')
    return slug or 'general'


def _settlement_delta_for_user(record: FriendSettlement, user: User) -> float:
    if not record or not user:
        return 0.0
    direction_sign = 1 if record.direction == 'owes_you' else -1
    signed_amount = direction_sign * _round_currency(record.amount)
    is_initiator = str(record.initiator.id) == str(user.id)
    return -signed_amount if is_initiator else signed_amount


def apply_balance_change(user: User, friend: User, delta: float, group_label: str) -> None:
    if not user or not friend or user.id == friend.id:
        return
    amount = _round_currency(delta)
    if amount == 0:
        return
    Friendship.objects(user=user, friend=friend).update_one(
        set__friend=friend,
        set_on_insert__created_at=_now(),
        set_on_insert__group_balances={},
        set_on_insert__group_labels={},
        set_on_insert__group_snapshot_version=1,
        upsert=True,
    )
    friendship = Friendship.objects(user=user, friend=friend).first()
    friendship = _hydrate_group_balances(friendship)
    if not friendship:
        return
    slug = slugify_group_label(group_label)
    label_value = normalize_group_label(group_label)
    update_ops = {
        'inc__balance': amount,
        f"inc__group_balances__{slug}": amount,
        f"set__group_labels__{slug}": label_value,
    }
    Friendship.objects(id=friendship.id).update_one(**update_ops)


def compute_group_snapshot(user: User, friend: User):
    if not user or not friend:
        return {}, {}
    lookup = Expense.objects(
        Q(payer=user, participants__user=friend) | Q(payer=friend, participants__user=user)
    )
    balances = {}
    labels = {}
    user_id = str(user.id)
    friend_id = str(friend.id)
    for expense in lookup:
        group_label = normalize_group_label(expense.group_name or expense.note)
        slug = slugify_group_label(group_label)
        delta = 0.0
        payer_id = str(expense.payer.id)
        if payer_id == user_id:
            for part in expense.participants:
                if str(part.user.id) == friend_id:
                    delta += _round_currency(part.amount)
        elif payer_id == friend_id:
            for part in expense.participants:
                if str(part.user.id) == user_id:
                    delta -= _round_currency(part.amount)
        if delta:
            balances[slug] = _round_currency(balances.get(slug, 0) + delta)
            labels[slug] = group_label
    return balances, labels


def apply_settlement_offsets(user: User, friend: User, balances: dict, labels: dict) -> None:
    settlements = FriendSettlement.objects(
        Q(initiator=user, counterparty=friend) | Q(initiator=friend, counterparty=user)
    )
    for record in settlements:
        slug = record.group_slug or slugify_group_label(record.group_label)
        delta = _settlement_delta_for_user(record, user)
        if not delta:
            continue
        balances[slug] = _round_currency(balances.get(slug, 0.0) + delta)
        if slug not in labels and record.group_label:
            labels[slug] = normalize_group_label(record.group_label)


def _hydrate_group_balances(friendship: Friendship) -> Friendship:
    if not friendship:
        return None
    snapshot_version = getattr(friendship, 'group_snapshot_version', 0)
    if snapshot_version >= 1 and friendship.group_balances is not None:
        return friendship
    # If balances already exist but version flag never flipped, trust the stored values.
    if friendship.group_balances:
        Friendship.objects(id=friendship.id).update(set__group_snapshot_version=1)
        friendship.reload()
        return friendship
    balances, labels = compute_group_snapshot(friendship.user, friendship.friend)
    apply_settlement_offsets(friendship.user, friendship.friend, balances, labels)
    total = _round_currency(sum(balances.values())) if balances else 0.0
    update_payload = {
        'set__group_balances': balances or {},
        'set__group_labels': labels or {},
        'set__group_snapshot_version': 1,
    }
    if balances:
        update_payload['set__balance'] = total
    Friendship.objects(id=friendship.id).update(**update_payload)
    friendship.reload()
    return friendship


def build_friend_breakdown(user: User, friend: User) -> dict:
    friendship = Friendship.objects(user=user, friend=friend).first()
    if not friendship:
        raise SettlementError("Friend relationship not found.")
    friendship = _hydrate_group_balances(friendship)
    groups = []
    you_owe = 0.0
    owes_you = 0.0
    for slug, amount in (friendship.group_balances or {}).items():
        if abs(amount) < 0.01:
            continue
        label = friendship.group_labels.get(slug, slug.replace('-', ' ').title())
        direction = 'owes_you' if amount > 0 else 'you_owe'
        absolute = _round_currency(abs(amount))
        groups.append({
            "slug": slug,
            "label": label,
            "direction": direction,
            "amount": absolute,
        })
        if direction == 'owes_you':
            owes_you += absolute
        else:
            you_owe += absolute
    groups.sort(key=lambda entry: entry['amount'], reverse=True)
    payload = {
        "groups": groups,
        "totals": {
            "you_owe": _round_currency(you_owe),
            "owes_you": _round_currency(owes_you),
        },
        "balance": _round_currency(friendship.balance),
    }
    # Keep the counterparty view aligned with the hydrated snapshot the user just loaded.
    sync_friendship_views(user, friend)
    return payload


def prune_group_entries(user: User, friend: User, slugs=None) -> None:
    friendship = Friendship.objects(user=user, friend=friend).first()
    if not friendship or not friendship.group_balances:
        return
    targets = set(slugs or friendship.group_balances.keys())
    modified = False
    for slug in list(friendship.group_balances.keys()):
        if slug not in targets:
            continue
        if abs(friendship.group_balances.get(slug, 0)) < 0.01:
            friendship.group_balances.pop(slug, None)
            friendship.group_labels.pop(slug, None)
            modified = True
    if modified:
        friendship.save()


def sync_friendship_views(user: User, friend: User) -> None:
    """Force the counterparty view to mirror the canonical user's balances."""
    if not user or not friend or user.id == friend.id:
        return
    ensure_friendship(user, friend)
    source = Friendship.objects(user=user, friend=friend).first()
    target = Friendship.objects(user=friend, friend=user).first()
    if not source or not target:
        return
    source = _hydrate_group_balances(source)
    mirrored = {}
    for slug, amount in (source.group_balances or {}).items():
        rounded = _round_currency(-amount)
        if abs(rounded) < 0.01:
            continue
        mirrored[slug] = rounded
    Friendship.objects(id=target.id).update(
        set__group_balances=mirrored,
        set__group_labels=source.group_labels or {},
        set__balance=_round_currency(-(source.balance or 0.0)),
        set__group_snapshot_version=max(
            getattr(target, 'group_snapshot_version', 0),
            getattr(source, 'group_snapshot_version', 0),
            1,
        ),
    )


def send_settlement_email(record: FriendSettlement) -> bool:
    amount = record.amount
    initiator = record.initiator
    target_email = record.counterparty.email
    message_lines = [
        f"{initiator.name} marked ${amount:.2f} settled in {record.group_label}.",
        '',
        "Open Balance Studio to review the updated totals.",
    ]
    try:
        send_mail(
            subject=f"${amount:.2f} settled with {initiator.name}",
            message='\n'.join(message_lines),
            from_email=SETTLEMENT_FROM_EMAIL,
            recipient_list=[target_email],
            fail_silently=False,
        )
        return True
    except smtplib.SMTPException:
        logger.exception("Failed to send settlement email to %s", target_email)
        return False


def apply_group_settlement(user: User, friend: User, group_slug: str, amount: float = None) -> FriendSettlement:
    friendship = Friendship.objects(user=user, friend=friend).first()
    if not friendship:
        raise SettlementError("Friend relationship not found.")
    friendship = _hydrate_group_balances(friendship)
    group_amount = (friendship.group_balances or {}).get(group_slug)
    if group_amount is None or abs(group_amount) < 0.01:
        raise SettlementError("Nothing left to settle for this group.")
    label = friendship.group_labels.get(group_slug, group_slug)
    direction = 'owes_you' if group_amount > 0 else 'you_owe'
    max_amount = _round_currency(abs(group_amount))
    requested = max_amount if amount is None else _round_currency(amount)
    if requested <= 0:
        raise SettlementError("Settlement amount must be greater than zero.")
    if requested - max_amount > 0.01:
        raise SettlementError("Cannot settle more than the outstanding amount.")
    delta = -requested if direction == 'owes_you' else requested
    apply_balance_change(user, friend, delta, label)
    apply_balance_change(friend, user, -delta, label)
    record = FriendSettlement(
        initiator=user,
        counterparty=friend,
        group_slug=group_slug,
        group_label=label,
        direction=direction,
        amount=requested,
    )
    record.save()
    email_sent = send_settlement_email(record)
    prune_group_entries(user, friend, [group_slug])
    prune_group_entries(friend, user, [group_slug])
    sync_friendship_views(user, friend)
    record_notification(
        friend,
        user,
        Notification.KIND_SETTLEMENT,
        f"{user.name} settled {label}",
        f"{user.name} marked ${requested:.2f} as settled in {label}.",
        {
            "group": label,
            "amount": requested,
        },
    )
    return record, email_sent


def apply_full_settlement(user: User, friend: User):
    """Settle every outstanding group shared between two friends."""
    friendship = Friendship.objects(user=user, friend=friend).first()
    if not friendship:
        raise SettlementError("Friend relationship not found.")
    friendship = _hydrate_group_balances(friendship)
    outstanding = [
        (slug, amount)
        for slug, amount in (friendship.group_balances or {}).items()
        if abs(amount) >= 0.01
    ]
    if not outstanding:
        raise SettlementError("All shared groups are already settled.")

    settlements = []
    total_amount = 0.0
    for slug, amount in outstanding:
        record, delivered = apply_group_settlement(user, friend, slug, abs(amount))
        settlements.append((record, delivered))
        total_amount += record.amount

    breakdown = build_friend_breakdown(user, friend)
    sync_friendship_views(user, friend)
    return settlements, _round_currency(total_amount), breakdown
