import React, { useEffect, useMemo, useState } from "react";
import { Button, Form, Modal, ProgressBar } from "react-bootstrap";
import { api } from "./api";
import { formatDateRu } from "./format";

export interface Goal {
  id: number;
  name: string;
  target_amount: string | number;
  saved_amount: string | number;
  due_date: string;
  percent: number;
  status: "active" | "completed" | "expired";
}

const money = (v: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2
  }).format(v);

export const GoalsWidget: React.FC<{
  refreshKey: string;
  onGoToGoals: () => void;
  onGoalsChanged?: () => void;
}> = ({ refreshKey, onGoToGoals, onGoalsChanged }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>("");

  const load = async () => {
    const res = await api.get<Goal[]>("/goals/");
    setGoals(res.data);
  };

  useEffect(() => {
    load().catch((e) => console.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const topGoals = useMemo(() => goals.slice(0, 4), [goals]);

  const openDeposit = (g: Goal) => {
    setDepositGoal(g);
    setDepositAmount("");
  };

  const closeDeposit = () => setDepositGoal(null);

  const doDeposit = async () => {
    if (!depositGoal) return;
    const amt = Number(depositAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Введите сумму пополнения (> 0).");
      return;
    }
    await api.post(`/goals/${depositGoal.id}/deposit/`, { amount: amt });
    closeDeposit();
    await load();
    onGoalsChanged?.();
  };

  return (
    <div className="card shadow-sm border-0 mb-3">
      <div className="card-header bg-white border-0 fw-semibold d-flex justify-content-between align-items-center">
        <span>Цели</span>
        <button className="btn btn-sm btn-outline-primary" onClick={onGoToGoals}>
          Перейти
        </button>
      </div>
      <div className="card-body">
        {goals.length === 0 ? (
          <div className="text-muted">
            Целей пока нет. Добавьте цель во вкладке «Цели», чтобы отслеживать прогресс.
          </div>
        ) : (
          <div className="row g-3">
            {topGoals.map((g) => {
              const targetNum =
                typeof g.target_amount === "number"
                  ? g.target_amount
                  : Number(g.target_amount);
              const savedNum =
                typeof g.saved_amount === "number"
                  ? g.saved_amount
                  : Number(g.saved_amount);
              const remaining = Math.max(0, targetNum - savedNum);
              const badge =
                g.status === "completed"
                  ? "text-bg-success"
                  : g.status === "expired"
                    ? "text-bg-danger"
                    : "text-bg-primary";
              const badgeText =
                g.status === "completed"
                  ? "Выполнена"
                  : g.status === "expired"
                    ? "Срок истёк"
                    : "Активна";
              return (
                <div key={g.id} className="col-12 col-lg-6">
                  <div className="p-3 rounded-4 border bg-body">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <div className="fw-semibold">{g.name}</div>
                          <span className={`badge ${badge}`}>{badgeText}</span>
                        </div>
                        <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                          Срок: {formatDateRu(g.due_date)}
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                          {g.percent}%
                        </div>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => openDeposit(g)}
                        >
                          Пополнить
                        </Button>
                      </div>
                    </div>

                    <ProgressBar className="mt-2" now={g.percent} />
                    <div className="text-muted mt-2" style={{ fontSize: "0.9rem" }}>
                      Накоплено {money(savedNum)} из {money(targetNum)} · осталось{" "}
                      <strong>{money(remaining)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {goals.length > 4 && (
          <div className="text-muted mt-3">Показаны первые 4 цели.</div>
        )}
      </div>

      <Modal show={Boolean(depositGoal)} onHide={closeDeposit} centered>
        <Modal.Header closeButton>
          <Modal.Title>Пополнить цель</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-2">
            <div className="text-muted" style={{ fontSize: "0.9rem" }}>
              Цель
            </div>
            <div className="fw-semibold">{depositGoal?.name}</div>
          </div>
          <Form
            id="goal-widget-deposit-form"
            onSubmit={(e) => {
              e.preventDefault();
              doDeposit();
            }}
          >
            <Form.Group>
              <Form.Label>Сумма пополнения</Form.Label>
              <Form.Control
                autoFocus
                type="number"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Например, 1000"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeDeposit}>
            Отмена
          </Button>
          <Button variant="primary" type="submit" form="goal-widget-deposit-form">
            Пополнить
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};


