from __future__ import annotations

from decimal import Decimal

from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from finance.models import Category
from finance.models_settings_goals import UserSettings


DEFAULT_CATEGORIES = [
    # income
    ("Зарплата", "income", None),
    ("Стипендия", "income", None),
    ("Фриланс", "income", None),
    ("Подарки", "income", None),
    # expense
    ("Еда", "expense", Decimal("20000.00")),
    ("Жильё", "expense", Decimal("35000.00")),
    ("Транспорт", "expense", Decimal("7000.00")),
    ("Связь", "expense", Decimal("1200.00")),
    ("Развлечения", "expense", Decimal("8000.00")),
]


@receiver(post_save, sender=User)
def ensure_user_settings_and_defaults(sender, instance: User, created: bool, **kwargs):
    """
    Гарантирует, что:
    - каждый пользователь имеет свои уникальные настройки (UserSettings OneToOne)
    - при регистрации создаются стартовые категории (для удобства использования)
    """
    if not created:
        return

    UserSettings.objects.get_or_create(user=instance)

    for name, typ, limit in DEFAULT_CATEGORIES:
        obj, _ = Category.objects.get_or_create(
            user=instance,
            name=name,
            defaults={"type": typ, "limit": limit},
        )
        # Если категория существовала (например, при повторном импорте) — нормализуем поля
        if obj.type != typ or obj.limit != limit:
            obj.type = typ
            obj.limit = limit
            obj.save(update_fields=["type", "limit"])



