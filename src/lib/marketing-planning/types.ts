/**
 * Marketing planning value typing + metric catalog for UX grids.
 * General sheet mirrors Sales Planning row chrome (weeks / план-факт-прогноз).
 */

export type MarketingValueKind =
  | "FACT"
  | "PLAN"
  | "FORECAST"
  | "SCENARIO"
  | "UNKNOWN"
  | "NO_PLAN"
  | "BLOCKED"
  | "NOT_CONNECTED";

export type MarketingMetricDef = {
  metric_id: string;
  label: string;
  section: "lagging" | "leading";
  kind: "additive" | "ratio" | "average" | "quality";
  /** 1-based plan row (fact=plan+1, forecast=plan+2) — aligned to Sales PREDICTIVE_METRICS where possible */
  planRow: number;
  /** Fact availability */
  availability: "fact" | "not_connected" | "no_plan_only";
  polarity?: "higher_better" | "lower_better";
};

/**
 * Маркетинг общий — like Sales «Предиктивка продажи»:
 * Lagging (Bitrix/Sales OS): Revenue, Sale, Invoices
 * Leading: Leads, CPL, A–E quality (not connected until canon exists)
 */
export const MARKETING_GENERAL_METRICS: readonly MarketingMetricDef[] = [
  {
    metric_id: "paid_revenue",
    label: "Revenue",
    section: "lagging",
    kind: "additive",
    planRow: 4,
    availability: "fact",
    polarity: "higher_better"
  },
  {
    metric_id: "payments",
    label: "Sale",
    section: "lagging",
    kind: "additive",
    planRow: 7,
    availability: "fact",
    polarity: "higher_better"
  },
  {
    metric_id: "invoice_events",
    label: "Invoices",
    section: "lagging",
    kind: "additive",
    planRow: 10,
    availability: "fact",
    polarity: "higher_better"
  },
  {
    metric_id: "leads",
    label: "Leads",
    section: "leading",
    kind: "additive",
    planRow: 14,
    availability: "fact",
    polarity: "higher_better"
  },
  {
    metric_id: "cpl",
    label: "CPL",
    section: "leading",
    kind: "ratio",
    planRow: 17,
    availability: "fact",
    polarity: "lower_better"
  },
  {
    metric_id: "lead_grade_a",
    label: "ICE A",
    section: "leading",
    kind: "quality",
    planRow: 20,
    availability: "not_connected"
  },
  {
    metric_id: "lead_grade_b",
    label: "ICE B",
    section: "leading",
    kind: "quality",
    planRow: 23,
    availability: "not_connected"
  },
  {
    metric_id: "lead_grade_c",
    label: "ICE C",
    section: "leading",
    kind: "quality",
    planRow: 26,
    availability: "not_connected"
  },
  {
    metric_id: "lead_grade_d",
    label: "ICE D",
    section: "leading",
    kind: "quality",
    planRow: 29,
    availability: "not_connected"
  },
  {
    metric_id: "lead_grade_e",
    label: "ICE E",
    section: "leading",
    kind: "quality",
    planRow: 32,
    availability: "not_connected"
  }
] as const;

/** @deprecated alias — prefer MARKETING_GENERAL_METRICS */
export const MARKETING_HOME_METRICS = MARKETING_GENERAL_METRICS;

export const MARKETING_GRID_LAST_ROW = 35;

export type MarketingSliceKind = "general" | "performance" | "organic" | "smm" | "inbound_calls";

/** Performance = paid acquisition focus */
export const MARKETING_PERFORMANCE_METRICS: readonly MarketingMetricDef[] = [
  {
    metric_id: "paid_revenue",
    label: "Revenue",
    section: "lagging",
    kind: "additive",
    planRow: 4,
    availability: "fact",
    polarity: "higher_better"
  },
  {
    metric_id: "payments",
    label: "Sale",
    section: "lagging",
    kind: "additive",
    planRow: 7,
    availability: "fact",
    polarity: "higher_better"
  },
  {
    metric_id: "invoice_events",
    label: "Invoices",
    section: "lagging",
    kind: "additive",
    planRow: 10,
    availability: "fact",
    polarity: "higher_better"
  },
  {
    metric_id: "paid_leads",
    label: "Leads",
    section: "leading",
    kind: "additive",
    planRow: 14,
    availability: "fact",
    polarity: "higher_better"
  },
  {
    metric_id: "spend",
    label: "Spend",
    section: "leading",
    kind: "additive",
    planRow: 17,
    availability: "fact",
    polarity: "lower_better"
  },
  {
    metric_id: "cpl",
    label: "CPL",
    section: "leading",
    kind: "ratio",
    planRow: 20,
    availability: "fact",
    polarity: "lower_better"
  }
] as const;

export const MARKETING_ORGANIC_METRICS: readonly MarketingMetricDef[] = [
  {
    metric_id: "organic_revenue",
    label: "Revenue",
    section: "lagging",
    kind: "additive",
    planRow: 4,
    availability: "fact",
    polarity: "higher_better"
  },
  {
    metric_id: "organic_payments",
    label: "Sale",
    section: "lagging",
    kind: "additive",
    planRow: 7,
    availability: "fact",
    polarity: "higher_better"
  },
  {
    metric_id: "organic_leads",
    label: "Leads",
    section: "leading",
    kind: "additive",
    planRow: 14,
    availability: "fact",
    polarity: "higher_better"
  }
] as const;

/** SMM / phone — structure ready; facts NOT_CONNECTED until source confirmed */
export const MARKETING_SMM_METRICS: readonly MarketingMetricDef[] = [
  {
    metric_id: "organic_leads",
    label: "Leads",
    section: "leading",
    kind: "additive",
    planRow: 14,
    availability: "not_connected",
    polarity: "higher_better"
  },
  {
    metric_id: "cpl",
    label: "CPL",
    section: "leading",
    kind: "ratio",
    planRow: 17,
    availability: "not_connected",
    polarity: "lower_better"
  }
] as const;

export const MARKETING_INBOUND_CALLS_METRICS: readonly MarketingMetricDef[] = [
  {
    metric_id: "leads",
    label: "Leads (calls)",
    section: "leading",
    kind: "additive",
    planRow: 14,
    availability: "not_connected",
    polarity: "higher_better"
  }
] as const;

export function metricsForSlice(slice: MarketingSliceKind): readonly MarketingMetricDef[] {
  switch (slice) {
    case "performance":
      return MARKETING_PERFORMANCE_METRICS;
    case "organic":
      return MARKETING_ORGANIC_METRICS;
    case "smm":
      return MARKETING_SMM_METRICS;
    case "inbound_calls":
      return MARKETING_INBOUND_CALLS_METRICS;
    default:
      return MARKETING_GENERAL_METRICS;
  }
}

export function ratio(num: number | null, den: number | null): number | null {
  if (num == null || den == null || !(den > 0)) return null;
  return Number((num / den).toFixed(6));
}

export function formatCell(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}
