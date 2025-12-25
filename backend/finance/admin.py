from django.contrib import admin

from finance.models import Category, Transaction
from finance.models_settings_goals import Goal, UserSettings


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "name", "type", "limit")
    list_filter = ("type",)
    search_fields = ("name", "user__username")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "date",
        "category",
        "amount",
        "is_income",
        "is_reserved",
        "created_at",
    )
    list_filter = ("is_income", "is_reserved", "date")
    search_fields = ("comment", "category__name", "user__username")


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "name", "target_amount", "saved_amount", "due_date", "created_at")
    search_fields = ("name", "user__username")
    list_filter = ("due_date",)


@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "theme", "period_start_day", "notify_limit_exceeded", "notify_monthly_email", "updated_at")
    search_fields = ("user__username",)


