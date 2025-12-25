import React, { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import { api } from "./api";
import { CategoryManager, Category as CategoryT } from "./CategoryManager";

export interface UserSettings {
  theme: "light" | "dark";
  period_start_day: number;
  notify_limit_exceeded: boolean;
  notify_monthly_email: boolean;
}

export const SettingsPage: React.FC<{
  categories: CategoryT[];
  onCategoriesChanged: () => void;
  onLogout: () => void;
  onThemeApplied: (theme: "light" | "dark") => void;
}> = ({ categories, onCategoriesChanged, onLogout, onThemeApplied }) => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    const res = await api.get<UserSettings>("/settings/");
    setSettings(res.data);
    onThemeApplied(res.data.theme);
    localStorage.setItem("period_start_day", String(res.data.period_start_day));
  };

  useEffect(() => {
    loadSettings().catch((e) => console.error(e));
  }, []);

  const patch = async (partial: Partial<UserSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...partial };
    setSettings(next);
    setSaving(true);
    try {
      const res = await api.patch<UserSettings>("/settings/", partial);
      setSettings(res.data);
      onThemeApplied(res.data.theme);
      localStorage.setItem("period_start_day", String(res.data.period_start_day));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h4 className="mb-3">Настройки</h4>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-header bg-white border-0 fw-semibold">
          Аккаунт и приложение
        </div>
        <div className="card-body">
          {settings ? (
            <>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <Form.Label className="text-muted">Тема</Form.Label>
                  <Form.Select
                    value={settings.theme}
                    onChange={(e) => patch({ theme: e.target.value as "light" | "dark" })}
                  >
                    <option value="light">Светлая</option>
                    <option value="dark">Тёмная</option>
                  </Form.Select>
                </div>
                <div className="col-12 col-md-6">
                  <Form.Label className="text-muted">Первый день бюджетного периода</Form.Label>
                  <Form.Select
                    value={settings.period_start_day}
                    onChange={(e) => patch({ period_start_day: Number(e.target.value) })}
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Form.Select>
                  <div className="text-muted mt-1" style={{ fontSize: "0.85rem" }}>
                    Можно поставить, например, 10 — если бюджетный месяц начинается с даты получения стипендии.
                  </div>
                </div>
              </div>

              <hr />

              <div className="fw-semibold mb-2">Уведомления</div>
              <Form.Check
                type="switch"
                id="notify-limit"
                label="Присылать уведомления о превышении лимита"
                checked={settings.notify_limit_exceeded}
                onChange={(e) => patch({ notify_limit_exceeded: e.target.checked })}
              />
              <Form.Check
                type="switch"
                id="notify-email"
                label="Ежемесячный отчет на email"
                checked={settings.notify_monthly_email}
                onChange={(e) => patch({ notify_monthly_email: e.target.checked })}
              />

              <div className="text-muted mt-2" style={{ fontSize: "0.85rem" }}>
                {saving ? "Сохранение…" : "Изменения сохраняются автоматически."}
              </div>
            </>
          ) : (
            <div className="text-muted">Загрузка настроек…</div>
          )}
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-header bg-white border-0 fw-semibold">
          Управление категориями
        </div>
        <div className="card-body">
          <CategoryManager categories={categories} onChanged={onCategoriesChanged} />
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-header bg-white border-0 fw-semibold">О приложении</div>
        <div className="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="text-muted">Версия: <strong>0.1.0</strong></div>
          <button className="btn btn-outline-secondary" onClick={onLogout}>
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
};


