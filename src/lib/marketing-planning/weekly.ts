/**
 * Weekly rollups from daily marketing facts — ratios recalculated, never summed.
 */

import { buildMonthDayColumns, layoutForMonth } from "@/lib/sales-os/predictive-model";
import type { DayTrafficAgg } from "./facts";
import { formatCell } from "./types";
import { recalculateRatio, sumAdditive } from "./rules";

export type WeekAgg = {
  week_index: number;
  week_start: string;
  week_end: string;
  traffic_type: string;
  sessions: number | null;
  leads: number | null;
  deals: number | null;
  invoice_events: number | null;
  payments: number | null;
  paid_revenue: number | null;
  spend: number | null;
  average_check: number | null;
  session_to_lead_cr: number | null;
  lead_to_payment_cr: number | null;
  cpl: number | null;
  roas: number | null;
};

function pickDays(
  daily: Map<string, DayTrafficAgg>,
  isos: string[]
): DayTrafficAgg[] {
  const set = new Set(isos);
  return [...daily.values()].filter((d) => set.has(d.date));
}

function aggregateDays(
  days: DayTrafficAgg[],
  trafficType: string,
  weekIndex: number,
  start: string,
  end: string
): WeekAgg {
  const sessions = sumAdditive(days.map((d) => d.sessions));
  const leads = sumAdditive(days.map((d) => d.leads));
  const deals = sumAdditive(days.map((d) => d.deals));
  const invoice_events = sumAdditive(days.map((d) => d.invoice_events));
  const payments = sumAdditive(days.map((d) => d.payments));
  const paid_revenue = sumAdditive(days.map((d) => d.paid_revenue));
  const spend = sumAdditive(days.map((d) => d.spend));
  const paidLeads = sumAdditive(days.map((d) => d.paid_leads));
  const paidRevAttr = sumAdditive(days.map((d) => d.paid_revenue_attr));
  return {
    week_index: weekIndex,
    week_start: start,
    week_end: end,
    traffic_type: trafficType,
    sessions,
    leads,
    deals,
    invoice_events,
    payments,
    paid_revenue,
    spend,
    average_check: recalculateRatio(paid_revenue, payments),
    session_to_lead_cr: recalculateRatio(leads, sessions),
    lead_to_payment_cr: recalculateRatio(payments, leads),
    cpl: spend != null ? recalculateRatio(spend, paidLeads ?? leads) : null,
    roas: spend != null && spend > 0 ? recalculateRatio(paidRevAttr ?? paid_revenue, spend) : null
  };
}

export function buildMarketingWeekly(
  month: string,
  daily: Map<string, DayTrafficAgg>
): WeekAgg[] {
  const layout = layoutForMonth(month);
  const dayCols = buildMonthDayColumns(month);
  const out: WeekAgg[] = [];
  for (let i = 0; i < layout.weekBlocks.length; i += 1) {
    const weekIsos = dayCols
      .slice(i * 7, i * 7 + 7)
      .map((d) => d.iso)
      .filter((iso) => iso.startsWith(month));
    if (!weekIsos.length) continue;
    const start = weekIsos[0];
    const end = weekIsos[weekIsos.length - 1];
    const days = pickDays(daily, weekIsos);
    out.push(aggregateDays(days, "all", i + 1, start, end));
  }
  return out;
}

export function marketingWeeklyMatrix(weeks: WeekAgg[], syncedAt: string): string[][] {
  return weeks.map((w) => [
    `${w.week_start}/${w.week_end}`,
    w.traffic_type,
    formatCell(w.sessions),
    "",
    "",
    formatCell(w.leads),
    formatCell(w.deals),
    formatCell(w.invoice_events),
    formatCell(w.payments),
    formatCell(w.paid_revenue),
    formatCell(w.spend),
    formatCell(w.average_check),
    formatCell(w.session_to_lead_cr),
    "",
    "",
    "",
    formatCell(w.lead_to_payment_cr),
    formatCell(w.cpl),
    "",
    formatCell(w.roas),
    w.spend == null ? "spend_missing" : "ok",
    "",
    syncedAt
  ]);
}
