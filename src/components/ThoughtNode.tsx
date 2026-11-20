import React from "react";
import type { MNode } from "../state/types";
import { TYPE_META } from "../state/types";
import { I, TypeIcon } from "./Icons";

export interface NodeFlags {
  selected: boolean; dim: boolean; faded: boolean; match: boolean; related: boolean; fresh: boolean;
  dragging: boolean; settle: boolean; csrc: boolean; focusCenter: boolean;
}

function Ring({ r, pct }: { r: number; pct: number }) {
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={r * 2 + 8} height={r * 2 + 8} viewBox={`0 0 ${r * 2 + 8} ${r * 2 + 8}`} aria-hidden="true">
      <circle cx={r + 4} cy={r + 4} r={r} className="ring-bg" />
      <circle cx={r + 4} cy={r + 4} r={r} className="ring-fg" strokeDasharray={`${(pct / 100) * c} ${c}`} transform={`rotate(-90 ${r + 4} ${r + 4})`} />
    </svg>
  );
}

function ThoughtNodeBase({ node, progress, flags, magnet, idx }: { node: MNode; progress: number | null; flags: NodeFlags; magnet?: { x: number; y: number }; idx: number }) {
  const meta = TYPE_META[node.type];
  const orb = node.size === "xl" || node.size === "lg";
  const cls = [
    "mnode", orb ? "is-orb" : "is-pill", `t-${node.type}`, `s-${node.size || "sm"}`,
    flags.selected && "sel", flags.dim && "dim", flags.faded && "faded", flags.match && "match", flags.related && "related",
    flags.fresh && "fresh", flags.fresh && Date.now() - node.createdAt < 2500 && "born", flags.dragging && "dragging", flags.settle && "settle", flags.csrc && "csrc",
    flags.focusCenter && "fcenter", node.type === "task" && node.done && "done",
  ].filter(Boolean).join(" ");
  const style = {
    left: node.x, top: node.y,
    "--c": meta.color, "--c2": meta.color2,
    "--mx": `${magnet?.x || 0}px`, "--my": `${magnet?.y || 0}px`,
    "--fd": `${(idx % 7) * -1.3}s`, "--pd": `${(idx % 11) * -2.1}s`,
  } as React.CSSProperties;
  const pctLabel = progress !== null ? ` · ${progress}%` : "";

  return (
    <div className={cls} style={style} data-id={node.id} role="button" tabIndex={-1}
      aria-label={`${meta.label}: ${node.title}${pctLabel}`}>
      <div className="mn-float">
        {orb ? (
          <>
            <div className="orb" data-grab>
              {progress !== null && <Ring r={node.size === "xl" ? 104 : 54} pct={progress} />}
              <div className="orb-core">
                {node.size === "xl" && (
                  <svg className="globe" viewBox="0 0 100 100" aria-hidden="true">
                    <ellipse cx="50" cy="50" rx="46" ry="16" /><ellipse cx="50" cy="50" rx="46" ry="32" />
                    <ellipse cx="50" cy="50" rx="16" ry="46" /><ellipse cx="50" cy="50" rx="32" ry="46" />
                  </svg>
                )}
                <span className="orb-ic"><TypeIcon type={node.type} size={node.size === "xl" ? 30 : 20} /></span>
              </div>
            </div>
            <div className="olabel" data-grab>
              <span className="tt">{node.title}</span>
              <span className="mt">{meta.label}{pctLabel}</span>
            </div>
          </>
        ) : (
          <div className="pill" data-grab>
            {node.type === "task" ? (
              <button className="chk" data-check aria-label={node.done ? "Mark as not done" : "Mark as done"} data-tip={node.done ? "Mark as not done" : "Mark complete"}>
                <I.Check size={12} />
              </button>
            ) : (
              <span className="pic"><TypeIcon type={node.type} size={14} /></span>
            )}
            <span className="tt">{node.title}</span>
            {progress !== null && node.type !== "task" && <span className="mini"><i style={{ width: `${progress}%` }} /></span>}
            {node.type === "task" && progress !== null && progress > 0 && progress < 100 && <span className="pc">{progress}%</span>}
          </div>
        )}
        <button className="xbtn" data-expand aria-label="Expand" data-tip="Expand"><I.Expand size={12} /></button>
        <span className="handle" data-handle data-tip="Drag to connect" />
      </div>
    </div>
  );
}

export const ThoughtNode = React.memo(ThoughtNodeBase, (a, b) =>
  a.node === b.node && a.progress === b.progress && a.idx === b.idx &&
  (a.magnet?.x || 0) === (b.magnet?.x || 0) && (a.magnet?.y || 0) === (b.magnet?.y || 0) &&
  Object.keys(a.flags).every((k) => a.flags[k as keyof NodeFlags] === b.flags[k as keyof NodeFlags]));
