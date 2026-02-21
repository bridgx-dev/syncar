import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { SynnelProvider } from "@synnel/react";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SynnelProvider options={{ url: "ws://localhost:3000" }}>
      <App />
    </SynnelProvider>
  </StrictMode>,
);
