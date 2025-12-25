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
  remaining_amount: number;
  status: "active" | "completed" | "expired";
  months_left: number;
}

const money = (v: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2
  }).format(v);

export const GoalsPage: React.FC<{ onGoalsChanged?: () => void }> = ({
  onGoalsChanged
}) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [show, setShow] = useState(false);
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [name, setName] = useState("");
  const [target, setTarget] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [initialSaved, setInitialSaved] = useState<string>("");

  const loadGoals = async () => {
    const res = await api.get<Goal[]>("/goals/");
    setGoals(res.data);
  };

  useEffect(() => {
    loadGoals().catch((e) => console.error(e));
  }, []);

  const createGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !target || Number(target) <= 0) {
      alert("Введите название и сумму цели (> 0).");
      return;
    }
    const saved = initialSaved ? Number(initialSaved) : 0;
    if (saved < 0) {
      alert("Начальная сумма не может быть отрицательной.");
      return;
    }
    await api.post("/goals/", {
      name: name.trim(),
      target_amount: Number(target),
      saved_amount: saved,
      due_date: dueDate
    });
    setShow(false);
    setName("");
    setTarget("");
    setInitialSaved("");
    await loadGoals();
    onGoalsChanged?.();
  };

  const deleteGoal = async (g: Goal) => {
    const ok = window.confirm(`Удалить цель "${g.name}"?`);
    if (!ok) return;
    await api.delete(`/goals/${g.id}/`);
    await loadGoals();
    onGoalsChanged?.();
  };

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
    await loadGoals();
    onGoalsChanged?.();
  };

  const statusBadge = (g: Goal) => {
    if (g.status === "completed") {
      return <span className="badge text-bg-success">Выполнена</span>;
    }
    if (g.status === "expired") {
      return <span className="badge text-bg-danger">Срок истёк</span>;
    }
    return <span className="badge text-bg-primary">Активна</span>;
  };

  const empty = goals.length === 0;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Цели</h4>
        <Button onClick={() => setShow(true)}>+ Новая цель</Button>
      </div>

      {empty ? (
        <div className="card shadow-sm border-0">
          <div className="card-body text-muted">
            Целей пока нет. Добавьте цель накопления, чтобы отслеживать прогресс.
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {goals.map((g) => {
            const targetNum =
              typeof g.target_amount === "number"
                ? g.target_amount
                : Number(g.target_amount);
            const savedNum =
              typeof g.saved_amount === "number" ? g.saved_amount : Number(g.saved_amount);
            const remaining = Math.max(0, targetNum - savedNum);
            return (
              <div key={g.id} className="col-12 col-lg-6">
                <div className="card shadow-sm border-0 h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <h5 className="mb-0">{g.name}</h5>
                          {statusBadge(g)}
                        </div>
                        <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                          Срок: {formatDateRu(g.due_date)}
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => openDeposit(g)}
                        >
                          Пополнить
                        </Button>
                        <button
                          type="button"
                          className="btn-close"
                          title="Удалить цель"
                          aria-label="Удалить цель"
                          onClick={() => deleteGoal(g)}
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="d-flex justify-content-between text-muted" style={{ fontSize: "0.9rem" }}>
                        <div>
                          Накоплено: <strong>{money(savedNum)}</strong> из{" "}
                          <strong>{money(targetNum)}</strong>
                        </div>
                        <div>
                          {g.percent}% · осталось <strong>{money(remaining)}</strong>
                        </div>
                      </div>
                      <ProgressBar
                        className="mt-2"
                        now={g.percent}
                        variant={g.status === "completed" ? "success" : g.status === "expired" ? "danger" : "primary"}
                      />
                      {g.status === "active" && (
                        <div className="text-muted mt-2" style={{ fontSize: "0.9rem" }}>
                          Осталось примерно: {g.months_left} мес.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal show={show} onHide={() => setShow(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Новая цель</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={createGoal}>
            <Form.Group className="mb-2">
              <Form.Label>Название</Form.Label>
              <Form.Control value={name} onChange={(e) => setName(e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Сумма цели</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Срок (дата)</Form.Label>
              <Form.Control type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Отложить сейчас (начальная сумма) — опционально</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={initialSaved}
                onChange={(e) => setInitialSaved(e.target.value)}
              />
            </Form.Group>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button variant="secondary" onClick={() => setShow(false)} type="button">
                Отмена
              </Button>
              <Button variant="primary" type="submit">
                Создать
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

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
            id="goal-deposit-form"
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
          <Button variant="primary" type="submit" form="goal-deposit-form">
            Пополнить
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};


