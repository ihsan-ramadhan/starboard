import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import ContextMenuProvider from "./components/ContextMenuProvider";
import App from "./App";
import "./globals.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ContextMenuProvider />
      <Toaster richColors position="top-right" />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
