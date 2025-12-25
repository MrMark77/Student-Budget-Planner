import React, { useEffect, useMemo, useState } from "react";
import Nav from "react-bootstrap/Nav";
import ProgressBar from "react-bootstrap/ProgressBar";
import { api } from "./api";
import type { Category as CategoryT } from "./CategoryManager";
import { Dashboard, Summary as DashboardSummary } from "./Dashboard";
import { formatDateRu, formatMonthRu } from "./format";
import { GoalsPage } from "./GoalsPage";
import { SettingsPage } from "./SettingsPage";
import { GoalsWidget } from "./GoalsWidget";
import { LimitAlerts } from "./LimitAlerts";
import { AuthPage } from "./AuthPage";
import { TransactionModal } from "./TransactionModal";
import { OperationsPage } from "./OperationsPage";

interface Transaction {
  id: number;
  category: number;
  amount: number | string;
  date: string;
  is_income: boolean;
  is_reserved: boolean;
  reserve_months?: number | null;
  comment: string;
}

type Summary = DashboardSummary;

const monthString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const money = (v: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(v);

export const App: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(
    Boolean(localStorage.getItem("access_token"))
  );

  const [activeTab, setActiveTab] = useState<
    "home" | "operations" | "reports" | "goals" | "settings"
  >("home");

  const [categories, setCategories] = useState<CategoryT[]>([]);

  // Home data = always current month
  const [homeSummary, setHomeSummary] = useState<Summary | null>(null);
  const [homeTransactions, setHomeTransactions] = useState<Transaction[]>([]);

  // Reports data
  const [reportsMonth, setReportsMonth] = useState<string>(monthString(new Date()));
  const [reportsSummary, setReportsSummary] = useState<Summary | null>(null);

  // Operations page data
  const [opsMonth, setOpsMonth] = useState<string>(monthString(new Date()));
  const [opsTransactions, setOpsTransactions] = useState<Transaction[]>([]);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [theme, setTheme] = useState<"light" | "dark">(
    (localStorage.getItem("theme") as "light" | "dark") || "light"
  );

  const [goalsRefresh, setGoalsRefresh] = useState(0);
  const [limitAlertsVisible, setLimitAlertsVisible] = useState(true);

  // Transaction modal
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalMode, setTxModalMode] = useState<"create" | "edit">("create");
  const [txModalType, setTxModalType] = useState<"income" | "expense">("expense");
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const startDayQuery = () => {
    const startDay = localStorage.getItem("period_start_day");
    return startDay ? `&start_day=${encodeURIComponent(startDay)}` : "";
  };

  const applyTheme = (t: "light" | "dark") => {
    setTheme(t);
    localStorage.setItem("theme", t);
    document.documentElement.setAttribute("data-bs-theme", t);
  };

  const loadCategories = async () => {
    const res = await api.get<CategoryT[]>("/categories/");
    setCategories(res.data);
  };

  const loadHome = async () => {
    try {
      setLoadError(null);
      const m = monthString(new Date());
      const [catRes, txRes, sumRes] = await Promise.all([
        api.get<CategoryT[]>("/categories/"),
        api.get<Transaction[]>(`/transactions/?month=${encodeURIComponent(m)}${startDayQuery()}`),
        api.get<Summary>(`/summary/?month=${encodeURIComponent(m)}${startDayQuery()}`)
      ]);
      setCategories(catRes.data);
      setHomeTransactions(txRes.data);
      setHomeSummary(sumRes.data);
    } catch (e) {
      console.error(e);
      setLoadError("Не удалось загрузить данные главного экрана.");
    }
  };

  const loadOperations = async (m: string = opsMonth) => {
    try {
      setLoadError(null);
      const res = await api.get<Transaction[]>(
        `/transactions/?month=${encodeURIComponent(m)}${startDayQuery()}`
      );
      setOpsTransactions(res.data);
    } catch (e) {
      console.error(e);
      setLoadError("Не удалось загрузить операции.");
    }
  };

  const loadReports = async (m: string = reportsMonth) => {
    try {
      setLoadError(null);
      const res = await api.get<Summary>(
        `/summary/?month=${encodeURIComponent(m)}${startDayQuery()}`
      );
      setReportsSummary(res.data);
    } catch (e) {
      console.error(e);
      setLoadError("Не удалось загрузить данные отчёта.");
    }
  };

  const resetTransactions = async (month?: string) => {
    const label = month ? `за ${formatMonthRu(month)}` : "";
    const ok = window.confirm(`Удалить ВСЕ операции ${label}?`);
    if (!ok) return;
    const ok2 = window.confirm(`Подтвердите ещё раз: точно удалить все операции ${label}?`);
    if (!ok2) return;
    const url = month
      ? `/reset/transactions/?month=${encodeURIComponent(month)}${startDayQuery()}`
      : "/reset/transactions/";
    await api.post(url);
    // Мгновенно очищаем UI, чтобы не ждать ручной перезагрузки/повторного запроса
    setOpsTransactions([]);
    const currentMonth = monthString(new Date());
    if (!month || month === currentMonth) setHomeTransactions([]);
    await loadHome();
    await loadOperations(month ?? opsMonth);
    if (activeTab === "reports") {
      await loadReports();
    }
  };

  const deleteTransaction = async (id: number) => {
    const ok = window.confirm("Удалить эту операцию?");
    if (!ok) return;
    await api.delete(`/transactions/${id}/`);
    // Мгновенно обновляем UI (важно для страницы "Операции")
    setHomeTransactions((prev) => prev.filter((t) => t.id !== id));
    setOpsTransactions((prev) => prev.filter((t) => t.id !== id));
    // И синхронизируем агрегаты/данные с сервером
    await loadHome();
    await loadOperations();
    if (activeTab === "reports") {
      await loadReports();
    }
  };

  const monthProgress = useMemo(() => {
    const today = new Date();
    const day = today.getDate();
    const total = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const percent = Math.round((day / total) * 100);
    return { day, total, percent };
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    loadHome();
    loadReports(reportsMonth);
    loadOperations(opsMonth);
    // При каждом входе в аккаунт показываем уведомления о лимитах заново
    setLimitAlertsVisible(true);
  }, [isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;
    loadReports(reportsMonth);
  }, [reportsMonth, isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;
    loadOperations(opsMonth);
  }, [opsMonth, isAuthorized]);

  // При переходе на вкладку "Отчёты" всегда подгружаем актуальные данные.
  // Иначе отчёт может оставаться устаревшим после изменений на других вкладках.
  useEffect(() => {
    if (!isAuthorized) return;
    if (activeTab !== "reports") return;
    loadReports(reportsMonth);
  }, [activeTab, isAuthorized]);

  useEffect(() => {
    if (activeTab === "home") setGoalsRefresh((x) => x + 1);
  }, [activeTab]);

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setIsAuthorized(false);
  };

  useEffect(() => {
    const onForcedLogout = () => setIsAuthorized(false);
    window.addEventListener("auth:logout", onForcedLogout);
    return () => window.removeEventListener("auth:logout", onForcedLogout);
  }, []);

  if (!isAuthorized) {
    return <AuthPage onLoggedIn={() => setIsAuthorized(true)} />;
  }

  return (
    <div className="container py-3 app-content">
      {theme && null}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">Student Budget</h3>
        <button className="btn btn-outline-secondary btn-sm" onClick={logout}>
          Выйти
        </button>
      </div>

      {/* Desktop/Tablet tabs */}
      <Nav
        variant="tabs"
        activeKey={activeTab}
        onSelect={(k) => setActiveTab((k as any) || "home")}
        className="mb-3 d-none d-md-flex"
      >
        <Nav.Item>
          <Nav.Link eventKey="home">Главная</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="operations">Операции</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="reports">Отчёты</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="goals">Цели</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="settings">Настройки</Nav.Link>
        </Nav.Item>
      </Nav>

      {loadError && (
        <div className="alert alert-warning d-flex justify-content-between align-items-center">
          <div>{loadError}</div>
          <button
            className="btn btn-sm btn-outline-dark"
            onClick={() => {
              if (activeTab === "reports") loadReports();
              else if (activeTab === "operations") loadOperations();
              else loadHome();
            }}
          >
            Повторить
          </button>
        </div>
      )}

      {activeTab === "home" && (
        <>
          <div className="card shadow-sm border-0 mb-3">
            <div className="card-body">
              <div className="text-muted">Баланс</div>
              <div className="display-6 fw-semibold">
                {homeSummary ? money(homeSummary.balance) : "—"}
              </div>

              <div className="mt-3">
                <div
                  className="d-flex justify-content-between text-muted"
                  style={{ fontSize: "0.9rem" }}
                >
                  <div>Прогресс месяца</div>
                  <div>
                    {monthProgress.day} / {monthProgress.total}
                  </div>
                </div>
                <ProgressBar now={monthProgress.percent} className="mt-1" />
              </div>

              {homeSummary && (
                <div className="row g-2 mt-3">
                  <div className="col-12 col-md-4">
                    <div className="p-3 rounded-4 border bg-body">
                      <div className="text-muted">В этом месяце: Доходы</div>
                      <div className="fw-semibold">{money(homeSummary.income_total)}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="p-3 rounded-4 border bg-body">
                      <div className="text-muted">Расходы</div>
                      <div className="fw-semibold">{money(homeSummary.expense_total)}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="p-3 rounded-4 border bg-body">
                      <div className="text-muted">Сэкономлено</div>
                      <div className="fw-semibold">
                        {money(homeSummary.income_total - homeSummary.expense_total)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="d-flex gap-2 mt-3 flex-wrap">
                <button
                  className="btn btn-success"
                  onClick={() => {
                    setTxModalMode("create");
                    setTxModalType("income");
                    setEditingTx(null);
                    setTxModalOpen(true);
                  }}
                >
                  + Доход
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setTxModalMode("create");
                    setTxModalType("expense");
                    setEditingTx(null);
                    setTxModalOpen(true);
                  }}
                >
                  + Расход
                </button>
                <button
                  className="btn btn-outline-primary"
                  onClick={() => {
                    setActiveTab("reports");
                    setReportsMonth(monthString(new Date()));
                  }}
                >
                  Посмотреть отчет за месяц
                </button>
              </div>
            </div>
          </div>

          {limitAlertsVisible && (
            <LimitAlerts
              categories={categories}
              transactions={homeTransactions}
              onClose={() => setLimitAlertsVisible(false)}
            />
          )}

          <GoalsWidget
            refreshKey={`${goalsRefresh}`}
            onGoToGoals={() => setActiveTab("goals")}
            onGoalsChanged={() => setGoalsRefresh((x) => x + 1)}
          />

          <div className="card">
            <div className="card-header bg-white border-0 fw-semibold d-flex justify-content-between align-items-center">
              <span>Последние операции</span>
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => {
                  setOpsMonth(monthString(new Date()));
                  setActiveTab("operations");
                }}
              >
                Перейти
              </button>
            </div>
            <ul className="list-group list-group-flush">
              {homeTransactions.slice(0, 5).map((t) => {
                const cat = categories.find((c) => c.id === t.category);
                const amountNum = typeof t.amount === "number" ? t.amount : Number(t.amount);
                return (
                  <li
                    key={t.id}
                    className="list-group-item d-flex justify-content-between align-items-center clickable-row"
                    role="button"
                    onClick={() => {
                      setTxModalMode("edit");
                      setTxModalType(t.is_income ? "income" : "expense");
                      setEditingTx(t);
                      setTxModalOpen(true);
                    }}
                  >
                    <div>
                      <div>
                        <strong>{cat?.name ?? "Категория"}</strong>{" "}
                        {t.is_income ? "(доход)" : "(расход)"}
                      </div>
                      <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                        {formatDateRu(t.date)} {t.comment && " · " + t.comment}
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div className={t.is_income ? "text-success" : "text-danger"}>
                        {t.is_income ? "+" : "-"}
                        {Number.isFinite(amountNum) ? amountNum.toFixed(2) : "—"} ₽
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        title="Редактировать"
                        aria-label={`Редактировать операцию ${t.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTxModalMode("edit");
                          setTxModalType(t.is_income ? "income" : "expense");
                          setEditingTx(t);
                          setTxModalOpen(true);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="btn-close"
                        aria-label={`Удалить операцию ${t.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTransaction(t.id);
                        }}
                        title="Удалить"
                      />
                    </div>
                  </li>
                );
              })}
              {homeTransactions.length === 0 && (
                <li className="list-group-item text-muted">Пока нет операций</li>
              )}
            </ul>
          </div>
        </>
      )}

      {activeTab === "operations" && (
        <OperationsPage
          month={opsMonth}
          onMonthChange={setOpsMonth}
          categories={categories}
          transactions={opsTransactions}
          onEdit={(t) => {
            setTxModalMode("edit");
            setTxModalType(t.is_income ? "income" : "expense");
            setEditingTx(t);
            setTxModalOpen(true);
          }}
          onDelete={deleteTransaction}
          onResetAll={(m) => resetTransactions(m)}
        />
      )}

      {activeTab === "reports" && (
        <>
          <h4 className="mb-3">Отчёты</h4>
          <Dashboard summary={reportsSummary} month={reportsMonth} onMonthChange={setReportsMonth} />
          {reportsSummary && (
            <div className="card shadow-sm border-0">
              <div className="card-body d-flex gap-4 flex-wrap">
                <div>
                  <div className="text-muted">Доход</div>
                  <div className="fw-semibold">{money(reportsSummary.income_total)}</div>
                </div>
                <div>
                  <div className="text-muted">Расход</div>
                  <div className="fw-semibold">{money(reportsSummary.expense_total)}</div>
                </div>
                <div>
                  <div className="text-muted">Разница</div>
                  <div className="fw-semibold">
                    {money(reportsSummary.income_total - reportsSummary.expense_total)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "goals" && <GoalsPage onGoalsChanged={() => setGoalsRefresh((x) => x + 1)} />}

      {activeTab === "settings" && (
        <SettingsPage
          categories={categories}
          onCategoriesChanged={async () => {
            await loadCategories();
            await loadHome();
          }}
          onLogout={logout}
          onThemeApplied={applyTheme}
        />
      )}

      <TransactionModal
        show={txModalOpen}
        onHide={() => setTxModalOpen(false)}
        categories={categories}
        mode={txModalMode}
        initialType={txModalType}
        editingTx={editingTx}
        onSaved={() => {
          loadHome();
          loadOperations();
          if (activeTab === "reports") loadReports();
        }}
      />

      {/* Mobile bottom nav */}
      <div className="d-md-none fixed-bottom bottom-nav">
        <div className="container">
          <div className="bottom-nav__bar d-flex justify-content-between">
            <button
              className={`bottom-nav__item ${activeTab === "home" ? "bottom-nav__item--active" : ""}`}
              onClick={() => setActiveTab("home")}
              aria-label="Главная"
            >
              <svg className="bottom-nav__icon" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="bottom-nav__label">Главная</span>
            </button>

            <button
              className={`bottom-nav__item ${activeTab === "operations" ? "bottom-nav__item--active" : ""}`}
              onClick={() => setActiveTab("operations")}
              aria-label="Операции"
            >
              <svg className="bottom-nav__icon" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 6h14M7 12h14M7 18h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M4 6h.01M4 12h.01M4 18h.01"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="bottom-nav__label">Операции</span>
            </button>

            <button
              className={`bottom-nav__item ${activeTab === "reports" ? "bottom-nav__item--active" : ""}`}
              onClick={() => setActiveTab("reports")}
              aria-label="Отчёты"
            >
              <svg className="bottom-nav__icon" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3a9 9 0 1 0 9 9h-9V3Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 3.3A9 9 0 0 1 21 10h-7V3.3Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="bottom-nav__label">Отчёты</span>
            </button>

            <button
              className={`bottom-nav__item ${activeTab === "goals" ? "bottom-nav__item--active" : ""}`}
              onClick={() => setActiveTab("goals")}
              aria-label="Цели"
            >
              <svg className="bottom-nav__icon" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3v4M12 17v4M3 12h4M17 12h4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
              <span className="bottom-nav__label">Цели</span>
            </button>

            <button
              className={`bottom-nav__item ${activeTab === "settings" ? "bottom-nav__item--active" : ""}`}
              onClick={() => setActiveTab("settings")}
              aria-label="Настройки"
            >
              <svg className="bottom-nav__icon" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M19 12a7 7 0 0 0-.1-1l2-1.4-2-3.5-2.4 1a7.3 7.3 0 0 0-1.7-1l-.3-2.6H9.5l-.3 2.6a7.3 7.3 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.4A7 7 0 0 0 5 12c0 .34.03.67.1 1l-2 1.4 2 3.5 2.4-1c.54.4 1.1.73 1.7 1l.3 2.6h5l.3-2.6c.6-.27 1.16-.6 1.7-1l2.4 1 2-3.5-2-1.4c.07-.33.1-.66.1-1Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="bottom-nav__label">Настройки</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


