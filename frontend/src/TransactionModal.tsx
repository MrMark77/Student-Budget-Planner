import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { api } from "./api";

export interface Category {
  id: number;
  name: string;
  type: "income" | "expense";
}

export interface Transaction {
  id: number;
  category: number;
  amount: number | string;
  date: string;
  is_income: boolean;
  is_reserved: boolean;
  reserve_months?: number | null;
  comment: string;
}

export const TransactionModal: React.FC<{
  show: boolean;
  onHide: () => void;
  categories: Category[];
  mode: "create" | "edit";
  initialType: "income" | "expense";
  editingTx?: Transaction | null;
  onSaved: () => void;
}> = ({ show, onHide, categories, mode, initialType, editingTx, onSaved }) => {
  const [isIncome, setIsIncome] = useState(initialType === "income");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState<string>("");
  const [isReserved, setIsReserved] = useState<boolean>(false);
  const [reserveMonths, setReserveMonths] = useState<number>(3);
  const amountRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!show) return;
    // init by mode
    if (mode === "edit" && editingTx) {
      setIsIncome(Boolean(editingTx.is_income));
      setCategoryId(editingTx.category);
      setAmount(typeof editingTx.amount === "number" ? String(editingTx.amount) : String(editingTx.amount));
      setDate(editingTx.date);
      setComment(editingTx.comment ?? "");
      setIsReserved(Boolean(editingTx.is_reserved));
      setReserveMonths(editingTx.reserve_months ?? 3);
    } else {
      setIsIncome(initialType === "income");
      setCategoryId("");
      setAmount("");
      setDate(new Date().toISOString().slice(0, 10));
      setComment("");
      setIsReserved(false);
      setReserveMonths(3);
    }
    setTimeout(() => amountRef.current?.focus(), 0);
  }, [show, mode, editingTx, initialType]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => (isIncome ? c.type === "income" : c.type === "expense")),
    [categories, isIncome]
  );

  const save = async () => {
    const amountNum = Number(amount);
    if (!categoryId || !Number.isFinite(amountNum) || amountNum <= 0) {
      alert("Выберите категорию и введите положительную сумму.");
      return;
    }
    const payload: any = {
      category: Number(categoryId),
      amount: amountNum,
      date,
      is_income: isIncome,
      is_reserved: isIncome && isReserved,
      reserve_months: isIncome && isReserved ? reserveMonths : null,
      comment
    };
    try {
      if (mode === "edit" && editingTx) {
        await api.patch(`/transactions/${editingTx.id}/`, payload);
      } else {
        await api.post("/transactions/", payload);
      }
      onHide();
      onSaved();
    } catch (err: any) {
      console.error(err);
      const data = err?.response?.data;
      const msg =
        data?.detail ||
        data?.category ||
        data?.amount ||
        data?.reserve_months ||
        "Не удалось сохранить операцию.";
      alert(Array.isArray(msg) ? msg.join("\n") : String(msg));
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {mode === "edit" ? "Редактирование операции" : "Новая операция"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form
          id="tx-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
        <div className="btn-group w-100 mb-3" role="group" aria-label="Тип операции">
          <button
            type="button"
            className={`btn ${!isIncome ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => {
              setIsIncome(false);
              setIsReserved(false);
              setCategoryId("");
            }}
          >
            Расход
          </button>
          <button
            type="button"
            className={`btn ${isIncome ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => {
              setIsIncome(true);
              setCategoryId("");
            }}
          >
            Доход
          </button>
        </div>

        <Form.Group className="mb-2">
          <Form.Label className="text-muted">Сумма</Form.Label>
          <Form.Control
            ref={amountRef}
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Form.Group>

        <Form.Group className="mb-2">
          <Form.Label className="text-muted">Категория</Form.Label>
          <Form.Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Выберите категорию</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Form.Select>
          {categories.length === 0 && (
            <div className="text-muted mt-1" style={{ fontSize: "0.9rem" }}>
              Нет категорий. Добавьте их в «Настройках».
            </div>
          )}
        </Form.Group>

        <Form.Group className="mb-2">
          <Form.Label className="text-muted">Дата</Form.Label>
          <Form.Control type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Form.Group>

        {isIncome && (
          <div className="mb-2">
            <Form.Check
              type="checkbox"
              id="tx-reserved"
              label="Распределить доход на будущее"
              checked={isReserved}
              onChange={(e) => setIsReserved(e.target.checked)}
            />
            {isReserved && (
              <div className="mt-2">
                <Form.Label className="text-muted">На сколько месяцев распределить</Form.Label>
                <Form.Select
                  value={reserveMonths}
                  onChange={(e) => setReserveMonths(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Form.Select>
              </div>
            )}
          </div>
        )}

        <Form.Group className="mb-2">
          <Form.Label className="text-muted">Комментарий</Form.Label>
          <Form.Control value={comment} onChange={(e) => setComment(e.target.value)} />
        </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Отмена
        </Button>
        <Button variant="primary" type="submit" form="tx-form">
          Сохранить
        </Button>
      </Modal.Footer>
    </Modal>
  );
};


