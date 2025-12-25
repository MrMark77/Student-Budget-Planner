import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";

interface TransactionFormProps {
  categories: { id: number; name: string; type: "income" | "expense" }[];
  onTransactionAdded: () => void;
}

export const AddTransactionForm: React.FC<TransactionFormProps> = ({
  categories,
  onTransactionAdded
}) => {
  const [isIncome, setIsIncome] = useState(false);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState<string>("");
  const [isReserved, setIsReserved] = useState<boolean>(false);
  const amountRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // make expense flow fast by default
    amountRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId || !amount || Number(amount) <= 0) {
      alert("Пожалуйста, выберите категорию и введите положительную сумму.");
      return;
    }

    try {
      await api.post("/transactions/", {
        category: Number(categoryId),
        amount: Number(amount),
        date,
        is_income: isIncome,
        is_reserved: isIncome && isReserved,
        comment
      });
      setAmount("");
      setComment("");
      setIsReserved(false);
      onTransactionAdded();
    } catch (error) {
      console.error("Ошибка при добавлении операции", error);
      alert("Не удалось добавить операцию.");
    }
  };

  const filteredCategories = categories.filter((c) =>
    isIncome ? c.type === "income" : c.type === "expense"
  );

  return (
    <form onSubmit={handleSubmit} className="card p-3 mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="mb-0">Новая операция</h5>
        <div className="btn-group" role="group" aria-label="Тип операции">
          <button
            type="button"
            className={`btn btn-sm ${!isIncome ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => {
              setIsIncome(false);
              setIsReserved(false);
              setCategoryId("");
              amountRef.current?.focus();
            }}
          >
            + Расход
          </button>
          <button
            type="button"
            className={`btn btn-sm ${isIncome ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => {
              setIsIncome(true);
              setCategoryId("");
              amountRef.current?.focus();
            }}
          >
            + Доход
          </button>
        </div>
      </div>

      {categories.length === 0 && (
        <div className="alert alert-warning mb-2">
          Нет категорий. Добавьте категории в разделе «Настройки».
        </div>
      )}

      <div className="mb-2">
        <select
          className="form-select"
          value={categoryId}
          onChange={(e) =>
            setCategoryId(e.target.value ? Number(e.target.value) : "")
          }
        >
          <option value="">Выберите категорию</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-2">
        <input
          type="number"
          step="0.01"
          className="form-control"
          placeholder="Сумма"
          ref={amountRef}
          value={amount}
          onChange={(e) =>
            setAmount(e.target.value ? Number(e.target.value) : "")
          }
        />
      </div>

      <div className="mb-2">
        <input
          type="date"
          className="form-control"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {isIncome && (
        <div className="form-check mb-2">
          <input
            className="form-check-input"
            type="checkbox"
            id="tx-reserved"
            checked={isReserved}
            onChange={(e) => setIsReserved(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="tx-reserved">
            Распределить доход на будущее
          </label>
        </div>
      )}

      <div className="mb-2">
        <input
          type="text"
          className="form-control"
          placeholder="Комментарий"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <button type="submit" className="btn btn-primary">
        Добавить
      </button>
    </form>
  );
};


