import {
  OS_SPREADSHEET_ID,
  OS_TABS,
  PAYMENTS_COLUMNS,
  PAYMENTS_NUMERIC_COLUMNS
} from "@/config/os-sheets";
import { ordersRowFromSheetLine, type OrdersRow } from "@/lib/os-sheets/orders-mapper";
import {
  buildPaymentsFromOrders,
  paymentsRowToSheetLine
} from "@/lib/os-sheets/payments-mapper";
import { safeReplaceSheet } from "@/lib/os-sheets/safe-write";
import { withSyncRun } from "@/lib/os-sheets/sync-runs";
import {
  formatSheetNumberColumns,
  getSheetIdByTitle,
  readGoogleServiceAccount,
  readSheetValues
} from "@/lib/google/sheets-client";

export type SyncOsPaymentsOptions = {
  spreadsheetId?: string;
  dryRun?: boolean;
  triggerType?: "cron" | "manual" | "api" | "script";
};

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

async function readOrders(spreadsheetId: string): Promise<OrdersRow[]> {
  const values = await readSheetValues({
    spreadsheetId,
    range: `${quoteTab(OS_TABS.orders)}!A1:AJ`
  });
  if (!values.length) return [];
  const [header, ...lines] = values;
  return lines
    .map((line) => ordersRowFromSheetLine(header, line))
    .filter((row): row is OrdersRow => Boolean(row));
}

export async function syncOsPaymentsToSheet(options: SyncOsPaymentsOptions = {}) {
  if (!readGoogleServiceAccount()) {
    throw new Error("Google service account is not configured");
  }

  const spreadsheetId = options.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  const tabTitle = OS_TABS.paymentsCore;
  const syncedAt = new Date().toISOString();
  const orders = await readOrders(spreadsheetId);
  if (!orders.length) throw new Error("Orders sheet is empty — run os-orders sync first");

  const rows = buildPaymentsFromOrders({ orders, syncedAt });
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const sheetRows = rows.map(paymentsRowToSheetLine);

  if (options.dryRun) {
    return {
      ok: true as const,
      spreadsheetId,
      tabTitle,
      rowsWritten: rows.length,
      totalAmount: Number(totalAmount.toFixed(2)),
      dryRun: true,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      syncedAt,
      rowsRead: orders.length
    };
  }

  return withSyncRun({
    syncName: "os-payments",
    source: OS_TABS.orders,
    target: tabTitle,
    spreadsheetId,
    startedAt: syncedAt,
    schemaVersion: "1",
    triggerType: options.triggerType || "script"
  }, async () => {
    await safeReplaceSheet({
      spreadsheetId,
      tabTitle,
      expectedColumns: PAYMENTS_COLUMNS,
      rows: sheetRows,
      clearRange: `${quoteTab(tabTitle)}!A:O`,
      schemaVersion: "1"
    });
    const sheetId = await getSheetIdByTitle(spreadsheetId, tabTitle);
    if (sheetId !== null) {
      const columnIndexes = PAYMENTS_NUMERIC_COLUMNS
        .map((column) => PAYMENTS_COLUMNS.indexOf(column))
        .filter((index) => index >= 0);
      await formatSheetNumberColumns({ spreadsheetId, sheetId, columnIndexes });
    }
    return {
      ok: true as const,
      spreadsheetId,
      tabTitle,
      rowsWritten: rows.length,
      rowsRead: orders.length,
      totalAmount: Number(totalAmount.toFixed(2)),
      dryRun: false,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      syncedAt
    };
  });
}
