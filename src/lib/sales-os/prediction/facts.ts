/**
 * Build Prediction Fact rows from official Sales OS Daily Fact only.
 */

import {
  DEPARTMENT_SCOPE_ID,
  SALES_PREDICTION_METRICS,
  type PredictionFactRow,
  type PredictionPeriodType,
  type PredictionScopeType,
  type SalesPredictionMetricDef
} from "./contract";
import { buildWeekSlices, completedDaysThrough, datesInMonth } from "./periods";
import { formatNumber, parseNumber, ratioFromParts } from "./run-rate";

export type DailyFactLike = {
  date: string;
  manager_id: string;
  manager_name?: string;
  leads?: string;
  deals_created?: string;
  invoices?: string;
  payments?: string;
  revenue?: string;
  active_pipeline_deals?: string;
  active_pipeline_amount?: string;
  sync_updated_at?: string;
};

function fieldValue(row: DailyFactLike, field: string | undefined): number {
  if (!field) return 0;
  return parseNumber((row as Record<string, string>)[field]) || 0;
}

export function sumAdditive(rows: DailyFactLike[], def: SalesPredictionMetricDef): number {
  if (!def.daily_fact_field || def.kind === "snapshot") return 0;
  let sum = 0;
  for (const row of rows) sum += fieldValue(row, def.daily_fact_field);
  return sum;
}

export function latestSnapshot(rows: DailyFactLike[], def: SalesPredictionMetricDef): number | null {
  if (def.kind !== "snapshot" || !def.daily_fact_field) return null;
  const sorted = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const last = sorted[sorted.length - 1];
  if (!last) return null;
  return parseNumber((last as Record<string, string>)[def.daily_fact_field]);
}

export function filterDailyFact(input: {
  rows: DailyFactLike[];
  dates: string[];
  scopeType: PredictionScopeType;
  scopeId: string;
}): DailyFactLike[] {
  const dateSet = new Set(input.dates);
  return input.rows.filter((row) => {
    const d = String(row.date || "").slice(0, 10);
    if (!dateSet.has(d)) return false;
    if (input.scopeType === "department") return true;
    return String(row.manager_id || "") === input.scopeId;
  });
}

export function activeManagerIds(input: {
  rows: DailyFactLike[];
  month: string;
}): string[] {
  const ids = new Set<string>();
  for (const row of input.rows) {
    const d = String(row.date || "").slice(0, 10);
    if (!d.startsWith(input.month)) continue;
    const id = String(row.manager_id || "").trim();
    if (!id || id === "unknown") continue;
    const leads = parseNumber(row.leads) || 0;
    const deals = parseNumber(row.deals_created) || 0;
    const payments = parseNumber(row.payments) || 0;
    const revenue = parseNumber(row.revenue) || 0;
    if (leads || deals || payments || revenue) ids.add(id);
  }
  return [...ids].sort();
}

function metricFactFromRows(input: {
  def: SalesPredictionMetricDef;
  rows: DailyFactLike[];
  additiveCache: Map<string, number>;
}): { value: number | null; numerator: number | null; denominator: number | null } {
  const { def, rows, additiveCache } = input;
  if (def.kind === "additive" || def.kind === "event") {
    const v = sumAdditive(rows, def);
    additiveCache.set(def.metric_id, v);
    return { value: v, numerator: null, denominator: null };
  }
  if (def.kind === "snapshot") {
    return { value: latestSnapshot(rows, def), numerator: null, denominator: null };
  }
  const numId = def.numerator_id!;
  const denId = def.denominator_id!;
  const numDef = SALES_PREDICTION_METRICS.find((m) => m.metric_id === numId)!;
  const denDef = SALES_PREDICTION_METRICS.find((m) => m.metric_id === denId)!;
  const num =
    additiveCache.get(numId) ??
    (numDef.kind === "snapshot" ? latestSnapshot(rows, numDef) : sumAdditive(rows, numDef));
  const den =
    additiveCache.get(denId) ??
    (denDef.kind === "snapshot" ? latestSnapshot(rows, denDef) : sumAdditive(rows, denDef));
  additiveCache.set(numId, num || 0);
  additiveCache.set(denId, den || 0);
  return {
    value: ratioFromParts(num, den),
    numerator: num,
    denominator: den
  };
}

export function buildFactRowsForScope(input: {
  periodType: PredictionPeriodType;
  period: string;
  dates: string[];
  scopeType: PredictionScopeType;
  scopeId: string;
  dailyFact: DailyFactLike[];
  factAsOf: string | null;
  syncedAt: string;
}): PredictionFactRow[] {
  const rows = filterDailyFact({
    rows: input.dailyFact,
    dates: input.dates,
    scopeType: input.scopeType,
    scopeId: input.scopeId
  });
  const additiveFirst = SALES_PREDICTION_METRICS.filter(
    (m) => m.kind === "additive" || m.kind === "event" || m.kind === "snapshot"
  );
  const derived = SALES_PREDICTION_METRICS.filter((m) => m.kind === "ratio" || m.kind === "average");
  const cache = new Map<string, number>();
  const out: PredictionFactRow[] = [];
  const sourceUpdated = rows.map((r) => r.sync_updated_at || "").filter(Boolean).sort().at(-1) || "";

  for (const def of [...additiveFirst, ...derived]) {
    const parts = metricFactFromRows({ def, rows, additiveCache: cache });
    out.push({
      period_type: input.periodType,
      period: input.period,
      scope_type: input.scopeType,
      scope_id: input.scopeId,
      metric_id: def.metric_id,
      metric_group: def.metric_group,
      metric_role: def.metric_role,
      fact_value: formatNumber(parts.value),
      unit: def.unit,
      numerator_value: formatNumber(parts.numerator),
      denominator_value: formatNumber(parts.denominator),
      fact_source: "12_Daily_Fact",
      fact_as_of: input.factAsOf || "",
      source_updated_at: sourceUpdated,
      sync_updated_at: input.syncedAt,
      data_quality_status: rows.length ? "good" : "unknown"
    });
  }
  return out;
}

export function buildAllFactRows(input: {
  month: string;
  dailyFact: DailyFactLike[];
  managerIds: string[];
  factAsOf: string | null;
  syncedAt: string;
  includeWeeks?: boolean;
  includeDays?: boolean;
}): PredictionFactRow[] {
  const weeks = input.includeWeeks !== false;
  const days = input.includeDays !== false;
  const out: PredictionFactRow[] = [];
  const monthDates = completedDaysThrough(input.month, input.factAsOf);

  const scopes: Array<{ scopeType: PredictionScopeType; scopeId: string }> = [
    { scopeType: "department", scopeId: DEPARTMENT_SCOPE_ID },
    ...input.managerIds.map((id) => ({ scopeType: "manager" as const, scopeId: id }))
  ];

  for (const scope of scopes) {
    out.push(
      ...buildFactRowsForScope({
        periodType: "month",
        period: input.month,
        dates: monthDates,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        dailyFact: input.dailyFact,
        factAsOf: input.factAsOf,
        syncedAt: input.syncedAt
      })
    );

    if (weeks) {
      for (const week of buildWeekSlices(input.month)) {
        const weekDates = week.daysInMonth.filter((d) => !input.factAsOf || d <= input.factAsOf);
        out.push(
          ...buildFactRowsForScope({
            periodType: "week",
            period: week.weekId,
            dates: weekDates,
            scopeType: scope.scopeType,
            scopeId: scope.scopeId,
            dailyFact: input.dailyFact,
            factAsOf: input.factAsOf,
            syncedAt: input.syncedAt
          })
        );
      }
    }

    if (days) {
      for (const day of datesInMonth(input.month)) {
        if (input.factAsOf && day > input.factAsOf) continue;
        out.push(
          ...buildFactRowsForScope({
            periodType: "day",
            period: day,
            dates: [day],
            scopeType: scope.scopeType,
            scopeId: scope.scopeId,
            dailyFact: input.dailyFact,
            factAsOf: input.factAsOf,
            syncedAt: input.syncedAt
          })
        );
      }
    }
  }

  return out;
}
