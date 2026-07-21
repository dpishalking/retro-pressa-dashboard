import { TRAFFIC_COLUMNS, TRAFFIC_NUMERIC_COLUMNS, type TrafficColumn } from "@/config/os-sheets";
import type { TrafficRow } from "@/lib/google/traffic-connector";

const numericColumnSet = new Set<string>(TRAFFIC_NUMERIC_COLUMNS);

export type TrafficSheetRow = Record<TrafficColumn, string>;
export type TrafficSheetCell = string | number;

export function emptyTrafficRow(): TrafficSheetRow {
  return Object.fromEntries(TRAFFIC_COLUMNS.map((column) => [column, ""])) as TrafficSheetRow;
}

export function mapTrafficRowToSheet(row: TrafficRow, syncedAt: string): TrafficSheetRow {
  const isOrganic = row.organicLeads > 0 && row.paidLeads === 0;
  const leads = isOrganic ? row.organicLeads : row.paidLeads;
  const sheetRow = emptyTrafficRow();
  sheetRow.date = row.date;
  sheetRow.channel = row.channel || (isOrganic ? "organic" : "paid_social");
  sheetRow.lead_kind = isOrganic ? "organic" : "paid";
  sheetRow.source = row.source;
  sheetRow.campaign = row.campaign;
  sheetRow.country = row.market;
  sheetRow.spend = row.spend ? String(row.spend) : "";
  sheetRow.clicks = row.clicks ? String(row.clicks) : "";
  sheetRow.leads = leads ? String(leads) : "";
  sheetRow.qualified_leads = row.ql ? String(row.ql) : "";
  sheetRow.cpl = row.cpl ? String(Number(row.cpl.toFixed(4))) : "";
  sheetRow.orders = row.salesCount ? String(row.salesCount) : "";
  sheetRow.revenue = row.revenue ? String(row.revenue) : "";
  sheetRow.data_status = "live";
  sheetRow.last_sync_at = syncedAt;
  sheetRow.source_sheet = row.source;
  return sheetRow;
}

export function trafficRowToSheetLine(row: TrafficSheetRow): TrafficSheetCell[] {
  return TRAFFIC_COLUMNS.map((column) => {
    const raw = row[column] ?? "";
    if (!numericColumnSet.has(column)) return raw;
    if (!raw.trim()) return "";
    const value = Number(raw.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(value) ? value : raw;
  });
}

export function splitTrafficRows(rows: TrafficSheetRow[]) {
  return {
    all: rows.sort((a, b) => a.date.localeCompare(b.date) || a.lead_kind.localeCompare(b.lead_kind)),
    organic: rows.filter((row) => row.lead_kind === "organic"),
    paid: rows.filter((row) => row.lead_kind === "paid")
  };
}
