import {
  OS_SPREADSHEET_ID,
  OS_TABS,
  SYNC_RUNS_COLUMNS,
  type SyncRunsColumn
} from "@/config/os-sheets";
import { appendSheetRows, ensureSheetTab, readGoogleServiceAccount } from "@/lib/google/sheets-client";
import { randomUUID } from "node:crypto";

export type SyncRunStatus = "running" | "success" | "partial" | "failed" | "skipped";

export type SyncRunInput = {
  syncName: string;
  status: SyncRunStatus;
  source?: string;
  target?: string;
  rowsRead?: number;
  rowsWritten?: number;
  rowsSkipped?: number;
  rowsRejected?: number;
  schemaVersion?: string;
  errorCode?: string;
  errorMessage?: string;
  triggerType?: "cron" | "manual" | "api" | "script";
  startedAt: string;
  finishedAt?: string;
  spreadsheetId?: string;
};

function sanitizeError(message: string | undefined) {
  if (!message) return "";
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/-----BEGIN[\s\S]*?PRIVATE KEY-----/g, "[redacted-key]")
    .slice(0, 400);
}

export async function appendSyncRun(input: SyncRunInput): Promise<string> {
  const syncId = randomUUID();
  if (!readGoogleServiceAccount()) return syncId;

  const spreadsheetId = input.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  const tabTitle = OS_TABS.syncRuns;
  await ensureSheetTab(spreadsheetId, tabTitle);

  const row: Record<SyncRunsColumn, string> = {
    sync_id: syncId,
    sync_name: input.syncName,
    started_at: input.startedAt,
    finished_at: input.finishedAt || new Date().toISOString(),
    status: input.status,
    source: input.source || "",
    target: input.target || "",
    rows_read: input.rowsRead != null ? String(input.rowsRead) : "",
    rows_written: input.rowsWritten != null ? String(input.rowsWritten) : "",
    rows_skipped: input.rowsSkipped != null ? String(input.rowsSkipped) : "",
    rows_rejected: input.rowsRejected != null ? String(input.rowsRejected) : "",
    schema_version: input.schemaVersion || "",
    error_code: input.errorCode || "",
    error_message: sanitizeError(input.errorMessage),
    trigger_type: input.triggerType || "script"
  };

  // Ensure header exists by writing header+row when sheet empty via append helper path.
  await appendSheetRows({
    spreadsheetId,
    tabTitle,
    rows: [SYNC_RUNS_COLUMNS.map((column) => row[column])]
  });

  // If sheet was empty, first append may miss header — write header once through a second ensure.
  // appendSheetRows starts at next empty row; callers that need header bootstrap use ensureSyncRunsHeader.
  return syncId;
}

export async function ensureSyncRunsHeader(spreadsheetId = OS_SPREADSHEET_ID) {
  const { readSheetValues, writeSheetValues } = await import("@/lib/google/sheets-client");
  await ensureSheetTab(spreadsheetId, OS_TABS.syncRuns);
  const existing = await readSheetValues({
    spreadsheetId,
    range: `'${OS_TABS.syncRuns}'!A1:A1`
  });
  if (existing.length) return;
  await writeSheetValues({
    spreadsheetId,
    range: `'${OS_TABS.syncRuns}'!A1`,
    rows: [[...SYNC_RUNS_COLUMNS]]
  });
}

export async function withSyncRun<T>(
  input: Omit<SyncRunInput, "status" | "finishedAt"> & { status?: SyncRunStatus },
  fn: () => Promise<T & { rowsRead?: number; rowsWritten?: number; rowsSkipped?: number; rowsRejected?: number }>
): Promise<T> {
  await ensureSyncRunsHeader(input.spreadsheetId);
  const startedAt = input.startedAt || new Date().toISOString();
  try {
    const result = await fn();
    await appendSyncRun({
      ...input,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: input.status || "success",
      rowsRead: result.rowsRead,
      rowsWritten: result.rowsWritten,
      rowsSkipped: result.rowsSkipped,
      rowsRejected: result.rowsRejected
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code || "SYNC_FAILED") : "SYNC_FAILED";
    await appendSyncRun({
      ...input,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "failed",
      errorCode: code,
      errorMessage: message
    });
    throw error;
  }
}
