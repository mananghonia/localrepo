from django.conf import settings
from django.utils.crypto import get_random_string
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenViewBase
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from .models import User, FriendInvite, Friendship
from .serializers import (
    SignupSerializer,
    LoginSerializer,
    OTPRequestSerializer,
    FriendInviteCreateSerializer,
    MongoTokenRefreshSerializer,
)
from . import services


def serialize_user(user):
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "username": getattr(user, 'username', ''),
    }


def serialize_friendship_entry(entry):
    friend = entry.friend
    return {
        "id": str(friend.id),
        "name": friend.name,
        "email": friend.email,
        "username": getattr(friend, 'username', ''),
        "balance": entry.balance,
        "since": entry.created_at.isoformat() if entry.created_at else None,
    }


def serialize_invite(invite):
    return {
        "id": str(invite.id),
        "status": invite.status,
        "note": invite.note or '',
        "created_at": invite.created_at.isoformat() if invite.created_at else None,
        "inviter": serialize_user(invite.inviter),
        "invitee_email": invite.invitee_email,
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


class FriendListView(APIView):
    def get(self, request):
        user = request.user
        services.attach_pending_invites_to_user(user)
        friendships = Friendship.objects(user=user).order_by('friend__name')
        results = [serialize_friendship_entry(entry) for entry in friendships]
        you_owe = sum(abs(entry.balance) for entry in friendships if entry.balance < 0)
        owes_you = sum(entry.balance for entry in friendships if entry.balance > 0)
        return Response({
            "friends": results,
            "totals": {
                "you_owe": round(you_owe, 2),
                "owes_you": round(owes_you, 2),
            },
        })


class FriendInviteListView(APIView):
    def get(self, request):
        user = request.user
        services.attach_pending_invites_to_user(user)
        invites = FriendInvite.objects(
            status=FriendInvite.STATUS_PENDING,
            invitee_user=user,
        ).order_by('-created_at')
        serialized = [serialize_invite(invite) for invite in invites]
        return Response({
            "count": len(serialized),
            "results": serialized,
        })


class FriendInviteCreateView(APIView):
    def post(self, request):
        serializer = FriendInviteCreateSerializer(data=request.data, context={'request_user': request.user})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        invite = FriendInvite(
            inviter=request.user,
            invitee_email=serializer.validated_data['email'],
            invitee_user=serializer.context.get('invitee_user'),
            note=serializer.validated_data.get('note') or '',
        )
        invite.save()

        try:
            services.send_friend_invite_email(invite)
        except services.InviteDeliveryError as exc:
            invite.delete()
            return Response({"error": str(exc)}, status=500)

        return Response(serialize_invite(invite), status=201)


class FriendInviteDecisionView(APIView):
    action = None

    def post(self, request, invite_id, action):
        if action not in {'accept', 'reject'}:
            return Response({"error": "Unsupported action"}, status=400)

        invite = FriendInvite.objects(id=invite_id).first()
        if not invite or invite.status != FriendInvite.STATUS_PENDING:
            return Response({"error": "Invite not found"}, status=404)

        services.attach_pending_invites_to_user(request.user)
        invite.reload()

        target_user = invite.invitee_user or (User.objects(email=invite.invitee_email).first())
        if not target_user or str(target_user.id) != str(request.user.id):
            return Response({"error": "You cannot act on this invite"}, status=403)

        invite.invitee_user = request.user

        if action == 'accept':
            invite.mark_status(FriendInvite.STATUS_ACCEPTED)
            services.ensure_friendship(invite.inviter, request.user)
            friendship = Friendship.objects(user=request.user, friend=invite.inviter).first()
            payload = {
                "invite": serialize_invite(invite),
                "friend": serialize_friendship_entry(friendship) if friendship else None,
            }
            return Response(payload, status=200)

        invite.mark_status(FriendInvite.STATUS_REJECTED)
        return Response({"invite": serialize_invite(invite)}, status=200)


class MongoTokenRefreshView(TokenViewBase):
    serializer_class = MongoTokenRefreshSerializer
