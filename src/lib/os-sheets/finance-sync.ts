import {
  FINANCE_COLUMNS,
  FINANCE_NUMERIC_COLUMNS,
  OS_SPREADSHEET_ID,
  OS_TABS,
  TRAFFIC_COLUMNS
} from "@/config/os-sheets";
import {
  buildFinanceFactsFromSources,
  financeRowFromSheetLine,
  financeRowToSheetLine,
  mergeFinanceRows,
  type FinanceRow
} from "@/lib/os-sheets/finance-mapper";
import { ordersRowFromSheetLine, type OrdersRow } from "@/lib/os-sheets/orders-mapper";
import { emptyTrafficRow, type TrafficSheetRow } from "@/lib/os-sheets/traffic-mapper";
import {
  formatSheetNumberColumns,
  getSheetIdByTitle,
  readGoogleServiceAccount,
  readSheetValues,
  writeSheetValues
} from "@/lib/google/sheets-client";
import { currentPeriodKey } from "@/lib/conversation-periods";
import type { PeriodKey } from "@/types/metrics";

export type SyncOsFinanceOptions = {
  period?: PeriodKey;
  spreadsheetId?: string;
  dryRun?: boolean;
};

export type SyncOsFinanceResult = {
  ok: true;
  period: PeriodKey;
  spreadsheetId: string;
  tabTitle: string;
  daysWritten: number;
  factRevenue: number;
  cashIn: number;
  adSpend: number;
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

async function readOrders(spreadsheetId: string): Promise<OrdersRow[]> {
  const values = await readSheetValues({
    spreadsheetId,
    range: `${quoteTab(OS_TABS.orders)}!A1:AH`
  });
  if (!values.length) return [];
  const [header, ...lines] = values;
  return lines
    .map((line) => ordersRowFromSheetLine(header, line))
    .filter((row): row is OrdersRow => Boolean(row));
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

async function readExistingFinance(spreadsheetId: string): Promise<FinanceRow[]> {
  const values = await readSheetValues({
    spreadsheetId,
    range: `${quoteTab(OS_TABS.financeDaily)}!A1:R`
  });
  if (!values.length) return [];
  const [header, ...lines] = values;
  return lines
    .map((line) => financeRowFromSheetLine(header, line))
    .filter((row): row is FinanceRow => Boolean(row));
}

export async function syncOsFinanceToSheet(options: SyncOsFinanceOptions = {}): Promise<SyncOsFinanceResult> {
  if (!readGoogleServiceAccount()) {
    throw new Error("Google service account is not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)");
  }

  const period = options.period ?? currentPeriodKey();
  const spreadsheetId = options.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  const tabTitle = OS_TABS.financeDaily;
  const syncedAt = new Date().toISOString();

  const [orders, traffic, existing] = await Promise.all([
    readOrders(spreadsheetId),
    readTraffic(spreadsheetId),
    readExistingFinance(spreadsheetId)
  ]);

  if (!orders.length && !traffic.length) {
    throw new Error("Orders/Traffic sheets are empty — run os-orders and os-traffic sync first");
  }

  const computed = buildFinanceFactsFromSources({
    orders,
    traffic,
    periodPrefix: periodPrefix(period),
    syncedAt
  });
  const merged = mergeFinanceRows(existing, computed);

  if (!options.dryRun) {
    await writeSheetValues({
      spreadsheetId,
      range: `${quoteTab(tabTitle)}!A1`,
      clearRange: `${quoteTab(tabTitle)}!A:R`,
      valueInputOption: "USER_ENTERED",
      rows: [[...FINANCE_COLUMNS], ...merged.map(financeRowToSheetLine)]
    });

    const sheetId = await getSheetIdByTitle(spreadsheetId, tabTitle);
    if (sheetId !== null) {
      const columnIndexes = FINANCE_NUMERIC_COLUMNS
        .map((column) => FINANCE_COLUMNS.indexOf(column))
        .filter((index) => index >= 0);
      await formatSheetNumberColumns({ spreadsheetId, sheetId, columnIndexes });
    }
  }

  const factRevenue = merged.reduce((sum, row) => sum + Number(row.fact_revenue || 0), 0);
  const cashIn = merged.reduce((sum, row) => sum + Number(row.cash_in || 0), 0);
  const adSpend = merged.reduce((sum, row) => sum + Number(row.ad_spend || 0), 0);

  return {
    ok: true,
    period,
    spreadsheetId,
    tabTitle,
    daysWritten: merged.length,
    factRevenue: Number(factRevenue.toFixed(2)),
    cashIn: Number(cashIn.toFixed(2)),
    adSpend: Number(adSpend.toFixed(2)),
    dryRun: options.dryRun === true,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    syncedAt
  };
}
