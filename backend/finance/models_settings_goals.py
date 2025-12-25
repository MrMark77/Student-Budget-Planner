"""
Дополнительные модели приложения finance:
- Goal: цель накопления
- UserSettings: настройки приложения пользователя

Вынесены в отдельный файл, чтобы оставить models.py близко к описанным пользователем
Category/Transaction, но при этом расширить функционал прототипа.
"""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth.models import User
from django.db import models


class Goal(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="goals")
    name = models.CharField(max_length=200)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    saved_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    due_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.name}: {self.saved_amount}/{self.target_amount}"


class UserSettings(models.Model):
    THEME_CHOICES = [
        ("light", "Light"),
        ("dark", "Dark"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="settings")
    theme = models.CharField(max_length=10, choices=THEME_CHOICES, default="light")
    period_start_day = models.PositiveSmallIntegerField(default=1)  # 1..28/31

    notify_limit_exceeded = models.BooleanField(default=True)
    notify_monthly_email = models.BooleanField(default=False)

    updated_at = models.DateTimeField(auto_now=True)



