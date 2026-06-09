from django.urls import path

from .views import ActivityFeedView, ExpenseDeleteView, ExpenseListCreateView

urlpatterns = [
    path('expenses/', ExpenseListCreateView.as_view()),
    path('expenses/<str:expense_id>/', ExpenseDeleteView.as_view()),
    path('activity/', ActivityFeedView.as_view()),
]
