from __future__ import annotations

from rest_framework import serializers

from finance.models import Category, Transaction
from finance.models_settings_goals import Goal, UserSettings


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "type", "limit")


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = (
            "id",
            "category",
            "amount",
            "date",
            "is_income",
            "is_reserved",
            "reserve_months",
            "reserve_parent",
            "comment",
            "created_at",
        )
        read_only_fields = ("id", "created_at", "reserve_parent")

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        category = attrs.get("category") or getattr(self.instance, "category", None)
        is_income = attrs.get("is_income")
        if is_income is None and self.instance is not None:
            is_income = self.instance.is_income

        if category is None:
            raise serializers.ValidationError({"category": "Категория обязательна."})

        if user is not None and category.user_id != user.id:
            raise serializers.ValidationError(
                {"category": "Категория должна принадлежать текущему пользователю."}
            )

        # Проверяем согласованность: тип категории должен соответствовать is_income
        expected_type = "income" if is_income else "expense"
        if category.type != expected_type:
            raise serializers.ValidationError(
                {
                    "is_income": "Тип операции не соответствует типу выбранной категории.",
                    "category": f"Ожидался тип '{expected_type}'.",
                }
            )

        # Для расходов резерв запрещаем (по текущей модели)
        is_reserved = attrs.get("is_reserved")
        if is_reserved and not is_income:
            raise serializers.ValidationError(
                {"is_reserved": "Резервирование возможно только для доходов."}
            )

        reserve_months = attrs.get("reserve_months")
        if is_income and is_reserved:
            if reserve_months is None:
                raise serializers.ValidationError(
                    {"reserve_months": "Укажите количество месяцев распределения."}
                )
            if int(reserve_months) <= 0:
                raise serializers.ValidationError(
                    {"reserve_months": "Количество месяцев должно быть больше 0."}
                )
        else:
            # если не резерв или не доход — поле должно быть пустым
            if "reserve_months" in attrs:
                attrs["reserve_months"] = None

        return attrs


class GoalSerializer(serializers.ModelSerializer):
    percent = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    months_left = serializers.SerializerMethodField()

    class Meta:
        model = Goal
        fields = (
            "id",
            "name",
            "target_amount",
            "saved_amount",
            "due_date",
            "created_at",
            "percent",
            "remaining_amount",
            "status",
            "months_left",
        )
        read_only_fields = ("id", "created_at", "percent", "remaining_amount", "status", "months_left")

    def get_percent(self, obj: Goal) -> int:
        if obj.target_amount <= 0:
            return 0
        p = int((obj.saved_amount / obj.target_amount) * 100)
        return max(0, min(100, p))

    def get_remaining_amount(self, obj: Goal) -> float:
        rem = obj.target_amount - obj.saved_amount
        if rem < 0:
            rem = 0
        return float(rem)

    def get_status(self, obj: Goal) -> str:
        from datetime import date

        today = date.today()
        if obj.saved_amount >= obj.target_amount:
            return "completed"
        if obj.due_date < today:
            return "expired"
        return "active"

    def get_months_left(self, obj: Goal) -> int:
        from datetime import date
        from math import ceil

        today = date.today()
        if obj.due_date <= today:
            return 0
        days = (obj.due_date - today).days
        return int(ceil(days / 30))


class UserSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSettings
        fields = (
            "theme",
            "period_start_day",
            "notify_limit_exceeded",
            "notify_monthly_email",
        )


