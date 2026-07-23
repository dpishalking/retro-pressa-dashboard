/**
 * Dual-run: legacy predictive front aggregates vs Sales OS Prediction Fact.
 */

import {
  PREDICTION_RECON_COLUMNS,
  type PredictionFactRow,
  type PredictionReconRow
} from "./contract";
import { formatNumber, parseNumber } from "./run-rate";

export type LegacyMonthAgg = {
  paid_revenue?: number | null;
  payments?: number | null;
  average_check?: number | null;
  leads?: number | null;
  deals?: number | null;
  invoice_events?: number | null;
};

const COMPARE_METRICS = [
  "paid_revenue",
  "payments",
  "average_check",
  "leads",
  "deals",
  "invoice_events"
] as const;

function statusFor(input: {
  legacy: number | null;
  salesOs: number | null;
  metricId: string;
}): { status: string; reason: string; delta: number | null } {
  if (input.legacy == null && input.salesOs == null) {
    return { status: "pending_definition", reason: "both empty", delta: null };
  }
  if (input.legacy == null) {
    return { status: "missing_legacy", reason: "legacy empty", delta: null };
  }
  if (input.salesOs == null) {
    return { status: "missing_sales_os", reason: "sales os empty", delta: null };
  }
  const delta = Number((input.salesOs - input.legacy).toFixed(4));
  if (Math.abs(delta) < 0.01) {
    return { status: "matched", reason: "within 0.01", delta };
  }
  // Expected: Maria / СВОД vs Daily Fact
  if (input.metricId === "paid_revenue" || input.metricId === "payments") {
    return {
      status: "expected_difference",
      reason: "legacy may use Maria truth; Sales OS uses 12_Daily_Fact / Payment Events",
      delta
    };
  }
  if (input.metricId === "leads") {
    return {
      status: "expected_difference",
      reason: "legacy may prefer СВОД leads; Sales OS uses 12_Daily_Fact.leads",
      delta
    };
  }
  return { status: "mismatch", reason: "unexplained delta", delta };
}

export function reconcileLegacyVsSalesOs(input: {
  periodType: "month" | "week";
  period: string;
  legacy: LegacyMonthAgg;
  facts: PredictionFactRow[];
  scopeType?: string;
  scopeId?: string;
  syncedAt: string;
}): PredictionReconRow[] {
  const scopeType = input.scopeType || "department";
  const scopeId = input.scopeId || "sales";
  const out: PredictionReconRow[] = [];

  for (const metricId of COMPARE_METRICS) {
    const fact = input.facts.find(
      (f) =>
        f.period_type === input.periodType &&
        f.period === input.period &&
        f.scope_type === scopeType &&
        f.scope_id === scopeId &&
        f.metric_id === metricId
    );
    const legacyVal = input.legacy[metricId] ?? null;
    const salesOs = parseNumber(fact?.fact_value);
    const { status, reason, delta } = statusFor({
      legacy: legacyVal,
      salesOs,
      metricId
    });
    out.push({
      period_type: input.periodType,
      period: input.period,
      metric_id: metricId,
      legacy_value: formatNumber(legacyVal),
      sales_os_value: formatNumber(salesOs),
      delta: formatNumber(delta),
      status,
      reason,
      sync_updated_at: input.syncedAt
    });
  }
  return out;
}

export function reconToMatrix(rows: PredictionReconRow[]): string[][] {
  return [
    Array.from(PREDICTION_RECON_COLUMNS),
    ...rows.map((row) => PREDICTION_RECON_COLUMNS.map((c) => row[c] || ""))
  ];
}
