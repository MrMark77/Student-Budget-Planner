from __future__ import annotations

from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from finance.views import (
    CategoryViewSet,
    TransactionViewSet,
    SummaryView,
    ResetCategoriesView,
    ResetTransactionsView,
    GoalViewSet,
    SettingsView,
    RegisterView,
    ForgotPasswordView,
)

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="categories")
router.register(r"transactions", TransactionViewSet, basename="transactions")
router.register(r"goals", GoalViewSet, basename="goals")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/summary/", SummaryView.as_view(), name="summary"),
    path("api/settings/", SettingsView.as_view(), name="settings"),
    path("api/reset/transactions/", ResetTransactionsView.as_view(), name="reset_transactions"),
    path("api/reset/categories/", ResetCategoriesView.as_view(), name="reset_categories"),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/forgot/", ForgotPasswordView.as_view(), name="forgot_password"),
]


