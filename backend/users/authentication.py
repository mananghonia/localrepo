from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from .models import User


class MongoEngineJWTAuthentication(JWTAuthentication):
    """JWT auth class that loads users from MongoEngine instead of Django ORM."""

    def get_user(self, validated_token):
        user_id = validated_token.get('user_id') or validated_token.get('user')
        if not user_id:
            raise AuthenticationFailed('Token contained no user identification', code='user_not_found')

        user = User.objects(id=str(user_id)).first()
        if not user:
            raise AuthenticationFailed('User not found', code='user_not_found')
        return user
