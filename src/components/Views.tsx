import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../state/store";
import { useUI } from "../state/ui";
import type { MNode, NodeType, Workspace } from "../state/types";
import { TYPE_META } from "../state/types";
import { fmtAgo, fmtDate, freeSpot, neighbors, progressOf, projectTasks, visibleNodes } from "../state/graph";
import { uid } from "../state/demo";
import { I, TypeIcon } from "./Icons";
import { Toggle } from "./Chrome";
import { useActions } from "../actions";

function ViewShell({ title, sub, icon, actions, children }: { title: string; sub: string; icon: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  const ui = useUI();
  return (
    <motion.section className="view ui" initial={{ opacity: 0, y: 18, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 10, filter: "blur(4px)" }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }} aria-label={title}>
      <header className="view-h">
        <div className="vh-ic">{icon}</div>
        <div><h1>{title}</h1><p>{sub}</p></div>
        <div className="row-end">{actions}<button className="btn ghost sm" onClick={() => ui.setView("canvas")}><I.Overview size={15} /> Back to canvas</button></div>
      </header>
      <div className="view-body scroll">{children}</div>
    </motion.section>
  );
}

function Empty({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return <div className="empty"><div className="empty-ic">{icon}</div><h3>{title}</h3><p>{body}</p>{action}</div>;
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return <span className="hbar" style={{ "--c": color } as React.CSSProperties}><motion.i initial={{ width: 0 }} animate={{ width: pct + "%" }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} /></span>;
}

/* ------------------------------------------------------------------ Spaces */
function MiniPreview({ w }: { w: Workspace }) {
  const ns = visibleNodes(w);
  if (!ns.length) return <svg className="mini-prev" viewBox="0 0 200 110" />;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  ns.forEach((n) => { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); });
  const s = Math.min(170 / Math.max(1, x1 - x0), 84 / Math.max(1, y1 - y0), 0.5);
  const ox = 100 - ((x0 + x1) / 2) * s, oy = 55 - ((y0 + y1) / 2) * s;
  const m = new Map(ns.map((n) => [n.id, n]));
  return (
    <svg className="mini-prev" viewBox="0 0 200 110" aria-hidden="true">
      {w.edges.map((e) => { const a = m.get(e.from), b = m.get(e.to); return a && b ? <line key={e.id} x1={a.x * s + ox} y1={a.y * s + oy} x2={b.x * s + ox} y2={b.y * s + oy} /> : null; })}
      {ns.map((n) => <circle key={n.id} cx={n.x * s + ox} cy={n.y * s + oy} r={n.size === "xl" ? 6 : n.size === "lg" ? 4 : 2.4} fill={TYPE_META[n.type].color} />)}
    </svg>
  );
}

function SpacesView() {
  const store = useStore();
  const ui = useUI();
  const act = useActions();
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [paste, setPaste] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [rn, setRn] = useState("");
  const rename = (w: Workspace) => {
    const v = rn.trim(); setRenaming(null);
    if (!v || v === w.name) return;
    store.setData((d) => ({ ...d, workspaces: d.workspaces.map((x) => (x.id === w.id ? { ...x, name: v } : x)) }));
    ui.toast(`Renamed to “${v}”`);
  };
  const onFile = (f?: File) => { if (!f) return; f.text().then((t) => act.importText(t)); if (file.current) file.current.value = ""; };
  return (
    <ViewShell title="My Spaces" sub="Separate universes for separate parts of your life. Each one saves automatically in this browser." icon={<I.Spaces size={22} />}
      actions={<>
        <button className="btn ghost sm" onClick={() => file.current?.click()}><I.Upload size={15} /> Import JSON</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </>}>
      <div className="new-space">
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name a new space — e.g. Thesis research"
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { act.newWorkspace(name.trim() || "Untitled space"); setName(""); } }} aria-label="New space name" />
        <button className="btn" onClick={() => { act.newWorkspace(name.trim() || "Untitled space"); setName(""); }}><I.Plus size={16} /> Create space</button>
        <button className="btn ghost" onClick={act.newDemo} data-tip="Adds another copy of the sample space">Add demo space</button>
      </div>
      <div className="cards">
        {store.data.workspaces.map((w) => {
          const ns = visibleNodes(w);
          const counts = (Object.keys(TYPE_META) as NodeType[]).map((t) => [t, ns.filter((n) => n.type === t).length] as const).filter(([, c]) => c);
          const active = w.id === store.ws.id;
          return (
            <div key={w.id} className={"space-card" + (active ? " active" : "")}>
              <button className="sc-open" onClick={() => act.switchWorkspace(w.id)} aria-label={"Open " + w.name}><MiniPreview w={w} /></button>
              <div className="sc-info">
                {renaming === w.id ? (
                  <input className="field" autoFocus value={rn} onChange={(e) => setRn(e.target.value)} onBlur={() => rename(w)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") rename(w); if (e.key === "Escape") setRenaming(null); }} aria-label="Space name" />
                ) : <h3>{w.name}{active && <span className="pill-tag">Open</span>}</h3>}
                <p>{ns.length} nodes · {w.edges.length} connections · edited {fmtAgo(w.updatedAt)}</p>
                <div className="type-dots">{counts.map(([t, c]) => <span key={t} style={{ "--c": TYPE_META[t].color } as React.CSSProperties}><i />{c} {c === 1 ? TYPE_META[t].label.toLowerCase() : TYPE_META[t].plural.toLowerCase()}</span>)}</div>
              </div>
              <div className="sc-actions">
                <button className="btn sm" onClick={() => act.switchWorkspace(w.id)}>Open</button>
                <button className="ib sm" onClick={() => { setRenaming(w.id); setRn(w.name); }} data-tip="Rename" aria-label={"Rename " + w.name}><I.Edit size={15} /></button>
                <button className="ib sm" onClick={() => setPaste(act.exportWorkspace(w))} data-tip="Export JSON" aria-label={"Export " + w.name}><I.Download size={15} /></button>
                <button className="ib sm danger" onClick={() => act.deleteWorkspace(w.id)} data-tip="Delete space" aria-label={"Delete " + w.name}><I.Trash size={15} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <JsonBox text={paste} onClose={() => setPaste(null)} />
    </ViewShell>
  );
}

/** Shows exported JSON (copyable) — a fallback where file downloads are blocked — and a paste-to-import box */
function JsonBox({ text, onClose }: { text: string | null; onClose: () => void }) {
  const ui = useUI();
  const act = useActions();
  const [imp, setImp] = useState("");
  const copy = async () => {
    try { await navigator.clipboard.writeText(text || ""); ui.toast("JSON copied to clipboard"); }
    catch { ui.toast("Select the text and copy it manually", "info"); }
  };
  return (
    <div className="json-area">
      <AnimatePresence>
        {text && (
          <motion.div className="json-box" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <div className="row-between"><b>Exported JSON</b><div className="row-end"><button className="btn sm" onClick={copy}><I.Copy size={14} /> Copy</button><button className="ib sm" onClick={onClose} aria-label="Close"><I.Close size={14} /></button></div></div>
            <p className="muted small">The file was downloaded. If your browser blocked the download, copy this text and save it as a .json file.</p>
            <textarea className="field mono" readOnly value={text} rows={6} onFocus={(e) => e.target.select()} aria-label="Exported JSON" />
          </motion.div>
        )}
      </AnimatePresence>
      <details className="paste-imp">
        <summary>Or paste JSON to import</summary>
        <textarea className="field mono" rows={4} value={imp} onChange={(e) => setImp(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder='{"app":"mindspace", "workspace": { … } }' aria-label="Paste JSON to import" />
        <div className="row-end"><button className="btn sm" disabled={!imp.trim()} onClick={() => { if (act.importText(imp)) setImp(""); }}><I.Upload size={14} /> Import</button></div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ Projects + Goals */
function useOpenOnCanvas() {
  const ui = useUI();
  const act = useActions();
  return (n: MNode) => { ui.setView("canvas"); window.setTimeout(() => act.reveal(n), 60); };
}

function ProjectsView() {
  const { ws } = useStore();
  const open = useOpenOnCanvas();
  const projects = visibleNodes(ws).filter((n) => n.type === "project");
  return (
    <ViewShell title="Projects" sub="Bodies of work and everything connected to them. Progress updates as tasks are completed." icon={<I.Projects size={22} />}>
      {!projects.length ? (
        <Empty icon={<I.Hex size={28} />} title="No projects yet" body="Create a node on the canvas and set its category to Project, then connect tasks to it." />
      ) : (
        <div className="cards wide">
          {projects.map((p) => {
            const pct = progressOf(ws, p);
            const { tasks, items } = projectTasks(ws, p);
            const others = neighbors(ws, p.id).filter((x) => x.type !== "task");
            return (
              <button key={p.id} className="proj-card" onClick={() => open(p)} style={{ "--c": TYPE_META.project.color, "--c2": TYPE_META.project.color2 } as React.CSSProperties}>
                <div className="pc-head"><span className="mi-ic"><I.Hex size={16} /></span><div><h3>{p.title}</h3><p>{p.description || "No description"}</p></div><em>{pct ?? 0}%</em></div>
                <Bar pct={pct ?? 0} color={TYPE_META.project.color} />
                <ul className="pc-tasks">
                  {tasks.map((t) => <li key={t.id} className={t.done ? "done" : ""}><i />{t.title}<small>task</small></li>)}
                  {items.map((i) => <li key={i.id} className={i.done ? "done" : i.status === "progress" ? "prog" : ""}><i />{i.text}<small>{i.done ? "complete" : i.status === "progress" ? "in progress" : "pending"}</small></li>)}
                  {!tasks.length && !items.length && <li className="muted">No tasks yet</li>}
                </ul>
                {others.length > 0 && <div className="pc-foot">{others.slice(0, 4).map((o) => <span key={o.id} style={{ "--c": TYPE_META[o.type].color } as React.CSSProperties}><TypeIcon type={o.type} size={12} />{o.title}</span>)}</div>}
              </button>
            );
          })}
        </div>
      )}
    </ViewShell>
  );
}

function GoalsView() {
  const { ws } = useStore();
  const open = useOpenOnCanvas();
  const goals = visibleNodes(ws).filter((n) => n.type === "goal").sort((a, b) => (b.size === "xl" ? 1 : 0) - (a.size === "xl" ? 1 : 0));
  return (
    <ViewShell title="Goals" sub="Your long-term ambitions. A goal's progress is the average of the projects and tasks connected to it." icon={<I.Goals size={22} />}>
      {!goals.length ? (
        <Empty icon={<I.Target size={28} />} title="No goals yet" body="Create a Goal node on the canvas — it becomes the anchor for the projects that move it forward." />
      ) : (
        <div className="goal-list">
          {goals.map((g) => {
            const pct = progressOf(ws, g);
            const kids = neighbors(ws, g.id);
            return (
              <button key={g.id} className={"goal-row" + (g.size === "xl" ? " core" : "")} onClick={() => open(g)}>
                <span className="g-ring" style={{ "--p": (pct ?? 0) * 3.6 + "deg" } as React.CSSProperties}><b>{pct === null ? "—" : pct + "%"}</b></span>
                <div className="g-main">
                  <h3>{g.title}</h3><p>{g.description}</p>
                  <div className="type-dots">{kids.slice(0, 7).map((k) => <span key={k.id} style={{ "--c": TYPE_META[k.type].color } as React.CSSProperties}><i />{k.title}</span>)}{kids.length > 7 && <span>+{kids.length - 7}</span>}</div>
                </div>
                <Bar pct={pct ?? 0} color={TYPE_META.goal.color} />
              </button>
            );
          })}
        </div>
      )}
    </ViewShell>
  );
}

/* ------------------------------------------------------------------ Inbox */
function InboxView() {
  const store = useStore();
  const ui = useUI();
  const act = useActions();
  const [txt, setTxt] = useState("");
  const [type, setType] = useState<NodeType>("thought");
  const items = store.ws.nodes.filter((n) => n.inbox && !n.archived).sort((a, b) => b.createdAt - a.createdAt);
  const capture = () => {
    const t = txt.trim(); if (!t) return;
    const now = Date.now();
    store.update((w) => ({ ...w, nodes: [...w.nodes, { id: uid("n"), type, title: t, description: "", notes: "", x: 0, y: 0, size: "sm", priority: "medium", items: [], links: [], createdAt: now, updatedAt: now, inbox: true }] }));
    setTxt(""); ui.toast("Captured to Inbox");
  };
  const place = (n: MNode) => {
    // drop it near the centre of the current view, nudged so it doesn't stack
    const { w, h } = ui.canvasSize.current;
    const spot = freeSpot(store.ws, (w / 2 - ui.cam.x) / ui.cam.k, (h / 2 - ui.cam.y) / ui.cam.k);
    store.update((x) => ({ ...x, nodes: x.nodes.map((m) => (m.id === n.id ? { ...m, inbox: false, x: spot.x, y: spot.y, updatedAt: Date.now() } : m)) }));
    ui.setView("canvas");
    window.setTimeout(() => { ui.setSel([n.id]); ui.markFresh(n.id); }, 80);
    ui.toast(`Placed “${n.title}” on the canvas`);
  };
  return (
    <ViewShell title="Inbox" sub="Quick thoughts you haven't organised yet. Capture now, place them on the canvas when you're ready." icon={<I.Inbox size={22} />}>
      <div className="capture">
        <div className="seg types sm">
          {(["thought", "task", "inspiration"] as NodeType[]).map((t) => <button key={t} className={t === type ? "on" : ""} style={{ "--c": TYPE_META[t].color } as React.CSSProperties} onClick={() => setType(t)} aria-pressed={t === type}><TypeIcon type={t} size={14} />{TYPE_META[t].label}</button>)}
        </div>
        <input className="field" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="What's on your mind?" onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") capture(); }} aria-label="Quick capture" autoFocus />
        <button className="btn" onClick={capture} disabled={!txt.trim()}><I.Plus size={16} /> Capture</button>
      </div>
      {!items.length ? (
        <Empty icon={<I.Inbox size={28} />} title="Inbox zero" body="Nothing waiting to be organised. Type above to capture a thought without leaving your flow." />
      ) : (
        <ul className="inbox-list">
          <AnimatePresence initial={false}>
            {items.map((n) => (
              <motion.li key={n.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30, height: 0 }} style={{ "--c": TYPE_META[n.type].color } as React.CSSProperties}>
                <span className="mi-ic"><TypeIcon type={n.type} size={15} /></span>
                <div className="mi-t"><b>{n.title}</b><small>{TYPE_META[n.type].label} · captured {fmtAgo(n.createdAt)}</small></div>
                <button className="btn sm" onClick={() => place(n)}><I.Overview size={14} /> Place on canvas</button>
                <button className="ib sm danger" onClick={() => act.deleteNodes([n.id])} aria-label={"Delete " + n.title} data-tip="Delete"><I.Trash size={15} /></button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </ViewShell>
  );
}

/* ------------------------------------------------------------------ Archive */
function ArchiveView() {
  const store = useStore();
  const ui = useUI();
  const items = store.ws.nodes.filter((n) => n.archived).sort((a, b) => b.updatedAt - a.updatedAt);
  const restore = (n: MNode) => {
    store.update((w) => ({ ...w, nodes: w.nodes.map((m) => (m.id === n.id ? { ...m, archived: false, updatedAt: Date.now() } : m)) }));
    ui.toast(`Restored “${n.title}” to the canvas`);
  };
  const purge = async (n: MNode) => {
    const ok = await ui.confirm({ title: `Permanently delete “${n.title}”?`, body: "It will be removed along with its connections. You can still undo right after.", ok: "Delete forever", danger: true });
    if (!ok) return;
    store.update((w) => ({ ...w, nodes: w.nodes.filter((m) => m.id !== n.id), edges: w.edges.filter((e) => e.from !== n.id && e.to !== n.id), groups: w.groups.map((g) => ({ ...g, nodeIds: g.nodeIds.filter((id) => id !== n.id) })).filter((g) => g.nodeIds.length) }));
    ui.toast("Deleted permanently", "ok", { label: "Undo", run: store.undo });
  };
  return (
    <ViewShell title="Archived Ideas" sub="Ideas you've set aside. They keep their content and connections, and can come back any time." icon={<I.Archive size={22} />}>
      {!items.length ? (
        <Empty icon={<I.Archive size={28} />} title="Nothing archived" body="Archive a node from its detail panel (⋯ menu) to tuck it away without deleting it." />
      ) : (
        <ul className="inbox-list">
          {items.map((n) => (
            <li key={n.id} style={{ "--c": TYPE_META[n.type].color } as React.CSSProperties}>
              <span className="mi-ic"><TypeIcon type={n.type} size={15} /></span>
              <div className="mi-t"><b>{n.title}</b><small>{TYPE_META[n.type].label} · archived {fmtAgo(n.updatedAt)}{n.description ? " · " + n.description.slice(0, 70) : ""}</small></div>
              <button className="btn sm" onClick={() => restore(n)}><I.Restore size={14} /> Restore</button>
              <button className="ib sm danger" onClick={() => purge(n)} aria-label={"Delete " + n.title} data-tip="Delete forever"><I.Trash size={15} /></button>
            </li>
          ))}
        </ul>
      )}
    </ViewShell>
  );
}

/* ------------------------------------------------------------------ Settings */
function SettingsView() {
  const store = useStore();
  const ui = useUI();
  const act = useActions();
  const [json, setJson] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const s = store.settings;
  const set = (k: keyof typeof s, v: boolean | number) => store.setData((d) => ({ ...d, settings: { ...d.settings, [k]: v } }));
  const stats = useMemo(() => {
    const all = store.data.workspaces.flatMap((w) => w.nodes);
    return { spaces: store.data.workspaces.length, nodes: all.length, bytes: new Blob([JSON.stringify(store.data)]).size };
  }, [store.data]);
  const reset = async () => {
    const ok = await ui.confirm({ title: "Reset Mindspace?", body: "This deletes every space and restores the original “My Dream Life” demo. Export anything you want to keep first.", ok: "Reset everything", danger: true });
    if (!ok) return;
    try { localStorage.removeItem("mindspace.v2"); } catch { /* ignore */ }
    window.location.reload();
  };
  return (
    <ViewShell title="Settings" sub="Atmosphere, accessibility and your data. Everything is stored locally in this browser." icon={<I.Settings size={22} />}>
      <div className="settings-grid">
        <section className="set-card">
          <h3><I.Theme size={17} /> Atmosphere</h3>
          <Toggle label="Floating particles" hint="Subtle drifting light in the background" on={s.particles} set={(v) => set("particles", v)} />
          <Toggle label="Grid texture" hint="Faint spatial grid that moves with the canvas" on={s.grid} set={(v) => set("grid", v)} />
          <Toggle label="Always show relationship labels" hint="Otherwise labels appear on hover and selection" on={s.labels} set={(v) => set("labels", v)} />
          <label className="slider-row"><span>Glow intensity</span><input type="range" min={0.4} max={1.4} step={0.1} value={s.glow} onChange={(e) => set("glow", Number(e.target.value))} /><em>{Math.round(s.glow * 100)}%</em></label>
        </section>
        <section className="set-card">
          <h3><I.Eye size={17} /> Accessibility</h3>
          <Toggle label="Reduce motion" hint="Turns off floating, travelling lights and camera easing. Also follows your system setting." on={s.reduceMotion} set={(v) => set("reduceMotion", v)} />
          <button className="btn ghost" onClick={() => ui.setHelp(true)}><I.Help size={16} /> Keyboard shortcuts</button>
        </section>
        <section className="set-card">
          <h3><I.Download size={17} /> Your data</h3>
          <p className="muted small">{stats.spaces} space{stats.spaces > 1 ? "s" : ""} · {stats.nodes} nodes · {(stats.bytes / 1024).toFixed(1)} KB saved in this browser. Autosave is on.</p>
          <div className="btn-row">
            <button className="btn" onClick={() => setJson(act.exportWorkspace(store.ws))}><I.Download size={16} /> Export “{store.ws.name}”</button>
            <button className="btn ghost" onClick={() => file.current?.click()}><I.Upload size={16} /> Import JSON</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then((t) => act.importText(t)); e.target.value = ""; }} />
          </div>
          <JsonBox text={json} onClose={() => setJson(null)} />
        </section>
        <section className="set-card">
          <h3><span className="avatar sm">Y</span> Profile</h3>
          <p className="muted small">Mindspace runs entirely on this device — no account or server. Your spaces don't sync between browsers; use Export/Import to move them.</p>
          <button className="btn ghost danger" onClick={reset}><I.Trash size={16} /> Reset everything</button>
          <p className="muted small">Mindspace v1 · last saved {fmtDate(store.ws.updatedAt)}</p>
        </section>
      </div>
    </ViewShell>
  );
}

export function Views() {
  const ui = useUI();
  return (
    <AnimatePresence mode="wait">
      {ui.view === "spaces" && <SpacesView key="spaces" />}
      {ui.view === "projects" && <ProjectsView key="projects" />}
      {ui.view === "goals" && <GoalsView key="goals" />}
      {ui.view === "inbox" && <InboxView key="inbox" />}
      {ui.view === "archive" && <ArchiveView key="archive" />}
      {ui.view === "settings" && <SettingsView key="settings" />}
    </AnimatePresence>
  );
}
