import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PeriodKey } from "@/types/metrics";

export type Ga4ChannelRow = {
  channel: string;
  newUsers: number;
  sessions: number;
  engagedSessions: number;
};

export type Ga4CampaignRow = {
  campaign: string;
  source: string;
  medium: string;
  sessions: number;
  newUsers: number;
  compliant: boolean;
};

export type Ga4LandingRow = {
  landingPage: string;
  source: string;
  medium: string;
  sessions: number;
};

export type Ga4DailyRow = {
  date: string;
  newUsers: number;
  sessions: number;
};

export type Ga4Snapshot = {
  version: 1;
  period: PeriodKey;
  propertyId: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  createdAt: string;
  summary: {
    newUsers: number;
    sessions: number;
    engagedSessions: number;
    returningUsers: number;
    unassignedUsers: number;
    unassignedShare: number;
    channels: string[];
    compliantSessionShare: number;
    sessionsWithoutUtm: number;
  };
  byChannel: Ga4ChannelRow[];
  byCampaign: Ga4CampaignRow[];
  byLanding: Ga4LandingRow[];
  daily: Ga4DailyRow[];
};

const snapshotDir = path.join(process.cwd(), "data", "ga4-snapshots");

export function ga4SnapshotFilePath(period: PeriodKey) {
  return path.join(snapshotDir, `${period}.json`);
}

async function ensureSnapshotDir() {
  await mkdir(snapshotDir, { recursive: true });
}

export async function readGa4Snapshot(period: PeriodKey): Promise<Ga4Snapshot | null> {
  try {
    const raw = await readFile(ga4SnapshotFilePath(period), "utf8");
    const parsed = JSON.parse(raw) as Partial<Ga4Snapshot>;
    if (parsed?.version !== 1 || parsed.period !== period || !parsed.summary || !Array.isArray(parsed.byChannel) || !Array.isArray(parsed.daily)) {
      return null;
    }
    return {
      ...parsed,
      byCampaign: Array.isArray(parsed.byCampaign) ? parsed.byCampaign : [],
      byLanding: Array.isArray(parsed.byLanding) ? parsed.byLanding : [],
      summary: {
        ...parsed.summary,
        compliantSessionShare: parsed.summary.compliantSessionShare ?? 0,
        sessionsWithoutUtm: parsed.summary.sessionsWithoutUtm ?? 0
      }
    } as Ga4Snapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) return null;
    return null;
  }
}

export async function writeGa4Snapshot(snapshot: Ga4Snapshot) {
  await ensureSnapshotDir();
  await writeFile(ga4SnapshotFilePath(snapshot.period), JSON.stringify(snapshot, null, 2), "utf8");
}
