from django.urls import path

from .views import ExpenseListCreateView, ActivityFeedView

urlpatterns = [
    path('expenses/', ExpenseListCreateView.as_view()),
    path('activity/', ActivityFeedView.as_view()),
]
