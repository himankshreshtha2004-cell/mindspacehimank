export type NodeType = "thought" | "goal" | "project" | "task" | "inspiration";
export type Priority = "low" | "medium" | "high";
export type Relation = "related" | "depends" | "partof" | "leads" | "inspired";

export interface CheckItem { id: string; text: string; done: boolean; status?: "done" | "progress" | "pending" }

export interface MNode {
  id: string;
  type: NodeType;
  title: string;
  description: string;
  notes: string;
  x: number;
  y: number;
  size?: "xl" | "lg" | "md" | "sm"; // visual weight
  priority: Priority;
  progress?: number;       // manual progress (0–100) for nodes without tasks
  done?: boolean;          // tasks
  due?: string;            // tasks (yyyy-mm-dd)
  items: CheckItem[];      // attached checklist / sub-tasks
  links: { label: string; url: string }[];
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
  inbox?: boolean;         // captured but not yet placed on the canvas
  convertedFrom?: NodeType;
}

export interface Edge { id: string; from: string; to: string; rel: Relation; createdAt: number }

export interface Group { id: string; name: string; color: string; nodeIds: string[] }

export interface Workspace {
  id: string;
  name: string;
  nodes: MNode[];
  edges: Edge[];
  groups: Group[];
  createdAt: number;
  updatedAt: number;
  view?: { x: number; y: number; k: number };
}

export interface Settings {
  particles: boolean;
  grid: boolean;
  labels: boolean;     // always show relationship labels
  glow: number;        // 0.4 – 1.4
  reduceMotion: boolean;
}

export interface AppData {
  version: 1;
  activeId: string;
  workspaces: Workspace[];
  settings: Settings;
  activity: { id: string; text: string; at: number; kind: string }[];
}

export const TYPE_META: Record<NodeType, { label: string; color: string; color2: string; plural: string }> = {
  thought: { label: "Thought", plural: "Thoughts", color: "#3B82F6", color2: "#60A5FA" },
  goal: { label: "Goal", plural: "Goals", color: "#A855F7", color2: "#C084FC" },
  project: { label: "Project", plural: "Projects", color: "#EC4899", color2: "#8B5CF6" },
  task: { label: "Task", plural: "Tasks", color: "#22D3EE", color2: "#67E8F9" },
  inspiration: { label: "Inspiration", plural: "Inspiration", color: "#C4B5FD", color2: "#DDD6FE" },
};

export const REL_META: Record<Relation, { label: string; short: string }> = {
  related: { label: "Related to", short: "related" },
  depends: { label: "Depends on", short: "depends on" },
  partof: { label: "Part of", short: "part of" },
  leads: { label: "Leads to", short: "leads to" },
  inspired: { label: "Inspired by", short: "inspired by" },
};

export const GROUP_COLORS = ["#A855F7", "#3B82F6", "#22D3EE", "#EC4899", "#8B5CF6", "#F1F5F9"];
