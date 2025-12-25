from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction as db_transaction

from finance.models import Category, Transaction


@dataclass(frozen=True)
class CatDef:
    name: str
    type: str  # "income" | "expense"
    limit: Decimal | None = None


INCOME_CATS = [
    CatDef("Зарплата", "income"),
    CatDef("Стипендия", "income"),
    CatDef("Фриланс", "income"),
    CatDef("Подарки", "income"),
]

EXPENSE_CATS = [
    CatDef("Еда", "expense", Decimal("20000")),
    CatDef("Жильё", "expense", Decimal("35000")),
    CatDef("Транспорт", "expense", Decimal("7000")),
    CatDef("Связь", "expense", Decimal("1200")),
    CatDef("Развлечения", "expense", Decimal("8000")),
    CatDef("Здоровье", "expense", Decimal("5000")),
    CatDef("Покупки", "expense", Decimal("15000")),
]


def money(v: float) -> Decimal:
    return Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class Command(BaseCommand):
    help = "Seed demo categories and transactions for a user (no external libs)."

    def add_arguments(self, parser):
        parser.add_argument("--username", type=str, default="admin")
        parser.add_argument("--months", type=int, default=6)
        parser.add_argument("--tx-per-month", type=int, default=60)
        parser.add_argument("--clear", action="store_true", help="Clear existing user data first")
        parser.add_argument("--seed", type=int, default=42)

    def handle(self, *args, **options):
        username: str = options["username"]
        months: int = int(options["months"])
        tx_per_month: int = int(options["tx_per_month"])
        clear: bool = bool(options["clear"])
        seed: int = int(options["seed"])

        if months <= 0 or tx_per_month <= 0:
            raise CommandError("--months and --tx-per-month must be > 0")

        random.seed(seed)

        user = User.objects.filter(username=username).first()
        if not user:
            raise CommandError(f"User '{username}' not found. Create it first.")

        with db_transaction.atomic():
            if clear:
                Transaction.objects.filter(user=user).delete()
                Category.objects.filter(user=user).delete()

            # Ensure categories exist
            income_cats = []
            for c in INCOME_CATS:
                obj, _ = Category.objects.get_or_create(
                    user=user, name=c.name, defaults={"type": c.type, "limit": None}
                )
                # In case it existed with different type, normalize
                if obj.type != "income":
                    obj.type = "income"
                    obj.limit = None
                    obj.save(update_fields=["type", "limit"])
                income_cats.append(obj)

            expense_cats = []
            for c in EXPENSE_CATS:
                obj, _ = Category.objects.get_or_create(
                    user=user,
                    name=c.name,
                    defaults={"type": c.type, "limit": c.limit},
                )
                if obj.type != "expense":
                    obj.type = "expense"
                obj.limit = c.limit
                obj.save(update_fields=["type", "limit"])
                expense_cats.append(obj)

            # Generate transactions across last N months, including current month
            today = date.today()
            first_month = date(today.year, today.month, 1)
            month_starts: list[date] = []
            y, m = first_month.year, first_month.month
            for i in range(months):
                mm = m - i
                yy = y
                while mm <= 0:
                    mm += 12
                    yy -= 1
                month_starts.append(date(yy, mm, 1))

            created = 0
            for ms in month_starts:
                # month end (exclusive)
                if ms.month == 12:
                    me = date(ms.year + 1, 1, 1)
                else:
                    me = date(ms.year, ms.month + 1, 1)

                days = (me - ms).days
                # Distribute tx through the month
                for _ in range(tx_per_month):
                    d = ms + timedelta(days=random.randint(0, max(0, days - 1)))

                    # Decide income vs expense (roughly 25% income)
                    is_income = random.random() < 0.25

                    if is_income:
                        cat = random.choice(income_cats)
                        # Salaries higher, gifts smaller, etc.
                        base = {
                            "Зарплата": random.uniform(60000, 140000),
                            "Стипендия": random.uniform(3000, 12000),
                            "Фриланс": random.uniform(5000, 45000),
                            "Подарки": random.uniform(500, 8000),
                        }.get(cat.name, random.uniform(3000, 30000))
                        amt = money(base)
                        is_reserved = random.random() < 0.12
                        comment = random.choice(
                            [
                                "",
                                "перевод",
                                "премия",
                                "подработка",
                                "бонус",
                            ]
                        )
                    else:
                        cat = random.choice(expense_cats)
                        base = {
                            "Еда": random.uniform(250, 2500),
                            "Жильё": random.uniform(15000, 45000),
                            "Транспорт": random.uniform(80, 1200),
                            "Связь": random.uniform(300, 1200),
                            "Развлечения": random.uniform(200, 5000),
                            "Здоровье": random.uniform(200, 6000),
                            "Покупки": random.uniform(300, 15000),
                        }.get(cat.name, random.uniform(100, 5000))
                        amt = money(base)
                        is_reserved = False
                        comment = random.choice(
                            [
                                "",
                                "карта",
                                "наличные",
                                "онлайн",
                                "скидка",
                            ]
                        )

                    Transaction.objects.create(
                        user=user,
                        category=cat,
                        amount=amt,
                        date=d,
                        is_income=is_income,
                        is_reserved=is_reserved,
                        comment=comment,
                    )
                    created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded for user={username}: categories={len(INCOME_CATS)+len(EXPENSE_CATS)}, transactions_created={created}"
            )
        )



