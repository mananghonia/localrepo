from django.urls import path

from .views import (
    ActivityFeedView,
    AnalyticsView,
    ExpenseDeleteView,
    ExpenseListCreateView,
    SimplifyDebtsView,
)

urlpatterns = [
    path('expenses/', ExpenseListCreateView.as_view()),
    path('expenses/<str:expense_id>/', ExpenseDeleteView.as_view()),
    path('activity/', ActivityFeedView.as_view()),
    path('analytics/', AnalyticsView.as_view()),
    path('analytics/simplify/', SimplifyDebtsView.as_view()),
]
