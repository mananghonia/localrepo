from rest_framework import serializers
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, FriendInvite, Friendship
from . import services


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    username = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True, min_length=8)
    otp_code = serializers.CharField(write_only=True, min_length=6, max_length=6)

    def validate_email(self, value):
        normalized = value.lower()
        if User.objects(email=normalized).first():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized

    def validate_username(self, value):
        normalized = value.strip().lower()
        if not normalized:
            raise serializers.ValidationError("Username cannot be empty.")
        if User.objects(username=normalized).first():
            raise serializers.ValidationError("This username is already taken.")
        return normalized

    def validate(self, attrs):
        otp_valid = services.verify_signup_otp(attrs['email'], attrs['otp_code'])
        if not otp_valid:
            raise serializers.ValidationError({"otp_code": "Invalid or expired verification code."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('otp_code', None)
        user = User(
            email=validated_data["email"],
            username=validated_data["username"],
            name=validated_data["name"],
        )
        user.set_password(validated_data["password"])
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)


class OTPRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    name = serializers.CharField(max_length=255, allow_blank=True, required=False)

    def validate_email(self, value):
        normalized = value.lower()
        if User.objects(email=normalized).first():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized


class FriendInviteCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    note = serializers.CharField(max_length=255, allow_blank=True, required=False)

    def validate_email(self, value):
        normalized = value.strip().lower()
        request_user = self.context.get('request_user')
        if not request_user:
            return normalized
        if normalized == request_user.email:
            raise serializers.ValidationError("You cannot invite yourself.")

        existing_user = User.objects(email=normalized).first()
        if existing_user and Friendship.objects(user=request_user, friend=existing_user).first():
            raise serializers.ValidationError("You are already friends with this user.")

        pending_outgoing = FriendInvite.objects(
            inviter=request_user,
            invitee_email=normalized,
            status=FriendInvite.STATUS_PENDING,
        ).first()
        if pending_outgoing:
            raise serializers.ValidationError("You already sent an invite to this email.")

        pending_incoming = None
        if existing_user:
            pending_incoming = FriendInvite.objects(
                inviter=existing_user,
                invitee_email=request_user.email,
                status=FriendInvite.STATUS_PENDING,
            ).first()
            if pending_incoming:
                raise serializers.ValidationError(
                    "This person has already invited you. Check notifications."
                )

        self.context['invitee_user'] = existing_user
        return normalized


class MongoTokenRefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    default_error_messages = {
        'no_user': 'Refresh token did not include a user id.',
        'user_not_found': 'The user linked to this token no longer exists.',
    }

    def validate(self, attrs):
        refresh_token = attrs.get('refresh')
        if not refresh_token:
            raise serializers.ValidationError({'refresh': 'This field is required.'})

        try:
            refresh = RefreshToken(refresh_token)
        except TokenError as exc:
            raise serializers.ValidationError({'refresh': str(exc)}) from exc

        user_id = refresh.payload.get('user_id') or refresh.payload.get('user')
        if not user_id:
            self.fail('no_user')

        user = User.objects(id=str(user_id)).first()
        if not user:
            self.fail('user_not_found')

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
