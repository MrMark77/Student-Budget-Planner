from django.apps import AppConfig


class FinanceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "finance"

    def ready(self):
        # Подключаем сигналы (создание UserSettings и дефолтных категорий при регистрации)
        from . import signals  # noqa: F401


