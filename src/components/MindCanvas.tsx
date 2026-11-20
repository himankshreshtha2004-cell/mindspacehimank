import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../state/store";
import { useUI } from "../state/ui";
import type { Edge, MNode, NodeType, Relation, Workspace } from "../state/types";
import { REL_META, TYPE_META } from "../state/types";
import { byId, groupBounds, neighbors, progressOf, searchNodes, visibleNodes } from "../state/graph";
import { uid } from "../state/demo";
import { ThoughtNode, type NodeFlags } from "./ThoughtNode";
import { I, TypeIcon } from "./Icons";

export const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
const isTouch = (e: React.PointerEvent | PointerEvent) => e.pointerType === "touch";

/* ------------------------------------------------------------------ background */
function Backdrop({ camRef, enabled, reduce }: { camRef: React.MutableRefObject<{ x: number; y: number; k: number }>; enabled: boolean; reduce: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv || !enabled) return;
    const ctx = cv.getContext("2d")!;
    let raf = 0, w = 0, h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); window.addEventListener("resize", resize);
    const cols = ["168,85,247", "59,130,246", "34,211,238", "236,72,153", "241,245,249"];
    const P = Array.from({ length: Math.round(Math.min(90, (w * h) / 16000)) }, () => ({
      x: Math.random() * 2000, y: Math.random() * 1400, z: 0.2 + Math.random() * 0.8,
      r: 0.4 + Math.random() * 1.3, vx: (Math.random() - 0.5) * 0.06, vy: (Math.random() - 0.5) * 0.05,
      c: cols[Math.random() < 0.6 ? 4 : Math.floor(Math.random() * 4)], tw: Math.random() * 6.28,
    }));
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const cam = camRef.current;
      for (const p of P) {
        if (!reduce) { p.x += p.vx; p.y += p.vy; }
        const px = (((p.x + cam.x * 0.04 * p.z) % 2000) + 2000) % 2000 * (w / 2000);
        const py = (((p.y + cam.y * 0.04 * p.z) % 1400) + 1400) % 1400 * (h / 1400);
        const a = (0.18 + 0.35 * p.z) * (reduce ? 1 : 0.65 + 0.35 * Math.sin(t / 1600 + p.tw));
        ctx.beginPath(); ctx.arc(px, py, p.r * (0.6 + p.z * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.c},${a.toFixed(3)})`; ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [enabled, reduce, camRef]);
  return enabled ? <canvas ref={ref} className="particles" aria-hidden="true" /> : null;
}

/* ------------------------------------------------------------------ edge geometry */
function edgeGeom(a: MNode, b: MNode) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const bend = Math.min(60, len * 0.12);
  const cx = (a.x + b.x) / 2 - (dy / len) * bend, cy = (a.y + b.y) / 2 + (dx / len) * bend;
  return { d: `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`, mx: (a.x + 2 * cx + b.x) / 4, my: (a.y + 2 * cy + b.y) / 4 };
}

/* ------------------------------------------------------------------ menus */
const TYPES: NodeType[] = ["thought", "goal", "project", "task", "inspiration"];
const HINT: Record<NodeType, string> = {
  thought: "A quick idea", goal: "A long-term ambition", project: "A body of work", task: "Something to do", inspiration: "A reference or spark",
};
const menuAnim = { initial: { opacity: 0, scale: 0.92, y: 6 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.95, y: 4 }, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } };

function clampMenu(x: number, y: number, w: number, h: number) {
  return { left: Math.max(10, Math.min(window.innerWidth - w - 10, x)), top: Math.max(70, Math.min(window.innerHeight - h - 10, y)) };
}

function CreationMenu({ sx, sy, onPick, onClose }: { sx: number; sy: number; onPick: (t: NodeType) => void; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= 5) { e.preventDefault(); onPick(TYPES[n - 1]); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onPick]);
  const pos = clampMenu(sx + 8, sy + 8, 236, 300);
  return (
    <motion.div className="menu create-menu ui" style={pos} {...menuAnim} role="menu" aria-label="Create">
      <div className="menu-h">Create here <button className="ib" onClick={onClose} aria-label="Close"><I.Close size={14} /></button></div>
      {TYPES.map((t, i) => (
        <button key={t} className="menu-i" role="menuitem" onClick={() => onPick(t)} style={{ "--c": TYPE_META[t].color } as React.CSSProperties}>
          <span className="mi-ic"><TypeIcon type={t} size={15} /></span>
          <span className="mi-t"><b>{TYPE_META[t].label}</b><small>{HINT[t]}</small></span>
          <kbd>{i + 1}</kbd>
        </button>
      ))}
    </motion.div>
  );
}

function RelationMenu({ sx, sy, current, fresh, onPick, onDelete, onClose }: { sx: number; sy: number; current: Relation; fresh: boolean; onPick: (r: Relation) => void; onDelete: () => void; onClose: () => void }) {
  const pos = clampMenu(sx - 110, sy + 14, 220, 280);
  return (
    <motion.div className="menu rel-menu ui" style={pos} {...menuAnim} role="menu" aria-label="Relationship">
      <div className="menu-h">{fresh ? "How are they related?" : "Connection"} <button className="ib" onClick={onClose} aria-label="Close"><I.Close size={14} /></button></div>
      {(Object.keys(REL_META) as Relation[]).map((r) => (
        <button key={r} className={"menu-i rel" + (r === current ? " on" : "")} onClick={() => onPick(r)} role="menuitemradio" aria-checked={r === current}>
          <span className={"rel-dot r-" + r} /> <span className="mi-t"><b>{REL_META[r].label}</b></span>{r === current && <I.Check size={14} />}
        </button>
      ))}
      <button className="menu-i danger" onClick={onDelete}><I.Trash size={15} /> <span className="mi-t"><b>Remove connection</b></span></button>
    </motion.div>
  );
}

function GroupMenu({ sx, sy, groupId, onClose }: { sx: number; sy: number; groupId: string; onClose: () => void }) {
  const { ws, update } = useStore();
  const { toast } = useUI();
  const g = ws.groups.find((x) => x.id === groupId);
  const [name, setName] = useState(g?.name || "");
  if (!g) return null;
  const pos = clampMenu(sx, sy + 12, 240, 230);
  const save = (patch: Partial<typeof g>) => update((w) => ({ ...w, groups: w.groups.map((x) => (x.id === g.id ? { ...x, ...patch } : x)) }));
  return (
    <motion.div className="menu ui" style={pos} {...menuAnim}>
      <div className="menu-h">Group <button className="ib" onClick={onClose} aria-label="Close"><I.Close size={14} /></button></div>
      <div className="menu-pad">
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== g.name && save({ name: name.trim() })}
          onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); onClose(); } }} aria-label="Group name" />
        <div className="swatches">
          {["#A855F7", "#3B82F6", "#22D3EE", "#EC4899", "#8B5CF6", "#F1F5F9"].map((c) => (
            <button key={c} className={"sw" + (c === g.color ? " on" : "")} style={{ background: c }} onClick={() => save({ color: c })} aria-label={"Colour " + c} />
          ))}
        </div>
        <div className="muted small">{g.nodeIds.length} nodes · drag the label to move them together</div>
      </div>
      <button className="menu-i danger" onClick={() => { update((w) => ({ ...w, groups: w.groups.filter((x) => x.id !== g.id) })); toast("Group removed — nodes kept"); onClose(); }}>
        <I.Group size={15} /> <span className="mi-t"><b>Ungroup</b></span>
      </button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ canvas */
type Gesture =
  | { m: "node-pending" | "node-drag"; ids: string[]; id: string; sx: number; sy: number; orig: Record<string, { x: number; y: number }> }
  | { m: "group-pending" | "group-drag"; gid: string; ids: string[]; sx: number; sy: number; orig: Record<string, { x: number; y: number }> }
  | { m: "pan-pending" | "pan"; sx: number; sy: number; cx: number; cy: number; empty: boolean }
  | { m: "marquee"; sx: number; sy: number; x: number; y: number }
  | { m: "link"; from: string; x: number; y: number }
  | { m: "pinch" }
  | null;

export default function MindCanvas() {
  const store = useStore();
  const ui = useUI();
  const { ws, update, checkpoint, settings, log } = store;
  const { cam, setCam, sel, setSel } = ui;
  const root = useRef<HTMLDivElement>(null);
  const camRef = useRef(cam); camRef.current = cam;
  const wsRef = useRef(ws); wsRef.current = ws;
  const uiRef = useRef(ui); uiRef.current = ui;
  const g = useRef<Gesture>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch0 = useRef<{ d: number; mx: number; my: number; cam: { x: number; y: number; k: number } } | null>(null);
  const [dragIds, setDragIds] = useState<string[]>([]);
  const [settleIds, setSettleIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [linkLine, setLinkLine] = useState<{ from: string; x: number; y: number } | null>(null);
  const [freshEdges, setFreshEdges] = useState<Set<string>>(new Set());
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [space, setSpace] = useState(false);
  const reduce = settings.reduceMotion || (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  const toWorld = useCallback((sx: number, sy: number) => { const c = camRef.current; return { x: (sx - c.x) / c.k, y: (sy - c.y) / c.k }; }, []);
  const toScreen = useCallback((wx: number, wy: number) => { const c = camRef.current; return { x: wx * c.k + c.x, y: wy * c.k + c.y }; }, []);

  /* ---------- size ---------- */
  useEffect(() => {
    const r = () => { ui.canvasSize.current = { w: window.innerWidth, h: window.innerHeight, left: 0, top: 0 }; };
    r(); window.addEventListener("resize", r); return () => window.removeEventListener("resize", r);
  }, [ui.canvasSize]);

  /* ---------- space-to-pan ---------- */
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName));
    const d = (e: KeyboardEvent) => { if (e.code === "Space" && !typing(e.target)) { e.preventDefault(); setSpace(true); } };
    const u = (e: KeyboardEvent) => { if (e.code === "Space") setSpace(false); };
    window.addEventListener("keydown", d); window.addEventListener("keyup", u);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); };
  }, []);

  /* ---------- creation + connection helpers ---------- */
  const createNode = useCallback((type: NodeType, wx: number, wy: number) => {
    const now = Date.now();
    const id = uid("n");
    const n: MNode = {
      id, type, title: `New ${TYPE_META[type].label.toLowerCase()}`, description: "", notes: "", x: Math.round(wx), y: Math.round(wy),
      size: type === "goal" || type === "project" ? "md" : "sm", priority: "medium", items: [], links: [], createdAt: now, updatedAt: now,
    };
    update((w) => ({ ...w, nodes: [...w.nodes, n] }));
    uiRef.current.setMenu(null);
    uiRef.current.setSel([id]); uiRef.current.setSelEdge(null);
    uiRef.current.markFresh(id);
    uiRef.current.toast(`${TYPE_META[type].label} created`);
    log(`Created ${TYPE_META[type].label.toLowerCase()} “${n.title}”`, "create");
  }, [update, log]);
  useEffect(() => { ui.registerCreate(createNode); }, [ui, createNode]);

  const createEdge = useCallback((from: string, to: string) => {
    if (from === to) return;
    const w = wsRef.current;
    const exists = w.edges.find((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from));
    const m = byId(w);
    if (exists) { uiRef.current.toast("Those two are already connected", "info"); uiRef.current.setSelEdge(exists.id); return; }
    const e: Edge = { id: uid("e"), from, to, rel: "related", createdAt: Date.now() };
    update((x) => ({ ...x, edges: [...x.edges, e] }));
    setFreshEdges((s) => new Set(s).add(e.id));
    window.setTimeout(() => setFreshEdges((s) => { const n = new Set(s); n.delete(e.id); return n; }), 1400);
    uiRef.current.markFresh(from); uiRef.current.markFresh(to);
    const a = m.get(from)!, b = m.get(to)!;
    const mid = edgeGeom(a, b), sp = toScreen(mid.mx, mid.my);
    uiRef.current.setSelEdge(e.id);
    uiRef.current.setMenu({ kind: "relation", sx: sp.x, sy: sp.y, edgeId: e.id, fresh: true });
    log(`Connected “${a.title}” → “${b.title}”`, "connect");
  }, [update, toScreen, log]);

  const toggleDone = useCallback((id: string) => {
    const n = wsRef.current.nodes.find((x) => x.id === id); if (!n) return;
    const done = !n.done;
    store.patchNode(id, { done, items: done ? n.items.map((i) => ({ ...i, done: true, status: "done" as const })) : n.items });
    uiRef.current.markFresh(id);
    if (done) { uiRef.current.toast(`Task complete — “${n.title}”`); log(`Completed task “${n.title}”`, "done"); }
  }, [store, log]);

  /* ---------- pointer handling ---------- */
  const onPointerDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest(".ui")) return;
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // two fingers → pinch zoom (cancels whatever one finger started)
      const [p1, p2] = [...pointers.current.values()];
      pinch0.current = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2, cam: { ...camRef.current } };
      g.current = { m: "pinch" }; setDragIds([]); setLinkLine(null);
      return;
    }
    if (e.button === 1 || (space && e.button === 0)) { g.current = { m: "pan", sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, empty: false }; root.current?.setPointerCapture(e.pointerId); return; }
    if (e.button !== 0) return;
    root.current?.setPointerCapture(e.pointerId);
    const nodeEl = t.closest("[data-id]") as HTMLElement | null;
    const id = nodeEl?.dataset.id;
    if (id && t.closest("[data-handle]")) { const p = toWorld(e.clientX, e.clientY); g.current = { m: "link", from: id, x: p.x, y: p.y }; setLinkLine({ from: id, x: p.x, y: p.y }); return; }
    if (id && (t.closest("[data-expand]") || t.closest("[data-check]"))) { g.current = null; return; }
    if (id) {
      if (ui.tool === "connect") { const p = toWorld(e.clientX, e.clientY); g.current = { m: "link", from: id, x: p.x, y: p.y }; return; }
      const ids = sel.includes(id) && sel.length > 1 ? sel : [id];
      const orig: Record<string, { x: number; y: number }> = {};
      ws.nodes.forEach((n) => { if (ids.includes(n.id)) orig[n.id] = { x: n.x, y: n.y }; });
      g.current = { m: "node-pending", ids, id, sx: e.clientX, sy: e.clientY, orig };
      return;
    }
    const grp = (t.closest("[data-group]") as HTMLElement | null)?.dataset.group;
    if (grp) {
      const G = ws.groups.find((x) => x.id === grp);
      if (G) {
        const orig: Record<string, { x: number; y: number }> = {};
        ws.nodes.forEach((n) => { if (G.nodeIds.includes(n.id)) orig[n.id] = { x: n.x, y: n.y }; });
        g.current = { m: "group-pending", gid: grp, ids: G.nodeIds, sx: e.clientX, sy: e.clientY, orig };
      }
      return;
    }
    const edgeId = (t.closest("[data-edge]") as Element | null)?.getAttribute("data-edge");
    if (edgeId) {
      const ed = ws.edges.find((x) => x.id === edgeId);
      ui.setSelEdge(edgeId); ui.setSel([]);
      if (ed) ui.setMenu({ kind: "relation", sx: e.clientX, sy: e.clientY, edgeId, fresh: false });
      g.current = null; return;
    }
    if (e.shiftKey) { g.current = { m: "marquee", sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY }; setMarquee({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY }); return; }
    g.current = { m: "pan-pending", sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, empty: true };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = g.current; if (!s) return;
    if (s.m === "pinch" && pinch0.current && pointers.current.size >= 2) {
      const [p1, p2] = [...pointers.current.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y), mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const P0 = pinch0.current, k = Math.max(0.2, Math.min(2.6, P0.cam.k * (d / P0.d)));
      const wx = (P0.mx - P0.cam.x) / P0.cam.k, wy = (P0.my - P0.cam.y) / P0.cam.k;
      setCam({ k, x: mx - wx * k, y: my - wy * k });
      return;
    }
    const dx = e.clientX - ("sx" in s ? s.sx : 0), dy = e.clientY - ("sy" in s ? s.sy : 0);
    const far = Math.hypot(dx, dy) > (isTouch(e) ? 8 : 4);
    if (s.m === "node-pending" && far) { checkpoint(); g.current = { ...s, m: "node-drag" }; setDragIds(s.ids); }
    if (s.m === "group-pending" && far) { checkpoint(); g.current = { ...s, m: "group-drag" }; setDragIds(s.ids); }
    if (s.m === "pan-pending" && far) g.current = { ...s, m: "pan" };
    const cur = g.current!;
    if (cur.m === "node-drag" || cur.m === "group-drag") {
      const k = camRef.current.k;
      update((w) => ({ ...w, nodes: w.nodes.map((n) => (cur.orig[n.id] ? { ...n, x: Math.round(cur.orig[n.id].x + dx / k), y: Math.round(cur.orig[n.id].y + dy / k) } : n)) }), false);
    } else if (cur.m === "pan") {
      setCam((c) => ({ ...c, x: cur.cx + dx, y: cur.cy + dy }));
    } else if (cur.m === "marquee") {
      setMarquee({ x0: cur.sx, y0: cur.sy, x1: e.clientX, y1: e.clientY });
    } else if (cur.m === "link") {
      const p = toWorld(e.clientX, e.clientY);
      setLinkLine({ from: cur.from, x: p.x, y: p.y });
    }
  };

  const clickNode = (id: string, shift: boolean) => {
    if (ui.tool === "connect") {
      if (!ui.connectFrom) { ui.setConnectFrom(id); ui.toast("Now select the node to connect to", "info"); }
      else if (ui.connectFrom === id) ui.setConnectFrom(null);
      else { createEdge(ui.connectFrom, id); ui.setConnectFrom(null); }
      return;
    }
    ui.setSelEdge(null); ui.setMenu(null);
    if (shift) ui.setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
    else ui.setSel([id]);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const s = g.current;
    if (s?.m === "pinch") { if (pointers.current.size < 2) { g.current = null; pinch0.current = null; } return; }
    g.current = null;
    if (!s) return;
    const t = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null) || (e.target as HTMLElement);
    if (s.m === "node-drag" || s.m === "group-drag") {
      setSettleIds(s.ids); setDragIds([]);
      window.setTimeout(() => setSettleIds([]), 650);
      return;
    }
    if (s.m === "node-pending") {
      const id = s.id;
      if (t.closest("[data-check]")) return;
      clickNode(id, e.shiftKey);
      return;
    }
    if (s.m === "group-pending") {
      ui.setMenu({ kind: "group", sx: e.clientX, sy: e.clientY, groupId: s.gid });
      return;
    }
    if (s.m === "link") {
      setLinkLine(null);
      const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const to = (under?.closest("[data-id]") as HTMLElement | null)?.dataset.id;
      if (to && to !== s.from) { createEdge(s.from, to); ui.setConnectFrom(null); }
      else if (!to || to === s.from) {
        if (ui.tool === "connect") clickNode(s.from, false);
        else if (to === s.from) clickNode(s.from, false);
      }
      return;
    }
    if (s.m === "marquee") {
      setMarquee(null);
      const a = toWorld(Math.min(s.sx, e.clientX), Math.min(s.sy, e.clientY)), b = toWorld(Math.max(s.sx, e.clientX), Math.max(s.sy, e.clientY));
      const hit = visibleNodes(ws).filter((n) => n.x >= a.x && n.x <= b.x && n.y >= a.y && n.y <= b.y).map((n) => n.id);
      ui.setSel([...new Set([...sel, ...hit])]);
      if (hit.length) ui.toast(`${hit.length} node${hit.length > 1 ? "s" : ""} selected`, "info");
      return;
    }
    if (s.m === "pan-pending") {
      // click on empty canvas
      if (ui.menu) { ui.setMenu(null); return; }
      if (ui.expanded) { ui.setExpanded(null); return; }
      if (ui.tool === "connect" && ui.connectFrom) { ui.setConnectFrom(null); return; }
      if (sel.length || ui.selEdge) { ui.setSel([]); ui.setSelEdge(null); return; }
      if (ui.focus) return;
      const p = toWorld(e.clientX, e.clientY);
      ui.setMenu({ kind: "create", sx: e.clientX, sy: e.clientY, wx: p.x, wy: p.y });
    }
  };

  // with pointer capture, click/dblclick are retargeted to the canvas — resolve the real element under the pointer
  const under = (e: React.MouseEvent) => (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null) || (e.target as HTMLElement);
  const onDoubleClick = (e: React.MouseEvent) => {
    const t = under(e);
    if (t.closest(".ui")) return;
    const id = (t.closest("[data-id]") as HTMLElement | null)?.dataset.id;
    if (id) { ui.setSel([id]); ui.setExpanded(id); ui.setMenu(null); return; }
    if (!t.closest("[data-group]") && !t.closest("[data-edge]") && !ui.focus) {
      const p = toWorld(e.clientX, e.clientY);
      ui.setMenu({ kind: "create", sx: e.clientX, sy: e.clientY, wx: p.x, wy: p.y });
    }
  };

  const onClick = (e: React.MouseEvent) => {
    const t = under(e);
    const id = (t.closest("[data-id]") as HTMLElement | null)?.dataset.id;
    if (!id) return;
    if (t.closest("[data-expand]")) { ui.setSel([id]); ui.setExpanded(id); }
    else if (t.closest("[data-check]")) toggleDone(id);
  };

  // the canvas never scrolls natively (focus() or scrollIntoView could otherwise shift it)
  useEffect(() => {
    const el = root.current; if (!el) return;
    const fix = () => { if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; } };
    el.addEventListener("scroll", fix);
    return () => el.removeEventListener("scroll", fix);
  }, []);

  // wheel: ctrl/⌘ or pinch = zoom at cursor; plain wheel pans (shift = horizontal)
  useEffect(() => {
    const el = root.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest(".ui .scroll, .ui textarea")) return;
      e.preventDefault();
      const c = camRef.current;
      if (e.ctrlKey || e.metaKey) {
        // trackpad pinch sends small deltas; a ctrl + mouse-wheel notch sends ~100
        const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
        const f = Math.exp(-dy * (Math.abs(dy) < 40 ? 0.012 : 0.0022));
        const k = Math.max(0.2, Math.min(2.6, c.k * f));
        const wx = (e.clientX - c.x) / c.k, wy = (e.clientY - c.y) / c.k;
        setCam({ k, x: e.clientX - wx * k, y: e.clientY - wy * k });
      } else {
        const m = e.deltaMode === 1 ? 33 : 1;
        setCam({ ...c, x: c.x - (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * m, y: c.y - (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * m });
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [setCam]);

  /* ---------- derived view state ---------- */
  const nodes = useMemo(() => visibleNodes(ws), [ws]);
  const map = useMemo(() => byId(ws), [ws]);
  const progress = useMemo(() => { const p: Record<string, number | null> = {}; nodes.forEach((n) => (p[n.id] = progressOf(ws, n))); return p; }, [ws, nodes]);
  const matches = useMemo(() => (ui.query.trim() ? new Set(searchNodes(ws, ui.query).map((r) => r.node.id)) : null), [ws, ui.query]);
  const single = sel.length === 1 ? map.get(sel[0]) : undefined;
  const relatedSet = useMemo(() => (single ? new Set(neighbors(ws, single.id).map((n) => n.id)) : null), [ws, single]);
  const focusSet = useMemo(() => (ui.focus ? new Set([ui.focus, ...neighbors(ws, ui.focus).map((n) => n.id)]) : null), [ws, ui.focus]);
  const dragging = dragIds.length ? dragIds : null;
  const magnets = useMemo(() => {
    if (!dragging || reduce) return {} as Record<string, { x: number; y: number }>;
    const out: Record<string, { x: number; y: number }> = {};
    const movers = nodes.filter((n) => dragging.includes(n.id));
    for (const n of nodes) {
      if (dragging.includes(n.id)) continue;
      for (const d of movers) {
        const dx = d.x - n.x, dy = d.y - n.y, dist = Math.hypot(dx, dy);
        if (dist < 190 && dist > 1) { const f = (1 - dist / 190) * 12; out[n.id] = { x: (dx / dist) * f, y: (dy / dist) * f }; }
      }
    }
    return out;
  }, [dragging, nodes, reduce]);

  const flagsFor = (n: MNode): NodeFlags => ({
    selected: sel.includes(n.id) || ui.connectFrom === n.id,
    dim: (!!matches && !matches.has(n.id)) || (!!ui.expanded && ui.expanded !== n.id),
    faded: !!focusSet && !focusSet.has(n.id),
    match: !!matches && matches.has(n.id),
    related: !!relatedSet && relatedSet.has(n.id),
    fresh: ui.freshIds.has(n.id),
    dragging: !!dragging && dragging.includes(n.id),
    settle: settleIds.includes(n.id),
    csrc: ui.connectFrom === n.id,
    focusCenter: ui.focus === n.id,
  });

  // edges with particles: those touching the selection/focus, plus a few ambient ones
  const liveEdge = (e: Edge, i: number) => {
    if (reduce) return false;
    const key = ui.focus || single?.id;
    if (key) return e.from === key || e.to === key;
    return i % 5 === 0;
  };

  const groupRects = ws.groups.map((G) => ({ G, b: groupBounds(ws, G) })).filter((x) => x.b);
  const selEdge = ui.selEdge ? ws.edges.find((e) => e.id === ui.selEdge) : undefined;
  const relMenu = ui.menu?.kind === "relation" ? ui.menu : null;
  const relEdge = relMenu ? ws.edges.find((e) => e.id === relMenu.edgeId) : undefined;

  const cls = ["canvas", space && "spacepan", ui.tool === "connect" && "connecting", ui.expanded && "expanding", ui.focus && "focusing",
    matches && "searching", dragging && "is-dragging", cam.k < 0.5 && "lod"].filter(Boolean).join(" ");
  const gridSize = 56 * cam.k;

  return (
    <div ref={root} className={cls} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp} onDoubleClick={onDoubleClick} onClick={onClick}
      style={{ "--glow": settings.glow, "--lods": Math.min(2.6, 0.62 / cam.k) } as React.CSSProperties} aria-label="Mind canvas" role="application">
      <div className="atmo" aria-hidden="true"><i className="a1" /><i className="a2" /><i className="a3" /></div>
      {settings.grid && <div className="grid" aria-hidden="true" style={{ backgroundSize: `${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px`, backgroundPosition: `${cam.x}px ${cam.y}px`, opacity: Math.min(1, cam.k * 1.1) }} />}
      <Backdrop camRef={camRef} enabled={settings.particles} reduce={reduce} />

      <div className="world" style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})` }}>
        <svg className="links" width="1" height="1" aria-hidden="true">
          <defs>
            {ws.edges.map((e) => {
              const a = map.get(e.from), b = map.get(e.to);
              if (!a || !b) return null;
              return (
                <linearGradient key={e.id} id={"g" + e.id} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
                  <stop offset="0" stopColor={TYPE_META[a.type].color} /><stop offset="1" stopColor={TYPE_META[b.type].color} />
                </linearGradient>
              );
            })}
          </defs>
          {groupRects.map(({ G, b }) => (
            <g key={G.id} className={"grp-g" + (focusSet || matches ? " off" : "")} style={{ "--gc": G.color } as React.CSSProperties}>
              <rect className="grp" x={b!.x} y={b!.y} width={b!.w} height={b!.h} rx={34} />
              <rect className="grp-hit" x={b!.x} y={b!.y} width={b!.w} height={b!.h} rx={34} data-group={G.id} />
            </g>
          ))}
          {ws.edges.map((e, i) => {
            const a = map.get(e.from), b = map.get(e.to);
            if (!a || !b || a.archived || b.archived || a.inbox || b.inbox) return null;
            const { d } = edgeGeom(a, b);
            const on = ui.selEdge === e.id || hoverEdge === e.id || (!!ui.focus && (e.from === ui.focus || e.to === ui.focus)) || (!!single && (e.from === single.id || e.to === single.id));
            const off = (!!focusSet && !(focusSet.has(e.from) && focusSet.has(e.to))) || (!!matches && !(matches.has(e.from) || matches.has(e.to))) || (!!ui.expanded);
            return (
              <g key={e.id} className={"edge" + (on ? " on" : "") + (off ? " off" : "") + (freshEdges.has(e.id) ? " draw" : "") + " r-" + e.rel}>
                <path d={d} className="e-glow" stroke={`url(#g${e.id})`} />
                <path d={d} className="e-line" stroke={`url(#g${e.id})`} pathLength={1} />
                <path d={d} className="e-hit" data-edge={e.id} onPointerEnter={() => setHoverEdge(e.id)} onPointerLeave={() => setHoverEdge((h) => (h === e.id ? null : h))} />
                {liveEdge(e, i) && !off && (
                  <circle r={2.4} className="spark"><animateMotion dur={`${3.2 + (i % 4) * 0.7}s`} repeatCount="indefinite" path={d} /></circle>
                )}
              </g>
            );
          })}
          {linkLine && map.get(linkLine.from) && (
            <path className="temp-link" d={`M${map.get(linkLine.from)!.x},${map.get(linkLine.from)!.y} L${linkLine.x},${linkLine.y}`} />
          )}
        </svg>

        {/* relationship indicators + group labels (HTML for crisp text) */}
        <div className="labels">
          {ws.edges.map((e) => {
            const a = map.get(e.from), b = map.get(e.to);
            if (!a || !b || a.archived || b.archived || a.inbox || b.inbox) return null;
            const { mx, my } = edgeGeom(a, b);
            const show = settings.labels || ui.selEdge === e.id || hoverEdge === e.id || (!!ui.focus && (e.from === ui.focus || e.to === ui.focus));
            const off = (!!focusSet && !(focusSet.has(e.from) && focusSet.has(e.to))) || !!ui.expanded || (!!matches && !(matches.has(e.from) || matches.has(e.to)));
            return (
              <div key={e.id} className={"rel-ind r-" + e.rel + (show ? " show" : "") + (off ? " off" : "")} style={{ left: mx, top: my }} data-edge={e.id}>
                <i />{show && <span>{REL_META[e.rel].short}</span>}
              </div>
            );
          })}
          {groupRects.map(({ G, b }) => (
            <div key={G.id} className={"grp-label" + (focusSet ? " off" : "")} style={{ left: b!.x + 18, top: b!.y - 15, "--gc": G.color } as React.CSSProperties} data-group={G.id} data-tip="Drag to move the group · click for options">
              <i />{G.name}<small>{G.nodeIds.length}</small>
            </div>
          ))}
        </div>

        <div className="nodes">
          {nodes.map((n, i) => (
            <ThoughtNode key={n.id} node={n} idx={i} progress={progress[n.id] ?? null} flags={flagsFor(n)} magnet={magnets[n.id]} />
          ))}
        </div>
      </div>

      {marquee && (
        <div className="marquee" style={{ left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1), width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0) }} />
      )}

      {ui.tool === "connect" && (
        <div className="mode-pill ui">
          <I.Connect size={15} /> {ui.connectFrom ? <>Select a second node to connect <b>“{map.get(ui.connectFrom)?.title}”</b></> : "Connect mode — select a source node, or drag from one node to another"}
          <button onClick={() => { ui.setTool("select"); ui.setConnectFrom(null); }}>Done <kbd>Esc</kbd></button>
        </div>
      )}

      <AnimatePresence>
        {ui.menu?.kind === "create" && (
          <CreationMenu key="cm" sx={ui.menu.sx} sy={ui.menu.sy} onClose={() => ui.setMenu(null)}
            onPick={(t) => { const m = uiRef.current.menu; if (m && m.kind === "create") createNode(t, m.wx, m.wy); }} />
        )}
        {relMenu && relEdge && (
          <RelationMenu key={"rm" + relEdge.id} sx={relMenu.sx} sy={relMenu.sy} current={relEdge.rel} fresh={relMenu.fresh}
            onClose={() => { ui.setMenu(null); }}
            onPick={(r) => {
              update((w) => ({ ...w, edges: w.edges.map((x) => (x.id === relEdge.id ? { ...x, rel: r } : x)) }), !relMenu.fresh);
              ui.setMenu(null); ui.toast(`Connection saved · ${REL_META[r].label}`);
            }}
            onDelete={() => { update((w) => ({ ...w, edges: w.edges.filter((x) => x.id !== relEdge.id) })); ui.setMenu(null); ui.setSelEdge(null); ui.toast("Connection removed", "ok", { label: "Undo", run: store.undo }); }} />
        )}
        {ui.menu?.kind === "group" && <GroupMenu key="gm" sx={ui.menu.sx} sy={ui.menu.sy} groupId={ui.menu.groupId} onClose={() => ui.setMenu(null)} />}
      </AnimatePresence>
      {selEdge && !relMenu && null}
    </div>
  );
}

export function defaultPad() {
  const W = window.innerWidth;
  if (W < 720) return { l: 18, r: 18, t: 84, b: 120 };
  if (W < 1100) return { l: 40, r: 40, t: 100, b: 120 };
  return { l: 236, r: 50, t: 84, b: 84 };
}

export function fitView(w: Workspace, size: { w: number; h: number }, pad = defaultPad()) {
  const ns = visibleNodes(w);
  if (!ns.length) return { x: size.w / 2, y: size.h / 2, k: 1 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  ns.forEach((n) => { const big = n.size === "xl" || n.size === "lg"; const hw = big ? 105 : 125; x0 = Math.min(x0, n.x - hw); x1 = Math.max(x1, n.x + hw); y0 = Math.min(y0, n.y - (big ? 70 : 34)); y1 = Math.max(y1, n.y + (big ? 110 : 34)); });
  const aw = size.w - pad.l - pad.r, ah = size.h - pad.t - pad.b;
  const k = Math.max(0.22, Math.min(1.25, Math.min(aw / (x1 - x0), ah / (y1 - y0))));
  return { k, x: pad.l + aw / 2 - ((x0 + x1) / 2) * k, y: pad.t + ah / 2 - ((y0 + y1) / 2) * k };
}
