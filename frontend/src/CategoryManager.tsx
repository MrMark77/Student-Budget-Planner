import React, { useState } from "react";
import { api } from "./api";
import { Button, Form, Modal } from "react-bootstrap";

export interface Category {
  id: number;
  name: string;
  type: "income" | "expense";
  limit: number | null;
}

export const CategoryManager: React.FC<{
  categories: Category[];
  onChanged: () => void;
}> = ({ categories, onChanged }) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [limit, setLimit] = useState<string>("");

  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"income" | "expense">("expense");
  const [editLimit, setEditLimit] = useState<string>("");

  const openEdit = (c: Category) => {
    setEditing(c);
    setEditName(c.name);
    setEditType(c.type);
    setEditLimit(c.limit == null ? "" : String(c.limit));
  };

  const closeEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    if (!editName.trim()) {
      alert("Введите название категории.");
      return;
    }
    try {
      await api.patch(`/categories/${editing.id}/`, {
        name: editName.trim(),
        type: editType,
        limit: editType === "expense" ? (editLimit === "" ? null : Number(editLimit)) : null
      });
      closeEdit();
      onChanged();
    } catch (err: any) {
      console.error("Ошибка редактирования категории", err);
      const msg =
        err?.response?.data?.detail || "Не удалось сохранить изменения.";
      alert(msg);
    }
  };

  const deleteCategory = async (c: Category) => {
    const ok = window.confirm(`Удалить категорию "${c.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/categories/${c.id}/`);
      onChanged();
    } catch (err: any) {
      console.error("Ошибка удаления категории", err);
      const msg =
        err?.response?.data?.detail ||
        "Не удалось удалить категорию. Возможно, она используется в операциях.";
      alert(msg);
    }
  };

  const resetCategories = async () => {
    const ok = window.confirm(
      "Удалить ВСЕ категории? Если есть операции, сервер попросит сначала очистить операции."
    );
    if (!ok) return;
    try {
      await api.post("/reset/categories/");
      onChanged();
    } catch (err: any) {
      console.error("Ошибка очистки категорий", err);
      const msg =
        err?.response?.data?.detail ||
        "Не удалось очистить категории. Возможно, есть операции.";
      alert(msg);
    }
  };

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Введите название категории.");
      return;
    }
    try {
      await api.post("/categories/", {
        name: name.trim(),
        type,
        limit: limit === "" ? null : Number(limit)
      });
      setName("");
      setLimit("");
      onChanged();
    } catch (err) {
      console.error("Ошибка создания категории", err);
      alert("Не удалось создать категорию.");
    }
  };

  return (
    <div>
      {categories.length === 0 ? (
        <div className="text-muted mb-3">Категории пока не созданы.</div>
      ) : (
        <ul className="list-group mb-3">
          {categories.map((c) => (
            <li
              key={c.id}
              className="list-group-item d-flex justify-content-between align-items-center"
            >
              <div className="me-2">
                <strong>{c.name}</strong>{" "}
                <span className="text-muted">
                  ({c.type === "income" ? "доход" : "расход"})
                </span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <div className="text-muted">
                  {c.type === "expense" && c.limit != null ? `лимит: ${c.limit}` : ""}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => openEdit(c)}
                  title="Редактировать"
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="btn-close"
                  aria-label={`Удалить категорию ${c.name}`}
                  onClick={() => deleteCategory(c)}
                  title="Удалить"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={createCategory} className="row g-2">
        <div className="col-12 col-md-5">
          <input
            className="form-control"
            placeholder="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <select
            className="form-select"
            value={type}
            onChange={(e) => setType(e.target.value as "income" | "expense")}
          >
            <option value="expense">Расход</option>
            <option value="income">Доход</option>
          </select>
        </div>
        <div className="col-6 col-md-2">
          <input
            className="form-control"
            placeholder="Лимит"
            type="number"
            step="0.01"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            disabled={type !== "expense"}
          />
        </div>
        <div className="col-12 col-md-2 d-grid">
          <button className="btn btn-outline-primary" type="submit">
            Добавить
          </button>
        </div>
      </form>

      <div className="mt-3 d-flex justify-content-end">
        <button
          type="button"
          className="btn btn-outline-danger"
          onClick={resetCategories}
        >
          Очистить категории
        </button>
      </div>

      <Modal show={Boolean(editing)} onHide={closeEdit} centered>
        <Modal.Header closeButton>
          <Modal.Title>Редактировать категорию</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-2">
              <Form.Label>Название</Form.Label>
              <Form.Control
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Тип</Form.Label>
              <Form.Select
                value={editType}
                onChange={(e) =>
                  setEditType(e.target.value as "income" | "expense")
                }
              >
                <option value="expense">Расход</option>
                <option value="income">Доход</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Лимит (только для расходов)</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={editLimit}
                onChange={(e) => setEditLimit(e.target.value)}
                disabled={editType !== "expense"}
              />
            </Form.Group>
            {editType === "income" && (
              <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                Для доходных категорий лимит не используется.
              </div>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeEdit}>
            Отмена
          </Button>
          <Button variant="primary" onClick={saveEdit}>
            Сохранить
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};


