import { OS_SPREADSHEET_ID, OS_TABS, TRAFFIC_COLUMNS, TRAFFIC_NUMERIC_COLUMNS } from "@/config/os-sheets";
import { syncGoogleTraffic } from "@/lib/google/traffic-connector";
import {
  mapTrafficRowToSheet,
  splitTrafficRows,
  trafficRowToSheetLine
} from "@/lib/os-sheets/traffic-mapper";
import {
  ensureSheetTab,
  formatSheetNumberColumns,
  getSheetIdByTitle,
  readGoogleServiceAccount,
  writeSheetValues
} from "@/lib/google/sheets-client";
import { currentPeriodKey } from "@/lib/conversation-periods";
import type { PeriodKey } from "@/types/metrics";

export type SyncOsTrafficOptions = {
  period?: PeriodKey;
  spreadsheetId?: string;
  refreshGoogle?: boolean;
  dryRun?: boolean;
};

export type SyncOsTrafficResult = {
  ok: true;
  period: PeriodKey;
  spreadsheetId: string;
  trafficTab: string;
  organicTab: string;
  paidRows: number;
  organicRows: number;
  writtenRows: number;
  sourcesLoaded: string[];
  spend: number;
  paidLeads: number;
  organicLeads: number;
  dataSource: "snapshot" | "live";
  dryRun: boolean;
  sheetUrl: string;
  syncedAt: string;
};

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

async function writeTrafficTab(input: {
  spreadsheetId: string;
  tabTitle: string;
  rows: ReturnType<typeof mapTrafficRowToSheet>[];
}) {
  await ensureSheetTab(input.spreadsheetId, input.tabTitle);
  await writeSheetValues({
    spreadsheetId: input.spreadsheetId,
    range: `${quoteTab(input.tabTitle)}!A1`,
    clearRange: `${quoteTab(input.tabTitle)}!A:P`,
    valueInputOption: "USER_ENTERED",
    rows: [[...TRAFFIC_COLUMNS], ...input.rows.map(trafficRowToSheetLine)]
  });

  const sheetId = await getSheetIdByTitle(input.spreadsheetId, input.tabTitle);
  if (sheetId === null) return;
  const columnIndexes = TRAFFIC_NUMERIC_COLUMNS
    .map((column) => TRAFFIC_COLUMNS.indexOf(column))
    .filter((index) => index >= 0);
  await formatSheetNumberColumns({ spreadsheetId: input.spreadsheetId, sheetId, columnIndexes });
}

export async function syncOsTrafficToSheet(options: SyncOsTrafficOptions = {}): Promise<SyncOsTrafficResult> {
  if (!readGoogleServiceAccount()) {
    throw new Error("Google service account is not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)");
  }

  const period = options.period ?? currentPeriodKey();
  const spreadsheetId = options.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  const trafficTab = OS_TABS.trafficDaily;
  const organicTab = OS_TABS.organicDaily;
  const syncedAt = new Date().toISOString();

  const google = await syncGoogleTraffic({ period, refresh: options.refreshGoogle === true });
  const mapped = google.rows.map((row) => mapTrafficRowToSheet(row, syncedAt));
  const { all, organic, paid } = splitTrafficRows(mapped);

  if (!options.dryRun) {
    await writeTrafficTab({ spreadsheetId, tabTitle: trafficTab, rows: all });
    await writeTrafficTab({ spreadsheetId, tabTitle: organicTab, rows: organic });
  }

  return {
    ok: true,
    period,
    spreadsheetId,
    trafficTab,
    organicTab,
    paidRows: paid.length,
    organicRows: organic.length,
    writtenRows: all.length,
    sourcesLoaded: google.summary.sourcesLoaded,
    spend: google.summary.spend,
    paidLeads: google.summary.paidLeads,
    organicLeads: google.summary.organicLeads,
    dataSource: google.summary.dataSource,
    dryRun: options.dryRun === true,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    syncedAt
  };
}
