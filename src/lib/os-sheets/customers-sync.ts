import {
  CUSTOMERS_COLUMNS,
  CUSTOMERS_NUMERIC_COLUMNS,
  OS_SPREADSHEET_ID,
  OS_TABS
} from "@/config/os-sheets";
import {
  buildCustomersFromOrders,
  customersRowToSheetLine
} from "@/lib/os-sheets/customers-mapper";
import { ordersRowFromSheetLine, type OrdersRow } from "@/lib/os-sheets/orders-mapper";
import { safeReplaceSheet } from "@/lib/os-sheets/safe-write";
import { withSyncRun } from "@/lib/os-sheets/sync-runs";
import {
  formatSheetNumberColumns,
  getSheetIdByTitle,
  readGoogleServiceAccount,
  readSheetValues
} from "@/lib/google/sheets-client";

export type SyncOsCustomersOptions = {
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

export async function syncOsCustomersToSheet(options: SyncOsCustomersOptions = {}) {
  if (!readGoogleServiceAccount()) {
    throw new Error("Google service account is not configured");
  }

  const spreadsheetId = options.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  const tabTitle = OS_TABS.customersCore;
  const syncedAt = new Date().toISOString();
  const orders = await readOrders(spreadsheetId);
  if (!orders.length) throw new Error("Orders sheet is empty — run os-orders sync first");

  const rows = buildCustomersFromOrders({ orders, syncedAt });
  const sheetRows = rows.map(customersRowToSheetLine);

  if (options.dryRun) {
    return {
      ok: true as const,
      spreadsheetId,
      tabTitle,
      rowsWritten: rows.length,
      dryRun: true,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      syncedAt,
      rowsRead: orders.length
    };
  }

  return withSyncRun({
    syncName: "os-customers",
    source: OS_TABS.orders,
    target: tabTitle,
    spreadsheetId,
    startedAt: syncedAt,
    schemaVersion: "2",
    triggerType: options.triggerType || "script"
  }, async () => {
    await safeReplaceSheet({
      spreadsheetId,
      tabTitle,
      expectedColumns: CUSTOMERS_COLUMNS,
      rows: sheetRows,
      clearRange: `${quoteTab(tabTitle)}!A:N`,
      schemaVersion: "2"
    });
    const sheetId = await getSheetIdByTitle(spreadsheetId, tabTitle);
    if (sheetId !== null) {
      const columnIndexes = CUSTOMERS_NUMERIC_COLUMNS
        .map((column) => CUSTOMERS_COLUMNS.indexOf(column))
        .filter((index) => index >= 0);
      await formatSheetNumberColumns({ spreadsheetId, sheetId, columnIndexes });
    }
    return {
      ok: true as const,
      spreadsheetId,
      tabTitle,
      rowsWritten: rows.length,
      rowsRead: orders.length,
      dryRun: false,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      syncedAt
    };
  });
}
