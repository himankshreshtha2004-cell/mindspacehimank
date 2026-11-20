import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "./styles.css";
import App from "./App";
import { StoreProvider, loadData } from "./state/store";
import { UIProvider } from "./state/ui";
import { fitView } from "./components/MindCanvas";

const d = loadData();
const ws = d.workspaces.find((w) => w.id === d.activeId) || d.workspaces[0];
const cam = fitView(ws, { w: window.innerWidth, h: window.innerHeight });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StoreProvider>
      <UIProvider initialCam={cam}>
        <App />
      </UIProvider>
    </StoreProvider>
  </React.StrictMode>,
);
