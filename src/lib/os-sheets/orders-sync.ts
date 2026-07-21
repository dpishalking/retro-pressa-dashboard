import { ORDERS_COLUMNS, ORDERS_NUMERIC_COLUMNS, OS_SPREADSHEET_ID, OS_TABS } from "@/config/os-sheets";
import { syncBitrixMetrics } from "@/lib/bitrix/connector";
import { readBitrixSnapshot } from "@/lib/bitrix/snapshot-store";
import {
  buildOrdersRowsFromSnapshot,
  mergeSheetAndBitrixOrders,
  ordersRowFromSheetLine,
  ordersRowToSheetLine,
  type OrdersRow
} from "@/lib/os-sheets/orders-mapper";
import {
  formatSheetNumberColumns,
  getSheetIdByTitle,
  readGoogleServiceAccount,
  readSheetValues,
  writeSheetValues
} from "@/lib/google/sheets-client";
import { currentPeriodKey } from "@/lib/conversation-periods";
import type { PeriodKey } from "@/types/metrics";

export type SyncOsOrdersOptions = {
  period?: PeriodKey;
  spreadsheetId?: string;
  refreshBitrix?: boolean;
  dryRun?: boolean;
};

export type SyncOsOrdersResult = {
  ok: true;
  period: PeriodKey;
  spreadsheetId: string;
  tabTitle: string;
  bitrixOrders: number;
  existingRows: number;
  writtenRows: number;
  preservedManualRows: number;
  dataSource: "snapshot" | "live";
  dryRun: boolean;
  sheetUrl: string;
  syncedAt: string;
};

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

async function readExistingOrders(spreadsheetId: string, tabTitle: string): Promise<OrdersRow[]> {
  const values = await readSheetValues({
    spreadsheetId,
    range: `${quoteTab(tabTitle)}!A1:AH`
  });
  if (!values.length) return [];

  const [header, ...lines] = values;
  return lines
    .map((line) => ordersRowFromSheetLine(header, line))
    .filter((row): row is OrdersRow => Boolean(row));
}

export async function syncOsOrdersToSheet(options: SyncOsOrdersOptions = {}): Promise<SyncOsOrdersResult> {
  if (!readGoogleServiceAccount()) {
    throw new Error("Google service account is not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)");
  }

  const period = options.period ?? currentPeriodKey();
  const spreadsheetId = options.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  const tabTitle = OS_TABS.orders;
  const syncedAt = new Date().toISOString();

  const bitrix = await syncBitrixMetrics({ period, refresh: options.refreshBitrix === true });
  const snapshot = await readBitrixSnapshot(period);
  if (!snapshot) {
    throw new Error(`Bitrix snapshot for ${period} is missing after sync`);
  }

  const bitrixRows = buildOrdersRowsFromSnapshot(snapshot, syncedAt);
  const existingRows = await readExistingOrders(spreadsheetId, tabTitle);
  const merged = mergeSheetAndBitrixOrders(existingRows, bitrixRows);
  const preservedManualRows = merged.filter((row) => !bitrixRows.some((item) => item.order_id === row.order_id)).length;

  if (!options.dryRun) {
    await writeSheetValues({
      spreadsheetId,
      range: `${quoteTab(tabTitle)}!A1`,
      clearRange: `${quoteTab(tabTitle)}!A:AH`,
      valueInputOption: "USER_ENTERED",
      rows: [[...ORDERS_COLUMNS], ...merged.map(ordersRowToSheetLine)]
    });

    const sheetId = await getSheetIdByTitle(spreadsheetId, tabTitle);
    if (sheetId !== null) {
      const columnIndexes = ORDERS_NUMERIC_COLUMNS
        .map((column) => ORDERS_COLUMNS.indexOf(column))
        .filter((index) => index >= 0);
      await formatSheetNumberColumns({ spreadsheetId, sheetId, columnIndexes });
    }
  }

  return {
    ok: true,
    period,
    spreadsheetId,
    tabTitle,
    bitrixOrders: bitrixRows.length,
    existingRows: existingRows.length,
    writtenRows: merged.length,
    preservedManualRows,
    dataSource: bitrix.summary.dataSource,
    dryRun: options.dryRun === true,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`,
    syncedAt
  };
}
