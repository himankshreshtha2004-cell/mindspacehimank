import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { AppData, MNode, Settings, Workspace } from "./types";
import { demoActivity, makeDemo, makeRandomSpace, uid } from "./demo";

const KEY = "mindspace.v2";
const HISTORY_LIMIT = 120;

export const defaultSettings: Settings = { particles: true, grid: true, labels: false, glow: 1, reduceMotion: false };

function freshData(): AppData {
  const now = Date.now();
  const ws = makeDemo(now);
  return { version: 1, activeId: ws.id, workspaces: [ws, makeRandomSpace(now)], settings: { ...defaultSettings }, activity: demoActivity(now) };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as AppData;
      if (d && d.version === 1 && Array.isArray(d.workspaces) && d.workspaces.length) {
        d.settings = { ...defaultSettings, ...(d.settings || {}) };
        d.activity = d.activity || [];
        if (!d.workspaces.find((w) => w.id === d.activeId)) d.activeId = d.workspaces[0].id;
        return d;
      }
    }
  } catch { /* storage unavailable or corrupt — start fresh */ }
  return freshData();
}

interface State { data: AppData; past: Workspace[]; future: Workspace[] }
type Action =
  | { t: "ws"; fn: (w: Workspace) => Workspace; record: boolean }
  | { t: "checkpoint" }
  | { t: "undo" } | { t: "redo" }
  | { t: "data"; fn: (d: AppData) => AppData; resetHistory?: boolean };

const active = (d: AppData) => d.workspaces.find((w) => w.id === d.activeId)!;
const replaceActive = (d: AppData, w: Workspace): AppData => ({ ...d, workspaces: d.workspaces.map((x) => (x.id === w.id ? w : x)) });

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "checkpoint": {
      const cur = active(s.data);
      return { ...s, past: [...s.past, cur].slice(-HISTORY_LIMIT), future: [] };
    }
    case "ws": {
      const cur = active(s.data);
      const next = { ...a.fn(cur), updatedAt: Date.now() };
      return {
        data: replaceActive(s.data, next),
        past: a.record ? [...s.past, cur].slice(-HISTORY_LIMIT) : s.past,
        future: a.record ? [] : s.future,
      };
    }
    case "undo": {
      if (!s.past.length) return s;
      const cur = active(s.data), prev = s.past[s.past.length - 1];
      return { data: replaceActive(s.data, { ...prev, view: cur.view }), past: s.past.slice(0, -1), future: [cur, ...s.future] };
    }
    case "redo": {
      if (!s.future.length) return s;
      const cur = active(s.data), nxt = s.future[0];
      return { data: replaceActive(s.data, { ...nxt, view: cur.view }), past: [...s.past, cur], future: s.future.slice(1) };
    }
    case "data": {
      const d = a.fn(s.data);
      return a.resetHistory ? { data: d, past: [], future: [] } : { ...s, data: d };
    }
  }
}

export interface Store {
  data: AppData; ws: Workspace; settings: Settings;
  canUndo: boolean; canRedo: boolean; saveState: "saved" | "saving";
  /** change the active workspace; record=true adds an undo step */
  update: (fn: (w: Workspace) => Workspace, record?: boolean) => void;
  checkpoint: () => void;
  undo: () => void; redo: () => void;
  setData: (fn: (d: AppData) => AppData, resetHistory?: boolean) => void;
  log: (text: string, kind?: string) => void;
  patchNode: (id: string, patch: Partial<MNode>, record?: boolean) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, dispatch] = useReducer(reducer, undefined, () => ({ data: loadData(), past: [], future: [] }));
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const timer = useRef<number>();

  // Autosave (debounced) to localStorage
  useEffect(() => {
    setSaveState("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(s.data)); } catch { /* quota or private mode */ }
      setSaveState("saved");
    }, 450);
    return () => window.clearTimeout(timer.current);
  }, [s.data]);
  useEffect(() => {
    const flush = () => { try { localStorage.setItem(KEY, JSON.stringify(s.data)); } catch { /* ignore */ } };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [s.data]);

  const update = useCallback((fn: (w: Workspace) => Workspace, record = true) => dispatch({ t: "ws", fn, record }), []);
  const checkpoint = useCallback(() => dispatch({ t: "checkpoint" }), []);
  const undo = useCallback(() => dispatch({ t: "undo" }), []);
  const redo = useCallback(() => dispatch({ t: "redo" }), []);
  const setData = useCallback((fn: (d: AppData) => AppData, resetHistory?: boolean) => dispatch({ t: "data", fn, resetHistory }), []);
  const log = useCallback((text: string, kind = "info") => dispatch({ t: "data", fn: (d) => ({ ...d, activity: [{ id: uid("a"), text, at: Date.now(), kind }, ...d.activity].slice(0, 40) }) }), []);
  const patchNode = useCallback((id: string, patch: Partial<MNode>, record = true) =>
    dispatch({ t: "ws", record, fn: (w) => ({ ...w, nodes: w.nodes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)) }) }), []);

  const ws = active(s.data);
  const value = useMemo<Store>(() => ({
    data: s.data, ws, settings: s.data.settings, canUndo: s.past.length > 0, canRedo: s.future.length > 0, saveState,
    update, checkpoint, undo, redo, setData, log, patchNode,
  }), [s, ws, saveState, update, checkpoint, undo, redo, setData, log, patchNode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}
