import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "highlight.js/styles/github-dark.css";
import "./styles.css";
import { App } from "./App.tsx";

const root = document.getElementById("root") as HTMLElement | null;
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
