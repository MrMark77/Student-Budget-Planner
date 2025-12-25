import React from "react";
import ReactDOM from "react-dom/client";
import "modern-normalize/modern-normalize.css";
import "./global.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { App } from "./App";

// Bootstrap theme hook: default
document.documentElement.setAttribute(
  "data-bs-theme",
  (localStorage.getItem("theme") as "light" | "dark") || "light"
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


