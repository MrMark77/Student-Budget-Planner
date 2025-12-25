import React, { useMemo } from "react";

export interface Category {
  id: number;
  name: string;
  type: "income" | "expense";
  limit: number | null;
}

export interface Transaction {
  id: number;
  category: number;
  amount: number | string;
  date: string;
  is_income: boolean;
}

const money = (v: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2
  }).format(v);

export const LimitAlerts: React.FC<{
  categories: Category[];
  transactions: Transaction[];
  onClose: () => void;
}> = ({ categories, transactions, onClose }) => {
  const alerts = useMemo(() => {
    const expenseCats = categories.filter((c) => c.type === "expense" && c.limit != null);
    const byCat = new Map<number, number>();
    for (const t of transactions) {
      if (t.is_income) continue;
      const amt = typeof t.amount === "number" ? t.amount : Number(t.amount);
      if (!Number.isFinite(amt)) continue;
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + amt);
    }

    const items = expenseCats
      .map((c) => {
        const spent = byCat.get(c.id) ?? 0;
        const limit = c.limit ?? 0;
        const ratio = limit > 0 ? spent / limit : 0;
        return { c, spent, limit, ratio };
      })
      .filter((x) => x.limit > 0 && x.spent > 0 && x.ratio >= 0.8)
      .sort((a, b) => b.ratio - a.ratio);

    return items;
  }, [categories, transactions]);

  if (alerts.length === 0) return null;

  const critical = alerts.filter((a) => a.ratio >= 1);
  const warning = alerts.filter((a) => a.ratio < 1);

  return (
    <div className="mb-3">
      {critical.length > 0 && (
        <div className="alert alert-danger d-flex justify-content-between align-items-start gap-3">
          <div>
            <div className="fw-semibold mb-1">Превышены лимиты — начинай экономить</div>
          {critical.slice(0, 3).map((a) => (
            <div key={a.c.id}>
              Категория «{a.c.name}»: {Math.round(a.ratio * 100)}% · потрачено{" "}
              <strong>{money(a.spent)}</strong> из {money(a.limit)}
            </div>
          ))}
          </div>
          <button
            type="button"
            className="btn-close"
            aria-label="Закрыть уведомление"
            title="Закрыть"
            onClick={onClose}
          />
        </div>
      )}

      {warning.length > 0 && (
        <div className="alert alert-warning d-flex justify-content-between align-items-start gap-3">
          <div>
            <div className="fw-semibold mb-1">Приближение к лимиту</div>
          {warning.slice(0, 3).map((a) => (
            <div key={a.c.id}>
              Категория «{a.c.name}»: {Math.round(a.ratio * 100)}% · потрачено{" "}
              <strong>{money(a.spent)}</strong> из {money(a.limit)}
            </div>
          ))}
          </div>
          <button
            type="button"
            className="btn-close"
            aria-label="Закрыть уведомление"
            title="Закрыть"
            onClick={onClose}
          />
        </div>
      )}
    </div>
  );
};


