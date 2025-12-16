from django.conf import settings
from django.utils.crypto import get_random_string
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from .models import User
from .serializers import SignupSerializer, LoginSerializer, OTPRequestSerializer
from . import services


def serialize_user(user):
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "username": getattr(user, 'username', ''),
    }


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "message": "User registered successfully",
                **self._build_token_payload(user),
            }, status=201)
        return Response(serializer.errors, status=400)

    def _build_token_payload(self, user):
        refresh = RefreshToken.for_user(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": serialize_user(user),
        }


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        identifier = serializer.validated_data['identifier'].strip().lower()
        user = None
        if '@' in identifier:
            user = User.objects(email=identifier).first()
        if user is None:
            user = User.objects(username=identifier).first()

        if not user:
            return Response({"error": "Invalid credentials"}, status=401)

        if not user.check_password(serializer.validated_data['password']):
            return Response({"error": "Invalid credentials"}, status=401)

        refresh = RefreshToken.for_user(user)

        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": serialize_user(user),
        })


class GoogleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("token")
        if not token:
            return Response({"error": "Google ID token is required"}, status=400)

        try:
            id_info = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except ValueError as exc:
            return Response({"error": "Invalid Google token", "details": str(exc)}, status=400)

        email = id_info.get("email")
        if not email:
            return Response({"error": "Google account does not expose an email"}, status=400)

        user = User.objects(email=email.lower()).first()
        if not user:
            return Response({
                "error": "No account found for this Google email. Please sign up first."
            }, status=403)

        refresh = RefreshToken.for_user(user)
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                **serialize_user(user),
                "picture": id_info.get("picture"),
            }
        })


class OTPRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            services.issue_signup_otp(
                email=serializer.validated_data['email'],
                name=serializer.validated_data.get('name', ''),
            )
        except services.OTPDeliveryError as exc:
            return Response({"error": str(exc)}, status=500)
        return Response({"message": "Verification code sent"}, status=200)
