import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PeriodKey, DailyMetrics } from "@/types/metrics";
import type { TrafficRow } from "@/lib/google/traffic-connector";

export type GoogleTrafficSnapshot = {
  version: 1;
  period: PeriodKey;
  monthPrefix: string;
  createdAt: string;
  rows: TrafficRow[];
  daily: DailyMetrics[];
  summary: {
    rowsLoaded: number;
    sourcesLoaded: string[];
    paidLeads: number;
    organicLeads: number;
    ql: number;
    spend: number;
    averageCpl: number;
    markets: string[];
    channels: string[];
  };
};

const snapshotDir = path.join(process.cwd(), "data", "google-snapshots");

export function googleSnapshotFilePath(period: PeriodKey) {
  return path.join(snapshotDir, `${period}.json`);
}

async function ensureSnapshotDir() {
  await mkdir(snapshotDir, { recursive: true });
}

export async function readGoogleTrafficSnapshot(period: PeriodKey): Promise<GoogleTrafficSnapshot | null> {
  try {
    const raw = await readFile(googleSnapshotFilePath(period), "utf8");
    const parsed = JSON.parse(raw) as Partial<GoogleTrafficSnapshot>;
    if (parsed?.version !== 1 || parsed.period !== period || !Array.isArray(parsed.rows) || !Array.isArray(parsed.daily) || !parsed.summary) {
      return null;
    }
    return parsed as GoogleTrafficSnapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) return null;
    return null;
  }
}

export async function writeGoogleTrafficSnapshot(snapshot: GoogleTrafficSnapshot) {
  await ensureSnapshotDir();
  await writeFile(googleSnapshotFilePath(snapshot.period), JSON.stringify(snapshot, null, 2), "utf8");
}
