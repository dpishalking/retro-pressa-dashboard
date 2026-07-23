/**
 * Sales Prediction contract sales_prediction_v1 — Business OS Standard Prediction Layer.
 */

import type { ForecastMethod, MetricGroup, MetricRole } from "@/types/business-os-standard";

export const SALES_PREDICTION_CONTRACT_VERSION = "sales_prediction_v1" as const;

export type PredictionPeriodType = "month" | "week" | "day";
export type PredictionScopeType = "department" | "manager";
/** Reserved for future OS — not built in this sprint. */
export type PredictionScopeTypeFuture = "country" | "product" | "source" | "traffic_type";

export type PredictionMetricKind = "additive" | "ratio" | "average" | "snapshot" | "event";

export type PredictionModelStatus =
  | "ON_PLAN"
  | "ABOVE_PLAN"
  | "BELOW_PLAN"
  | "NO_PLAN"
  | "UNKNOWN"
  | "LOW_CONFIDENCE"
  | "BLOCKED";

export type DayCompleteness = "complete" | "partial" | "future" | "missing_data";

export type SalesPredictionMetricDef = {
  metric_id: string;
  metric_name: string;
  metric_group: MetricGroup;
  metric_role: MetricRole;
  kind: PredictionMetricKind;
  unit: string;
  daily_fact_field?: string;
  numerator_id?: string;
  denominator_id?: string;
};

/** Minimal official set — do not expand without ops need. */
export const SALES_PREDICTION_METRICS: readonly SalesPredictionMetricDef[] = [
  {
    metric_id: "paid_revenue",
    metric_name: "Paid Revenue",
    metric_group: "lagging",
    metric_role: "result",
    kind: "additive",
    unit: "EUR",
    daily_fact_field: "revenue"
  },
  {
    metric_id: "payments",
    metric_name: "Payments",
    metric_group: "lagging",
    metric_role: "result",
    kind: "additive",
    unit: "count",
    daily_fact_field: "payments"
  },
  {
    metric_id: "average_check",
    metric_name: "Average Check",
    metric_group: "lagging",
    metric_role: "result",
    kind: "average",
    unit: "EUR",
    numerator_id: "paid_revenue",
    denominator_id: "payments"
  },
  {
    metric_id: "leads",
    metric_name: "Leads",
    metric_group: "leading",
    metric_role: "driver",
    kind: "additive",
    unit: "count",
    daily_fact_field: "leads"
  },
  {
    metric_id: "deals",
    metric_name: "Deals",
    metric_group: "leading",
    metric_role: "driver",
    kind: "additive",
    unit: "count",
    daily_fact_field: "deals_created"
  },
  {
    metric_id: "invoice_events",
    metric_name: "Invoice Events",
    metric_group: "leading",
    metric_role: "driver",
    kind: "additive",
    unit: "count",
    daily_fact_field: "invoices"
  },
  {
    metric_id: "lead_to_deal_cr",
    metric_name: "Lead → Deal CR",
    metric_group: "leading",
    metric_role: "conversion",
    kind: "ratio",
    unit: "ratio",
    numerator_id: "deals",
    denominator_id: "leads"
  },
  {
    metric_id: "deal_to_invoice_cr",
    metric_name: "Deal → Invoice CR",
    metric_group: "leading",
    metric_role: "conversion",
    kind: "ratio",
    unit: "ratio",
    numerator_id: "invoice_events",
    denominator_id: "deals"
  },
  {
    metric_id: "invoice_to_payment_cr",
    metric_name: "Invoice → Payment CR",
    metric_group: "leading",
    metric_role: "conversion",
    kind: "ratio",
    unit: "ratio",
    numerator_id: "payments",
    denominator_id: "invoice_events"
  },
  {
    metric_id: "lead_to_payment_cr",
    metric_name: "Lead → Payment CR",
    metric_group: "leading",
    metric_role: "conversion",
    kind: "ratio",
    unit: "ratio",
    numerator_id: "payments",
    denominator_id: "leads"
  },
  {
    metric_id: "active_deals",
    metric_name: "Active Deals",
    metric_group: "leading",
    metric_role: "capacity",
    kind: "snapshot",
    unit: "count",
    daily_fact_field: "active_pipeline_deals"
  },
  {
    metric_id: "active_pipeline_amount",
    metric_name: "Active Pipeline Amount",
    metric_group: "leading",
    metric_role: "capacity",
    kind: "snapshot",
    unit: "EUR",
    daily_fact_field: "active_pipeline_amount"
  }
] as const;

export const SALES_PREDICTION_METRIC_BY_ID = Object.fromEntries(
  SALES_PREDICTION_METRICS.map((m) => [m.metric_id, m])
) as Record<string, SalesPredictionMetricDef>;

export const DEFAULT_FORECAST_METHOD: ForecastMethod = "calendar_run_rate";

export const DEPARTMENT_SCOPE_ID = "sales";

export const PLAN_COLUMNS = [
  "plan_id",
  "period_type",
  "period",
  "scope_type",
  "scope_id",
  "metric_id",
  "plan_value",
  "unit",
  "currency",
  "owner",
  "approved_by",
  "approved_at",
  "plan_source",
  "status",
  "comment",
  "updated_at"
] as const;

export const PREDICTION_FACT_COLUMNS = [
  "period_type",
  "period",
  "scope_type",
  "scope_id",
  "metric_id",
  "metric_group",
  "metric_role",
  "fact_value",
  "unit",
  "numerator_value",
  "denominator_value",
  "fact_source",
  "fact_as_of",
  "source_updated_at",
  "sync_updated_at",
  "data_quality_status"
] as const;

export const PREDICTION_MODEL_COLUMNS = [
  "model_id",
  "model_name",
  "period_type",
  "period",
  "scope_type",
  "scope_id",
  "metric_id",
  "metric_name",
  "metric_group",
  "metric_role",
  "plan_value",
  "fact_value",
  "run_rate_value",
  "gap_to_plan",
  "required_value",
  "required_per_remaining_unit",
  "forecast_method",
  "forecast_as_of",
  "plan_source",
  "fact_source",
  "confidence",
  "status",
  "comment",
  "source_updated_at",
  "sync_updated_at",
  "contract_version"
] as const;

export const PREDICTION_DRIVER_COLUMNS = [
  "period",
  "scope_type",
  "scope_id",
  "target_metric_id",
  "driver_metric_id",
  "target_plan",
  "target_fact",
  "target_run_rate",
  "required_driver_value",
  "current_driver_value",
  "driver_gap",
  "baseline_value",
  "baseline_source",
  "baseline_approval_status",
  "confidence",
  "status",
  "comment",
  "sync_updated_at"
] as const;

export const PREDICTION_QUALITY_COLUMNS = [
  "period",
  "scope_type",
  "scope_id",
  "metric_id",
  "plan_available",
  "fact_freshness",
  "fact_completeness",
  "conversion_baseline_available",
  "aov_baseline_available",
  "week_plan_available",
  "manager_plan_available",
  "forecast_allowed",
  "blocked_reason",
  "sync_updated_at"
] as const;

export const PREDICTION_RECON_COLUMNS = [
  "period_type",
  "period",
  "metric_id",
  "legacy_value",
  "sales_os_value",
  "delta",
  "status",
  "reason",
  "sync_updated_at"
] as const;

export const PREDICTION_EXPORT_COLUMNS = [
  "contract_version",
  "period",
  "scope_type",
  "scope_id",
  "metric_id",
  "plan_value",
  "fact_value",
  "run_rate_value",
  "gap_to_plan",
  "status",
  "forecast_method",
  "forecast_as_of",
  "sync_updated_at"
] as const;

export const PREDICTION_VIEW_COLUMNS = [
  "row_type",
  "section",
  "metric_id",
  "metric_label",
  "line_role",
  "week_1",
  "week_2",
  "week_3",
  "week_4",
  "week_5",
  "month_total",
  "status",
  "comment"
] as const;

export type PlanRow = Record<(typeof PLAN_COLUMNS)[number], string>;
export type PredictionFactRow = Record<(typeof PREDICTION_FACT_COLUMNS)[number], string>;
export type PredictionModelRow = Record<(typeof PREDICTION_MODEL_COLUMNS)[number], string>;
export type PredictionDriverRow = Record<(typeof PREDICTION_DRIVER_COLUMNS)[number], string>;
export type PredictionQualityRow = Record<(typeof PREDICTION_QUALITY_COLUMNS)[number], string>;
export type PredictionReconRow = Record<(typeof PREDICTION_RECON_COLUMNS)[number], string>;
export type PredictionExportRow = Record<(typeof PREDICTION_EXPORT_COLUMNS)[number], string>;
export type PredictionViewRow = Record<(typeof PREDICTION_VIEW_COLUMNS)[number], string>;

export function planPrimaryKey(row: Pick<PlanRow, "period_type" | "period" | "scope_type" | "scope_id" | "metric_id">): string {
  return [row.period_type, row.period, row.scope_type, row.scope_id, row.metric_id].join("|");
}

export function emptyPlanRow(): PlanRow {
  return Object.fromEntries(PLAN_COLUMNS.map((c) => [c, ""])) as PlanRow;
}
