import {
  appendSheetRows,
  readGoogleServiceAccount,
  readSheetDialogIds,
  writeSheetTab,
} from "@/lib/google/sheets-client";
import {
  filterManagerDialogRowsByDate,
  loadManagerDialogExports,
  managerDialogDataRows,
  managerDialogRowsToSheetValues,
} from "@/lib/conversation-manager-export";
import { syncLiveStoreToExportFile } from "@/lib/conversation-live-export";
import { currentPeriodKey } from "@/lib/conversation-periods";
import {
  createManagerDialogsSheetState,
  markDialogsExported,
  readManagerDialogsSheetState,
  writeManagerDialogsSheetState,
} from "@/lib/manager-dialogs-sheet-state";
import type { PeriodKey } from "@/types/metrics";

const DEFAULT_SHEET_ID = "1mQEcDnybKM6HLfJbOkgdNu3hMo3_3kxLbmRp_6DcQmo";
const DEFAULT_TAB_TITLE = "Июль 2026";

export type ManagerDialogsSheetMode = "full" | "backfill" | "incremental";

export type ManagerDialogsSheetSyncOptions = {
  periodKey?: PeriodKey;
  managerQuery?: string;
  spreadsheetId?: string;
  tabTitle?: string;
  successSource?: "bitrix" | "text";
  refreshBitrix?: boolean;
  syncLiveExport?: boolean;
  dryRun?: boolean;
  mode?: ManagerDialogsSheetMode;
  dateFrom?: string;
  dateTo?: string;
};

export type ManagerDialogsSheetSyncResult = {
  managerQuery: string;
  periodKey: PeriodKey;
  successSource: "bitrix" | "text";
  mode: ManagerDialogsSheetMode;
  totalDialogs: number;
  exportedDialogs: number;
  skippedDialogs: number;
  spreadsheetId: string;
  tabTitle: string;
  dateFrom: string | null;
  dateTo: string | null;
  exportedAt: string;
  liveExport?: {
    written: boolean;
    dialogs: number;
    messages: number;
    path: string | null;
  };
  uploaded: boolean;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function previousUtcDay(date = new Date()) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - 1);
  return isoDate(copy);
}

function resolveDateWindow(options: ManagerDialogsSheetSyncOptions, mode: ManagerDialogsSheetMode) {
  if (options.dateFrom && options.dateTo) {
    return { dateFrom: options.dateFrom, dateTo: options.dateTo };
  }

  if (mode === "backfill") {
    return { dateFrom: "2026-07-01", dateTo: "2026-07-08" };
  }

  if (mode === "incremental") {
    const day = previousUtcDay();
    return { dateFrom: day, dateTo: day };
  }

  return { dateFrom: null, dateTo: null };
}

async function loadAllManagerDialogRows(options: {
  periodKey: PeriodKey;
  managerQuery: string;
  successSource: "bitrix" | "text";
  refreshBitrix?: boolean;
}) {
  return loadManagerDialogExports({
    periodKey: options.periodKey,
    managerQuery: options.managerQuery,
    resultFilter: "all",
    successSource: options.successSource,
    refreshBitrix: options.refreshBitrix,
  });
}

function filterRowsForMode(
  rows: Awaited<ReturnType<typeof loadAllManagerDialogRows>>,
  mode: ManagerDialogsSheetMode,
  dateFrom: string | null,
  dateTo: string | null,
  exportedDialogIds: Set<string>,
) {
  let candidateRows = rows;

  if (mode !== "full" && dateFrom && dateTo) {
    candidateRows = filterManagerDialogRowsByDate(candidateRows, dateFrom, dateTo);
  }

  const newRows = candidateRows.filter((row) => !exportedDialogIds.has(row.dialogId));
  return {
    candidateRows,
    newRows,
  };
}

export async function syncManagerDialogsToSheet(
  options: ManagerDialogsSheetSyncOptions = {},
): Promise<ManagerDialogsSheetSyncResult> {
  const periodKey = options.periodKey ?? currentPeriodKey();
  const managerQuery = options.managerQuery ?? "*";
  const spreadsheetId = options.spreadsheetId?.trim()
    || process.env.GOOGLE_SHEET_ID?.trim()
    || DEFAULT_SHEET_ID;
  const tabTitle = options.tabTitle ?? DEFAULT_TAB_TITLE;
  const successSource = options.successSource ?? "text";
  const refreshBitrix = options.refreshBitrix === true;
  const syncLiveExport = options.syncLiveExport !== false;
  const mode = options.mode ?? "incremental";
  const exportedAt = new Date().toISOString();
  const { dateFrom, dateTo } = resolveDateWindow(options, mode);

  const liveExport = syncLiveExport
    ? await syncLiveStoreToExportFile(periodKey)
    : undefined;

  const allRows = await loadAllManagerDialogRows({
    periodKey,
    managerQuery,
    successSource,
    refreshBitrix,
  });

  let state = await readManagerDialogsSheetState(periodKey);
  if (!state) {
    state = createManagerDialogsSheetState({ periodKey, spreadsheetId, tabTitle });
  } else {
    state = { ...state, spreadsheetId, tabTitle };
  }

  const exportedDialogIds = new Set(state.exportedDialogIds);
  if (!options.dryRun) {
    try {
      const sheetDialogIds = await readSheetDialogIds({ spreadsheetId, tabTitle });
      sheetDialogIds.forEach((dialogId) => exportedDialogIds.add(dialogId));
    } catch {
      // Sheet may be empty on first run.
    }
  }

  const { candidateRows, newRows } = filterRowsForMode(
    allRows,
    mode,
    dateFrom,
    dateTo,
    exportedDialogIds,
  );

  const result: ManagerDialogsSheetSyncResult = {
    managerQuery,
    periodKey,
    successSource,
    mode,
    totalDialogs: allRows.length,
    exportedDialogs: newRows.length,
    skippedDialogs: candidateRows.length - newRows.length,
    spreadsheetId,
    tabTitle,
    dateFrom,
    dateTo,
    exportedAt,
    liveExport,
    uploaded: false,
  };

  if (options.dryRun || newRows.length === 0) {
    return result;
  }

  const account = readGoogleServiceAccount();
  if (!account) {
    throw new Error(
      "Google credentials missing. Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY (or GOOGLE_SERVICE_ACCOUNT_JSON).",
    );
  }

  const dataRows = managerDialogDataRows(newRows);
  const hasExistingSheetData = exportedDialogIds.size > 0;

  if (!hasExistingSheetData && (mode === "backfill" || mode === "full")) {
    await writeSheetTab({
      spreadsheetId,
      tabTitle,
      rows: managerDialogRowsToSheetValues(newRows, {
        managerQuery,
        periodKey,
        exportedAt,
        sheetKind: "все диалоги",
      }),
    });
  } else {
    await appendSheetRows({
      spreadsheetId,
      tabTitle,
      rows: dataRows,
    });
  }

  const nextState = markDialogsExported(
    state,
    newRows.map((row) => row.dialogId),
    dateTo ?? dateFrom,
  );
  await writeManagerDialogsSheetState(nextState);

  result.uploaded = true;
  return result;
}
