from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def _group_name(user_id) -> str:
    return f"user_{user_id}"


def _resolve_user_id(user) -> str | None:
    if user is None:
        return None
    if isinstance(user, str):
        return user
    return str(getattr(user, 'id', '') or '')


def push_to_user(user, payload: dict) -> bool:
    user_id = _resolve_user_id(user)
    if not user_id or not payload:
        return False
    channel_layer = get_channel_layer()
    if not channel_layer:
        return False
    async_to_sync(channel_layer.group_send)(
        _group_name(user_id),
        {
            'type': 'push.event',
            'payload': payload,
        },
    )
    return True


def notify_notification_refresh(user, unread: int | None = None, event: str = 'refresh') -> None:
    payload = {
        'topic': 'notifications',
        'event': event,
    }
    if unread is not None:
        payload['unread'] = int(unread)
    push_to_user(user, payload)


def notify_invite_refresh(user, count: int | None = None, event: str = 'refresh') -> None:
    payload = {
        'topic': 'invites',
        'event': event,
    }
    if count is not None:
        payload['count'] = int(count)
    push_to_user(user, payload)


def notify_friends_refresh(user, event: str = 'refresh') -> None:
    push_to_user(
        user,
        {
            'topic': 'friends',
            'event': event,
        },
    )


def notify_activity_refresh(user, event: str = 'refresh') -> None:
    push_to_user(
        user,
        {
            'topic': 'activity',
            'event': event,
        },
    )
