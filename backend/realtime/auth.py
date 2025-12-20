from __future__ import annotations

from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from django.contrib.auth.models import AnonymousUser

from rest_framework_simplejwt.exceptions import AuthenticationFailed

from users.authentication import MongoEngineJWTAuthentication


class JWTAuthMiddleware:
    """Authenticate WebSocket connections using the same JWT tokens as the REST API."""

    def __init__(self, inner):
        self.inner = inner
        self.auth_backend = MongoEngineJWTAuthentication()

    async def __call__(self, scope, receive, send):
        scope['user'] = AnonymousUser()
        token = self._extract_token(scope)
        if token:
            user = await sync_to_async(self._authenticate_token, thread_sensitive=True)(token)
            if user is not None:
                scope['user'] = user
        return await self.inner(scope, receive, send)

    def _extract_token(self, scope) -> str | None:
        query_string = scope.get('query_string', b'')
        params = parse_qs(query_string.decode()) if query_string else {}
        token = params.get('token', [None])[0]
        if token:
            return token
        headers = {key.lower(): value for key, value in (scope.get('headers') or [])}
        auth_header = headers.get(b'authorization')
        if not auth_header:
            return None
        try:
            scheme, raw_token = auth_header.split(b' ', 1)
        except ValueError:
            return None
        if scheme.lower() != b'bearer':
            return None
        return raw_token.decode()

    def _authenticate_token(self, token: str):
        try:
            validated = self.auth_backend.get_validated_token(token)
            return self.auth_backend.get_user(validated)
        except AuthenticationFailed:
            return None
        except Exception:
            return None
