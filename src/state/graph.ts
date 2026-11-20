import type { Edge, Group, MNode, Workspace } from "./types";
import { TYPE_META } from "./types";

export const visibleNodes = (w: Workspace) => w.nodes.filter((n) => !n.archived && !n.inbox);
export const byId = (w: Workspace) => new Map(w.nodes.map((n) => [n.id, n] as const));

export function neighbors(w: Workspace, id: string): MNode[] {
  const m = byId(w);
  const out: MNode[] = [];
  for (const e of w.edges) {
    const other = e.from === id ? e.to : e.to === id ? e.from : null;
    if (other) { const n = m.get(other); if (n && !n.archived && !n.inbox) out.push(n); }
  }
  return out;
}
export const edgesOf = (w: Workspace, id: string): Edge[] => w.edges.filter((e) => e.from === id || e.to === id);

/** Progress 0–100, or null when the node has nothing to measure */
export function progressOf(w: Workspace, n: MNode, seen: Set<string> = new Set()): number | null {
  if (seen.has(n.id)) return null;
  seen.add(n.id);
  const items = n.items || [];
  const itemDone = items.filter((i) => i.done).length;
  if (n.type === "task") {
    if (n.done) return 100;
    return items.length ? Math.round((itemDone / items.length) * 100) : 0;
  }
  if (n.type === "project") {
    const tasks = neighbors(w, n.id).filter((x) => x.type === "task");
    const total = tasks.length + items.length;
    if (!total) return n.progress ?? null;
    const done = tasks.filter((t) => t.done).length + itemDone;
    return Math.round((done / total) * 100);
  }
  if (n.type === "goal") {
    const kids = neighbors(w, n.id).filter((x) => !seen.has(x.id) && (x.type === "project" || x.type === "task" || x.type === "goal"));
    const vals = kids.map((k) => progressOf(w, k, new Set(seen))).filter((v): v is number => v !== null);
    if (items.length) vals.push(Math.round((itemDone / items.length) * 100));
    if (!vals.length) return n.progress ?? null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return n.progress != null && !kids.length ? n.progress : Math.round(avg);
  }
  if (items.length) return Math.round((itemDone / items.length) * 100);
  return n.progress ?? null;
}

/** Tasks that count toward a project: connected task nodes + its own checklist */
export function projectTasks(w: Workspace, p: MNode) {
  const tasks = neighbors(w, p.id).filter((x) => x.type === "task");
  return { tasks, items: p.items || [] };
}

export function projectsOf(w: Workspace, n: MNode): MNode[] {
  const fromEdges = neighbors(w, n.id).filter((x) => x.type === "project");
  return fromEdges;
}

export function groupsOf(w: Workspace, id: string): Group[] { return w.groups.filter((g) => g.nodeIds.includes(id)); }

export function radiusOf(n: MNode) {
  switch (n.size) {
    case "xl": return 92;
    case "lg": return 46;
    case "md": return 34;
    default: return 26;
  }
}

/** Bounding box for a group in world coordinates */
export function groupBounds(w: Workspace, g: Group) {
  const m = byId(w);
  const ns = g.nodeIds.map((id) => m.get(id)).filter((n): n is MNode => !!n && !n.archived && !n.inbox);
  if (!ns.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of ns) {
    const r = radiusOf(n);
    const halfW = n.size === "xl" || n.size === "lg" ? r + 70 : 110; // pills are wider than tall
    x0 = Math.min(x0, n.x - halfW); x1 = Math.max(x1, n.x + halfW);
    y0 = Math.min(y0, n.y - r - 24); y1 = Math.max(y1, n.y + r + (n.size === "xl" || n.size === "lg" ? 60 : 26));
  }
  return { x: x0 - 22, y: y0 - 22, w: x1 - x0 + 44, h: y1 - y0 + 44 };
}

export function searchNodes(w: Workspace, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const terms = s.split(/\s+/);
  const m = byId(w);
  const res: { node: MNode; score: number; where: string }[] = [];
  for (const n of w.nodes) {
    if (n.archived) continue;
    const projects = w.edges.filter((e) => e.from === n.id || e.to === n.id)
      .map((e) => m.get(e.from === n.id ? e.to : e.from)).filter((x) => x && x.type === "project").map((x) => x!.title);
    const groups = w.groups.filter((g) => g.nodeIds.includes(n.id)).map((g) => g.name);
    const fields: [string, string, number][] = [
      ["title", n.title, 10], ["category", TYPE_META[n.type].label + " " + TYPE_META[n.type].plural, 4],
      ["description", n.description, 3], ["notes", n.notes, 2], ["project", projects.join(" ") + " " + groups.join(" "), 3],
      ["tasks", n.items.map((i) => i.text).join(" "), 2],
    ];
    let score = 0, where = "";
    for (const t of terms) {
      let hit = false;
      for (const [name, val, wgt] of fields) {
        const v = (val || "").toLowerCase();
        const i = v.indexOf(t);
        if (i >= 0) { score += wgt + (i === 0 ? 2 : 0); if (!where) where = name; hit = true; }
      }
      if (!hit) { score = 0; break; }
    }
    if (score > 0) res.push({ node: n, score, where });
  }
  return res.sort((a, b) => b.score - a.score);
}

export function worldBounds(nodes: MNode[]) {
  if (!nodes.length) return { x: -400, y: -300, w: 800, h: 600 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) { const r = radiusOf(n) + 90; x0 = Math.min(x0, n.x - r); y0 = Math.min(y0, n.y - r); x1 = Math.max(x1, n.x + r); y1 = Math.max(y1, n.y + r); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const fmtAgo = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); return d < 30 ? `${d} d ago` : fmtDate(t);
};

/** nearest spot to (cx, cy) that doesn't collide with existing nodes (spiral search) */
export function freeSpot(w: Workspace, cx: number, cy: number) {
  const ns = visibleNodes(w);
  const clear = (x: number, y: number) => ns.every((n) => {
    const big = n.size === "xl" || n.size === "lg";
    const rx = big ? radiusOf(n) + 140 : 210, ry = big ? radiusOf(n) + 90 : 62;
    return Math.abs(n.x - x) > rx || Math.abs(n.y - y) > ry;
  });
  if (clear(cx, cy)) return { x: Math.round(cx), y: Math.round(cy) };
  for (let r = 60; r < 1600; r += 50) {
    const steps = Math.max(8, Math.round(r / 30));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2 + r;
      const x = cx + Math.cos(a) * r * 1.4, y = cy + Math.sin(a) * r * 0.8;
      if (clear(x, y)) return { x: Math.round(x), y: Math.round(y) };
    }
  }
  return { x: Math.round(cx + 200), y: Math.round(cy + 200) };
}
