import React, { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { useStore } from "./state/store";
import { useUI } from "./state/ui";
import { neighbors } from "./state/graph";
import MindCanvas, { fitView } from "./components/MindCanvas";
import { FloatingToolbar, MiniMap, Sidebar, TopBar, openCreateAtPointer } from "./components/Chrome";
import { DetailPanel, ExpandedCard, FocusBar, GroupDialog } from "./components/Panels";
import { Views } from "./components/Views";
import { ConfirmDialog, HelpModal, Toasts, Tooltip } from "./components/Overlays";
import { isMobile, isTyping, useActions } from "./actions";

function useShortcuts() {
  const store = useStore();
  const ui = useUI();
  const act = useActions();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      // search + undo/redo work everywhere except while typing
      if (mod && k === "f") { e.preventDefault(); ui.setView("canvas"); const el = document.getElementById("search-input") as HTMLInputElement | null; if (window.innerWidth < 720) (document.querySelector(".m-only[aria-label='Search']") as HTMLElement | null)?.click(); el?.focus(); el?.select(); return; }
      if (isTyping(e.target)) return;
      if (ui.confirmReq || ui.groupDialog) return;
      if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) { if (store.canRedo) { store.redo(); ui.toast("Redone", "info"); } } else if (store.canUndo) { store.undo(); ui.toast("Undone", "info"); } return; }
      if (mod && k === "y") { e.preventDefault(); if (store.canRedo) { store.redo(); ui.toast("Redone", "info"); } return; }
      if (mod && k === "d") { e.preventDefault(); if (ui.sel.length) act.duplicateNodes(ui.sel); return; }
      if (mod || e.altKey) return;
      if (e.key === "Escape") {
        if (ui.help) return ui.setHelp(false);
        if (ui.menu) return ui.setMenu(null);
        if (ui.expanded) return ui.setExpanded(null);
        if (ui.focus) return act.exitFocus();
        if (ui.view !== "canvas") return ui.setView("canvas");
        if (ui.tool === "connect") { ui.setTool("select"); ui.setConnectFrom(null); return; }
        if (ui.query) return ui.setQuery("");
        if (ui.sel.length || ui.selEdge) { ui.setSel([]); ui.setSelEdge(null); return; }
        if (ui.sidebarOpen) return ui.setSidebarOpen(false);
        return;
      }
      if (e.key === "?") { ui.setHelp(!ui.help); return; }
      if (ui.view !== "canvas" || ui.help) return;
      if (ui.focus && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        (document.querySelector(e.key === "ArrowLeft" ? ".focusbar [aria-label='Previous connected node']" : ".focusbar [aria-label='Next connected node']") as HTMLElement | null)?.click();
        return;
      }
      if (k === "n") { e.preventDefault(); if (ui.focus) act.exitFocus(); openCreateAtPointer(ui); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && ui.sel.length) { e.preventDefault(); act.deleteNodes(ui.sel); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && ui.selEdge) {
        e.preventDefault(); const id = ui.selEdge;
        store.update((w) => ({ ...w, edges: w.edges.filter((x) => x.id !== id) })); ui.setSelEdge(null); ui.setMenu(null);
        ui.toast("Connection removed", "ok", { label: "Undo", run: store.undo }); return;
      }
      if (k === "c") { ui.setTool(ui.tool === "connect" ? "select" : "connect"); ui.setConnectFrom(null); ui.setMenu(null); return; }
      if (k === "g") { if (ui.sel.length >= 2) ui.setGroupDialog(true); else ui.toast("Select 2 or more nodes to group (Shift + click)", "info"); return; }
      if (k === "f") { if (ui.focus) act.exitFocus(); else act.enterFocus(); return; }
      if ((k === "e" || e.key === "Enter") && ui.sel.length === 1) { ui.setExpanded(ui.expanded ? null : ui.sel[0]); return; }
      if (k === "m") { ui.setMinimap(!ui.minimap); return; }
      if (k === "0") { const c = fitView(store.ws, { w: window.innerWidth, h: window.innerHeight }); ui.flyTo({ x: c.x, y: c.y, k: c.k }, 600); return; }
      if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
        const f = e.key === "+" || e.key === "=" ? 1.2 : 1 / 1.2;
        const { w, h } = ui.canvasSize.current; const nk = Math.max(0.2, Math.min(2.6, ui.cam.k * f));
        const wx = (w / 2 - ui.cam.x) / ui.cam.k, wy = (h / 2 - ui.cam.y) / ui.cam.k;
        ui.flyTo({ k: nk, x: w / 2 - wx * nk, y: h / 2 - wy * nk }, 220); return;
      }
      if (e.key.startsWith("Arrow") && ui.sel.length === 1 && !ui.focus) {
        // hop selection to the nearest connected node in that direction
        const n = store.ws.nodes.find((x) => x.id === ui.sel[0]); if (!n) return;
        const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key] as [number, number];
        const best = neighbors(store.ws, n.id).map((m) => { const dx = m.x - n.x, dy = m.y - n.y, d = Math.hypot(dx, dy) || 1; return { m, s: (dx * dir[0] + dy * dir[1]) / d }; })
          .filter((x) => x.s > 0.3).sort((a, b) => b.s - a.s)[0];
        if (best) { e.preventDefault(); act.reveal(best.m); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [store, ui, act]);
}

export default function App() {
  const ui = useUI();
  const { settings, ws } = useStore();
  useShortcuts();
  const reduce = settings.reduceMotion;
  useEffect(() => { document.documentElement.classList.toggle("reduce", reduce); }, [reduce]);
  // drop selection that no longer exists (after undo / delete / switching spaces)
  useEffect(() => {
    const ids = new Set(ws.nodes.filter((n) => !n.archived && !n.inbox).map((n) => n.id));
    if (ui.sel.some((id) => !ids.has(id))) ui.setSel(ui.sel.filter((id) => ids.has(id)));
    if (ui.expanded && !ids.has(ui.expanded)) ui.setExpanded(null);
    if (ui.focus && !ids.has(ui.focus)) ui.setFocus(null);
    if (ui.selEdge && !ws.edges.some((e) => e.id === ui.selEdge)) ui.setSelEdge(null);
  }, [ws, ui]);
  // keep a newly selected node clear of the detail panel / bottom sheet
  const selKey = ui.sel.length === 1 ? ui.sel[0] : "";
  useEffect(() => {
    if (!selKey || ui.focus || ui.expanded) return;
    const n = ws.nodes.find((x) => x.id === selKey); if (!n) return;
    const sx = n.x * ui.cam.k + ui.cam.x, sy = n.y * ui.cam.k + ui.cam.y;
    const W = window.innerWidth, H = window.innerHeight;
    if (W < 900) {
      const limit = H * 0.36 - 40;
      if (sy > limit) ui.flyTo({ x: ui.cam.x, y: ui.cam.y - (sy - Math.max(120, limit * 0.7)) }, 450);
    } else {
      const right = W - 372 - 14 - 150 * ui.cam.k - 30;
      const left = (W >= 1100 ? 240 : 20) + 130 * ui.cam.k;
      const bottom = H - 190, top = 110;
      let dx = 0, dy = 0;
      if (sx > right) dx = right - sx; else if (sx < left) dx = left - sx;
      if (sy > bottom) dy = bottom - sy; else if (sy < top) dy = top - sy;
      if (dx || dy) ui.flyTo({ x: ui.cam.x + dx, y: ui.cam.y + dy }, 450);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);
  useEffect(() => { if (isMobile()) ui.setMinimap(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const panelOpen = ui.view === "canvas" && !ui.focus && !ui.expanded && ui.sel.length > 0;
  return (
    <MotionConfig reducedMotion={reduce ? "always" : "user"}>
    <div className={"app" + (ui.focus ? " in-focus" : "") + (ui.view !== "canvas" ? " in-view" : "") + (reduce ? " reduce" : "") + (panelOpen ? " panel-open" : "")}>
      <MindCanvas />
      <div className="focus-vignette" aria-hidden="true" />
      <Sidebar />
      <TopBar />
      <Views />
      <DetailPanel />
      <ExpandedCard />
      <FloatingToolbar />
      <MiniMap />
      {ui.focus && <FocusBar />}
      <GroupDialog />
      <HelpModal />
      <ConfirmDialog />
      <Toasts />
      <Tooltip />
    </div>
    </MotionConfig>
  );
}
