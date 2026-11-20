import { useCallback } from "react";
import { useStore } from "./state/store";
import { useUI } from "./state/ui";
import type { AppData, MNode, Workspace } from "./state/types";
import { TYPE_META } from "./state/types";
import { blankWorkspace, makeDemo, uid } from "./state/demo";
import { fitView } from "./components/MindCanvas";

export const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
export const isMobile = () => window.innerWidth < 720;
export const PANEL_W = 372;

export function download(name: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Validate + normalise a workspace from imported JSON. Throws a readable error. */
export function parseWorkspace(text: string): Workspace {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("That file isn't valid JSON."); }
  let w = raw as Partial<Workspace> & { workspace?: Workspace; workspaces?: Workspace[]; app?: string };
  if (w && w.workspace) w = w.workspace;
  else if (w && Array.isArray(w.workspaces) && w.workspaces.length) w = w.workspaces[0];
  if (!w || !Array.isArray(w.nodes) || !Array.isArray(w.edges)) throw new Error("This doesn't look like a Mindspace workspace export.");
  const now = Date.now();
  const ids = new Set<string>();
  const nodes: MNode[] = w.nodes.filter((n) => n && typeof n.id === "string" && typeof n.x === "number" && typeof n.y === "number" && TYPE_META[n.type as MNode["type"]])
    .map((n) => {
      ids.add(n.id);
      const base: Partial<MNode> = { description: "", notes: "", priority: "medium", items: [], links: [], createdAt: now, updatedAt: now };
      return { ...base, ...n, title: String(n.title || "Untitled"), items: Array.isArray(n.items) ? n.items : [], links: Array.isArray(n.links) ? n.links : [] } as MNode;
    });
  if (!nodes.length) throw new Error("The workspace has no valid nodes.");
  return {
    id: uid("w"), name: String(w.name || "Imported space"), nodes,
    edges: w.edges.filter((e) => e && ids.has(e.from) && ids.has(e.to)).map((e) => ({ ...e, rel: e.rel || "related" })),
    groups: (w.groups || []).filter((g) => g && Array.isArray(g.nodeIds)).map((g) => ({ ...g, nodeIds: g.nodeIds.filter((id) => ids.has(id)) })),
    createdAt: w.createdAt || now, updatedAt: now,
  };
}

export function useActions() {
  const store = useStore();
  const ui = useUI();
  const { update, setData, log } = store;

  const reveal = useCallback((n: MNode, opts: { open?: boolean; k?: number } = {}) => {
    const k = opts.k ?? Math.max(ui.cam.k, 0.9);
    const mob = isMobile();
    const offX = !mob && opts.open !== false && window.innerWidth > 1000 ? PANEL_W / 2 / k : 0;
    const offY = mob ? window.innerHeight * 0.18 / k : 0;
    ui.flyTo({ wx: n.x + offX, wy: n.y + offY, k });
    if (opts.open !== false) { ui.setSel([n.id]); ui.setSelEdge(null); }
    ui.markFresh(n.id);
  }, [ui]);

  const deleteNodes = useCallback(async (ids: string[]) => {
    const w = store.ws;
    const ns = w.nodes.filter((n) => ids.includes(n.id));
    if (!ns.length) return;
    const conns = w.edges.filter((e) => ids.includes(e.from) || ids.includes(e.to)).length;
    const ok = await ui.confirm({
      title: ns.length === 1 ? `Delete “${ns[0].title}”?` : `Delete ${ns.length} nodes?`,
      body: `This removes ${ns.length === 1 ? "the node" : "them"}${conns ? ` and ${conns} connection${conns > 1 ? "s" : ""}` : ""}. You can undo with Ctrl/Cmd + Z.`,
      ok: "Delete", danger: true,
    });
    if (!ok) return;
    update((x) => ({
      ...x, nodes: x.nodes.filter((n) => !ids.includes(n.id)), edges: x.edges.filter((e) => !ids.includes(e.from) && !ids.includes(e.to)),
      groups: x.groups.map((g) => ({ ...g, nodeIds: g.nodeIds.filter((id) => !ids.includes(id)) })).filter((g) => g.nodeIds.length > 0),
    }));
    ui.setSel([]); ui.setExpanded(null); if (ui.focus && ids.includes(ui.focus)) ui.setFocus(null);
    ui.toast(ns.length === 1 ? `Deleted “${ns[0].title}”` : `Deleted ${ns.length} nodes`, "ok", { label: "Undo", run: store.undo });
    log(ns.length === 1 ? `Deleted “${ns[0].title}”` : `Deleted ${ns.length} nodes`, "delete");
  }, [store, ui, update, log]);

  const duplicateNodes = useCallback((ids: string[]) => {
    const w = store.ws;
    const ns = w.nodes.filter((n) => ids.includes(n.id));
    if (!ns.length) return;
    const map: Record<string, string> = {};
    const now = Date.now();
    const copies = ns.map((n) => {
      const id = uid("n"); map[n.id] = id;
      return { ...n, id, x: n.x + 70, y: n.y + 60, title: ns.length === 1 ? `${n.title} (copy)` : n.title, size: n.size === "xl" ? "lg" as const : n.size,
        items: n.items.map((i) => ({ ...i, id: uid("c") })), createdAt: now, updatedAt: now };
    });
    const inner = w.edges.filter((e) => map[e.from] && map[e.to]).map((e) => ({ ...e, id: uid("e"), from: map[e.from], to: map[e.to] }));
    update((x) => ({ ...x, nodes: [...x.nodes, ...copies], edges: [...x.edges, ...inner] }));
    ui.setSel(copies.map((c) => c.id));
    copies.forEach((c) => ui.markFresh(c.id));
    ui.toast(copies.length === 1 ? "Node duplicated" : `${copies.length} nodes duplicated`);
  }, [store, ui, update]);

  const archiveNodes = useCallback((ids: string[]) => {
    const ns = store.ws.nodes.filter((n) => ids.includes(n.id));
    update((x) => ({ ...x, nodes: x.nodes.map((n) => (ids.includes(n.id) ? { ...n, archived: true, updatedAt: Date.now() } : n)) }));
    ui.setSel([]); ui.setExpanded(null);
    ui.toast(ns.length === 1 ? `Archived “${ns[0].title}”` : `Archived ${ns.length} nodes`, "ok", { label: "Undo", run: store.undo });
    log(ns.length === 1 ? `Archived “${ns[0].title}”` : `Archived ${ns.length} nodes`, "archive");
  }, [store, ui, update, log]);

  const resetView = useCallback((w: Workspace) => {
    ui.setSel([]); ui.setExpanded(null); ui.setFocus(null); ui.setQuery(""); ui.setMenu(null); ui.setView("canvas");
    ui.setCam(fitView(w, { w: window.innerWidth, h: window.innerHeight }));
  }, [ui]);

  const switchWorkspace = useCallback((id: string) => {
    const w = store.data.workspaces.find((x) => x.id === id);
    if (!w) return;
    setData((d) => ({ ...d, activeId: id }), true);
    resetView(w);
  }, [store.data.workspaces, setData, resetView]);

  const addWorkspace = useCallback((w: Workspace, msg: string) => {
    setData((d: AppData) => ({ ...d, workspaces: [...d.workspaces, w], activeId: w.id }), true);
    resetView(w);
    ui.toast(msg);
    log(msg, "space");
  }, [setData, resetView, ui, log]);

  const newWorkspace = useCallback((name = "Untitled space") => addWorkspace(blankWorkspace(name), `Created space “${name}”`), [addWorkspace]);
  const newDemo = useCallback(() => addWorkspace(makeDemo(), "Added a fresh copy of “My Dream Life”"), [addWorkspace]);

  const exportWorkspace = useCallback((w: Workspace) => {
    const text = JSON.stringify({ app: "mindspace", version: 1, exportedAt: new Date().toISOString(), workspace: w }, null, 2);
    const name = `mindspace-${w.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "space"}.json`;
    try { download(name, text); } catch { /* sandboxed */ }
    ui.toast(`Exported “${w.name}” as ${name}`);
    return text;
  }, [ui]);

  const importText = useCallback((text: string) => {
    try {
      const w = parseWorkspace(text);
      addWorkspace(w, `Imported “${w.name}” · ${w.nodes.length} nodes`);
      return true;
    } catch (e) {
      ui.toast((e as Error).message, "warn");
      return false;
    }
  }, [addWorkspace, ui]);

  const deleteWorkspace = useCallback(async (id: string) => {
    const w = store.data.workspaces.find((x) => x.id === id);
    if (!w) return;
    if (store.data.workspaces.length === 1) { ui.toast("You need at least one space — create another first", "warn"); return; }
    const ok = await ui.confirm({ title: `Delete the space “${w.name}”?`, body: `All ${w.nodes.length} nodes and their connections will be permanently removed. Export it first if you may need it later.`, ok: "Delete space", danger: true });
    if (!ok) return;
    const rest = store.data.workspaces.filter((x) => x.id !== id);
    if (store.data.activeId === id) switchWorkspace(rest[0].id);
    setData((d) => ({ ...d, workspaces: d.workspaces.filter((x) => x.id !== id), activeId: d.activeId === id ? rest[0].id : d.activeId }), store.data.activeId === id);
    ui.toast(`Deleted space “${w.name}”`);
  }, [store.data, setData, switchWorkspace, ui]);

  const enterFocus = useCallback((id?: string) => {
    const w = store.ws;
    let target = id || ui.sel[0];
    if (!target) {
      // no selection: focus the most connected node
      const deg: Record<string, number> = {};
      w.edges.forEach((e) => { deg[e.from] = (deg[e.from] || 0) + 1; deg[e.to] = (deg[e.to] || 0) + 1; });
      target = [...w.nodes].filter((n) => !n.archived && !n.inbox).sort((a, b) => (deg[b.id] || 0) - (deg[a.id] || 0))[0]?.id;
    }
    const n = w.nodes.find((x) => x.id === target);
    if (!n) return;
    ui.setFocus(n.id); ui.setSel([n.id]); ui.setExpanded(null); ui.setMenu(null); ui.setTool("select"); ui.setConnectFrom(null); ui.setSidebarOpen(false);
    ui.setView("canvas");
    const k = Math.max(0.9, Math.min(1.1, ui.cam.k + 0.15));
    ui.flyTo({ wx: n.x, wy: n.y + (isMobile() ? 120 : 80) / k, k }, 900);
  }, [store.ws, ui]);

  const exitFocus = useCallback(() => {
    ui.setFocus(null);
    const c = fitView(store.ws, { w: window.innerWidth, h: window.innerHeight });
    ui.flyTo({ x: c.x, y: c.y, k: c.k }, 800);
  }, [store.ws, ui]);

  return { reveal, deleteNodes, duplicateNodes, archiveNodes, switchWorkspace, newWorkspace, newDemo, exportWorkspace, importText, deleteWorkspace, enterFocus, exitFocus };
}
