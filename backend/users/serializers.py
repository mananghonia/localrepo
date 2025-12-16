from rest_framework import serializers

from .models import User
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
