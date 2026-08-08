import type { AnalyticsMetricValue, MetricConfidence, MetricDataStatus } from "@/types/analytics-os";

export function metricValue(input: {
  metricId: string;
  value: number | null;
  status: MetricDataStatus;
  asOf?: string | null;
  source: string;
  confidence?: MetricConfidence;
  decisionHint?: string;
  plan?: number | null;
  changePct?: number | null;
  unit?: AnalyticsMetricValue["unit"];
}): AnalyticsMetricValue {
  const status = input.status;
  const value = status === "no_data" ? null : input.value;
  return {
    metricId: input.metricId,
    value,
    status,
    asOf: input.asOf ?? null,
    source: input.source,
    confidence: input.confidence ?? (status === "live" ? "high" : status === "no_data" ? "low" : "medium"),
    decisionHint: input.decisionHint,
    plan: input.plan ?? null,
    changePct: input.changePct ?? null,
    unit: input.unit
  };
}

export function noDataMetric(
  metricId: string,
  source: string,
  decisionHint?: string,
  unit?: AnalyticsMetricValue["unit"]
): AnalyticsMetricValue {
  return metricValue({
    metricId,
    value: null,
    status: "no_data",
    source,
    confidence: "low",
    decisionHint,
    unit
  });
}

/** Display helper: never coerce NO DATA to 0. */
export function displayMetricNumber(metric: AnalyticsMetricValue): number | null {
  if (metric.status === "no_data") return null;
  return metric.value;
}

export function safeShare(part: number, total: number): number {
  if (!total) return 0;
  return part / total;
}

export function safeDiv(num: number, den: number): number | null {
  if (!den) return null;
  return num / den;
}
