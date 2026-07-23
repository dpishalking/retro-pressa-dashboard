/**
 * Prediction View — display matrix from model only (no business logic).
 */

import {
  PREDICTION_VIEW_COLUMNS,
  SALES_PREDICTION_METRICS,
  type PredictionModelRow,
  type PredictionViewRow
} from "./contract";
import { buildWeekSlices } from "./periods";
import { parseNumber } from "./run-rate";

function emptyView(): PredictionViewRow {
  return Object.fromEntries(PREDICTION_VIEW_COLUMNS.map((c) => [c, ""])) as PredictionViewRow;
}

function modelMap(models: PredictionModelRow[]): Map<string, PredictionModelRow> {
  const map = new Map<string, PredictionModelRow>();
  for (const row of models) {
    map.set([row.period_type, row.period, row.scope_type, row.scope_id, row.metric_id].join("|"), row);
  }
  return map;
}

function cell(
  map: Map<string, PredictionModelRow>,
  periodType: string,
  period: string,
  scopeType: string,
  scopeId: string,
  metricId: string,
  field: "plan_value" | "fact_value" | "run_rate_value"
): string {
  const row = map.get([periodType, period, scopeType, scopeId, metricId].join("|"));
  if (!row) return "";
  return row[field] || "";
}

/**
 * Flat view rows for one scope: section headers + metric plan/fact/run_rate lines.
 * Week columns week_1..week_5 + month_total. Day detail as row_type=day.
 */
export function buildPredictionView(input: {
  month: string;
  scopeType: string;
  scopeId: string;
  models: PredictionModelRow[];
}): PredictionViewRow[] {
  const weeks = buildWeekSlices(input.month);
  const map = modelMap(
    input.models.filter((m) => m.scope_type === input.scopeType && m.scope_id === input.scopeId)
  );
  const out: PredictionViewRow[] = [];

  const pushSection = (title: string) => {
    const row = emptyView();
    row.row_type = "section";
    row.section = title;
    row.metric_label = title;
    out.push(row);
  };

  const pushMetric = (metricId: string) => {
    const def = SALES_PREDICTION_METRICS.find((m) => m.metric_id === metricId);
    if (!def) return;
    const monthModel = map.get(["month", input.month, input.scopeType, input.scopeId, metricId].join("|"));
    for (const line of ["plan", "fact", "run_rate"] as const) {
      const row = emptyView();
      row.row_type = "metric";
      row.section = def.metric_group;
      row.metric_id = metricId;
      row.metric_label = line === "plan" ? def.metric_name : "";
      row.line_role = line;
      const field =
        line === "plan" ? "plan_value" : line === "fact" ? "fact_value" : "run_rate_value";
      for (let w = 0; w < 5; w += 1) {
        const week = weeks[w];
        const key = `week_${w + 1}` as keyof PredictionViewRow;
        row[key] = week
          ? cell(map, "week", week.weekId, input.scopeType, input.scopeId, metricId, field)
          : "";
      }
      row.month_total = cell(
        map,
        "month",
        input.month,
        input.scopeType,
        input.scopeId,
        metricId,
        field
      );
      row.status = monthModel?.status || "";
      row.comment = monthModel?.comment || "";
      out.push(row);
    }

    for (const week of weeks) {
      for (const day of week.daysInMonth) {
        const dayModel = map.get(["day", day, input.scopeType, input.scopeId, metricId].join("|"));
        if (!dayModel) continue;
        const row = emptyView();
        row.row_type = "day";
        row.section = def.metric_group;
        row.metric_id = metricId;
        row.metric_label = day;
        row.line_role = "fact";
        row.month_total = dayModel.fact_value;
        row.status = dayModel.comment || "";
        row.comment = dayModel.plan_value ? `day_plan=${dayModel.plan_value}` : "";
        out.push(row);
      }
    }
  };

  pushSection("Lagging");
  for (const m of SALES_PREDICTION_METRICS.filter((x) => x.metric_group === "lagging")) {
    pushMetric(m.metric_id);
  }
  pushSection("Leading");
  for (const m of SALES_PREDICTION_METRICS.filter((x) => x.metric_group === "leading")) {
    pushMetric(m.metric_id);
  }

  return out;
}

export function viewToMatrix(rows: PredictionViewRow[]): string[][] {
  return [
    Array.from(PREDICTION_VIEW_COLUMNS),
    ...rows.map((row) => PREDICTION_VIEW_COLUMNS.map((c) => row[c] || ""))
  ];
}

export function departmentMonthSummary(models: PredictionModelRow[], month: string) {
  const row = models.find(
    (m) =>
      m.period_type === "month" &&
      m.period === month &&
      m.scope_type === "department" &&
      m.metric_id === "paid_revenue"
  );
  return {
    plan: parseNumber(row?.plan_value),
    fact: parseNumber(row?.fact_value),
    run_rate: parseNumber(row?.run_rate_value),
    gap: parseNumber(row?.gap_to_plan),
    required: parseNumber(row?.required_value),
    status: row?.status || "UNKNOWN"
  };
}
