import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateId } from "@/lib/training/id";
import { MARKETING_CREATIVE_OFFERS } from "@/lib/marketing/creative-offers";
import type { FunnelBoard, FunnelEdge, FunnelNode, FunnelSummary } from "@/lib/marketing/funnel-types";

const funnelsDir = process.env.MARKETING_FUNNELS_DIR?.trim()
  ? path.resolve(process.env.MARKETING_FUNNELS_DIR.trim())
  : path.join(process.cwd(), "data", "marketing-funnels");
const catalogPath = path.join(funnelsDir, "catalog.json");

let catalogLock: Promise<void> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = catalogLock.then(fn);
  catalogLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

type Catalog = { version: 1; funnels: FunnelBoard[] };

function isBoard(value: unknown): value is FunnelBoard {
  if (!value || typeof value !== "object") return false;
  const board = value as Partial<FunnelBoard>;
  return (
    typeof board.id === "string" &&
    typeof board.title === "string" &&
    Array.isArray(board.nodes) &&
    Array.isArray(board.edges)
  );
}

function node(id: string, kind: FunnelNode["kind"], x: number, y: number, color: string, text: string): FunnelNode {
  return {
    id,
    kind,
    x,
    y,
    w: kind === "step" ? 240 : 200,
    h: kind === "step" ? 112 : 140,
    color,
    text
  };
}

function edge(from: string, to: string): FunnelEdge {
  return { id: `${from}-${to}`, from, to };
}

function seedBoard(offer: (typeof MARKETING_CREATIVE_OFFERS)[number], now: string): FunnelBoard {
  const prefix = offer.id;
  const steps = offer.jobs.slice(0, 4).map((text, index) =>
    node(`${prefix}-step-${index + 1}`, "step", 80 + index * 280, 180, "#ffffff", text)
  );
  const sticky = node(`${prefix}-job`, "sticky", 80, 20, "#fef3c7", offer.job);
  const talk = node(`${prefix}-talk`, "sticky", 80, 360, "#dbeafe", offer.talk);
  const edges = steps.slice(0, -1).map((item, index) => edge(item.id, steps[index + 1]!.id));
  return {
    id: offer.id,
    title: offer.title,
    description: offer.job,
    stage: offer.stage,
    seeded: true,
    createdAt: now,
    updatedAt: now,
    viewport: { x: 24, y: 24, scale: 1 },
    nodes: [sticky, ...steps, talk],
    edges
  };
}

function seedCatalog(): Catalog {
  const now = new Date().toISOString();
  return { version: 1, funnels: MARKETING_CREATIVE_OFFERS.map((offer) => seedBoard(offer, now)) };
}

function normalizeBoard(board: FunnelBoard): FunnelBoard {
  return {
    ...board,
    description: board.description || "",
    stage: board.stage || "Воронка",
    seeded: Boolean(board.seeded),
    viewport: board.viewport ?? { x: 0, y: 0, scale: 1 },
    nodes: Array.isArray(board.nodes) ? board.nodes : [],
    edges: Array.isArray(board.edges) ? board.edges : []
  };
}

async function ensureDir() {
  await mkdir(funnelsDir, { recursive: true });
}

async function readCatalog(): Promise<Catalog> {
  try {
    const raw = await readFile(catalogPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<Catalog>;
    if (parsed.version === 1 && Array.isArray(parsed.funnels)) {
      const funnels = parsed.funnels.filter(isBoard).map(normalizeBoard);
      const seeded = seedCatalog().funnels;
      const byId = new Map(funnels.map((item) => [item.id, item]));
      for (const seed of seeded) {
        if (!byId.has(seed.id)) byId.set(seed.id, seed);
      }
      return { version: 1, funnels: [...byId.values()] };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      console.warn("Failed to read marketing funnels:", message);
    }
  }
  const seeded = seedCatalog();
  await writeCatalog(seeded);
  return seeded;
}

async function writeCatalog(catalog: Catalog) {
  await ensureDir();
  const payload = `${JSON.stringify(catalog, null, 2)}\n`;
  const tempPath = `${catalogPath}.${process.pid}.tmp`;
  await writeFile(tempPath, payload, "utf8");
  await rename(tempPath, catalogPath);
}

export function toFunnelSummary(board: FunnelBoard): FunnelSummary {
  return {
    id: board.id,
    title: board.title,
    description: board.description,
    stage: board.stage,
    seeded: board.seeded,
    updatedAt: board.updatedAt
  };
}

export async function listFunnels(): Promise<FunnelSummary[]> {
  const catalog = await readCatalog();
  return catalog.funnels
    .map(toFunnelSummary)
    .sort((a, b) => Number(b.seeded) - Number(a.seeded) || a.title.localeCompare(b.title, "ru"));
}

export async function getFunnel(id: string): Promise<FunnelBoard | null> {
  const catalog = await readCatalog();
  return catalog.funnels.find((item) => item.id === id) ?? null;
}

export async function createFunnel(input: { title: string; description?: string; stage?: string }): Promise<FunnelBoard> {
  return withLock(async () => {
    const catalog = await readCatalog();
    const now = new Date().toISOString();
    const board: FunnelBoard = {
      id: generateId("funnel"),
      title: input.title.trim() || "Новая воронка",
      description: (input.description || "").trim(),
      stage: (input.stage || "Воронка").trim() || "Воронка",
      seeded: false,
      createdAt: now,
      updatedAt: now,
      viewport: { x: 40, y: 40, scale: 1 },
      nodes: [
        node(generateId("node"), "step", 80, 160, "#ffffff", "Трафик"),
        node(generateId("node"), "step", 360, 160, "#ffffff", "Оффер"),
        node(generateId("node"), "step", 640, 160, "#ffffff", "Заявка"),
        node(generateId("node"), "sticky", 80, 20, "#fef3c7", "Какую работу закрывает эта воронка?")
      ],
      edges: []
    };
    board.edges = [
      edge(board.nodes[0]!.id, board.nodes[1]!.id),
      edge(board.nodes[1]!.id, board.nodes[2]!.id)
    ];
    catalog.funnels.push(board);
    await writeCatalog(catalog);
    return board;
  });
}

export async function saveFunnel(id: string, patch: Partial<FunnelBoard>): Promise<FunnelBoard | null> {
  return withLock(async () => {
    const catalog = await readCatalog();
    const index = catalog.funnels.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const current = catalog.funnels[index]!;
    const next: FunnelBoard = normalizeBoard({
      ...current,
      title: typeof patch.title === "string" && patch.title.trim() ? patch.title.trim() : current.title,
      description: typeof patch.description === "string" ? patch.description : current.description,
      stage: typeof patch.stage === "string" && patch.stage.trim() ? patch.stage.trim() : current.stage,
      viewport: patch.viewport ?? current.viewport,
      nodes: Array.isArray(patch.nodes) ? patch.nodes : current.nodes,
      edges: Array.isArray(patch.edges) ? patch.edges : current.edges,
      updatedAt: new Date().toISOString()
    });
    catalog.funnels[index] = next;
    await writeCatalog(catalog);
    return next;
  });
}

export async function deleteFunnel(id: string): Promise<"missing" | "seeded" | "ok"> {
  return withLock(async () => {
    const catalog = await readCatalog();
    const board = catalog.funnels.find((item) => item.id === id);
    if (!board) return "missing";
    if (board.seeded) return "seeded";
    catalog.funnels = catalog.funnels.filter((item) => item.id !== id);
    await writeCatalog(catalog);
    return "ok";
  });
}
