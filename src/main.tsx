import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { MindLockerProvider } from "./context/MindLockerContext.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MindLockerProvider>
      <App />
    </MindLockerProvider>
  </React.StrictMode>
);