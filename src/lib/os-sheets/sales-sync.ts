import {
  OS_SPREADSHEET_ID,
  OS_TABS,
  SALES_DAILY_COLUMNS,
  SALES_DAILY_NUMERIC_COLUMNS
} from "@/config/os-sheets";
import { ordersRowFromSheetLine, type OrdersRow } from "@/lib/os-sheets/orders-mapper";
import {
  buildSalesDailyFromOrders,
  salesDailyRowToSheetLine
} from "@/lib/os-sheets/sales-mapper";
import {
  formatSheetNumberColumns,
  getSheetIdByTitle,
  readGoogleServiceAccount,
  readSheetValues,
  writeSheetValues
} from "@/lib/google/sheets-client";
import { currentPeriodKey } from "@/lib/conversation-periods";
import type { PeriodKey } from "@/types/metrics";

export type SyncOsSalesOptions = {
  period?: PeriodKey;
  spreadsheetId?: string;
  dryRun?: boolean;
};

export type SyncOsSalesResult = {
  ok: true;
  period: PeriodKey;
  spreadsheetId: string;
  tabTitle: string;
  rowsWritten: number;
  dealsCreated: number;
  payments: number;
  revenue: number;
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

export async function syncOsSalesToSheet(options: SyncOsSalesOptions = {}): Promise<SyncOsSalesResult> {
  if (!readGoogleServiceAccount()) {
    throw new Error("Google service account is not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)");
  }

  const period = options.period ?? currentPeriodKey();
  const spreadsheetId = options.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  const tabTitle = OS_TABS.salesDaily;
  const syncedAt = new Date().toISOString();

  const orders = await readOrders(spreadsheetId);
  if (!orders.length) {
    throw new Error("Orders sheet is empty — run os-orders sync first");
  }

  const rows = buildSalesDailyFromOrders({
    orders,
    periodPrefix: periodPrefix(period),
    syncedAt
  });

  if (!options.dryRun) {
    await writeSheetValues({
      spreadsheetId,
      range: `${quoteTab(tabTitle)}!A1`,
      clearRange: `${quoteTab(tabTitle)}!A:N`,
      valueInputOption: "USER_ENTERED",
      rows: [[...SALES_DAILY_COLUMNS], ...rows.map(salesDailyRowToSheetLine)]
    });

    const sheetId = await getSheetIdByTitle(spreadsheetId, tabTitle);
    if (sheetId !== null) {
      const columnIndexes = SALES_DAILY_NUMERIC_COLUMNS
        .map((column) => SALES_DAILY_COLUMNS.indexOf(column))
        .filter((index) => index >= 0);
      await formatSheetNumberColumns({ spreadsheetId, sheetId, columnIndexes });
    }
  }

  const dealsCreated = rows.reduce((sum, row) => sum + Number(row.deals_created || 0), 0);
  const payments = rows.reduce((sum, row) => sum + Number(row.payments || 0), 0);
  const revenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);

  return {
    ok: true,
    period,
    spreadsheetId,
    tabTitle,
    rowsWritten: rows.length,
    dealsCreated,
    payments,
    revenue: Number(revenue.toFixed(2)),
    dryRun: options.dryRun === true,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    syncedAt
  };
}
