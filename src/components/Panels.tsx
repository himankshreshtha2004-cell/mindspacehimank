import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../state/store";
import { useUI } from "../state/ui";
import type { CheckItem, MNode, NodeType, Priority } from "../state/types";
import { GROUP_COLORS, REL_META, TYPE_META } from "../state/types";
import { edgesOf, fmtAgo, fmtDate, groupsOf, neighbors, progressOf, projectTasks, visibleNodes } from "../state/graph";
import { uid } from "../state/demo";
import { I, TypeIcon } from "./Icons";
import { useActions, PANEL_W } from "../actions";

export function useIsMobile(bp = 720) {
  const [m, setM] = useState(window.innerWidth < bp);
  useEffect(() => { const r = () => setM(window.innerWidth < bp); window.addEventListener("resize", r); return () => window.removeEventListener("resize", r); }, [bp]);
  return m;
}

/* ------------------------------------------------------------------ commit-on-blur fields */
function Field({ value, onCommit, multiline, className, placeholder, label, rows = 3 }: { value: string; onCommit: (v: string) => void; multiline?: boolean; className?: string; placeholder?: string; label: string; rows?: number }) {
  const [v, setV] = useState(value);
  const latest = useRef(v); latest.current = v;
  const orig = useRef(value);
  const commitRef = useRef(onCommit); commitRef.current = onCommit;
  useEffect(() => { setV(value); orig.current = value; }, [value]);
  const commit = () => { if (latest.current !== orig.current) { orig.current = latest.current; commitRef.current(latest.current); } };
  // commit if the panel closes while the field still has focus
  useEffect(() => () => { if (latest.current !== orig.current) commitRef.current(latest.current); }, []);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const t = ta.current; if (t) { t.style.height = "auto"; t.style.height = Math.min(320, t.scrollHeight + 2) + "px"; } }, [v]);
  return multiline ? (
    <textarea ref={ta} className={"field " + (className || "")} value={v} rows={rows} placeholder={placeholder} aria-label={label}
      onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Escape") (e.target as HTMLElement).blur(); e.stopPropagation(); }} />
  ) : (
    <input className={"field " + (className || "")} value={v} placeholder={placeholder} aria-label={label}
      onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLElement).blur(); e.stopPropagation(); }} />
  );
}

function Ring({ pct, size = 56, color }: { pct: number; size?: number; color: string }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="pring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="pr-bg" />
      <motion.circle cx={size / 2} cy={size / 2} r={r} className="pr-fg" stroke={color} strokeDasharray={c}
        initial={false} animate={{ strokeDashoffset: c - (pct / 100) * c }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy=".35em" textAnchor="middle">{pct}%</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ shared editing hooks */
function useNodeOps(n: MNode) {
  const store = useStore();
  const ui = useUI();
  const saved = () => { ui.flashSaved(); ui.markFresh(n.id); };
  const patch = (p: Partial<MNode>, msg?: string) => { store.patchNode(n.id, p); saved(); if (msg) ui.toast(msg); };
  const setItems = (items: CheckItem[]) => patch({ items });
  const toggleItem = (id: string) => setItems(n.items.map((i) => (i.id === id ? { ...i, done: !i.done, status: !i.done ? "done" : "pending" } : i)));
  const cycleItem = (id: string) => setItems(n.items.map((i) => {
    if (i.id !== id) return i;
    const next = i.done ? "pending" : i.status === "progress" ? "done" : "progress";
    return { ...i, status: next, done: next === "done" };
  }));
  const toggleTask = (t: MNode) => {
    const done = !t.done;
    store.patchNode(t.id, { done, items: done ? t.items.map((i) => ({ ...i, done: true, status: "done" as const })) : t.items });
    ui.markFresh(t.id); ui.flashSaved();
    if (done) { ui.toast(`Task complete — “${t.title}”`); store.log(`Completed task “${t.title}”`, "done"); }
  };
  return { store, ui, patch, setItems, toggleItem, cycleItem, toggleTask, saved };
}

function StatusChip({ it, onClick }: { it: CheckItem; onClick: () => void }) {
  const st = it.done ? "done" : it.status === "progress" ? "progress" : "pending";
  const label = st === "done" ? "Complete" : st === "progress" ? "In progress" : "Pending";
  return <button className={"st st-" + st} onClick={onClick} data-tip="Click to change status">{label}</button>;
}

/** Project/goal progress: ring + task list (connected task nodes + checklist) */
function ProgressBlock({ n, compact }: { n: MNode; compact?: boolean }) {
  const { store, toggleItem, cycleItem, toggleTask, setItems } = useNodeOps(n);
  const ui = useUI();
  const act = useActions();
  const w = store.ws;
  const pct = progressOf(w, n);
  const { tasks } = projectTasks(w, n);
  const [txt, setTxt] = useState("");
  const color = TYPE_META[n.type].color;
  const goalKids = n.type === "goal" ? neighbors(w, n.id).filter((x) => x.type !== "inspiration" && x.type !== "thought" && progressOf(w, x) !== null) : [];
  const add = () => { const t = txt.trim(); if (!t) return; setItems([...n.items, { id: uid("c"), text: t, done: false, status: "pending" }]); setTxt(""); };
  const total = tasks.length + n.items.length;
  const done = tasks.filter((t) => t.done).length + n.items.filter((i) => i.done).length;
  return (
    <div className="progress-block">
      <div className="pb-head">
        {pct !== null ? <Ring pct={pct} color={color} /> : <div className="pring empty"><I.Flag size={18} /></div>}
        <div>
          <b>{pct === null ? "No progress tracked yet" : pct === 100 ? "Complete" : "Progress"}</b>
          <small>
            {n.type === "goal" ? (goalKids.length ? `Average of ${goalKids.length} connected project${goalKids.length > 1 ? "s" : ""}/tasks` : "Connect projects or tasks, or set progress manually")
              : total ? `${done} of ${total} tasks complete` : "Add tasks below or connect task nodes"}
          </small>
        </div>
      </div>
      {n.type !== "task" && (!total && !goalKids.length) && (
        <label className="slider-row"><span>Manual</span>
          <input type="range" min={0} max={100} step={5} value={n.progress ?? 0} onChange={(e) => store.patchNode(n.id, { progress: Number(e.target.value) }, false)}
            onPointerDown={() => store.checkpoint()} aria-label="Manual progress" />
          <em>{n.progress ?? 0}%</em>
        </label>
      )}
      {goalKids.length > 0 && !compact && (
        <div className="kid-list">
          {goalKids.map((k) => { const p = progressOf(w, k) ?? 0; return (
            <button key={k.id} className="kid" onClick={() => { ui.setExpanded(null); act.reveal(k); }} style={{ "--c": TYPE_META[k.type].color } as React.CSSProperties}>
              <TypeIcon type={k.type} size={13} /><span>{k.title}</span><span className="bar"><i style={{ width: p + "%" }} /></span><em>{p}%</em>
            </button>); })}
        </div>
      )}
      {(n.type === "project" || n.type === "task" || n.items.length > 0 || tasks.length > 0) && (
        <ul className="tasks">
          {tasks.map((t) => (
            <li key={t.id} className={"task-row node" + (t.done ? " done" : "")}>
              <button className="cb" onClick={() => toggleTask(t)} aria-label={t.done ? "Mark not done" : "Mark done"}><I.Check size={12} /></button>
              <button className="tr-t" onClick={() => { ui.setExpanded(null); act.reveal(t); }}>{t.title}</button>
              <span className={"st st-" + (t.done ? "done" : "node")}>{t.done ? "Complete" : "Task node"}</span>
            </li>
          ))}
          {n.items.map((it) => (
            <li key={it.id} className={"task-row" + (it.done ? " done" : "")}>
              <button className="cb" onClick={() => toggleItem(it.id)} aria-label={it.done ? "Mark not done" : "Mark done"}><I.Check size={12} /></button>
              <span className="tr-t">{it.text}</span>
              <StatusChip it={it} onClick={() => cycleItem(it.id)} />
              {!compact && <button className="ib xs" onClick={() => setItems(n.items.filter((x) => x.id !== it.id))} aria-label={"Remove " + it.text}><I.Close size={12} /></button>}
            </li>
          ))}
          {!compact && (
            <li className="task-add">
              <I.Plus size={14} />
              <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={n.type === "task" ? "Add a sub-step…" : "Add a task…"} aria-label="New task"
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") add(); }} onBlur={add} />
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function RelatedList({ n, onPick }: { n: MNode; onPick: (m: MNode) => void }) {
  const { ws, update, undo } = useStore();
  const ui = useUI();
  const es = edgesOf(ws, n.id);
  const m = new Map(ws.nodes.map((x) => [x.id, x]));
  const rows = es.map((e) => ({ e, o: m.get(e.from === n.id ? e.to : e.from)! })).filter((r) => r.o && !r.o.archived);
  if (!rows.length) return <div className="empty-sm">No connections yet. Drag from the node's handle to another node, or use the Connect tool.</div>;
  return (
    <div className="related">
      {rows.map(({ e, o }) => (
        <div key={e.id} className="rel-row" style={{ "--c": TYPE_META[o.type].color } as React.CSSProperties}>
          <button className="rel-main" onClick={() => onPick(o)}>
            <span className="mi-ic"><TypeIcon type={o.type} size={14} /></span>
            <span className="mi-t"><b>{o.title}</b><small>{e.from === n.id ? REL_META[e.rel].label : reverseLabel(e.rel)}</small></span>
          </button>
          <button className="ib xs" data-tip="Remove connection" aria-label={"Disconnect " + o.title}
            onClick={() => { update((w) => ({ ...w, edges: w.edges.filter((x) => x.id !== e.id) })); ui.toast("Connection removed", "ok", { label: "Undo", run: undo }); }}>
            <I.Close size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
const reverseLabel = (r: keyof typeof REL_META) => ({ related: "Related to", depends: "Needed by", partof: "Contains", leads: "Comes from", inspired: "Inspires" }[r]);

function Links({ n }: { n: MNode }) {
  const { patch } = useNodeOps(n);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState(""); const [url, setUrl] = useState("");
  const add = () => {
    let u = url.trim(); if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    patch({ links: [...n.links, { label: label.trim() || u.replace(/^https?:\/\//, ""), url: u }] }, "Link added");
    setLabel(""); setUrl(""); setAdding(false);
  };
  return (
    <div className="links-list">
      {n.links.map((l, i) => (
        <div key={i} className="link-row">
          <I.Link size={14} /><a href={l.url} target="_blank" rel="noreferrer noopener">{l.label}</a>
          <button className="ib xs" onClick={() => patch({ links: n.links.filter((_, j) => j !== i) })} aria-label={"Remove link " + l.label}><I.Close size={12} /></button>
        </div>
      ))}
      {adding ? (
        <div className="link-form" onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") add(); if (e.key === "Escape") setAdding(false); }}>
          <input className="field" autoFocus placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Link label" />
          <input className="field" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link URL" />
          <div className="row-end"><button className="btn ghost sm" onClick={() => setAdding(false)}>Cancel</button><button className="btn sm" onClick={add}>Add link</button></div>
        </div>
      ) : <button className="add-link" onClick={() => setAdding(true)}><I.Plus size={14} /> Add a link or reference</button>}
    </div>
  );
}

/* ------------------------------------------------------------------ Node detail panel */
const TYPES: NodeType[] = ["thought", "goal", "project", "task", "inspiration"];
const PRI: Priority[] = ["low", "medium", "high"];

function NodeDetails({ n }: { n: MNode }) {
  const { store, ui, patch, toggleTask } = useNodeOps(n);
  const act = useActions();
  const w = store.ws;
  const meta = TYPE_META[n.type];
  const [more, setMore] = useState(false);
  const projects = useMemo(() => visibleNodes(w).filter((x) => x.type === "project" && x.id !== n.id), [w, n.id]);
  const inProjects = useMemo(() => {
    const ids = new Set(neighbors(w, n.id).filter((x) => x.type === "project").map((x) => x.id));
    return projects.filter((p) => ids.has(p.id));
  }, [w, n.id, projects]);
  const groups = groupsOf(w, n.id);

  const convertToTask = () => {
    store.patchNode(n.id, { type: "task", convertedFrom: n.type, size: "sm", done: false, priority: n.priority || "medium" });
    ui.markFresh(n.id); ui.flashSaved();
    ui.toast(`Converted to a task — your ${TYPE_META[n.type].label.toLowerCase()} content is kept`);
    store.log(`Converted “${n.title}” into a task`, "convert");
  };
  const changeType = (t: NodeType) => {
    if (t === n.type) return;
    if (t === "task") return convertToTask();
    const size = n.size === "xl" ? "xl" : (t === "goal" || t === "project") ? (n.size === "lg" ? "lg" : "md") : n.size === "lg" ? "lg" : "sm";
    patch({ type: t, size }, `Category changed to ${TYPE_META[t].label}`);
  };
  const addToProject = (pid: string) => {
    if (!pid) return;
    const p = w.nodes.find((x) => x.id === pid)!;
    store.update((x) => ({ ...x, edges: [...x.edges, { id: uid("e"), from: n.id, to: pid, rel: "partof", createdAt: Date.now() }] }));
    ui.markFresh(n.id); ui.markFresh(pid);
    ui.toast(`Added to project “${p.title}”`);
    store.log(`Added “${n.title}” to project “${p.title}”`, "connect");
  };
  const removeFromProject = (pid: string) => {
    store.update((x) => ({ ...x, edges: x.edges.filter((e) => !((e.from === n.id && e.to === pid) || (e.to === n.id && e.from === pid))) }));
    ui.toast("Removed from project");
  };

  return (
    <div className="pd" style={{ "--c": meta.color, "--c2": meta.color2 } as React.CSSProperties}>
      <div className="pd-top">
        <span className="type-badge"><TypeIcon type={n.type} size={14} />{meta.label}{n.convertedFrom && <small>· was {TYPE_META[n.convertedFrom].label.toLowerCase()}</small>}</span>
        <div className="pd-tools">
          <button className="ib sm" onClick={() => ui.setExpanded(n.id)} data-tip="Expand · E" aria-label="Expand"><I.Expand size={15} /></button>
          <button className="ib sm" onClick={() => act.enterFocus(n.id)} data-tip="Focus · F" aria-label="Focus"><I.Focus size={15} /></button>
          <div className="pop-wrap">
            <button className="ib sm" onClick={() => setMore((m) => !m)} aria-label="More actions" aria-expanded={more}>⋯</button>
            <AnimatePresence>{more && (
              <motion.div className="popover right more-pop" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onMouseLeave={() => setMore(false)}>
                <button className="menu-i" onClick={() => { setMore(false); act.duplicateNodes([n.id]); }}><I.Copy size={15} /><span className="mi-t"><b>Duplicate</b></span><kbd>Ctrl D</kbd></button>
                <button className="menu-i" onClick={() => { setMore(false); act.archiveNodes([n.id]); }}><I.Archive size={15} /><span className="mi-t"><b>Archive</b></span></button>
                <button className="menu-i danger" onClick={() => { setMore(false); act.deleteNodes([n.id]); }}><I.Trash size={15} /><span className="mi-t"><b>Delete</b></span><kbd>Del</kbd></button>
              </motion.div>)}
            </AnimatePresence>
          </div>
          <button className="ib sm" onClick={() => ui.setSel([])} aria-label="Close panel" data-tip="Close · Esc"><I.Close size={15} /></button>
        </div>
      </div>

      <Field key={n.id + "t"} value={n.title} label="Title" className="title-field" placeholder="Name this thought" onCommit={(v) => patch({ title: v.trim() || "Untitled" })} />

      {n.type === "task" && (
        <div className={"task-main" + (n.done ? " done" : "")}>
          <button className="cb lg" onClick={() => toggleTask(n)} aria-label={n.done ? "Mark as not done" : "Mark as complete"}><I.Check size={15} /></button>
          <span>{n.done ? "Completed" : "Mark as complete"}</span>
        </div>
      )}

      {(n.type === "thought" || n.type === "inspiration") && (
        <button className="convert" onClick={convertToTask}><I.Convert size={16} /><span><b>Convert to Task</b><small>Adds a due date, priority and checkbox. Content is kept.</small></span></button>
      )}

      <div className="sec">
        <label className="lbl">Category</label>
        <div className="seg types">
          {TYPES.map((t) => (
            <button key={t} className={t === n.type ? "on" : ""} onClick={() => changeType(t)} style={{ "--c": TYPE_META[t].color } as React.CSSProperties} data-tip={TYPE_META[t].label} aria-label={TYPE_META[t].label} aria-pressed={t === n.type}>
              <TypeIcon type={t} size={15} />
            </button>
          ))}
        </div>
      </div>

      <div className="sec two">
        <div>
          <label className="lbl">Priority</label>
          <div className="seg pri">
            {PRI.map((p) => <button key={p} className={(p === n.priority ? "on " : "") + "p-" + p} onClick={() => p !== n.priority && patch({ priority: p })} aria-pressed={p === n.priority}>{p[0].toUpperCase() + p.slice(1)}</button>)}
          </div>
        </div>
        {n.type === "task" && (
          <div>
            <label className="lbl" htmlFor="due">Due date</label>
            <div className="date-wrap"><I.Calendar size={15} />
              <input id="due" type="date" className="field" value={n.due || ""} onChange={(e) => patch({ due: e.target.value })} onKeyDown={(e) => e.stopPropagation()} />
            </div>
          </div>
        )}
      </div>

      <div className="sec">
        <label className="lbl">Description</label>
        <Field key={n.id + "d"} multiline value={n.description} label="Description" placeholder="What is this about?" onCommit={(v) => patch({ description: v })} />
      </div>

      {n.type !== "inspiration" && n.type !== "thought" && (
        <div className="sec"><label className="lbl">Progress</label><ProgressBlock n={n} /></div>
      )}

      {n.type !== "project" && (
        <div className="sec">
          <label className="lbl">Projects</label>
          <div className="chips">
            {inProjects.map((p) => (
              <span key={p.id} className="chip typed on" style={{ "--c": TYPE_META.project.color } as React.CSSProperties}>
                <button className="chip-l" onClick={() => act.reveal(p)}><I.Hex size={13} />{p.title}</button>
                <button className="chip-x" onClick={() => removeFromProject(p.id)} aria-label={"Remove from " + p.title}><I.Close size={11} /></button>
              </span>
            ))}
            {projects.filter((p) => !inProjects.includes(p)).length > 0 ? (
              <select className="add-proj" value="" onChange={(e) => addToProject(e.target.value)} aria-label="Add to project">
                <option value="">+ Add to project…</option>
                {projects.filter((p) => !inProjects.includes(p)).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            ) : !inProjects.length && <span className="muted small">No projects yet — set a node's category to Project.</span>}
          </div>
        </div>
      )}

      <div className="sec">
        <label className="lbl">Notes</label>
        <Field key={n.id + "n"} multiline value={n.notes} label="Notes" placeholder="Add notes, ideas, next steps…" onCommit={(v) => patch({ notes: v })} rows={3} />
      </div>

      <div className="sec">
        <label className="lbl">Related nodes <small>{neighbors(w, n.id).length}</small></label>
        <RelatedList n={n} onPick={(o) => act.reveal(o)} />
      </div>

      <div className="sec"><label className="lbl">Links & references</label><Links n={n} /></div>

      {groups.length > 0 && (
        <div className="sec"><label className="lbl">Groups</label>
          <div className="chips">{groups.map((g) => <span key={g.id} className="chip" style={{ borderColor: g.color }}><i className="gdot" style={{ background: g.color }} />{g.name}</span>)}</div>
        </div>
      )}

      <div className="meta-foot">
        <span>Created {fmtDate(n.createdAt)}</span><span>Updated {fmtAgo(n.updatedAt)}</span>
      </div>
    </div>
  );
}

function MultiDetails({ ids }: { ids: string[] }) {
  const ui = useUI();
  const act = useActions();
  const { ws } = useStore();
  const ns = ws.nodes.filter((n) => ids.includes(n.id));
  return (
    <div className="pd">
      <div className="pd-top"><span className="type-badge">{ns.length} selected</span><button className="ib sm" onClick={() => ui.setSel([])} aria-label="Clear selection"><I.Close size={15} /></button></div>
      <div className="multi-list">
        {ns.map((n) => <div key={n.id} className="multi-i" style={{ "--c": TYPE_META[n.type].color } as React.CSSProperties}><TypeIcon type={n.type} size={14} />{n.title}</div>)}
      </div>
      <div className="multi-actions">
        <button className="btn" onClick={() => ui.setGroupDialog(true)}><I.Group size={16} /> Group selection</button>
        <button className="btn ghost" onClick={() => act.duplicateNodes(ids)}><I.Copy size={16} /> Duplicate</button>
        <button className="btn ghost" onClick={() => act.archiveNodes(ids)}><I.Archive size={16} /> Archive</button>
        <button className="btn ghost danger" onClick={() => act.deleteNodes(ids)}><I.Trash size={16} /> Delete</button>
      </div>
      <p className="muted small">Tip: Shift + click to add or remove nodes, or Shift + drag on empty canvas to select an area.</p>
    </div>
  );
}

export function DetailPanel() {
  const ui = useUI();
  const { ws } = useStore();
  const mobile = useIsMobile(900); // bottom sheet on phones and portrait tablets
  const show = ui.view === "canvas" && !ui.focus && !ui.expanded && ui.sel.length > 0;
  const single = ui.sel.length === 1 ? ws.nodes.find((n) => n.id === ui.sel[0]) : undefined;
  const anim = mobile
    ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
    : { initial: { x: PANEL_W + 40, opacity: 0.4 }, animate: { x: 0, opacity: 1 }, exit: { x: PANEL_W + 40, opacity: 0 } };
  const [sheetFull, setSheetFull] = useState(false);
  useEffect(() => setSheetFull(false), [ui.sel[0]]);
  return (
    <AnimatePresence>
      {show && (single || ui.sel.length > 1) && (
        <motion.aside key="panel" className={"panel ui" + (mobile ? " sheet" + (sheetFull ? " full" : "") : "")} {...anim}
          transition={{ type: "spring", stiffness: 380, damping: 38 }} aria-label="Node details"
          drag={mobile ? "y" : false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.15, bottom: 0.6 }}
          onDragEnd={(_, info) => { if (info.offset.y > 120) ui.setSel([]); else if (info.offset.y < -60) setSheetFull(true); }}>
          {mobile && <button className="grabber" onClick={() => setSheetFull((f) => !f)} aria-label={sheetFull ? "Collapse details" : "Expand details"}><i /></button>}
          <div className="scroll panel-body" onPointerDownCapture={(e) => mobile && e.stopPropagation()}>
            {single ? <NodeDetails key={single.id} n={single} /> : <MultiDetails ids={ui.sel} />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ Expanded card */
export function ExpandedCard() {
  const ui = useUI();
  const store = useStore();
  const act = useActions();
  const n = ui.expanded ? store.ws.nodes.find((x) => x.id === ui.expanded) : undefined;
  const mobile = useIsMobile();
  const origin = n ? { x: n.x * ui.cam.k + ui.cam.x - window.innerWidth / 2, y: n.y * ui.cam.k + ui.cam.y - window.innerHeight / 2 } : { x: 0, y: 0 };
  const capt = useRef<{ id: string | null; o: { x: number; y: number } }>({ id: null, o: { x: 0, y: 0 } });
  if (n && capt.current.id !== n.id) capt.current = { id: n.id, o: origin };
  const start = capt.current.o;
  return (
    <AnimatePresence>
      {n && ui.view === "canvas" && (
        <motion.div key={"x" + n.id} className="expanded-wrap ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) ui.setExpanded(null); }}>
          <motion.article className="expanded" role="dialog" aria-label={n.title}
            style={{ "--c": TYPE_META[n.type].color, "--c2": TYPE_META[n.type].color2 } as React.CSSProperties}
            initial={mobile ? { y: 60, opacity: 0 } : { x: start.x, y: start.y, scale: 0.18, opacity: 0 }}
            animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            exit={mobile ? { y: 60, opacity: 0 } : { x: start.x, y: start.y, scale: 0.2, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}>
            <div className="ex-head">
              <div className="ex-orb"><TypeIcon type={n.type} size={26} /></div>
              <div className="ex-title">
                <span className="type-badge"><TypeIcon type={n.type} size={13} />{TYPE_META[n.type].label}{n.type === "task" && n.due && <small>· due {fmtDate(new Date(n.due).getTime())}</small>}</span>
                <h2>{n.title}</h2>
              </div>
              <button className="ib" onClick={() => ui.setExpanded(null)} aria-label="Close" data-tip="Close · Esc"><I.Close /></button>
            </div>
            <div className="ex-body scroll">
              <div className="ex-col">
                <section><h4>Description</h4>
                  <Field key={n.id + "xd"} multiline value={n.description} label="Description" placeholder="Describe this idea…" onCommit={(v) => { store.patchNode(n.id, { description: v }); ui.flashSaved(); ui.markFresh(n.id); ui.toast("Description saved"); }} rows={4} />
                </section>
                <section><h4>Notes</h4>
                  <Field key={n.id + "xn"} multiline value={n.notes} label="Notes" placeholder="Additional notes…" onCommit={(v) => { store.patchNode(n.id, { notes: v }); ui.flashSaved(); }} rows={3} />
                </section>
                <section><h4>Links & references</h4><Links n={n} /></section>
              </div>
              <div className="ex-col">
                <section><h4>Progress & tasks</h4><ProgressBlock n={n} /></section>
                <section><h4>Related nodes</h4><RelatedList n={n} onPick={(o) => { ui.setExpanded(o.id); act.reveal(o, { open: false }); }} /></section>
              </div>
            </div>
            <div className="ex-foot">
              <span className="muted small">Created {fmtDate(n.createdAt)} · updated {fmtAgo(n.updatedAt)}</span>
              <div className="row-end">
                <button className="btn ghost sm" onClick={() => { ui.setExpanded(null); act.enterFocus(n.id); }}><I.Focus size={15} /> Focus</button>
                <button className="btn sm" onClick={() => { ui.setExpanded(null); ui.setSel([n.id]); }}><I.Edit size={15} /> Edit details</button>
              </div>
            </div>
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ Group dialog */
export function GroupDialog() {
  const ui = useUI();
  const store = useStore();
  const [name, setName] = useState("");
  const [color, setColor] = useState(GROUP_COLORS[0]);
  useEffect(() => { if (ui.groupDialog) { setName(""); setColor(GROUP_COLORS[store.ws.groups.length % GROUP_COLORS.length]); } }, [ui.groupDialog, store.ws.groups.length]);
  const ids = ui.sel;
  const create = () => {
    const nm = name.trim() || "New group";
    store.update((w) => ({ ...w, groups: [...w.groups, { id: uid("g"), name: nm, color, nodeIds: ids }] }));
    ui.setGroupDialog(false);
    ui.toast(`Grouped ${ids.length} nodes as “${nm}”`);
    store.log(`Created group “${nm}” with ${ids.length} nodes`, "group");
  };
  return (
    <AnimatePresence>
      {ui.groupDialog && (
        <motion.div className="modal-wrap ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.target === e.currentTarget && ui.setGroupDialog(false)}>
          <motion.div className="modal" role="dialog" aria-label="Create group" initial={{ scale: 0.94, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") ui.setGroupDialog(false); if (e.key === "Enter") create(); }}>
            <h3>Group {ids.length} nodes</h3>
            <p className="muted">A translucent boundary will surround them. Drag its label to move them together.</p>
            <label className="lbl" htmlFor="gname">Group name</label>
            <input id="gname" className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning routine" maxLength={40} />
            <label className="lbl">Colour</label>
            <div className="swatches lg">
              {GROUP_COLORS.map((c) => <button key={c} className={"sw" + (c === color ? " on" : "")} style={{ background: c }} onClick={() => setColor(c)} aria-label={"Colour " + c} aria-pressed={c === color} />)}
            </div>
            <div className="row-end">
              <button className="btn ghost" onClick={() => ui.setGroupDialog(false)}>Cancel</button>
              <button className="btn" onClick={create} disabled={ids.length < 2}>Create group</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ Focus bar */
export function FocusBar() {
  const ui = useUI();
  const store = useStore();
  const act = useActions();
  const root = ui.focus ? store.ws.nodes.find((n) => n.id === ui.focus) : undefined;
  const nbrs = useMemo(() => (root ? neighbors(store.ws, root.id).sort((a, b) => Math.atan2(a.y - root.y, a.x - root.x) - Math.atan2(b.y - root.y, b.x - root.x)) : []), [store.ws, root]);
  const [idx, setIdx] = useState(-1);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { setIdx(-1); setNote(null); }, [ui.focus]);
  if (!root) return null;
  const cur = idx >= 0 ? nbrs[idx] : root;
  const go = (d: number) => {
    if (!nbrs.length) { ui.toast("This node has no connections yet", "info"); return; }
    const i = idx < 0 ? (d > 0 ? 0 : nbrs.length - 1) : (idx + d + nbrs.length) % nbrs.length;
    setIdx(i); const n = nbrs[i];
    ui.setSel([n.id]); ui.markFresh(n.id);
    ui.flyTo({ wx: (n.x + root.x * 2) / 3, wy: (n.y + root.y * 2) / 3 + 80 / ui.cam.k }, 650);
  };
  const saveNote = () => {
    const t = (note || "").trim();
    if (t && cur) {
      const stamp = new Date().toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      store.patchNode(cur.id, { notes: (cur.notes ? cur.notes + "\n\n" : "") + `${stamp} — ${t}` });
      ui.markFresh(cur.id); ui.toast(`Note added to “${cur.title}”`);
    }
    setNote(null);
  };
  const pct = cur ? progressOf(store.ws, cur) : null;
  return (
    <motion.div className="focusbar ui" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.15 }}>
      <AnimatePresence mode="wait">
        <motion.div key={cur?.id} className="focus-card" style={{ "--c": TYPE_META[cur!.type].color } as React.CSSProperties}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          <span className="type-badge"><TypeIcon type={cur!.type} size={13} />{TYPE_META[cur!.type].label}{pct !== null && <small>· {pct}%</small>}{idx >= 0 && <small>· {idx + 1} of {nbrs.length} connected</small>}</span>
          <b>{cur!.title}</b>
          {cur!.description && <p>{cur!.description}</p>}
        </motion.div>
      </AnimatePresence>
      {note !== null ? (
        <div className="fb-note">
          <input autoFocus className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder={`A note for “${cur?.title}”…`} aria-label="New note"
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") saveNote(); if (e.key === "Escape") setNote(null); }} />
          <button className="btn sm" onClick={saveNote}>Save</button>
        </div>
      ) : (
        <div className="fb-row" role="toolbar" aria-label="Focus controls">
          <button className="tb-b" onClick={() => go(-1)} data-tip="Previous connected node · ←" aria-label="Previous connected node"><I.Left /></button>
          <span className="fb-count">{nbrs.length} connected</span>
          <button className="tb-b" onClick={() => go(1)} data-tip="Next connected node · →" aria-label="Next connected node"><I.Right /></button>
          <span className="tb-sep" />
          <button className="fb-btn" onClick={() => setNote("")}><I.Note size={16} /> Add a note</button>
          <button className="fb-btn primary" onClick={act.exitFocus}><I.Overview size={16} /> Return to workspace <kbd>Esc</kbd></button>
        </div>
      )}
    </motion.div>
  );
}
