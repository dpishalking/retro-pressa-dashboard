import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ClarityDimensionRow = {
  dimension: string;
  value: string;
  sessions: number;
  engagementTime?: number;
  scrollDepth?: number;
  rageClicks?: number;
  deadClicks?: number;
  quickbackClicks?: number;
  errorClicks?: number;
  scriptErrors?: number;
};

export type ClaritySnapshot = {
  version: 1;
  createdAt: string;
  numOfDays: 1 | 2 | 3;
  queriesUsed: number;
  summary: {
    totalSessions: number;
    totalRageClicks: number;
    totalDeadClicks: number;
    totalQuickbackClicks: number;
    topCampaign: string | null;
    topUrl: string | null;
    mobileSessionShare: number;
  };
  byCampaign: ClarityDimensionRow[];
  byUrl: ClarityDimensionRow[];
  bySourceMedium: ClarityDimensionRow[];
  byDevice: ClarityDimensionRow[];
  byCountry: ClarityDimensionRow[];
};

const snapshotDir = path.join(process.cwd(), "data", "clarity-snapshots");

export function claritySnapshotFilePath() {
  return path.join(snapshotDir, "latest.json");
}

async function ensureSnapshotDir() {
  await mkdir(snapshotDir, { recursive: true });
}

export async function readClaritySnapshot(): Promise<ClaritySnapshot | null> {
  try {
    const raw = await readFile(claritySnapshotFilePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<ClaritySnapshot>;
    if (parsed?.version !== 1 || !parsed.summary || !Array.isArray(parsed.byCampaign)) {
      return null;
    }
    return parsed as ClaritySnapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) return null;
    return null;
  }
}

export async function writeClaritySnapshot(snapshot: ClaritySnapshot) {
  await ensureSnapshotDir();
  await writeFile(claritySnapshotFilePath(), JSON.stringify(snapshot, null, 2), "utf8");
}
