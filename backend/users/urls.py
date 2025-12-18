from django.urls import path
from .views import (
    SignupView,
    LoginView,
    GoogleAuthView,
    OTPRequestView,
    FriendListView,
    FriendInviteListView,
    FriendInviteCreateView,
    FriendInviteDecisionView,
    FriendBreakdownView,
    FriendSettlementView,
    FriendFullSettlementView,
    MongoTokenRefreshView,
)

urlpatterns = [
    path('signup/', SignupView.as_view()),
    path('login/', LoginView.as_view()),
    path('token/refresh/', MongoTokenRefreshView.as_view(), name='token_refresh'),
    path('google/', GoogleAuthView.as_view()),
    path('request-otp/', OTPRequestView.as_view()),
    path('friends/', FriendListView.as_view()),
    path('friends/<str:friend_id>/ledger/', FriendBreakdownView.as_view()),
    path('friends/<str:friend_id>/settlements/', FriendSettlementView.as_view()),
    path('friends/<str:friend_id>/settlements/all/', FriendFullSettlementView.as_view()),
    path('friends/invite/', FriendInviteCreateView.as_view()),
    path('friends/invites/', FriendInviteListView.as_view()),
    path('friends/invites/<str:invite_id>/<str:action>/', FriendInviteDecisionView.as_view()),
]
