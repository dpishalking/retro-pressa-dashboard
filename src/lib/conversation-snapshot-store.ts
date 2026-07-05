import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ConversationDashboardMetrics, ConversationImportFileDiagnostic } from "@/types/metrics";

export type ConversationSnapshotSource = "manual" | "gift-ai" | "bitrix";

export type ConversationSnapshotSummary = {
  filesLoaded: number;
  messagesLoaded: number;
  dialogsLoaded: number;
  filesParsed?: number;
  filesFailed?: number;
};

export type ConversationSnapshot = {
  version: 1;
  source: ConversationSnapshotSource;
  importedAt: string;
  importedDay: string;
  label: string;
  dashboard: ConversationDashboardMetrics;
  diagnostics: ConversationImportFileDiagnostic[];
  summary: ConversationSnapshotSummary;
};

export type ConversationSnapshotHistoryItem = {
  importedDay: string;
  importedAt: string;
  source: ConversationSnapshotSource;
  label: string;
  dashboard: ConversationDashboardMetrics;
  dialogs: number;
  conversion: number;
  qualityScore: number;
  potentialLostRevenue: number;
};

const snapshotDir = path.join(process.cwd(), "data", "conversation-snapshots");

function snapshotFilePath(importedAt: string) {
  const safeName = importedAt.replace(/[:.]/g, "-");
  return path.join(snapshotDir, `${safeName}.json`);
}

async function ensureSnapshotDir() {
  await mkdir(snapshotDir, { recursive: true });
}

export async function writeConversationSnapshot(snapshot: ConversationSnapshot) {
  await ensureSnapshotDir();
  await writeFile(snapshotFilePath(snapshot.importedAt), JSON.stringify(snapshot, null, 2), "utf8");
}

export async function listConversationSnapshots(): Promise<ConversationSnapshot[]> {
  await ensureSnapshotDir();
  const files = (await readdir(snapshotDir))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse();

  const snapshots = await Promise.all(files.map(async (file) => {
    try {
      const raw = await readFile(path.join(snapshotDir, file), "utf8");
      const parsed = JSON.parse(raw) as Partial<ConversationSnapshot>;
      if (
        parsed?.version !== 1
        || typeof parsed.importedAt !== "string"
        || typeof parsed.importedDay !== "string"
        || !parsed.dashboard
        || !parsed.summary
        || !Array.isArray(parsed.diagnostics)
      ) {
        return null;
      }
      return parsed as ConversationSnapshot;
    } catch {
      return null;
    }
  }));

  return snapshots.filter((item): item is ConversationSnapshot => item !== null)
    .sort((a, b) => String(b.importedAt).localeCompare(String(a.importedAt)));
}

export async function readLatestConversationSnapshot() {
  const snapshots = await listConversationSnapshots();
  return snapshots[0] ?? null;
}

export async function listConversationSnapshotHistory(limit = 14): Promise<ConversationSnapshotHistoryItem[]> {
  const snapshots = await listConversationSnapshots();

  return snapshots.slice(0, limit).map((snapshot) => ({
    importedDay: snapshot.importedDay,
    importedAt: snapshot.importedAt,
    source: snapshot.source,
    label: snapshot.label,
    dashboard: snapshot.dashboard,
    dialogs: snapshot.dashboard.totalDialogs,
    conversion: snapshot.dashboard.orderConversion,
    qualityScore: snapshot.dashboard.qualityScore,
    potentialLostRevenue: snapshot.dashboard.potentialLostRevenue
  }));
}
