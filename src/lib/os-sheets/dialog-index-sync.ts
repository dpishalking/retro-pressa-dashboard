import {
  DIALOG_EXPORT_COLUMNS,
  OS_DIALOGS_PERIOD_TABS,
  OS_DIALOGS_SPREADSHEET_ID,
  OS_SPREADSHEET_ID,
  OS_TABS,
  type DialogExportColumn
} from "@/config/os-sheets";
import {
  getSheetIdByTitle,
  readGoogleServiceAccount,
  readSheetValues,
  writeSheetValues
} from "@/lib/google/sheets-client";

export type SyncOsDialogIndexOptions = {
  spreadsheetId?: string;
  dialogsSpreadsheetId?: string;
  dryRun?: boolean;
};

export type SyncOsDialogIndexResult = {
  ok: true;
  spreadsheetId: string;
  dialogsSpreadsheetId: string;
  tabTitle: string;
  rowsWritten: number;
  dryRun: boolean;
  sheetUrl: string;
  syncedAt: string;
};

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function sheetUrl(spreadsheetId: string, gid: number) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=${gid}#gid=${gid}`;
}

async function countDataRows(spreadsheetId: string, tabTitle: string): Promise<number | null> {
  try {
    const values = await readSheetValues({
      spreadsheetId,
      range: `${quoteTab(tabTitle)}!A:A`
    });
    return Math.max(0, (values.length || 0) - 1);
  } catch {
    return null;
  }
}

export async function syncOsDialogIndexToSheet(
  options: SyncOsDialogIndexOptions = {}
): Promise<SyncOsDialogIndexResult> {
  if (!readGoogleServiceAccount()) {
    throw new Error("Google service account is not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)");
  }

  const spreadsheetId = options.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  const dialogsSpreadsheetId = options.dialogsSpreadsheetId?.trim() || OS_DIALOGS_SPREADSHEET_ID;
  const tabTitle = OS_TABS.dialogExport;
  const syncedAt = new Date().toISOString();

  const rows: Array<Record<DialogExportColumn, string>> = [];
  for (const tab of OS_DIALOGS_PERIOD_TABS) {
    const rowsCount = await countDataRows(dialogsSpreadsheetId, tab.tab_title);
    const grainType = tab.period === "july-2026" ? "dialog_or_mixed" : "message";
    rows.push({
      period: tab.period,
      spreadsheet_id: dialogsSpreadsheetId,
      tab_title: tab.tab_title,
      gid: String(tab.gid),
      sheet_url: sheetUrl(dialogsSpreadsheetId, tab.gid),
      rows_count: rowsCount == null ? "" : String(rowsCount),
      grain_type: grainType,
      data_status: rowsCount == null ? "pointer_only" : "live",
      last_sync_at: syncedAt,
      notes: rowsCount == null
        ? "Pointer only — share dialogs workbook with service account to refresh row counts"
        : "Transcripts stay in dialogs workbook; mother holds index only. rows_count is not dialog count when grain_type=message"
    });
  }

  if (!options.dryRun) {
    await writeSheetValues({
      spreadsheetId,
      range: `${quoteTab(tabTitle)}!A1`,
      clearRange: `${quoteTab(tabTitle)}!A:J`,
      valueInputOption: "USER_ENTERED",
      rows: [
        [...DIALOG_EXPORT_COLUMNS],
        ...rows.map((row) => DIALOG_EXPORT_COLUMNS.map((column) => {
          const value = row[column];
          if (column === "rows_count" || column === "gid") {
            if (!value) return "";
            const n = Number(value);
            return Number.isFinite(n) ? n : value;
          }
          return value;
        }))
      ]
    });

    // Touch sheet id resolution so missing tab fails loudly.
    await getSheetIdByTitle(spreadsheetId, tabTitle);
  }

  return {
    ok: true,
    spreadsheetId,
    dialogsSpreadsheetId,
    tabTitle,
    rowsWritten: rows.length,
    dryRun: options.dryRun === true,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    syncedAt
  };
}
