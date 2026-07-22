import {
  COMPANY_DAILY_COLUMNS,
  COMPANY_DAILY_NUMERIC_COLUMNS,
  OS_SPREADSHEET_ID,
  OS_TABS,
  TRAFFIC_COLUMNS
} from "@/config/os-sheets";
import {
  buildCompanyDaily,
  companyDailyRowToSheetLine
} from "@/lib/os-sheets/company-daily-mapper";
import {
  salesDailyRowFromSheetLine,
  type SalesDailyRow
} from "@/lib/os-sheets/sales-mapper";
import { emptyTrafficRow, type TrafficSheetRow } from "@/lib/os-sheets/traffic-mapper";
import {
  ensureSheetTab,
  formatSheetNumberColumns,
  getSheetIdByTitle,
  readGoogleServiceAccount,
  readSheetValues,
  writeSheetValues
} from "@/lib/google/sheets-client";
import { currentPeriodKey } from "@/lib/conversation-periods";
import type { PeriodKey } from "@/types/metrics";

export type SyncOsCompanyDailyOptions = {
  period?: PeriodKey;
  spreadsheetId?: string;
  dryRun?: boolean;
};

export type SyncOsCompanyDailyResult = {
  ok: true;
  period: PeriodKey;
  spreadsheetId: string;
  tabTitle: string;
  rowsWritten: number;
  revenue: number;
  payments: number;
  dryRun: boolean;
  sheetUrl: string;
  syncedAt: string;
};

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function periodPrefix(period: PeriodKey) {
  if (period === "may-2026") return "2026-05";
  if (period === "june-2026") return "2026-06";
  return "2026-07";
}

async function readTraffic(spreadsheetId: string): Promise<TrafficSheetRow[]> {
  const values = await readSheetValues({
    spreadsheetId,
    range: `${quoteTab(OS_TABS.trafficDaily)}!A1:P`
  });
  if (!values.length) return [];
  const [header, ...lines] = values;
  return lines.map((line) => {
    const row = emptyTrafficRow();
    header.forEach((rawKey, index) => {
      const key = rawKey.trim() as keyof TrafficSheetRow;
      if (!TRAFFIC_COLUMNS.includes(key as typeof TRAFFIC_COLUMNS[number])) return;
      row[key] = String(line[index] ?? "").trim();
    });
    return row;
  }).filter((row) => Boolean(row.date));
}

async function readSalesDaily(spreadsheetId: string): Promise<SalesDailyRow[]> {
  const values = await readSheetValues({
    spreadsheetId,
    range: `${quoteTab(OS_TABS.salesDaily)}!A1:N`
  });
  if (!values.length) return [];
  const [header, ...lines] = values;
  return lines
    .map((line) => salesDailyRowFromSheetLine(header, line))
    .filter((row): row is SalesDailyRow => Boolean(row));
}

export async function syncOsCompanyDailyToSheet(
  options: SyncOsCompanyDailyOptions = {}
): Promise<SyncOsCompanyDailyResult> {
  if (!readGoogleServiceAccount()) {
    throw new Error("Google service account is not configured");
  }

  const period = options.period ?? currentPeriodKey();
  const spreadsheetId = options.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  const tabTitle = OS_TABS.companyDaily;
  const syncedAt = new Date().toISOString();

  const [traffic, salesDaily] = await Promise.all([
    readTraffic(spreadsheetId),
    readSalesDaily(spreadsheetId)
  ]);

  if (!traffic.length && !salesDaily.length) {
    throw new Error("Traffic/Sales_Daily empty — run os-traffic and os-sales first");
  }

  const rows = buildCompanyDaily({
    traffic,
    salesDaily,
    periodPrefix: periodPrefix(period),
    syncedAt
  });

  if (!options.dryRun) {
    await ensureSheetTab(spreadsheetId, tabTitle);
    await writeSheetValues({
      spreadsheetId,
      range: `${quoteTab(tabTitle)}!A1`,
      clearRange: `${quoteTab(tabTitle)}!A:M`,
      valueInputOption: "USER_ENTERED",
      rows: [[...COMPANY_DAILY_COLUMNS], ...rows.map(companyDailyRowToSheetLine)]
    });
    const sheetId = await getSheetIdByTitle(spreadsheetId, tabTitle);
    if (sheetId !== null) {
      const columnIndexes = COMPANY_DAILY_NUMERIC_COLUMNS
        .map((column) => COMPANY_DAILY_COLUMNS.indexOf(column))
        .filter((index) => index >= 0);
      await formatSheetNumberColumns({ spreadsheetId, sheetId, columnIndexes });
    }
  }

  const revenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  const payments = rows.reduce((sum, row) => sum + Number(row.payments || 0), 0);

  return {
    ok: true,
    period,
    spreadsheetId,
    tabTitle,
    rowsWritten: rows.length,
    revenue: Number(revenue.toFixed(2)),
    payments,
    dryRun: options.dryRun === true,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    syncedAt
  };
}
