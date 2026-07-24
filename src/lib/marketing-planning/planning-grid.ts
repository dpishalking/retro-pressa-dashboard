/**
 * Marketing Planning UX grids — Sales «Предиктивка» chrome, marketing metric sets.
 */

import {
  buildMonthDayColumns,
  colLetter,
  daysInCalendarMonth,
  formatSheetDateLabel,
  formatWeekDateRangeLabel,
  layoutForMonth,
  monthNameRu
} from "@/lib/sales-os/predictive-model";
import { calendarRunRate } from "@/lib/sales-os/prediction/run-rate";
import { completedDaysThrough, resolveForecastAsOf } from "@/lib/sales-os/prediction/periods";
import type { DayTrafficAgg } from "./facts";
import { monthTotals } from "./facts";
import { findApprovedPlanValue, type PlanRegistryRow } from "./plans";
import {
  MARKETING_GRID_LAST_ROW,
  formatCell,
  metricsForSlice,
  ratio,
  type MarketingMetricDef,
  type MarketingSliceKind
} from "./types";

function blank(width: number) {
  return Array.from({ length: width }, () => "");
}

function metricFact(day: DayTrafficAgg, metricId: string): number | null {
  switch (metricId) {
    case "leads":
      return day.leads;
    case "invoice_events":
      return day.invoice_events;
    case "payments":
      return day.payments;
    case "paid_revenue":
      return day.paid_revenue;
    case "paid_leads":
      return day.paid_leads;
    case "paid_payments":
      return day.paid_payments;
    case "paid_revenue_attr":
      return day.paid_revenue_attr;
    case "spend":
      return day.spend;
    case "organic_leads":
      return day.organic_leads;
    case "organic_payments":
      return day.organic_payments;
    case "organic_revenue":
      return day.organic_revenue;
    case "cpl":
      return day.spend != null ? ratio(day.spend, day.paid_leads || day.leads) : null;
    default:
      return null;
  }
}

function monthMetric(totals: ReturnType<typeof monthTotals>, metricId: string): number | null {
  const map: Record<string, number | null> = {
    leads: totals.leads,
    invoice_events: totals.invoice_events,
    payments: totals.payments,
    paid_revenue: totals.paid_revenue,
    paid_leads: totals.paid_leads,
    paid_payments: totals.paid_payments,
    paid_revenue_attr: totals.paid_revenue_attr,
    spend: totals.spend,
    organic_leads: totals.organic_leads,
    organic_payments: totals.organic_payments,
    organic_revenue: totals.organic_revenue,
    cpl: totals.cpl
  };
  return map[metricId] ?? null;
}

function planScopeForMetric(
  metricId: string,
  slice: MarketingSliceKind
): { scopeType: string; scopeId: string; planMetric: string } {
  if (slice === "performance" || metricId === "paid_leads" || metricId === "spend") {
    const planMetric =
      metricId === "paid_leads" ? "leads" : metricId === "paid_revenue" ? "paid_revenue" : metricId;
    return { scopeType: "traffic_type", scopeId: "paid", planMetric };
  }
  if (slice === "organic" || metricId.startsWith("organic_")) {
    const planMetric =
      metricId === "organic_leads"
        ? "leads"
        : metricId === "organic_payments"
          ? "payments"
          : metricId === "organic_revenue"
            ? "paid_revenue"
            : metricId;
    return { scopeType: "traffic_type", scopeId: "organic", planMetric };
  }
  // General: company marketing plans; payments plan metric_id is payments; revenue → paid_revenue
  const planMetric = metricId === "payments" ? "payments" : metricId;
  return { scopeType: "company", scopeId: "marketing", planMetric };
}

function fillMetricBlock(input: {
  rows: string[][];
  def: MarketingMetricDef;
  month: string;
  monthCol: number;
  weekBlocks: ReturnType<typeof layoutForMonth>["weekBlocks"];
  dateToCol: Map<string, number>;
  daily: Map<string, DayTrafficAgg>;
  plans: PlanRegistryRow[];
  forecastAsOf: string | null;
  elapsed: number;
  dim: number;
  totals: ReturnType<typeof monthTotals>;
  slice: MarketingSliceKind;
}) {
  const { def, rows } = input;
  const planRow = def.planRow;
  const factRow = planRow + 1;
  const ptfRow = planRow + 2;
  rows[planRow - 1][0] = def.label;
  rows[planRow - 1][1] = "план";
  rows[factRow - 1][1] = "факт";
  rows[ptfRow - 1][1] = "прогноз";

  if (def.availability === "not_connected") {
    rows[planRow - 1][2] = "NOT_CONNECTED";
    rows[factRow - 1][2] = "NOT_CONNECTED";
    rows[ptfRow - 1][2] = "NOT_CONNECTED";
    return;
  }

  const scope = planScopeForMetric(def.metric_id, input.slice);
  const plan = findApprovedPlanValue(input.plans, {
    period: input.month,
    scopeType: scope.scopeType,
    scopeId: scope.scopeId,
    metricId: scope.planMetric
  });
  if (plan != null) rows[planRow - 1][input.monthCol] = String(plan);
  else rows[planRow - 1][2] = "NO_PLAN";

  if (def.kind === "quality") {
    rows[factRow - 1][2] = "NOT_CONNECTED";
    return;
  }

  for (const [date, agg] of input.daily) {
    if (input.forecastAsOf && date > input.forecastAsOf) continue;
    const col = input.dateToCol.get(date);
    if (col == null) continue;
    const v = metricFact(agg, def.metric_id);
    if (v != null) rows[factRow - 1][col] = formatCell(v);
  }

  if (def.kind === "additive") {
    for (const block of input.weekBlocks) {
      const a = colLetter(block.dayCols[0]);
      const b = colLetter(block.dayCols[6]);
      rows[factRow - 1][block.totalCol] = `=SUM(${a}${factRow}:${b}${factRow})`;
    }
    rows[factRow - 1][input.monthCol] = `=${input.weekBlocks
      .map((b) => `${colLetter(b.totalCol)}${factRow}`)
      .join("+")}`;
  } else {
    const monthVal = monthMetric(input.totals, def.metric_id);
    rows[factRow - 1][input.monthCol] = formatCell(monthVal);
    if (def.metric_id === "cpl" && input.totals.spend == null) {
      rows[factRow - 1][2] = "BLOCKED_MISSING_SPEND";
    }
  }

  const factMonth = monthMetric(input.totals, def.metric_id);
  if (def.kind === "additive") {
    const rr = calendarRunRate({
      factToDate: factMonth,
      elapsedUnits: input.elapsed,
      totalUnits: input.dim,
      method: "calendar_run_rate"
    });
    rows[ptfRow - 1][input.monthCol] = formatCell(rr);
  } else {
    rows[ptfRow - 1][2] = plan == null ? "NO_PLAN" : "BLOCKED";
  }
}

/**
 * Build predictive grid for a marketing slice.
 */
export function buildMarketingPlanningGrid(input: {
  month: string;
  title: string;
  daily: Map<string, DayTrafficAgg>;
  plans: PlanRegistryRow[];
  today: string;
  asOfDay: number;
  slice?: MarketingSliceKind;
  metrics?: readonly MarketingMetricDef[];
}): string[][] {
  const slice = input.slice || "general";
  const metrics = input.metrics || metricsForSlice(slice);
  const layout = layoutForMonth(input.month);
  const { weekBlocks, monthCol } = layout;
  const width = monthCol + 1;
  const rows: string[][] = Array.from({ length: MARKETING_GRID_LAST_ROW }, () => blank(width));
  const days = buildMonthDayColumns(input.month);
  const weekdays = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
  const totals = monthTotals(input.daily);
  const forecastAsOf = resolveForecastAsOf({ month: input.month, today: input.today });
  const elapsed = completedDaysThrough(input.month, forecastAsOf).length;
  const dim = daysInCalendarMonth(input.month);

  rows[0][0] = input.title;
  rows[0][2] = monthNameRu(input.month);
  rows[0][3] = "Месяц";
  rows[2][0] = "Запаздывающие метрики";

  for (let w = 0; w < weekBlocks.length; w += 1) {
    const block = weekBlocks[w];
    rows[1][block.totalCol] = `Неделя ${w + 1}`;
    rows[2][block.totalCol] = formatWeekDateRangeLabel(
      days.slice(w * 7, w * 7 + 7).map((d) => d.iso)
    );
    for (let d = 0; d < 7; d += 1) {
      rows[1][block.dayCols[d]] = weekdays[d];
      rows[2][block.dayCols[d]] = formatSheetDateLabel(days[w * 7 + d].iso);
    }
  }
  rows[1][monthCol] = "МЕС";
  rows[12][0] = "Опережающие метрики";

  const dateToCol = new Map(days.map((d) => [d.iso, d.col] as const));

  for (const def of metrics) {
    fillMetricBlock({
      rows,
      def,
      month: input.month,
      monthCol,
      weekBlocks,
      dateToCol,
      daily: input.daily,
      plans: input.plans,
      forecastAsOf,
      elapsed,
      dim,
      totals,
      slice
    });
  }

  rows[MARKETING_GRID_LAST_ROW - 1][0] = String(input.asOfDay);
  rows[MARKETING_GRID_LAST_ROW - 1][1] = "as_of_day";
  rows[MARKETING_GRID_LAST_ROW - 1][2] = `forecast_as_of=${forecastAsOf || ""}`;
  rows[MARKETING_GRID_LAST_ROW - 1][3] = `slice=${slice}`;

  return rows;
}

export function buildSlicePlanningGrid(input: {
  month: string;
  title: string;
  slice: MarketingSliceKind;
  daily: Map<string, DayTrafficAgg>;
  plans: PlanRegistryRow[];
  today: string;
  asOfDay: number;
}): string[][] {
  return buildMarketingPlanningGrid({
    month: input.month,
    title: input.title,
    daily: input.daily,
    plans: input.plans,
    today: input.today,
    asOfDay: input.asOfDay,
    slice: input.slice
  });
}
