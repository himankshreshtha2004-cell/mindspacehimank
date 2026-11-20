import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../state/store";
import { useUI, type ViewName } from "../state/ui";
import { TYPE_META } from "../state/types";
import { byId, fmtAgo, freeSpot, searchNodes, visibleNodes, worldBounds } from "../state/graph";
import { I, TypeIcon } from "./Icons";
import { useActions } from "../actions";
import { fitView, pointer } from "./MindCanvas";

const pop = { initial: { opacity: 0, y: -6, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -4, scale: 0.98 }, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } };

/* ================================================================== Sidebar */
export function Sidebar() {
  const { ws, data } = useStore();
  const ui = useUI();
  const inbox = ws.nodes.filter((n) => n.inbox && !n.archived).length;
  const archived = ws.nodes.filter((n) => n.archived).length;
  const [theme, setTheme] = useState(false);
  const items: { v: ViewName; label: string; icon: React.ReactNode; badge?: number }[] = [
    { v: "canvas", label: "Overview", icon: <I.Overview /> },
    { v: "spaces", label: "My Spaces", icon: <I.Spaces />, badge: data.workspaces.length },
    { v: "projects", label: "Projects", icon: <I.Projects /> },
    { v: "goals", label: "Goals", icon: <I.Goals /> },
    { v: "inbox", label: "Inbox", icon: <I.Inbox />, badge: inbox || undefined },
    { v: "archive", label: "Archived Ideas", icon: <I.Archive />, badge: archived || undefined },
  ];
  const go = (v: ViewName) => { ui.setView(v); ui.setSidebarOpen(false); ui.setMenu(null); if (v !== "canvas") ui.setExpanded(null); };
  return (
    <>
      <AnimatePresence>{ui.sidebarOpen && <motion.div className="scrim ui" onClick={() => ui.setSidebarOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}</AnimatePresence>
      <nav className={"sidebar ui" + (ui.sidebarOpen ? " open" : "") + (ui.focus ? " gone" : "")} aria-label="Main navigation">
        <div className="brand"><I.Logo size={30} /><span>Mindspace</span></div>
        <div className="nav">
          {items.map((it) => (
            <button key={it.v} className={"nav-i" + (ui.view === it.v ? " on" : "")} onClick={() => go(it.v)} data-tip={it.label} data-tip-side="right" aria-current={ui.view === it.v ? "page" : undefined}>
              {it.icon}<span className="nl">{it.label}</span>{it.badge ? <span className="badge">{it.badge}</span> : null}
              {ui.view === it.v && <motion.i layoutId="navglow" className="nav-glow" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            </button>
          ))}
          <div className="nav-sep" />
          <button className={"nav-i" + (ui.view === "settings" ? " on" : "")} onClick={() => go("settings")} data-tip="Settings" data-tip-side="right">
            <I.Settings /><span className="nl">Settings</span>
            {ui.view === "settings" && <motion.i layoutId="navglow" className="nav-glow" />}
          </button>
        </div>
        <SidebarTips />
        <div className="nav-foot">
          <div className="theme-wrap">
            <button className={"nav-i sm" + (theme ? " on" : "")} onClick={() => setTheme((t) => !t)} data-tip="Theme" data-tip-side="right" aria-expanded={theme}><I.Theme /><span className="nl">Theme</span></button>
            <AnimatePresence>{theme && <ThemePop onClose={() => setTheme(false)} />}</AnimatePresence>
          </div>
          <button className="nav-i sm" onClick={() => { ui.setHelp(true); ui.setSidebarOpen(false); }} data-tip="Help & shortcuts" data-tip-side="right"><I.Help /><span className="nl">Help</span></button>
          <button className="profile" onClick={() => go("settings")} data-tip="Your profile" data-tip-side="right">
            <span className="avatar">Y</span><span className="nl"><b>You</b><small>Local profile</small></span>
          </button>
        </div>
      </nav>
    </>
  );
}

function SidebarTips() {
  const ui = useUI();
  const show = ui.welcome && !ui.sel.length && ui.view === "canvas";
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="sb-tips" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.3 }}>
          <button className="ib xs wc-x" onClick={() => ui.setWelcome(false)} aria-label="Hide tips"><I.Close size={11} /></button>
          <b>Your universe of ideas</b>
          <p>Select a node to see its story. Everything is editable.</p>
          <ul className="tips">
            <li><span>Click empty space</span><em>create</em></li>
            <li><span>Drag a node's dot</span><em>link</em></li>
            <li><span>Double-click</span><em>expand</em></li>
            <li><span>Shift + drag</span><em>select</em></li>
            <li><span>Ctrl + scroll</span><em>zoom</em></li>
          </ul>
          <button className="link-btn" onClick={() => ui.setHelp(true)}>All shortcuts <kbd>?</kbd></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ThemePop({ onClose }: { onClose: () => void }) {
  const { settings, setData } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest(".theme-wrap")) onClose(); };
    window.addEventListener("pointerdown", h); return () => window.removeEventListener("pointerdown", h);
  }, [onClose]);
  const set = (k: keyof typeof settings, v: boolean | number) => setData((d) => ({ ...d, settings: { ...d.settings, [k]: v } }));
  return (
    <motion.div ref={ref} className="theme-pop ui" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.18 }}>
      <div className="menu-h">Atmosphere</div>
      <Toggle label="Particles" on={settings.particles} set={(v) => set("particles", v)} />
      <Toggle label="Grid texture" on={settings.grid} set={(v) => set("grid", v)} />
      <Toggle label="Relationship labels" on={settings.labels} set={(v) => set("labels", v)} />
      <Toggle label="Reduce motion" on={settings.reduceMotion} set={(v) => set("reduceMotion", v)} />
      <label className="slider-row"><span>Glow</span>
        <input type="range" min={0.4} max={1.4} step={0.1} value={settings.glow} onChange={(e) => set("glow", Number(e.target.value))} aria-label="Glow intensity" />
      </label>
    </motion.div>
  );
}

export function Toggle({ label, on, set, hint }: { label: string; on: boolean; set: (v: boolean) => void; hint?: string }) {
  return (
    <button className="toggle-row" role="switch" aria-checked={on} onClick={() => set(!on)}>
      <span className="tl"><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <span className={"tgl" + (on ? " on" : "")}><i /></span>
    </button>
  );
}

/* ================================================================== Top bar */
export function TopBar() {
  const store = useStore();
  const ui = useUI();
  const act = useActions();
  const { ws, data } = store;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(ws.name);
  const [spaces, setSpaces] = useState(false);
  const [notif, setNotif] = useState(false);
  const [mSearch, setMSearch] = useState(false);
  const lastAct = useRef(data.activity[0]?.id);
  const [savePulse, setSavePulse] = useState(0);

  useEffect(() => setName(ws.name), [ws.name, ws.id]);
  useEffect(() => {
    const id = data.activity[0]?.id;
    if (id && id !== lastAct.current) { lastAct.current = id; if (!notif) ui.setUnread(ui.unread + 1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.activity]);
  useEffect(() => { if (ui.savedFlash) setSavePulse((n) => n + 1); }, [ui.savedFlash]);

  const commitName = () => {
    setEditing(false);
    const v = name.trim();
    if (v && v !== ws.name) { store.update((w) => ({ ...w, name: v })); ui.toast(`Renamed space to “${v}”`); }
    else setName(ws.name);
  };

  return (
    <header className={"topbar ui" + (ui.focus ? " gone" : "")}>
      <button className="ib menu-btn" onClick={() => ui.setSidebarOpen(!ui.sidebarOpen)} aria-label="Open navigation"><I.Menu /></button>
      <div className="ws-name">
        <span className="ws-dot" />
        {editing ? (
          <input autoFocus className="ws-input" value={name} onChange={(e) => setName(e.target.value)} onBlur={commitName}
            onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { setName(ws.name); setEditing(false); } }} aria-label="Workspace name" maxLength={48} />
        ) : (
          <button className="ws-title" onClick={() => setEditing(true)} data-tip="Rename space">{ws.name}<I.Edit size={13} /></button>
        )}
        <button className="ib sm" onClick={() => setSpaces((s) => !s)} aria-label="Switch space" data-tip="Switch space" aria-expanded={spaces}>
          <I.Right size={14} style={{ transform: "rotate(90deg)" }} />
        </button>
        <AnimatePresence>
          {spaces && (
            <Popover onClose={() => setSpaces(false)} className="spaces-pop">
              <div className="menu-h">Your spaces</div>
              {data.workspaces.map((w) => (
                <button key={w.id} className={"menu-i" + (w.id === ws.id ? " on" : "")} onClick={() => { setSpaces(false); if (w.id !== ws.id) act.switchWorkspace(w.id); }}>
                  <span className="mi-ic"><I.Spaces size={15} /></span><span className="mi-t"><b>{w.name}</b><small>{visibleNodes(w).length} nodes · edited {fmtAgo(w.updatedAt)}</small></span>
                  {w.id === ws.id && <I.Check size={14} />}
                </button>
              ))}
              <button className="menu-i" onClick={() => { setSpaces(false); act.newWorkspace(); }}><span className="mi-ic"><I.Plus size={15} /></span><span className="mi-t"><b>New space</b></span></button>
              <button className="menu-i" onClick={() => { setSpaces(false); ui.setView("spaces"); }}><span className="mi-ic"><I.Spaces size={15} /></span><span className="mi-t"><b>Manage spaces…</b></span></button>
            </Popover>
          )}
        </AnimatePresence>
        <span key={savePulse} className={"save-state " + store.saveState + (savePulse ? " pulse" : "")} aria-live="polite">
          {store.saveState === "saving" ? "Saving…" : <><I.Check size={12} /> Saved</>}
        </span>
      </div>

      <SearchBox mobileOpen={mSearch} setMobileOpen={setMSearch} />

      <div className="tb-actions">
        <button className="ib m-only" onClick={() => setMSearch(true)} aria-label="Search"><I.Search /></button>
        <button className="ib" disabled={!store.canUndo} onClick={() => { store.undo(); ui.toast("Undone", "info"); }} aria-label="Undo" data-tip="Undo · Ctrl/⌘ Z"><I.Undo /></button>
        <button className="ib" disabled={!store.canRedo} onClick={() => { store.redo(); ui.toast("Redone", "info"); }} aria-label="Redo" data-tip="Redo · Ctrl/⌘ ⇧ Z"><I.Redo /></button>
        <span className="tb-sep" />
        <button className={"focus-btn" + (ui.focus ? " on" : "")} onClick={() => (ui.focus ? act.exitFocus() : act.enterFocus())} data-tip="Focus on the selected node · F">
          <I.Focus size={16} /><span>Focus</span>
        </button>
        <div className="pop-wrap">
          <button className="ib" onClick={() => { setNotif((n) => !n); ui.setUnread(0); }} aria-label="Notifications" data-tip="Activity" aria-expanded={notif}>
            <I.Bell />{ui.unread > 0 && <span className="dot-badge">{Math.min(9, ui.unread)}</span>}
          </button>
          <AnimatePresence>
            {notif && (
              <Popover onClose={() => setNotif(false)} className="notif-pop" right>
                <div className="menu-h">Activity <small>{data.activity.length}</small></div>
                <div className="scroll notif-list">
                  {data.activity.length === 0 && <div className="empty-sm">Nothing yet. Changes you make appear here.</div>}
                  {data.activity.slice(0, 20).map((a) => (
                    <div key={a.id} className={"notif k-" + a.kind}><i /><div><p>{a.text}</p><small>{fmtAgo(a.at)}</small></div></div>
                  ))}
                </div>
                {data.activity.length > 0 && <button className="menu-i center" onClick={() => { store.setData((d) => ({ ...d, activity: [] })); setNotif(false); }}>Clear activity</button>}
              </Popover>
            )}
          </AnimatePresence>
        </div>
        <button className="avatar sm" onClick={() => ui.setView("settings")} aria-label="Profile and settings" data-tip="Profile & settings">Y</button>
      </div>
    </header>
  );
}

function Popover({ children, onClose, className = "", right }: { children: React.ReactNode; onClose: () => void; className?: string; right?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: PointerEvent) => { const p = ref.current?.parentElement; if (p && !p.contains(e.target as Node)) onClose(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const t = window.setTimeout(() => { window.addEventListener("pointerdown", h); window.addEventListener("keydown", k); }, 0);
    return () => { window.clearTimeout(t); window.removeEventListener("pointerdown", h); window.removeEventListener("keydown", k); };
  }, [onClose]);
  return <motion.div ref={ref} className={"popover " + className + (right ? " right" : "")} {...pop}>{children}</motion.div>;
}

/* ================================================================== Search */
function SearchBox({ mobileOpen, setMobileOpen }: { mobileOpen: boolean; setMobileOpen: (b: boolean) => void }) {
  const { ws } = useStore();
  const ui = useUI();
  const act = useActions();
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inp = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchNodes(ws, ui.query).slice(0, 8), [ws, ui.query]);
  const recent = useMemo(() => [...visibleNodes(ws)].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4), [ws]);
  useEffect(() => setHi(0), [ui.query]);
  useEffect(() => { if (mobileOpen) window.setTimeout(() => inp.current?.focus(), 30); }, [mobileOpen]);

  const pick = (id: string) => {
    const n = ws.nodes.find((x) => x.id === id); if (!n) return;
    setOpen(false); setMobileOpen(false); inp.current?.blur();
    if (n.inbox) { ui.setView("inbox"); return; }
    ui.setView("canvas"); ui.setExpanded(null);
    if (ui.focus) ui.setFocus(null);
    act.reveal(n);
  };
  const where: Record<string, string> = { title: "Title", category: "Category", description: "Description", notes: "Notes", project: "Project / group", tasks: "Tasks" };
  const types = Object.keys(TYPE_META) as (keyof typeof TYPE_META)[];

  return (
    <div className={"search" + (open ? " open" : "") + (mobileOpen ? " m-open" : "")}>
      <I.Search size={17} />
      <input ref={inp} id="search-input" value={ui.query} placeholder="Search thoughts, projects, notes…" autoComplete="off" spellCheck={false}
        onChange={(e) => { ui.setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 160)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(results.length - 1, h + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
          if (e.key === "Enter" && results[hi]) pick(results[hi].node.id);
          if (e.key === "Escape") { if (ui.query) ui.setQuery(""); else { inp.current?.blur(); setMobileOpen(false); } e.stopPropagation(); }
        }}
        aria-label="Search the workspace" role="combobox" aria-expanded={open} aria-controls="search-list" />
      {ui.query ? (
        <button className="ib sm" onMouseDown={(e) => e.preventDefault()} onClick={() => { ui.setQuery(""); inp.current?.focus(); }} aria-label="Clear search"><I.Close size={14} /></button>
      ) : <kbd className="kbd-hint">Ctrl F</kbd>}
      {mobileOpen && <button className="ib sm m-only" onClick={() => { setMobileOpen(false); ui.setQuery(""); }} aria-label="Close search">Cancel</button>}
      <AnimatePresence>
        {open && (
          <motion.div className="search-pop" id="search-list" role="listbox" {...pop} onMouseDown={(e) => e.preventDefault()}>
            {ui.query.trim() ? (
              results.length ? (
                <>
                  <div className="menu-h">{searchNodes(ws, ui.query).length} matches <small>↑↓ to move · Enter to open</small></div>
                  {results.map((r, i) => (
                    <button key={r.node.id} role="option" aria-selected={i === hi} className={"sr" + (i === hi ? " hi" : "")} onMouseEnter={() => setHi(i)} onClick={() => pick(r.node.id)}
                      style={{ "--c": TYPE_META[r.node.type].color } as React.CSSProperties}>
                      <span className="mi-ic"><TypeIcon type={r.node.type} size={15} /></span>
                      <span className="mi-t"><b>{r.node.title}</b><small>{TYPE_META[r.node.type].label} · matched in {where[r.where] || r.where}{r.node.inbox ? " · Inbox" : ""}</small></span>
                    </button>
                  ))}
                </>
              ) : (
                <div className="empty-sm">No thoughts match “{ui.query}”. Try a project name, a category like “task”, or a word from your notes.</div>
              )
            ) : (
              <>
                <div className="menu-h">Try searching</div>
                <div className="chips">
                  {["portfolio", "health", "travel", "savings", "learn"].map((s) => <button key={s} className="chip" onClick={() => ui.setQuery(s)}>{s}</button>)}
                </div>
                <div className="menu-h">By category</div>
                <div className="chips">
                  {types.map((t) => <button key={t} className="chip typed" style={{ "--c": TYPE_META[t].color } as React.CSSProperties} onClick={() => ui.setQuery(TYPE_META[t].label.toLowerCase())}><TypeIcon type={t} size={13} />{TYPE_META[t].plural}</button>)}
                </div>
                <div className="menu-h">Recently edited</div>
                {recent.map((n) => (
                  <button key={n.id} className="sr" onClick={() => pick(n.id)} style={{ "--c": TYPE_META[n.type].color } as React.CSSProperties}>
                    <span className="mi-ic"><TypeIcon type={n.type} size={15} /></span><span className="mi-t"><b>{n.title}</b><small>{fmtAgo(n.updatedAt)}</small></span>
                  </button>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================================================================== Floating toolbar */
export function FloatingToolbar() {
  const ui = useUI();
  const { ws } = useStore();
  if (ui.focus || ui.view !== "canvas") return null;
  const zoom = (f: number) => {
    const { w, h } = ui.canvasSize.current;
    const k = Math.max(0.2, Math.min(2.6, ui.cam.k * f));
    const wx = (w / 2 - ui.cam.x) / ui.cam.k, wy = (h / 2 - ui.cam.y) / ui.cam.k;
    ui.flyTo({ k, x: w / 2 - wx * k, y: h / 2 - wy * k }, 260);
  };
  const add = () => {
    const { w, h } = ui.canvasSize.current;
    const p = freeSpot(ws, (w / 2 - ui.cam.x) / ui.cam.k, (h / 2 - 40 - ui.cam.y) / ui.cam.k);
    let sx = p.x * ui.cam.k + ui.cam.x, sy = p.y * ui.cam.k + ui.cam.y;
    if (sx < 260 || sx > w - 260 || sy < 100 || sy > h - 160) { sx = w / 2; sy = h / 2 - 40; } // fall back to centre if the free spot is off-screen
    ui.setMenu({ kind: "create", sx, sy, wx: (sx - ui.cam.x) / ui.cam.k, wy: (sy - ui.cam.y) / ui.cam.k });
  };
  const fit = () => {
    const c = fitView(ws, { w: window.innerWidth, h: window.innerHeight });
    ui.flyTo({ x: c.x, y: c.y, k: c.k }, 700);
  };
  const canGroup = ui.sel.length >= 2;
  return (
    <div className="toolbar ui" role="toolbar" aria-label="Canvas tools">
      <button className="tb-add" onClick={add} data-tip="Add thought · N"><I.Plus size={18} /><span>Add</span></button>
      <span className="tb-sep" />
      <button className={"tb-b" + (ui.tool === "connect" ? " on" : "")} onClick={() => { ui.setTool(ui.tool === "connect" ? "select" : "connect"); ui.setConnectFrom(null); ui.setMenu(null); }} data-tip="Connect · C" aria-pressed={ui.tool === "connect"}><I.Connect /></button>
      <button className={"tb-b" + (canGroup ? " ready" : "")} onClick={() => (canGroup ? ui.setGroupDialog(true) : ui.toast("Shift + click or Shift + drag to select 2 or more nodes, then group them", "info"))} data-tip={canGroup ? `Group ${ui.sel.length} nodes · G` : "Group selection · G"}><I.Group /></button>
      <span className="tb-sep" />
      <button className="tb-b" onClick={() => zoom(1 / 1.25)} data-tip="Zoom out · −" aria-label="Zoom out"><I.ZoomOut /></button>
      <button className="tb-zoom" onClick={() => { const { w, h } = ui.canvasSize.current; const wx = (w / 2 - ui.cam.x) / ui.cam.k, wy = (h / 2 - ui.cam.y) / ui.cam.k; ui.flyTo({ k: 1, x: w / 2 - wx, y: h / 2 - wy }, 300); }} data-tip="Reset to 100%">{Math.round(ui.cam.k * 100)}%</button>
      <button className="tb-b" onClick={() => zoom(1.25)} data-tip="Zoom in · +" aria-label="Zoom in"><I.ZoomIn /></button>
      <button className="tb-b" onClick={fit} data-tip="Fit to screen · 0" aria-label="Fit to screen"><I.Fit /></button>
      <span className="tb-sep" />
      <button className={"tb-b" + (ui.minimap ? " on" : "")} onClick={() => ui.setMinimap(!ui.minimap)} data-tip="Mini-map · M" aria-pressed={ui.minimap}><I.Map /></button>
    </div>
  );
}

/* ================================================================== Mini-map */
export function MiniMap() {
  const { ws } = useStore();
  const ui = useUI();
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef(false);
  const nodes = visibleNodes(ws);
  const map = byId(ws);
  const W = 196, H = 132;
  const { w: vw, h: vh } = ui.canvasSize.current;
  const view = { x: -ui.cam.x / ui.cam.k, y: -ui.cam.y / ui.cam.k, w: vw / ui.cam.k, h: vh / ui.cam.k };
  const b0 = worldBounds(nodes);
  const bx0 = Math.min(b0.x, view.x), by0 = Math.min(b0.y, view.y);
  const bx1 = Math.max(b0.x + b0.w, view.x + view.w), by1 = Math.max(b0.y + b0.h, view.y + view.h);
  const s = Math.min((W - 12) / (bx1 - bx0), (H - 12) / (by1 - by0));
  const ox = (W - (bx1 - bx0) * s) / 2 - bx0 * s, oy = (H - (by1 - by0) * s) / 2 - by0 * s;
  const mx = (x: number) => x * s + ox, my = (y: number) => y * s + oy;
  if (!ui.minimap || ui.view !== "canvas" || ui.focus) return null;

  const nav = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const wx = (e.clientX - r.left - ox) / s, wy = (e.clientY - r.top - oy) / s;
    ui.setCam({ k: ui.cam.k, x: vw / 2 - wx * ui.cam.k, y: vh / 2 - wy * ui.cam.k });
  };
  return (
    <div className="minimap ui" aria-label="Mini-map — click or drag to navigate">
      <svg ref={ref} width={W} height={H}
        onPointerDown={(e) => { drag.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); nav(e); }}
        onPointerMove={(e) => drag.current && nav(e)} onPointerUp={() => (drag.current = false)} onPointerCancel={() => (drag.current = false)}>
        {ws.edges.map((e) => {
          const a = map.get(e.from), b = map.get(e.to);
          if (!a || !b || a.archived || b.archived || a.inbox || b.inbox) return null;
          return <line key={e.id} x1={mx(a.x)} y1={my(a.y)} x2={mx(b.x)} y2={my(b.y)} className="mm-e" />;
        })}
        {nodes.map((n) => (
          <circle key={n.id} cx={mx(n.x)} cy={my(n.y)} r={n.size === "xl" ? 5 : n.size === "lg" ? 3.6 : 2.4} fill={TYPE_META[n.type].color}
            className={ui.sel.includes(n.id) ? "mm-sel" : undefined} />
        ))}
        <rect className="mm-view" x={mx(view.x)} y={my(view.y)} width={view.w * s} height={view.h * s} rx={4} />
      </svg>
      <div className="mm-cap"><span>{nodes.length} nodes</span><span>{ws.edges.length} links</span></div>
    </div>
  );
}

/** open the creation menu at the pointer if it's over the canvas, else centre */
export function openCreateAtPointer(ui: ReturnType<typeof useUI>) {
  const { w, h } = ui.canvasSize.current;
  const over = pointer.x > 80 && pointer.x < w - 20 && pointer.y > 80 && pointer.y < h - 90;
  const sx = over ? pointer.x : w / 2, sy = over ? pointer.y : h / 2 - 40;
  ui.setMenu({ kind: "create", sx, sy, wx: (sx - ui.cam.x) / ui.cam.k, wy: (sy - ui.cam.y) / ui.cam.k });
}
