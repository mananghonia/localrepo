from django.urls import path
from .views import SignupView, LoginView, GoogleAuthView, OTPRequestView

urlpatterns = [
    path('signup/', SignupView.as_view()),
    path('login/', LoginView.as_view()),
    path('google/', GoogleAuthView.as_view()),
    path('request-otp/', OTPRequestView.as_view()),
]
