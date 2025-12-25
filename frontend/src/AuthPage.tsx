import React, { useMemo, useState } from "react";
import { api } from "./api";

export const AuthPage: React.FC<{
  onLoggedIn: () => void;
}> = ({ onLoggedIn }) => {
  const [mode, setMode] = useState<"login" | "register">("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const title = "Student Budget";

  const canSubmit = useMemo(() => {
    if (!email || !password) return false;
    if (mode === "register") {
      if (!name || !password2) return false;
      if (password !== password2) return false;
    }
    return true;
  }, [email, password, mode, name, password2]);

  const login = async () => {
    // backend expects username/password; we use email as username
    const res = await api.post<{ access: string; refresh: string }>("/auth/token/", {
      username: email.trim().toLowerCase(),
      password
    });
    localStorage.setItem("access_token", res.data.access);
    localStorage.setItem("refresh_token", res.data.refresh);
    onLoggedIn();
  };

  const register = async () => {
    await api.post("/auth/register/", {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      password2
    });
    // auto login after register
    await login();
  };

  const forgot = async () => {
    if (!email.trim()) {
      alert("Введите email, чтобы восстановить пароль.");
      return;
    }
    await api.post("/auth/forgot/", { email: email.trim().toLowerCase() });
    alert("Если аккаунт существует, письмо для восстановления будет отправлено.");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "login") await login();
      else await register();
    } catch (err: any) {
      console.error(err);
      const data = err?.response?.data;
      const msg =
        data?.detail ||
        data?.email ||
        data?.password ||
        data?.password2 ||
        "Не удалось выполнить действие.";
      alert(Array.isArray(msg) ? msg.join("\n") : String(msg));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card shadow-sm">
        <div className="auth-brand">
          <div className="auth-logo">SB</div>
          <div>
            <div className="auth-title">{title}</div>
            <div className="auth-subtitle text-muted">
              {mode === "login" ? "Вход в аккаунт" : "Создание аккаунта"}
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-3">
          {mode === "register" && (
            <div className="mb-2">
              <label className="form-label text-muted">Имя</label>
              <input
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например, Иван"
              />
            </div>
          )}

          <div className="mb-2">
            <label className="form-label text-muted">Email</label>
            <input
              className="form-control"
              // В прототипе допускаем логин без '@' (например, 'admin'), чтобы удобно демонстрировать.
              // Для регистрации всё равно требуется корректный email.
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
            />
          </div>

          <div className="mb-2">
            <label className="form-label text-muted">Пароль</label>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {mode === "register" && (
            <div className="mb-2">
              <label className="form-label text-muted">Повтор пароля</label>
              <input
                className="form-control"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="••••••••"
              />
              {password2 && password !== password2 && (
                <div className="text-danger" style={{ fontSize: "0.9rem" }}>
                  Пароли не совпадают
                </div>
              )}
            </div>
          )}

          <button className="btn btn-primary w-100 mt-2" type="submit" disabled={!canSubmit}>
            {mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>

          <div className="d-flex justify-content-between align-items-center mt-3">
            <button
              type="button"
              className="btn btn-link p-0"
              onClick={forgot}
              style={{ textDecoration: "none" }}
            >
              Забыли пароль?
            </button>
            <button
              type="button"
              className="btn btn-link p-0"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              style={{ textDecoration: "none" }}
            >
              {mode === "login" ? "Регистрация" : "У меня уже есть аккаунт"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


