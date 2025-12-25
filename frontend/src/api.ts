import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true
});

const authApi = axios.create({
  baseURL: "/api",
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  const startDay = localStorage.getItem("period_start_day");
  if (startDay) {
    config.headers = config.headers ?? {};
    // Optional: server also accepts start_day as query param; header is for future use.
    config.headers["X-Period-Start-Day"] = startDay;
  }
  return config;
});

let isRefreshing = false;
let refreshWaiters: Array<(token: string | null) => void> = [];

function notifyRefreshWaiters(token: string | null) {
  refreshWaiters.forEach((cb) => cb(token));
  refreshWaiters = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error?.config;
    const status = error?.response?.status;

    if (!original || status !== 401) {
      return Promise.reject(error);
    }

    // avoid infinite loop
    if (original.__isRetryRequest) {
      return Promise.reject(error);
    }

    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) {
      localStorage.removeItem("access_token");
      window.dispatchEvent(new Event("auth:logout"));
      return Promise.reject(error);
    }

    if (isRefreshing) {
      const token = await new Promise<string | null>((resolve) => {
        refreshWaiters.push(resolve);
      });
      if (!token) {
        return Promise.reject(error);
      }
      original.__isRetryRequest = true;
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    }

    isRefreshing = true;
    try {
      const resp = await authApi.post<{ access: string }>("/auth/token/refresh/", {
        refresh
      });
      localStorage.setItem("access_token", resp.data.access);
      notifyRefreshWaiters(resp.data.access);

      original.__isRetryRequest = true;
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${resp.data.access}`;
      return api(original);
    } catch (e) {
      notifyRefreshWaiters(null);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.dispatchEvent(new Event("auth:logout"));
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);


