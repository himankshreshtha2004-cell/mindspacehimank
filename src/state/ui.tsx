import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { NodeType } from "./types";

export type ViewName = "canvas" | "spaces" | "projects" | "goals" | "inbox" | "archive" | "settings";
export interface Cam { x: number; y: number; k: number }
export interface Toast { id: number; text: string; kind?: "ok" | "info" | "warn"; action?: { label: string; run: () => void } }
export interface ConfirmReq { title: string; body?: string; ok?: string; danger?: boolean; resolve: (v: boolean) => void }
export type Menu =
  | { kind: "create"; sx: number; sy: number; wx: number; wy: number }
  | { kind: "relation"; sx: number; sy: number; edgeId: string; fresh: boolean }
  | { kind: "group"; sx: number; sy: number; groupId: string }
  | null;

interface UI {
  view: ViewName; setView: (v: ViewName) => void;
  sel: string[]; setSel: (ids: string[]) => void;
  selEdge: string | null; setSelEdge: (id: string | null) => void;
  expanded: string | null; setExpanded: (id: string | null) => void;
  tool: "select" | "connect"; setTool: (t: "select" | "connect") => void;
  connectFrom: string | null; setConnectFrom: (id: string | null) => void;
  focus: string | null; setFocus: (id: string | null) => void;
  query: string; setQuery: (q: string) => void;
  menu: Menu; setMenu: (m: Menu) => void;
  groupDialog: boolean; setGroupDialog: (b: boolean) => void;
  minimap: boolean; setMinimap: (b: boolean) => void;
  sidebarOpen: boolean; setSidebarOpen: (b: boolean) => void;
  help: boolean; setHelp: (b: boolean) => void;
  welcome: boolean; setWelcome: (b: boolean) => void;
  unread: number; setUnread: (n: number) => void;
  freshIds: Set<string>; markFresh: (id: string) => void;
  cam: Cam; setCam: (c: Cam | ((c: Cam) => Cam)) => void;
  flyTo: (target: Partial<Cam> & { wx?: number; wy?: number }, ms?: number) => void;
  canvasSize: React.MutableRefObject<{ w: number; h: number; left: number; top: number }>;
  toasts: Toast[]; toast: (text: string, kind?: Toast["kind"], action?: Toast["action"]) => void; dismissToast: (id: number) => void;
  confirmReq: ConfirmReq | null; confirm: (o: Omit<ConfirmReq, "resolve">) => Promise<boolean>; closeConfirm: (v: boolean) => void;
  createAt: (type: NodeType, wx: number, wy: number) => void; // set by canvas
  registerCreate: (fn: (type: NodeType, wx: number, wy: number) => void) => void;
  savedFlash: number; flashSaved: () => void;
}

const Ctx = createContext<UI | null>(null);
let toastSeq = 1;

export function UIProvider({ children, initialCam }: { children: React.ReactNode; initialCam: Cam }) {
  const [view, setView] = useState<ViewName>("canvas");
  const [sel, setSel] = useState<string[]>([]);
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "connect">("select");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<Menu>(null);
  const [groupDialog, setGroupDialog] = useState(false);
  const [minimap, setMinimap] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [welcome, setWelcome] = useState(true);
  const [unread, setUnread] = useState(1);
  const [freshIds, setFresh] = useState<Set<string>>(new Set());
  const [cam, setCam] = useState<Cam>(initialCam);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmReq, setConfirmReq] = useState<ConfirmReq | null>(null);
  const [savedFlash, setSavedFlash] = useState(0);
  const canvasSize = useRef({ w: window.innerWidth, h: window.innerHeight, left: 0, top: 0 });
  const createRef = useRef<(type: NodeType, wx: number, wy: number) => void>(() => {});
  const flyRaf = useRef(0);
  const camRef = useRef(cam); camRef.current = cam;

  const markFresh = useCallback((id: string) => {
    setFresh((s) => new Set(s).add(id));
    window.setTimeout(() => setFresh((s) => { const n = new Set(s); n.delete(id); return n; }), 1600);
  }, []);
  const toast = useCallback((text: string, kind: Toast["kind"] = "ok", action?: Toast["action"]) => {
    const id = toastSeq++;
    setToasts((t) => [...t.slice(-3), { id, text, kind, action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 5200 : 2800);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const confirm = useCallback((o: Omit<ConfirmReq, "resolve">) => new Promise<boolean>((resolve) => setConfirmReq({ ...o, resolve })), []);
  const closeConfirm = useCallback((v: boolean) => { setConfirmReq((r) => { r?.resolve(v); return null; }); }, []);

  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const flyTo = useCallback((t: Partial<Cam> & { wx?: number; wy?: number }, ms = 750) => {
    cancelAnimationFrame(flyRaf.current);
    const from = { ...camRef.current };
    const { w, h } = canvasSize.current;
    const k = t.k ?? from.k;
    let to: Cam = { x: t.x ?? from.x, y: t.y ?? from.y, k };
    if (t.wx !== undefined && t.wy !== undefined) to = { k, x: w / 2 - t.wx * k, y: h / 2 - t.wy * k };
    if (reduce || document.documentElement.classList.contains("reduce") || ms <= 0) { setCam(to); return; }
    const t0 = performance.now();
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms), e = ease(p);
      setCam({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, k: from.k + (to.k - from.k) * e });
      if (p < 1) flyRaf.current = requestAnimationFrame(step);
    };
    flyRaf.current = requestAnimationFrame(step);
  }, [reduce]);

  const value = useMemo<UI>(() => ({
    view, setView, sel, setSel, selEdge, setSelEdge, expanded, setExpanded, tool, setTool, connectFrom, setConnectFrom,
    focus, setFocus, query, setQuery, menu, setMenu, groupDialog, setGroupDialog, minimap, setMinimap,
    sidebarOpen, setSidebarOpen, help, setHelp, welcome, setWelcome, unread, setUnread, freshIds, markFresh,
    cam, setCam, flyTo, canvasSize, toasts, toast, dismissToast, confirmReq, confirm, closeConfirm,
    createAt: (type, wx, wy) => createRef.current(type, wx, wy),
    registerCreate: (fn) => { createRef.current = fn; },
    savedFlash, flashSaved: () => setSavedFlash((n) => n + 1),
  }), [view, sel, selEdge, expanded, tool, connectFrom, focus, query, menu, groupDialog, minimap, sidebarOpen, help, welcome,
    unread, freshIds, markFresh, cam, flyTo, toasts, toast, dismissToast, confirmReq, confirm, closeConfirm, savedFlash]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useUI outside provider");
  return c;
}
