import { access, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { importAndAnalyzeConversationsWithDiagnostics } from "@/lib/conversation-intelligence";
import { currentPeriodKey, inferPeriodKeyFromLabel, isPeriodArchiveFilename, periodArchiveFilename } from "@/lib/conversation-periods";
import type { ConversationDashboardMetrics, ConversationImportFileDiagnostic, PeriodKey } from "@/types/metrics";

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
  periodKey?: PeriodKey | null;
  label: string;
  dashboard: ConversationDashboardMetrics;
  diagnostics: ConversationImportFileDiagnostic[];
  summary: ConversationSnapshotSummary;
};

export type ConversationSnapshotHistoryItem = {
  importedDay: string;
  importedAt: string;
  source: ConversationSnapshotSource;
  periodKey?: PeriodKey | null;
  label: string;
  dashboard: ConversationDashboardMetrics;
  dialogs: number;
  conversion: number;
  qualityScore: number;
  potentialLostRevenue: number;
};

const snapshotDir = path.join(process.cwd(), "data", "conversation-snapshots");

const bundledExports: Partial<Record<PeriodKey, string>> = {
  "may-2026": "retro-pressa-conversations-2026-05.json",
  "june-2026": "retro-pressa-conversations-2026-06.json"
};

function snapshotFilePath(importedAt: string) {
  const safeName = importedAt.replace(/[:.]/g, "-");
  return path.join(snapshotDir, `${safeName}.json`);
}

function periodArchivePath(periodKey: PeriodKey) {
  return path.join(snapshotDir, periodArchiveFilename(periodKey));
}

export function effectivePeriodKey(snapshot: Pick<ConversationSnapshot, "periodKey" | "label" | "source" | "importedAt">): PeriodKey | null {
  if (snapshot.periodKey) return snapshot.periodKey;
  if (snapshot.source === "bitrix") return currentPeriodKey(new Date(snapshot.importedAt || Date.now()));
  return inferPeriodKeyFromLabel(snapshot.label);
}

async function ensureSnapshotDir() {
  await mkdir(snapshotDir, { recursive: true });
}

function isValidSnapshot(parsed: Partial<ConversationSnapshot>): parsed is ConversationSnapshot {
  return parsed?.version === 1
    && typeof parsed.importedAt === "string"
    && typeof parsed.importedDay === "string"
    && Boolean(parsed.dashboard)
    && Boolean(parsed.summary)
    && Array.isArray(parsed.diagnostics);
}

async function readSnapshotFile(filePath: string): Promise<ConversationSnapshot | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ConversationSnapshot>;
    if (!isValidSnapshot(parsed)) return null;
    const periodKey = effectivePeriodKey(parsed);
    return { ...parsed, periodKey };
  } catch {
    return null;
  }
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function migrateLegacySnapshots() {
  await ensureSnapshotDir();
  const files = (await readdir(snapshotDir)).filter((file) => file.endsWith(".json") && !isPeriodArchiveFilename(file));
  const legacy = await Promise.all(files.map(async (file) => readSnapshotFile(path.join(snapshotDir, file))));
  const valid = legacy.filter((item): item is ConversationSnapshot => item !== null);

  const archivePeriods: PeriodKey[] = ["may-2026", "june-2026"];
  for (const periodKey of archivePeriods) {
    if (await fileExists(periodArchivePath(periodKey))) continue;

    const candidates = valid.filter((item) => effectivePeriodKey(item) === periodKey && item.source !== "bitrix");
    if (!candidates.length) continue;

    const best = [...candidates].sort((a, b) => b.summary.dialogsLoaded - a.summary.dialogsLoaded)[0];
    await writePeriodArchiveSnapshot(periodKey, {
      ...best,
      periodKey,
      label: periodKey === "may-2026" ? "Архив мая 2026" : "Архив июня 2026"
    });
  }
}

async function ensureBundledArchive(periodKey: "may-2026" | "june-2026") {
  if (await fileExists(periodArchivePath(periodKey))) return;

  const exportName = bundledExports[periodKey];
  if (!exportName) return;

  const exportPath = path.join(process.cwd(), "data", "conversation-exports", exportName);
  if (!(await fileExists(exportPath))) return;

  const result = importAndAnalyzeConversationsWithDiagnostics([{
    filename: exportName,
    content: await readFile(exportPath),
    defaultChannel: "gift-ai"
  }]);

  if (!result.messages.length) return;

  const importedAt = new Date().toISOString();
  await writePeriodArchiveSnapshot(periodKey, {
    version: 1,
    source: "gift-ai",
    importedAt,
    importedDay: importedAt.slice(0, 10),
    periodKey,
    label: periodKey === "may-2026" ? "Архив мая 2026 (bundled)" : "Архив июня 2026 (bundled)",
    dashboard: result.dashboard,
    diagnostics: result.diagnostics,
    summary: {
      filesLoaded: 1,
      messagesLoaded: result.messages.length,
      dialogsLoaded: result.dialogs.length,
      filesParsed: result.diagnostics.filter((item) => item.status === "ok").length,
      filesFailed: result.diagnostics.filter((item) => item.status === "error").length
    }
  });
}

export async function ensureConversationArchives() {
  await migrateLegacySnapshots();
  await ensureBundledArchive("may-2026");
  await ensureBundledArchive("june-2026");
}

export async function writeConversationSnapshot(snapshot: ConversationSnapshot) {
  await ensureSnapshotDir();
  await writeFile(snapshotFilePath(snapshot.importedAt), JSON.stringify(snapshot, null, 2), "utf8");
}

export async function writePeriodArchiveSnapshot(periodKey: PeriodKey, snapshot: ConversationSnapshot) {
  await ensureSnapshotDir();
  const normalized: ConversationSnapshot = {
    ...snapshot,
    periodKey,
    importedAt: snapshot.importedAt || new Date().toISOString(),
    importedDay: snapshot.importedDay || snapshot.importedAt.slice(0, 10)
  };
  await writeFile(periodArchivePath(periodKey), JSON.stringify(normalized, null, 2), "utf8");

  const files = await readdir(snapshotDir);
  await Promise.all(files.map(async (file) => {
    if (isPeriodArchiveFilename(file)) return;
    if (!file.endsWith(".json")) return;
    const fullPath = path.join(snapshotDir, file);
    const parsed = await readSnapshotFile(fullPath);
    if (!parsed) return;
    if (parsed.source === "bitrix") return;
    if (effectivePeriodKey(parsed) !== periodKey) return;
    await unlink(fullPath);
  }));
}

export async function readPeriodArchive(periodKey: PeriodKey) {
  return readSnapshotFile(periodArchivePath(periodKey));
}

export async function listConversationSnapshots(): Promise<ConversationSnapshot[]> {
  await ensureSnapshotDir();

  const files = (await readdir(snapshotDir)).filter((file) => file.endsWith(".json"));
  const entries = await Promise.all(files.map(async (file) => {
    const snapshot = await readSnapshotFile(path.join(snapshotDir, file));
    return snapshot ? { file, snapshot } : null;
  }));
  const valid = entries.filter((item): item is { file: string; snapshot: ConversationSnapshot } => item !== null);
  const result: ConversationSnapshot[] = [];

  for (const periodKey of ["may-2026", "june-2026"] as const) {
    const archiveFile = periodArchiveFilename(periodKey);
    const match = valid.find((item) => item.file === archiveFile);
    if (match) {
      result.push({ ...match.snapshot, periodKey });
    }
  }

  for (const { file, snapshot } of valid) {
    if (isPeriodArchiveFilename(file)) continue;
    const periodKey = effectivePeriodKey(snapshot);
    if (periodKey && (periodKey === "may-2026" || periodKey === "june-2026") && snapshot.source !== "bitrix") {
      continue;
    }
    result.push({ ...snapshot, periodKey });
  }

  return result.sort((a, b) => String(b.importedAt).localeCompare(String(a.importedAt)));
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
    periodKey: effectivePeriodKey(snapshot),
    label: snapshot.label,
    dashboard: snapshot.dashboard,
    dialogs: snapshot.dashboard.totalDialogs,
    conversion: snapshot.dashboard.orderConversion,
    qualityScore: snapshot.dashboard.qualityScore,
    potentialLostRevenue: snapshot.dashboard.potentialLostRevenue
  }));
}
