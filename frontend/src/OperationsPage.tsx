import React, { useMemo } from "react";
import { Form } from "react-bootstrap";
import { formatDateRu, formatMonthRu } from "./format";

interface Category {
  id: number;
  name: string;
  type: "income" | "expense";
}

interface Transaction {
  id: number;
  category: number;
  amount: number | string;
  date: string;
  is_income: boolean;
  is_reserved: boolean;
  comment: string;
}

const money = (v: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2
  }).format(v);

export const OperationsPage: React.FC<{
  month: string;
  onMonthChange: (m: string) => void;
  categories: Category[];
  transactions: Transaction[];
  onEdit: (t: Transaction) => void;
  onDelete: (id: number) => void;
  onResetAll: (month: string) => void;
}> = ({ month, onMonthChange, categories, transactions, onEdit, onDelete, onResetAll }) => {
  const catMap = useMemo(() => {
    const m = new Map<number, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const shiftMonth = (ym: string, delta: number) => {
    const [y, mm] = ym.split("-").map((x) => Number(x));
    if (!y || !mm) return ym;
    const d = new Date(y, mm - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const monthOptions = useMemo(() => {
    const now = new Date();
    const opts: { value: string; label: string }[] = [];
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      opts.push({ value, label: formatMonthRu(value) });
    }
    return opts;
  }, []);

  const minMonth = monthOptions[monthOptions.length - 1]?.value;
  const maxMonth = monthOptions[0]?.value;
  const canPrev = Boolean(minMonth) && month !== minMonth;
  const canNext = Boolean(maxMonth) && month !== maxMonth;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="mb-0">Операции</h4>
        <button className="btn btn-outline-danger" onClick={() => onResetAll(month)}>
          Очистить операции
        </button>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body d-flex flex-wrap gap-3 align-items-center justify-content-between">
          <div>
            <div className="text-muted" style={{ fontSize: "0.9rem" }}>
              Период
            </div>
            <div className="fw-semibold">{formatMonthRu(month)}</div>
            <div className="text-muted" style={{ fontSize: "0.85rem" }}>
              Выберите месяц, чтобы увидеть список операций.
            </div>
          </div>
          <div className="d-flex align-items-end gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => onMonthChange(shiftMonth(month, -1))}
              disabled={!canPrev}
              title="Предыдущий месяц"
              aria-label="Предыдущий месяц"
            >
              ◀
            </button>
            <div style={{ minWidth: 240 }}>
              <Form.Label className="text-muted mb-1" style={{ fontSize: "0.85rem" }}>
                Месяц
              </Form.Label>
              <Form.Select value={month} onChange={(e) => onMonthChange(e.target.value)}>
                {monthOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => onMonthChange(shiftMonth(month, +1))}
              disabled={!canNext}
              title="Следующий месяц"
              aria-label="Следующий месяц"
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-header bg-white border-0 fw-semibold">
          Список операций
          <span className="text-muted ms-2" style={{ fontSize: "0.9rem" }}>
            ({transactions.length})
          </span>
        </div>
        <ul className="list-group list-group-flush">
          {transactions.map((t) => {
            const cat = catMap.get(t.category);
            const amountNum = typeof t.amount === "number" ? t.amount : Number(t.amount);
            return (
              <li
                key={t.id}
                className="list-group-item d-flex justify-content-between align-items-center"
                role="button"
                onClick={() => onEdit(t)}
              >
                <div>
                  <div>
                    <strong>{cat?.name ?? "Категория"}</strong>{" "}
                    <span className="text-muted">
                      {t.is_income ? "(доход)" : "(расход)"}
                    </span>
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                    {formatDateRu(t.date)}
                    {t.comment && " · " + t.comment}
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <div className={t.is_income ? "text-success" : "text-danger"}>
                    {t.is_income ? "+" : "-"}
                    {Number.isFinite(amountNum) ? money(amountNum) : "—"}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    title="Редактировать"
                    aria-label={`Редактировать операцию ${t.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(t);
                    }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="btn-close"
                    title="Удалить"
                    aria-label={`Удалить операцию ${t.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(t.id);
                    }}
                  />
                </div>
              </li>
            );
          })}
          {transactions.length === 0 && (
            <li className="list-group-item text-muted">
              В {formatMonthRu(month)} нет доходов и расходов.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};


