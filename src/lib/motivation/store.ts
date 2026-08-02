import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createMotivationCatalogSeed } from "@/data/motivation-seed";
import { generateId } from "@/lib/training/id";
import type { MotivationCatalog } from "@/types/motivation";

const motivationDir = process.env.MOTIVATION_DATA_DIR?.trim()
  ? path.resolve(process.env.MOTIVATION_DATA_DIR.trim())
  : path.join(process.cwd(), "data", "motivation");
const catalogPath = path.join(motivationDir, "catalog.json");

let catalogLock: Promise<void> = Promise.resolve();

function withCatalogLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = catalogLock.then(fn);
  catalogLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function ensureMotivationDir() {
  await mkdir(motivationDir, { recursive: true });
}

function isValidCatalog(value: unknown): value is MotivationCatalog {
  if (!value || typeof value !== "object") return false;
  const catalog = value as Partial<MotivationCatalog>;
  return (
    catalog.version === 1 &&
    Array.isArray(catalog.periods) &&
    Array.isArray(catalog.rules) &&
    Array.isArray(catalog.managers)
  );
}

export async function readRawMotivationCatalog(): Promise<MotivationCatalog | null> {
  try {
    const raw = await readFile(catalogPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (isValidCatalog(parsed)) return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      console.warn("Failed to read motivation catalog:", message);
    }
  }
  return null;
}

export async function writeMotivationCatalog(catalog: MotivationCatalog) {
  await ensureMotivationDir();
  const payload = `${JSON.stringify({ ...catalog, version: 1 as const, updatedAt: new Date().toISOString() }, null, 2)}\n`;
  const tempPath = `${catalogPath}.${process.pid}.tmp`;
  await writeFile(tempPath, payload, "utf8");
  await rename(tempPath, catalogPath);
}

export async function readMotivationCatalog(): Promise<MotivationCatalog> {
  const stored = await readRawMotivationCatalog();
  if (stored) return stored;
  const seed = createMotivationCatalogSeed();
  await writeMotivationCatalog(seed);
  return seed;
}

export async function updateMotivationCatalog(
  mutator: (catalog: MotivationCatalog) => MotivationCatalog | void
): Promise<MotivationCatalog> {
  return withCatalogLock(async () => {
    const current = await readMotivationCatalog();
    const next = mutator(current) ?? current;
    await writeMotivationCatalog(next);
    return next;
  });
}

export function newMotivationId(prefix: string): string {
  return generateId(prefix);
}

export function getMotivationCatalogPath(): string {
  return catalogPath;
}

export async function resetMotivationCatalogToSeed(): Promise<MotivationCatalog> {
  const seed = createMotivationCatalogSeed();
  await writeMotivationCatalog(seed);
  return seed;
}
