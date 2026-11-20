import React from "react";
import type { NodeType } from "../state/types";

type P = { size?: number; className?: string; style?: React.CSSProperties };
const S = ({ size = 18, className, style, children, fill }: P & { children: React.ReactNode; fill?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.6}
    strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">{children}</svg>
);

export const I = {
  Overview: (p: P) => <S {...p}><circle cx="12" cy="12" r="2.6" /><circle cx="5" cy="6" r="1.6" /><circle cx="19" cy="7" r="1.6" /><circle cx="18" cy="18" r="1.6" /><circle cx="6" cy="18" r="1.6" /><path d="M6.3 7l3.9 3.4M17.6 8l-3.7 2.6M16.7 16.8l-2.9-2.7M7.4 16.8l2.7-2.6" /></S>,
  Spaces: (p: P) => <S {...p}><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" /><path d="m3 12 9 4.5 9-4.5" /><path d="m3 16.5 9 4.5 9-4.5" /></S>,
  Projects: (p: P) => <S {...p}><path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4L12 2.8Z" /><path d="M12 12 20 7.4M12 12v9.2M12 12 4 7.4" /></S>,
  Goals: (p: P) => <S {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /></S>,
  Inbox: (p: P) => <S {...p}><path d="M3.5 13.5 6 5h12l2.5 8.5V19H3.5v-5.5Z" /><path d="M3.5 13.5H8.5l1.2 2.5h4.6l1.2-2.5h5" /></S>,
  Archive: (p: P) => <S {...p}><rect x="3" y="4" width="18" height="4.5" rx="1.2" /><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4" /></S>,
  Settings: (p: P) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.4H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.6 4V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-.8.3Z" /></S>,
  Theme: (p: P) => <S {...p}><path d="M12 3a9 9 0 1 0 9 9c0-.5-.4-.9-.9-.9h-3.6a2.5 2.5 0 0 1-1.7-4.3l.4-.4c.6-.6.2-1.6-.6-1.6H12Z" /><circle cx="7.5" cy="11" r="1" fill="currentColor" /><circle cx="10" cy="7" r="1" fill="currentColor" /><circle cx="8.5" cy="15.5" r="1" fill="currentColor" /></S>,
  Help: (p: P) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.8" /><circle cx="12" cy="17.2" r=".6" fill="currentColor" /></S>,
  Search: (p: P) => <S {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></S>,
  Undo: (p: P) => <S {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></S>,
  Redo: (p: P) => <S {...p}><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></S>,
  Focus: (p: P) => <S {...p}><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><circle cx="12" cy="12" r="3" /></S>,
  Bell: (p: P) => <S {...p}><path d="M6 9.5a6 6 0 1 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 16 6 9.5Z" /><path d="M10.3 20.5a2 2 0 0 0 3.4 0" /></S>,
  Plus: (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>,
  Connect: (p: P) => <S {...p}><circle cx="6" cy="17" r="2.5" /><circle cx="18" cy="7" r="2.5" /><path d="M8 15.4C10 9.5 12.5 9 15.7 8" /></S>,
  Group: (p: P) => <S {...p}><rect x="3" y="3" width="18" height="18" rx="4" strokeDasharray="3 3" /><circle cx="9" cy="10" r="2" /><circle cx="15.5" cy="14.5" r="2" /></S>,
  ZoomIn: (p: P) => <S {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M11 8.5v5M8.5 11h5" /></S>,
  ZoomOut: (p: P) => <S {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M8.5 11h5" /></S>,
  Fit: (p: P) => <S {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /><rect x="8.5" y="8.5" width="7" height="7" rx="1.5" /></S>,
  Map: (p: P) => <S {...p}><path d="m3 6.5 6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5V6.5Z" /><path d="M9 4v13.5M15 6.5V20" /></S>,
  Expand: (p: P) => <S {...p}><path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5" /></S>,
  Close: (p: P) => <S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>,
  Trash: (p: P) => <S {...p}><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h8a1.5 1.5 0 0 0 1.5-1.4l1-12M9 7V4.5A.5.5 0 0 1 9.5 4h5a.5.5 0 0 1 .5.5V7" /></S>,
  Copy: (p: P) => <S {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></S>,
  Check: (p: P) => <S {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></S>,
  Left: (p: P) => <S {...p}><path d="m14.5 6-6 6 6 6" /></S>,
  Right: (p: P) => <S {...p}><path d="m9.5 6 6 6-6 6" /></S>,
  Note: (p: P) => <S {...p}><path d="M5 4h10l4 4v12H5V4Z" /><path d="M15 4v4h4M8.5 12h7M8.5 15.5h5" /></S>,
  Bulb: (p: P) => <S {...p}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" /></S>,
  Target: (p: P) => <S {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" /></S>,
  Hex: (p: P) => <S {...p}><path d="M12 3 19.8 7.5v9L12 21l-7.8-4.5v-9L12 3Z" /><path d="M8.5 12h7M12 8.5v7" /></S>,
  TaskI: (p: P) => <S {...p}><rect x="4" y="4" width="16" height="16" rx="5" /><path d="m8.5 12.3 2.4 2.4 4.8-5" /></S>,
  Spark: (p: P) => <S {...p}><path d="M12 3.5c.6 4.3 2.2 6 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.5 5.9-2.2 6.5-6.5Z" /><path d="M18.5 15.5c.3 1.7.9 2.3 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.2 2.2-.8 2.5-2.5Z" /></S>,
  Calendar: (p: P) => <S {...p}><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></S>,
  Flag: (p: P) => <S {...p}><path d="M5 21V4M5 4.5h11l-1.8 3.8L16 12H5" /></S>,
  Download: (p: P) => <S {...p}><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></S>,
  Upload: (p: P) => <S {...p}><path d="M12 15V4M7 8.5l5-5 5 5M5 20h14" /></S>,
  Menu: (p: P) => <S {...p}><path d="M4 7h16M4 12h16M4 17h10" /></S>,
  Edit: (p: P) => <S {...p}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m13.5 6.5 3 3" /></S>,
  Link: (p: P) => <S {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></S>,
  Convert: (p: P) => <S {...p}><path d="M4 8h12l-3-3M20 16H8l3 3" /></S>,
  Restore: (p: P) => <S {...p}><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 4v4.5h4.5" /></S>,
  Eye: (p: P) => <S {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></S>,
  Cursor: (p: P) => <S {...p}><path d="m5 3 14 7.5-6 1.7-2.6 5.8L5 3Z" /></S>,
  Logo: ({ size = 28 }: P) => (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id="lg1" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#F5EDFF" /><stop offset=".45" stopColor="#A855F7" /><stop offset="1" stopColor="#3B82F6" /></radialGradient>
      </defs>
      <circle cx="16" cy="16" r="9" fill="url(#lg1)" />
      <ellipse cx="16" cy="16" rx="14.5" ry="5.2" fill="none" stroke="#22D3EE" strokeOpacity=".7" strokeWidth="1.1" transform="rotate(-24 16 16)" />
      <circle cx="28.3" cy="10.6" r="1.6" fill="#EC4899" />
    </svg>
  ),
};

export function TypeIcon({ type, size = 16 }: { type: NodeType; size?: number }) {
  switch (type) {
    case "thought": return <I.Bulb size={size} />;
    case "goal": return <I.Target size={size} />;
    case "project": return <I.Hex size={size} />;
    case "task": return <I.TaskI size={size} />;
    case "inspiration": return <I.Spark size={size} />;
  }
}
