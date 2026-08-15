/**
 * Read GA4 Foundation facts from Traffic OS warehouse (not live Data API).
 */

import { getTrafficOsSpreadsheetId, TRAFFIC_OS_SHEETS } from "@/config/traffic-os";
import { metricValue, noDataMetric, safeDiv } from "@/lib/analytics-os/metric-value";
import { readSheetValues } from "@/lib/google/sheets-client";
import { quoteTab } from "@/lib/sales-os/predictive-model";
import type { AnalyticsMetricValue } from "@/types/analytics-os";

const GA4_CHANNEL_SOURCE = "Traffic OS 27_GA4_Channel_Daily";
const GENERATE_LEAD_NOTE = "GA4 generate_lead — события сайта, не лиды CRM";

export type Ga4WarehouseMonth = {
  sessions: number;
  users: number;
  generateLeadEvents: number;
  lastSync: string | null;
  propertyId: string | null;
  rowCount: number;
};

function num(raw: string | undefined): number {
  const n = Number(String(raw || "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function inWindow(date: string, month: string, throughDate?: string | null): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (!date.startsWith(month)) return false;
  if (throughDate && date > throughDate) return false;
  return true;
}

function asRows(values: string[][]): Array<Record<string, string>> {
  if (!values.length) return [];
  const header = values[0].map((cell) => String(cell || "").trim());
  return values.slice(1).map((raw) =>
    Object.fromEntries(header.map((key, index) => [key, String(raw[index] ?? "").trim()]))
  );
}

export function aggregateGa4ChannelDaily(
  rows: Array<Record<string, string>>,
  input: { month: string; throughDate?: string | null }
): Omit<Ga4WarehouseMonth, "generateLeadEvents"> {
  let sessions = 0;
  let users = 0;
  let lastSync: string | null = null;
  let propertyId: string | null = null;
  let rowCount = 0;
  for (const row of rows) {
    const date = String(row.date || "").slice(0, 10);
    if (!inWindow(date, input.month, input.throughDate)) continue;
    rowCount += 1;
    sessions += num(row.sessions);
    users += num(row.users);
    const sync = String(row.sync_updated_at || "").trim();
    if (sync && (!lastSync || sync > lastSync)) lastSync = sync;
    const pid = String(row.property_id || "").trim();
    if (pid) propertyId = pid;
  }
  return { sessions, users, lastSync, propertyId, rowCount };
}

export function sumGa4EventCount(
  rows: Array<Record<string, string>>,
  input: { month: string; eventName: string; throughDate?: string | null }
): number {
  let total = 0;
  for (const row of rows) {
    const date = String(row.date || "").slice(0, 10);
    if (!inWindow(date, input.month, input.throughDate)) continue;
    if (String(row.event_name || "").trim() !== input.eventName) continue;
    total += num(row.event_count);
  }
  return total;
}

export async function loadGa4WarehouseMonth(input: {
  month: string;
  throughDate?: string | null;
}): Promise<Ga4WarehouseMonth | null> {
  const spreadsheetId = getTrafficOsSpreadsheetId();
  const q = quoteTab;
  try {
    const [channelValues, eventValues] = await Promise.all([
      readSheetValues({
        spreadsheetId,
        range: `${q(TRAFFIC_OS_SHEETS.ga4ChannelDaily)}!A1:Z`
      }),
      readSheetValues({
        spreadsheetId,
        range: `${q(TRAFFIC_OS_SHEETS.ga4EventDaily)}!A1:Z`
      }).catch(() => [])
    ]);
    const channel = aggregateGa4ChannelDaily(asRows(channelValues), input);
    if (channel.rowCount === 0) return null;
    return {
      ...channel,
      generateLeadEvents: sumGa4EventCount(asRows(eventValues), {
        month: input.month,
        eventName: "generate_lead",
        throughDate: input.throughDate
      })
    };
  } catch {
    return null;
  }
}

export function buildGa4TrafficMetrics(input: {
  warehouse: Ga4WarehouseMonth | null;
  svodLeads: number | null;
  leadsSliced: boolean;
}): { sessions: AnalyticsMetricValue; sessionToLeadCr: AnalyticsMetricValue } {
  const warehouse = input.warehouse;
  if (!warehouse) {
    return {
      sessions: noDataMetric("sessions", GA4_CHANNEL_SOURCE, "Склад GA4 пуст за период", "count"),
      sessionToLeadCr: noDataMetric(
        "session_to_lead_cr",
        "СВОД leads / GA4 sessions",
        "Нет сессий GA4 в складе",
        "pct"
      )
    };
  }

  const generateLeadHint =
    warehouse.generateLeadEvents > 0
      ? `${GENERATE_LEAD_NOTE}: ${warehouse.generateLeadEvents}`
      : GENERATE_LEAD_NOTE;

  const sessions = metricValue({
    metricId: "sessions",
    value: warehouse.sessions,
    status: "live",
    asOf: warehouse.lastSync,
    source: GA4_CHANNEL_SOURCE,
    unit: "count",
    confidence: "high",
    decisionHint: generateLeadHint
  });

  if (input.leadsSliced) {
    return {
      sessions,
      sessionToLeadCr: noDataMetric(
        "session_to_lead_cr",
        "СВОД leads / GA4 sessions",
        "Сессии GA4 без разреза по стране/менеджеру",
        "pct"
      )
    };
  }

  const cr = safeDiv(input.svodLeads ?? 0, warehouse.sessions);
  const hasCr = input.svodLeads != null && warehouse.sessions > 0 && cr != null;

  return {
    sessions,
    sessionToLeadCr: hasCr
      ? metricValue({
          metricId: "session_to_lead_cr",
          value: cr,
          status: "calculated",
          asOf: warehouse.lastSync,
          source: "СВОД Лиды CRM / 27_GA4_Channel_Daily sessions",
          unit: "pct",
          confidence: "medium",
          decisionHint: generateLeadHint
        })
      : noDataMetric(
          "session_to_lead_cr",
          "СВОД leads / GA4 sessions",
          input.svodLeads == null ? "Нет лидов СВОД за период" : "Нет сессий для расчёта CR",
          "pct"
        )
  };
}
