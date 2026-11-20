import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUI } from "../state/ui";
import { I } from "./Icons";

export function Toasts() {
  const ui = useUI();
  return (
    <div className="toasts ui" aria-live="polite">
      <AnimatePresence initial={false}>
        {ui.toasts.map((t) => (
          <motion.div key={t.id} layout className={"toast k-" + (t.kind || "ok")} initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15 } }} transition={{ type: "spring", stiffness: 420, damping: 32 }}>
            <span className="t-ic">{t.kind === "warn" ? "!" : t.kind === "info" ? "i" : <I.Check size={12} />}</span>
            <span className="t-txt">{t.text}</span>
            {t.action && <button className="t-act" onClick={() => { t.action!.run(); ui.dismissToast(t.id); }}>{t.action.label}</button>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function ConfirmDialog() {
  const ui = useUI();
  const r = ui.confirmReq;
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (r) window.setTimeout(() => okRef.current?.focus(), 40); }, [r]);
  return (
    <AnimatePresence>
      {r && (
        <motion.div className="modal-wrap ui confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onPointerDown={(e) => e.target === e.currentTarget && ui.closeConfirm(false)}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") ui.closeConfirm(false); }}>
          <motion.div className="modal sm" role="alertdialog" aria-modal="true" aria-label={r.title} initial={{ scale: 0.94, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}>
            <div className={"m-ic" + (r.danger ? " danger" : "")}>{r.danger ? <I.Trash size={20} /> : <I.Help size={20} />}</div>
            <h3>{r.title}</h3>
            {r.body && <p className="muted">{r.body}</p>}
            <div className="row-end">
              <button className="btn ghost" onClick={() => ui.closeConfirm(false)}>Cancel</button>
              <button ref={okRef} className={"btn" + (r.danger ? " danger-solid" : "")} onClick={() => ui.closeConfirm(true)}>{r.ok || "Confirm"}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** One global tooltip driven by [data-tip] attributes, shown after a short hover delay (mouse only). */
export function Tooltip() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; side: "top" | "bottom" | "right" } | null>(null);
  useEffect(() => {
    let timer = 0; let cur: HTMLElement | null = null;
    const over = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = (e.target as HTMLElement).closest?.("[data-tip]") as HTMLElement | null;
      if (el === cur) return;
      cur = el; window.clearTimeout(timer); setTip(null);
      if (!el || document.body.classList.contains("dragging")) return;
      timer = window.setTimeout(() => {
        if (!el.isConnected) return;
        const r = el.getBoundingClientRect();
        let side = (el.dataset.tipSide as "right") || (r.top < 90 ? "bottom" : "top");
        if (side === "right" && window.innerWidth < 1100 && !document.querySelector(".sidebar.open")) side = "right";
        const x = side === "right" ? r.right + 10 : r.left + r.width / 2;
        const y = side === "right" ? r.top + r.height / 2 : side === "bottom" ? r.bottom + 8 : r.top - 8;
        setTip({ text: el.dataset.tip || "", x, y, side });
      }, 480);
    };
    const hide = () => { window.clearTimeout(timer); setTip(null); cur = null; };
    window.addEventListener("pointerover", over);
    window.addEventListener("pointerdown", hide);
    window.addEventListener("wheel", hide, { passive: true });
    window.addEventListener("keydown", hide);
    return () => { window.removeEventListener("pointerover", over); window.removeEventListener("pointerdown", hide); window.removeEventListener("wheel", hide); window.removeEventListener("keydown", hide); };
  }, []);
  return (
    <AnimatePresence>
      {tip && (
        <motion.div key={tip.text + tip.x} className={"tooltip s-" + tip.side} style={{ left: tip.x, top: tip.y }} role="tooltip"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
          <span>{tip.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const SHORTCUTS: [string, string][] = [
  ["N", "New thought at the cursor"], ["1 – 5", "Pick a type in the create menu"], ["Delete / Backspace", "Delete selected nodes"],
  ["Ctrl/⌘ Z", "Undo"], ["Ctrl/⌘ ⇧ Z  ·  Ctrl Y", "Redo"], ["Ctrl/⌘ F", "Search"], ["Ctrl/⌘ D", "Duplicate selection"],
  ["Esc", "Close / exit the active mode"], ["Space + drag", "Pan the canvas"], ["Shift + click", "Multi-select"],
  ["Shift + drag", "Select an area"], ["C", "Connect mode"], ["G", "Group selection"], ["E / Enter", "Expand selected node"],
  ["F", "Focus mode"], ["← / →", "Previous / next connected node (focus)"], ["+ / −  ·  0", "Zoom · fit to screen"], ["M", "Toggle mini-map"],
];

export function HelpModal() {
  const ui = useUI();
  return (
    <AnimatePresence>
      {ui.help && (
        <motion.div className="modal-wrap ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.target === e.currentTarget && ui.setHelp(false)}>
          <motion.div className="modal help" role="dialog" aria-label="Help and shortcuts" initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0 }}>
            <div className="row-between"><h3>Navigating your mindspace</h3><button className="ib" onClick={() => ui.setHelp(false)} aria-label="Close"><I.Close /></button></div>
            <div className="help-grid">
              <div>
                <h4>Mouse & touch</h4>
                <ul className="help-list">
                  <li><b>Click empty space</b> — open the create menu</li>
                  <li><b>Drag a node</b> — move it; neighbours lean in</li>
                  <li><b>Drag the small dot</b> on a node — connect it</li>
                  <li><b>Double-click a node</b> — expand into a card</li>
                  <li><b>Click a line</b> — change or remove the relationship</li>
                  <li><b>Drag a group label</b> — move the whole group</li>
                  <li><b>Scroll</b> to pan · <b>Ctrl + scroll</b> or pinch to zoom</li>
                  <li><b>Mini-map</b> — click or drag to jump around</li>
                </ul>
              </div>
              <div>
                <h4>Keyboard</h4>
                <dl className="keys">{SHORTCUTS.map(([k, d]) => <React.Fragment key={k}><dt><kbd>{k}</kbd></dt><dd>{d}</dd></React.Fragment>)}</dl>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
