from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from django.db.models import Q, Sum
from django.db import transaction as db_transaction
from django.db.models import F
from rest_framework import status
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action

from finance.models import Category, Transaction
from finance.models_settings_goals import Goal, UserSettings
from finance.serializers import (
    CategorySerializer,
    TransactionSerializer,
    GoalSerializer,
    UserSettingsSerializer,
)

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework.exceptions import ValidationError
from decimal import Decimal, InvalidOperation


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user).order_by("type", "name")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            Transaction.objects.filter(user=self.request.user)
            .select_related("category")
            .order_by("-date", "-created_at")
        )
        month = self.request.query_params.get("month")
        if month:
            start_day = self.request.query_params.get("start_day")
            if start_day:
                r = period_to_range(month, int(start_day))
            else:
                r = month_to_range(month)
            qs = qs.filter(date__gte=r.start, date__lt=r.end)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


@dataclass(frozen=True)
class MonthRange:
    start: date
    end: date


def month_to_range(month: str) -> MonthRange:
    """
    month: 'YYYY-MM'
    """
    year_s, month_s = month.split("-", 1)
    y = int(year_s)
    m = int(month_s)
    start = date(y, m, 1)
    if m == 12:
        end = date(y + 1, 1, 1)
    else:
        end = date(y, m + 1, 1)
    # end exclusive -> convert to inclusive by subtracting one day at query time if needed,
    # but we use < end with range filters elsewhere. Here return [start, end).
    return MonthRange(start=start, end=end)


def clamp_day(year: int, month: int, day: int) -> int:
    """Clamp start-day to existing day in month (e.g. 31 -> 30/28)."""
    from calendar import monthrange

    last = monthrange(year, month)[1]
    return max(1, min(last, day))


def period_to_range(month: str, start_day: int) -> MonthRange:
    """
    Budget period range for selected month with custom start_day.
    Example: month=2025-12, start_day=10 -> [2025-12-10, 2026-01-10)
    """
    year_s, month_s = month.split("-", 1)
    y = int(year_s)
    m = int(month_s)
    sd = clamp_day(y, m, int(start_day))
    start = date(y, m, sd)

    if m == 12:
        ny, nm = y + 1, 1
    else:
        ny, nm = y, m + 1
    ed = clamp_day(ny, nm, int(start_day))
    end = date(ny, nm, ed)
    return MonthRange(start=start, end=end)


class SummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        month = request.query_params.get("month")  # YYYY-MM
        qs = Transaction.objects.filter(user=request.user)
        start_day = request.query_params.get("start_day")

        if month:
            if start_day:
                r = period_to_range(month, int(start_day))
            else:
                r = month_to_range(month)
            qs = qs.filter(date__gte=r.start, date__lt=r.end)

        # Доходы: обычные доходы считаем целиком, доходы-резервы учитываем только долей текущего месяца
        reserved_roots = qs.filter(is_income=True, is_reserved=True, reserve_parent__isnull=True)
        reserved_future_total = 0
        reserved_available_total = 0
        for tx in reserved_roots:
            months = int(tx.reserve_months or 1)
            if months <= 0:
                months = 1
            per = tx.amount / months
            reserved_available_total += per
            reserved_future_total += (tx.amount - per)

        non_reserved_income_total = (
            qs.filter(is_income=True)
            .exclude(is_reserved=True, reserve_parent__isnull=True)
            .aggregate(total=Sum("amount"))
            .get("total")
            or 0
        )
        income_total = non_reserved_income_total + reserved_available_total
        expense_total = (
            qs.filter(is_income=False).aggregate(total=Sum("amount")).get("total") or 0
        )
        balance = income_total - expense_total

        income_by_category_qs = (
            qs.filter(is_income=True)
            .values("category__name")
            .annotate(total=Sum("amount"))
            .order_by("-total")
        )
        income_by_category = {
            row["category__name"]: float(row["total"]) for row in income_by_category_qs
        }

        expenses_by_category_qs = (
            qs.filter(is_income=False)
            .values("category__name")
            .annotate(total=Sum("amount"))
            .order_by("-total")
        )
        expenses_by_category = {
            row["category__name"]: float(row["total"]) for row in expenses_by_category_qs
        }

        # Баланс по дням: поле `date` уже DateField, поэтому на SQLite безопаснее группировать
        # напрямую по нему (без TruncDate, который может упираться в sqlite UDF).
        daily_rows = (
            qs.values("date")
            .annotate(
                income=Sum("amount", filter=Q(is_income=True)),
                expense=Sum("amount", filter=Q(is_income=False)),
            )
            .order_by("date")
        )

        running = 0
        daily_balance: dict[str, float] = {}
        for row in daily_rows:
            inc = row["income"] or 0
            exp = row["expense"] or 0
            running += inc - exp
            daily_balance[row["date"].isoformat()] = float(running)

        return Response(
            {
                "balance": float(balance),
                "income_total": float(income_total),
                "expense_total": float(expense_total),
                "income_by_category": income_by_category,
                "expenses_by_category": expenses_by_category,
                "daily_balance": daily_balance,
                "reserved_future_total": float(reserved_future_total),
            }
        )


class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = GoalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Goal.objects.filter(user=self.request.user).order_by("due_date", "-created_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def deposit(self, request, pk=None):
        """
        Пополнить цель на сумму amount (дельта).
        Делается атомарно, чтобы не потерять обновления при параллельных запросах.
        """
        raw = request.data.get("amount")
        if raw is None:
            raise ValidationError({"amount": "Укажите сумму пополнения."})
        try:
            amount = Decimal(str(raw))
        except (InvalidOperation, ValueError):
            raise ValidationError({"amount": "Некорректная сумма."})
        if amount <= 0:
            raise ValidationError({"amount": "Сумма должна быть больше 0."})

        with db_transaction.atomic():
            updated = (
                Goal.objects.filter(id=pk, user=request.user)
                .update(saved_amount=F("saved_amount") + amount)
            )
            if updated != 1:
                return Response({"detail": "Цель не найдена."}, status=status.HTTP_404_NOT_FOUND)

        goal = Goal.objects.get(id=pk, user=request.user)
        return Response(GoalSerializer(goal).data)


class SettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings, _ = UserSettings.objects.get_or_create(user=request.user)
        return Response(UserSettingsSerializer(settings).data)

    def put(self, request):
        settings, _ = UserSettings.objects.get_or_create(user=request.user)
        ser = UserSettingsSerializer(settings, data=request.data, partial=False)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def patch(self, request):
        settings, _ = UserSettings.objects.get_or_create(user=request.user)
        ser = UserSettingsSerializer(settings, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class RegisterView(APIView):
    """
    Регистрация для фронта: username=email, сохраняем email и first_name.
    """

    permission_classes = []

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        password2 = request.data.get("password2") or ""

        if not email or "@" not in email:
            raise ValidationError({"email": "Введите корректный email."})
        if not password:
            raise ValidationError({"password": "Введите пароль."})
        if password != password2:
            raise ValidationError({"password2": "Пароли не совпадают."})
        if User.objects.filter(username=email).exists():
            raise ValidationError({"email": "Пользователь с таким email уже существует."})

        validate_password(password)

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=name,
        )
        # UserSettings и дефолтные категории создадутся сигналом post_save(User).
        return Response({"id": user.id, "email": user.email, "name": user.first_name})


class ForgotPasswordView(APIView):
    """
    Заглушка "Забыли пароль?" для прототипа.
    """

    permission_classes = []

    def post(self, request):
        # In production: send reset link to email.
        return Response({"detail": "Если аккаунт существует, письмо для восстановления будет отправлено."})


class ResetTransactionsView(APIView):
    """Удаляет все операции текущего пользователя."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        month = request.query_params.get("month")  # optional YYYY-MM
        start_day = request.query_params.get("start_day")

        qs = Transaction.objects.filter(user=request.user)
        if month:
            if start_day:
                r = period_to_range(month, int(start_day))
            else:
                r = month_to_range(month)
            qs = qs.filter(date__gte=r.start, date__lt=r.end)

        with db_transaction.atomic():
            tx_deleted, _ = qs.delete()
        return Response({"deleted_transactions": tx_deleted, "month": month})


class ResetCategoriesView(APIView):
    """
    Удаляет все категории текущего пользователя.
    Если есть операции, удаление категорий будет запрещено из-за PROTECT.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if Transaction.objects.filter(user=request.user).exists():
            return Response(
                {
                    "detail": "Нельзя удалить категории, пока существуют операции. Сначала очистите операции."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        with db_transaction.atomic():
            cat_deleted, _ = Category.objects.filter(user=request.user).delete()
        return Response({"deleted_categories": cat_deleted})


