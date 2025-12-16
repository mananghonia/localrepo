from datetime import datetime, timedelta
import logging
import smtplib

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.utils.crypto import get_random_string

from .models import EmailOTP, User


OTP_ALLOWED_CHARS = '0123456789'
logger = logging.getLogger(__name__)


class OTPDeliveryError(Exception):
    """Raised when the OTP email cannot be delivered."""
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
