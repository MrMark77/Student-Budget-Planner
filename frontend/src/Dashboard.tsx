import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { formatDateRu, formatMonthRu } from "./format";
import { Form } from "react-bootstrap";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend
);

export interface Summary {
  balance: number;
  income_total: number;
  expense_total: number;
  income_by_category: Record<string, number>;
  expenses_by_category: Record<string, number>;
  daily_balance: Record<string, number>;
}

const palette = [
  "#4F46E5",
  "#06B6D4",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#22C55E",
  "#F97316",
  "#0EA5E9",
  "#A3E635"
];

const formatMoney = (v: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2
  }).format(v);

export const Dashboard: React.FC<{
  summary: Summary | null;
  month: string;
  onMonthChange: (month: string) => void;
}> = ({ summary, month, onMonthChange }) => {
  const shiftMonth = (ym: string, delta: number) => {
    const [y, m] = ym.split("-").map((x) => Number(x));
    if (!y || !m) return ym;
    const d = new Date(y, m - 1 + delta, 1);
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

  const minMonth = monthOptions[monthOptions.length - 1]?.value; // самый старый
  const maxMonth = monthOptions[0]?.value; // текущий
  const canPrev = Boolean(minMonth) && month !== minMonth;
  const canNext = Boolean(maxMonth) && month !== maxMonth;
  const expenseDoughnut = useMemo(() => {
    const entries = Object.entries(summary?.expenses_by_category ?? {});
    const labels = entries.map(([k]) => k);
    const data = entries.map(([, v]) => v);
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((_, i) => palette[i % palette.length]),
          borderWidth: 0
        }
      ]
    };
  }, [summary]);

  const incomeBar = useMemo(() => {
    const entries = Object.entries(summary?.income_by_category ?? {});
    const labels = entries.map(([k]) => k);
    const data = entries.map(([, v]) => v);
    return {
      labels,
      datasets: [
        {
          label: "Доходы по категориям",
          data,
          backgroundColor: "#10B981"
        }
      ]
    };
  }, [summary]);

  const balanceLine = useMemo(() => {
    const entries = Object.entries(summary?.daily_balance ?? {}).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return {
      labels: entries.map(([d]) => formatDateRu(d)),
      datasets: [
        {
          label: "Баланс по дням",
          data: entries.map(([, v]) => v),
          borderColor: "#4F46E5",
          backgroundColor: "rgba(79,70,229,0.15)",
          tension: 0.3,
          fill: true,
          pointRadius: 2
        }
      ]
    };
  }, [summary]);

  if (!summary) return null;

  return (
    <div className="mb-3">
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body d-flex flex-wrap gap-3 align-items-center justify-content-between">
          <div>
            <div className="text-muted" style={{ fontSize: "0.9rem" }}>
              Период отчёта
            </div>
            <div className="fw-semibold">{formatMonthRu(month)}</div>
            <div className="text-muted" style={{ fontSize: "0.85rem" }}>
              Выберите месяц, чтобы посмотреть доходы и расходы за период.
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
              <Form.Label
                className="text-muted mb-1"
                style={{ fontSize: "0.85rem" }}
              >
                Месяц
              </Form.Label>
              <Form.Select
                value={month}
                onChange={(e) => onMonthChange(e.target.value)}
              >
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

      <div className="row g-3 mb-3">
        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <div className="text-muted">Доходы (месяц)</div>
              <div className="fs-4 fw-semibold text-success">
                {formatMoney(summary.income_total)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <div className="text-muted">Расходы (месяц)</div>
              <div className="fs-4 fw-semibold text-danger">
                {formatMoney(summary.expense_total)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <div className="text-muted">Баланс</div>
              <div className="fs-4 fw-semibold">
                {formatMoney(summary.balance)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-md-4 d-flex">
          <div className="card shadow-sm border-0 h-100 w-100 d-flex flex-column">
            <div className="card-header bg-white border-0 fw-semibold">
              Расходы по категориям
            </div>
            <div className="card-body d-flex flex-column flex-grow-1">
              {Object.keys(summary.expenses_by_category).length === 0 ? (
                <div className="text-muted">
                  Нет расходов за {formatMonthRu(month)}.
                </div>
              ) : (
                <div className="flex-grow-1" style={{ minHeight: 360 }}>
                  <Doughnut
                    data={expenseDoughnut}
                    redraw
                    options={{
                      plugins: { legend: { position: "bottom" } },
                      maintainAspectRatio: false
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-md-8">
          <div className="card shadow-sm border-0 mb-3">
            <div className="card-header bg-white border-0 fw-semibold">
              Баланс по дням
            </div>
            <div className="card-body" style={{ height: 260 }}>
              {Object.keys(summary.daily_balance).length === 0 ? (
                <div className="text-muted">
                  Нет данных по дням за {formatMonthRu(month)}.
                </div>
              ) : (
                <Line
                  data={balanceLine}
                  redraw
                  options={{
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { ticks: { callback: (v) => `${v} ₽` } }
                    }
                  }}
                />
              )}
            </div>
          </div>

          <div className="card shadow-sm border-0">
            <div className="card-header bg-white border-0 fw-semibold">
              Доходы по категориям
            </div>
            <div className="card-body" style={{ height: 240 }}>
              {Object.keys(summary.income_by_category).length === 0 ? (
                <div className="text-muted">
                  Нет доходов за {formatMonthRu(month)}.
                </div>
              ) : (
                <Bar
                  data={incomeBar}
                  redraw
                  options={{
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


