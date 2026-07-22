import {
  CHANNELS_COLUMNS,
  COUNTRIES_COLUMNS,
  DATA_SOURCES_COLUMNS,
  EMPLOYEES_COLUMNS,
  CHANGE_LOG_COLUMNS,
  OS_DIALOGS_SPREADSHEET_ID,
  OS_SPREADSHEET_ID,
  OS_SVOD_GID,
  OS_SVOD_SPREADSHEET_ID,
  OS_SVOD_TAB,
  OS_TABS
} from "@/config/os-sheets";
import { ordersRowFromSheetLine, type OrdersRow } from "@/lib/os-sheets/orders-mapper";
import { emptyTrafficRow, type TrafficSheetRow } from "@/lib/os-sheets/traffic-mapper";
import { TRAFFIC_COLUMNS } from "@/config/os-sheets";
import { safeReplaceSheet } from "@/lib/os-sheets/safe-write";
import { withSyncRun } from "@/lib/os-sheets/sync-runs";
import {
  appendSheetRows,
  ensureSheetTab,
  readGoogleServiceAccount,
  readSheetValues,
  writeSheetValues
} from "@/lib/google/sheets-client";

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "unknown";
}

async function readOrders(spreadsheetId: string): Promise<OrdersRow[]> {
  const values = await readSheetValues({ spreadsheetId, range: `${quoteTab(OS_TABS.orders)}!A1:AJ` });
  if (!values.length) return [];
  const [header, ...lines] = values;
  return lines.map((line) => ordersRowFromSheetLine(header, line)).filter((row): row is OrdersRow => Boolean(row));
}

async function readTraffic(spreadsheetId: string): Promise<TrafficSheetRow[]> {
  const values = await readSheetValues({ spreadsheetId, range: `${quoteTab(OS_TABS.trafficDaily)}!A1:P` });
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

export async function syncOsDictionariesToSheet(options: { spreadsheetId?: string; dryRun?: boolean } = {}) {
  if (!readGoogleServiceAccount()) throw new Error("Google service account is not configured");
  const spreadsheetId = options.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  const syncedAt = new Date().toISOString();
  const [orders, traffic] = await Promise.all([readOrders(spreadsheetId), readTraffic(spreadsheetId)]);

  const countryNames = new Set<string>();
  const channels = new Map<string, { name: string; paid: boolean }>();
  const employees = new Map<string, string>();

  for (const order of orders) {
    if (order.country?.trim()) countryNames.add(order.country.trim());
    if (order.source_channel?.trim()) {
      const name = order.source_channel.trim();
      channels.set(slug(name), { name, paid: name.includes("paid") });
    }
    if (order.manager_id?.trim()) employees.set(order.manager_id.trim(), order.manager_name || `ID ${order.manager_id}`);
  }
  for (const row of traffic) {
    if (row.country?.trim()) countryNames.add(row.country.trim());
    if (row.channel?.trim()) {
      const name = row.channel.trim();
      channels.set(slug(name), { name, paid: row.lead_kind === "paid" });
    }
  }

  const countryRows = [...countryNames].sort((a, b) => a.localeCompare(b, "ru")).map((name) => [
    slug(name),
    name,
    "",
    "EUR",
    "true",
    "orders_traffic",
    syncedAt
  ]);

  const channelRows = [...channels.entries()].map(([id, meta]) => [
    id,
    meta.name,
    meta.paid ? "Meta Ads" : (meta.name.includes("organic") ? "Organic Social" : "Unknown"),
    "os_mother",
    meta.paid ? "true" : "false",
    "true",
    syncedAt
  ]);

  const employeeRows = [...employees.entries()].map(([id, name]) => [
    id,
    name,
    "sales",
    "unknown",
    id,
    "true",
    "orders",
    syncedAt
  ]);

  if (options.dryRun) {
    return {
      ok: true as const,
      countries: countryRows.length,
      channels: channelRows.length,
      employees: employeeRows.length,
      dryRun: true,
      syncedAt
    };
  }

  return withSyncRun({
    syncName: "os-dictionaries",
    source: "orders+traffic",
    target: "10/11/12",
    spreadsheetId,
    startedAt: syncedAt,
    schemaVersion: "1",
    triggerType: "script"
  }, async () => {
    await safeReplaceSheet({
      spreadsheetId,
      tabTitle: OS_TABS.countries,
      expectedColumns: COUNTRIES_COLUMNS,
      rows: countryRows,
      clearRange: `${quoteTab(OS_TABS.countries)}!A:G`
    });
    await safeReplaceSheet({
      spreadsheetId,
      tabTitle: OS_TABS.channels,
      expectedColumns: CHANNELS_COLUMNS,
      rows: channelRows,
      clearRange: `${quoteTab(OS_TABS.channels)}!A:G`
    });
    await safeReplaceSheet({
      spreadsheetId,
      tabTitle: OS_TABS.employees,
      expectedColumns: EMPLOYEES_COLUMNS,
      rows: employeeRows,
      clearRange: `${quoteTab(OS_TABS.employees)}!A:H`
    });
    return {
      ok: true as const,
      countries: countryRows.length,
      channels: channelRows.length,
      employees: employeeRows.length,
      rowsWritten: countryRows.length + channelRows.length + employeeRows.length,
      rowsRead: orders.length + traffic.length,
      dryRun: false,
      syncedAt
    };
  });
}

export async function syncOsDataSourcesToSheet(options: { spreadsheetId?: string; dryRun?: boolean } = {}) {
  if (!readGoogleServiceAccount()) throw new Error("Google service account is not configured");
  const spreadsheetId = options.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  const syncedAt = new Date().toISOString();
  const rows: string[][] = [
    ["bitrix_crm", "Bitrix24 CRM", "api", "", "", "", "engineering", "sales", "deal/lead", "deal_id", "pull", "os-daily 12:00 MSK", "os_paid_revenue,os_deals", syncedAt, "active", "No webhook URLs stored"],
    ["os_mother", "Mother workbook", "google_sheet", OS_SPREADSHEET_ID, "multiple", "", "engineering", "ceo", "mixed", "varies", "sync", "os-daily", "company aggregates", syncedAt, "active", "Core OS"],
    ["svod_grafik", "СВОД График", "google_sheet", OS_SVOD_SPREADSHEET_ID, OS_SVOD_TAB, String(OS_SVOD_GID), "marketing", "marketing", "month", "month", "manual+sync", "daily", "svod_attributed_revenue,ad_spend,cpl", syncedAt, "active", "Verified marketing KPIs"],
    ["svod_day", "Marketing day", "google_sheet", OS_SVOD_SPREADSHEET_ID, "day", "", "marketing", "marketing", "day", "date", "sync", "os-traffic", "traffic_leads_raw", syncedAt, "active", ""],
    ["svod_organic", "Органика", "google_sheet", OS_SVOD_SPREADSHEET_ID, "Органика", "", "marketing", "marketing", "day", "date", "sync", "os-traffic", "organic_leads", syncedAt, "active", ""],
    ["dialogs_book", "Chat analytics", "google_sheet", OS_DIALOGS_SPREADSHEET_ID, "period tabs", "", "sales_quality", "rop", "message|dialog", "dialog/message id", "incremental", "rop daily-sync", "dialog index only", syncedAt, "active", "Transcripts not copied to mother"],
    ["margin_catalog", "TB/FRS margin", "google_sheet", "1nyHqCUuT12augMMD5J7gDp0OWbE8AWBH", "На 6 направлений", "582207804", "product", "product", "sku", "product_name", "manual", "on demand", "gross_margin_pct", syncedAt, "active", "Office-in-Drive; gviz read used"]
  ];

  if (options.dryRun) {
    return { ok: true as const, rowsWritten: rows.length, dryRun: true, syncedAt };
  }

  return withSyncRun({
    syncName: "os-data-sources",
    source: "contracts",
    target: OS_TABS.dataSources,
    spreadsheetId,
    startedAt: syncedAt,
    schemaVersion: "1",
    triggerType: "script"
  }, async () => {
    await safeReplaceSheet({
      spreadsheetId,
      tabTitle: OS_TABS.dataSources,
      expectedColumns: DATA_SOURCES_COLUMNS,
      rows,
      clearRange: `${quoteTab(OS_TABS.dataSources)}!A:P`
    });
    return { ok: true as const, rowsWritten: rows.length, rowsRead: rows.length, dryRun: false, syncedAt };
  });
}

export async function appendOsChangeLog(input: {
  spreadsheetId?: string;
  changeType: string;
  system: string;
  entity: string;
  description: string;
  reason: string;
  version?: string;
}) {
  if (!readGoogleServiceAccount()) return;
  const spreadsheetId = input.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  await ensureSheetTab(spreadsheetId, OS_TABS.changeLog);
  const existing = await readSheetValues({ spreadsheetId, range: `${quoteTab(OS_TABS.changeLog)}!A1:A1` });
  if (!existing.length) {
    await writeSheetValues({
      spreadsheetId,
      range: `${quoteTab(OS_TABS.changeLog)}!A1`,
      rows: [[...CHANGE_LOG_COLUMNS]]
    });
  }
  const changedAt = new Date().toISOString();
  await appendSheetRows({
    spreadsheetId,
    tabTitle: OS_TABS.changeLog,
    rows: [[
      `chg_${changedAt.slice(0, 10)}_${Math.random().toString(36).slice(2, 8)}`,
      changedAt,
      input.changeType,
      input.system,
      input.entity,
      input.description,
      input.reason,
      "cursor-agent",
      input.version || "1"
    ]]
  });
}
