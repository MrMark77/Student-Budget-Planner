from __future__ import annotations

from django.contrib.auth.models import User
from django.db import models

from finance.models_settings_goals import Goal, UserSettings  # noqa: F401


def distribute_to_future(tx: "Transaction") -> None:
    """
    Реализация распределения дохода на будущие месяцы (резерв).

    Правило прототипа:
    - В БД сохраняется исходная транзакция-доход на полную сумму (amount), is_reserved=True
    - Дополнительно создаются "виртуальные" доходы на следующие месяцы
      (amount / reserve_months) с соответствующими датами.
    - В текущем месяце в отчётах учитывается только доля (amount/reserve_months),
      а оставшаяся часть считается "зарезервированной на будущее".
    """

    from decimal import Decimal, ROUND_HALF_UP

    if tx.reserve_parent_id is not None:
        return
    months = int(tx.reserve_months or 1)
    if months <= 1:
        return

    # Не создаём дубликаты при повторных сохранениях
    if tx.reserve_children.exists():
        return

    total = tx.amount
    per = (total / Decimal(months)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    # Ремайндер распределяем по первым месяцам (+0.01), чтобы сумма сошлась
    remainder = total - (per * Decimal(months))
    cents = int((remainder * 100).to_integral_value(rounding=ROUND_HALF_UP))

    def add_months(d, n: int):
        y = d.year
        m = d.month + n
        while m > 12:
            m -= 12
            y += 1
        # clamp day for month
        from calendar import monthrange

        day = min(d.day, monthrange(y, m)[1])
        return d.__class__(y, m, day)

    # Создаем будущие транзакции (со 2-го месяца распределения)
    children = []
    for i in range(1, months):
        amt = per
        if cents > 0:
            amt = (amt + Decimal("0.01")).quantize(Decimal("0.01"))
            cents -= 1

        children.append(
            Transaction(
                user=tx.user,
                category=tx.category,
                amount=amt,
                date=add_months(tx.date, i),
                is_income=True,
                is_reserved=False,
                reserve_months=None,
                reserve_parent=tx,
                comment=(tx.comment or "") + " (резерв)",
            )
        )
    Transaction.objects.bulk_create(children)


class Category(models.Model):
    CATEGORY_TYPES = [
        ("income", "Доход"),
        ("expense", "Расход"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=7, choices=CATEGORY_TYPES)
    limit = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )  # лимит бюджета (для расходов)

    def __str__(self) -> str:
        return f"{self.name} ({'доход' if self.type == 'income' else 'расход'})"


class Transaction(models.Model):
    """Универсальная модель для операций – доходов или расходов."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="transactions")
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField()
    is_income = models.BooleanField()  # True для дохода, False для расхода
    is_reserved = models.BooleanField(
        default=False
    )  # пометка, что доход зарезервирован на будущее
    reserve_months = models.PositiveSmallIntegerField(
        null=True, blank=True
    )  # на сколько месяцев распределить (для дохода)
    reserve_parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        related_name="reserve_children",
        on_delete=models.CASCADE,
    )  # ссылка на исходный доход-резерв (для виртуальных транзакций)
    comment = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Переопределяем сохранение, чтобы автоматически распределять резерв, если нужно
        if self.is_income and self.is_reserved and self.reserve_parent_id is None:
            distribute_to_future(self)  # создает виртуальные транзакции


