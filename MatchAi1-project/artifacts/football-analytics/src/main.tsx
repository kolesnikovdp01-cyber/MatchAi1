import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize Telegram Mini App
try {
  const tg = (window as any).Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }
} catch { /* ignore if not in Telegram */ }

createRoot(document.getElementById("root")!).render(<App />);
