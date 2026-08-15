import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { listBitrixSnapshotPeriods, snapshotFilePath } from "@/lib/bitrix/snapshot-store";
import type { CohortGrain, SalesCyclePayload } from "./types";

const cacheDir = path.join(process.cwd(), "data", "sales-cycle-cache");

export type SalesCycleCacheKey = {
  period: string;
  cohortGrain: CohortGrain;
  managerId?: string | null;
  productId?: string | null;
  country?: string | null;
  sourceId?: string | null;
};

function sanitize(part: string | null | undefined): string {
  const value = (part || "all").trim().toLowerCase() || "all";
  return value.replace(/[^a-z0-9._-]+/g, "_").slice(0, 80);
}

export function salesCycleCacheFileName(key: SalesCycleCacheKey): string {
  return [
    sanitize(key.period),
    sanitize(key.cohortGrain),
    `mgr-${sanitize(key.managerId)}`,
    `prd-${sanitize(key.productId)}`,
    `cty-${sanitize(key.country)}`,
    `src-${sanitize(key.sourceId)}`
  ].join("__") + ".json";
}

function cachePath(key: SalesCycleCacheKey): string {
  return path.join(cacheDir, salesCycleCacheFileName(key));
}

async function ensureCacheDir() {
  await mkdir(cacheDir, { recursive: true });
}

async function newestBitrixSnapshotMtimeMs(): Promise<number> {
  const periods = await listBitrixSnapshotPeriods();
  let newest = 0;
  for (const period of periods) {
    try {
      const info = await stat(snapshotFilePath(period));
      newest = Math.max(newest, info.mtimeMs);
    } catch {
      // missing snapshot — ignore
    }
  }
  return newest;
}

export type SalesCycleCacheHit = {
  payload: SalesCyclePayload;
  stale: boolean;
};

export async function readSalesCycleCache(
  key: SalesCycleCacheKey,
  options: { allowStale?: boolean } = {}
): Promise<SalesCycleCacheHit | null> {
  try {
    const file = cachePath(key);
    const [raw, cacheInfo, sourceMtime] = await Promise.all([
      readFile(file, "utf8"),
      stat(file),
      newestBitrixSnapshotMtimeMs()
    ]);
    const stale = sourceMtime > 0 && cacheInfo.mtimeMs < sourceMtime;
    if (stale && !options.allowStale) return null;
    const parsed = JSON.parse(raw) as SalesCyclePayload;
    if (!parsed || !Array.isArray(parsed.cohorts) || !parsed.summary) return null;
    return { payload: parsed, stale };
  } catch {
    return null;
  }
}

export async function writeSalesCycleCache(key: SalesCycleCacheKey, payload: SalesCyclePayload): Promise<void> {
  await ensureCacheDir();
  await writeFile(cachePath(key), JSON.stringify(payload), "utf8");
}

export async function listSalesCycleCacheFiles(): Promise<string[]> {
  try {
    const files = await readdir(cacheDir);
    return files.filter((file) => file.endsWith(".json")).sort();
  } catch {
    return [];
  }
}
