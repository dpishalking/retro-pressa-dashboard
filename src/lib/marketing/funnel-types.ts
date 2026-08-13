export type FunnelNodeKind = "sticky" | "step";

export type FunnelViewport = {
  x: number;
  y: number;
  scale: number;
};

export type FunnelNode = {
  id: string;
  kind: FunnelNodeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  text: string;
};

export type FunnelEdge = {
  id: string;
  from: string;
  to: string;
};

export type FunnelBoard = {
  id: string;
  title: string;
  description: string;
  stage: string;
  seeded: boolean;
  createdAt: string;
  updatedAt: string;
  viewport: FunnelViewport;
  nodes: FunnelNode[];
  edges: FunnelEdge[];
};

export type FunnelSummary = Pick<FunnelBoard, "id" | "title" | "description" | "stage" | "seeded" | "updatedAt">;

export const FUNNEL_STICKY_COLORS = ["#fef3c7", "#dbeafe", "#fce7f3", "#dcfce7", "#ffedd5", "#e0e7ff"] as const;
