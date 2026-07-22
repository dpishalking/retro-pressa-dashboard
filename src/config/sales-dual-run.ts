import { OS_SPREADSHEET_ID } from "@/config/os-sheets";

/** Mother workbook. Env priority: MOTHER_OS_SPREADSHEET_ID → GOOGLE_OS_SHEET_ID → fallback. */
export function getMotherSpreadsheetId(): string {
  return (
    process.env.MOTHER_OS_SPREADSHEET_ID?.trim()
    || process.env.GOOGLE_OS_SHEET_ID?.trim()
    || OS_SPREADSHEET_ID
  );
}

export const SALES_OS_DAILY_TAB = "32_Sales_OS_Daily";
export const SALES_RECONCILIATION_TAB = "51_Sales_Reconciliation";
export const SALES_CUTOVER_READINESS_TAB = "52_Sales_Cutover_Readiness";

export const SALES_OS_DAILY_COLUMNS = [
  "date",
  "manager_id",
  "leads",
  "deals",
  "invoice_events",
  "payments",
  "paid_revenue",
  "active_deals",
  "active_pipeline_amount",
  "stale_deals",
  "deals_without_next_activity",
  "lead_to_deal_cr",
  "deal_to_invoice_cr",
  "invoice_to_payment_cr",
  "deal_to_payment_cr",
  "average_check",
  "data_quality_score",
  "source_updated_at",
  "sales_os_sync_updated_at",
  "contract_version",
  "ingested_at",
  "ingest_status"
] as const;

export const SALES_RECONCILIATION_COLUMNS = [
  "period_type",
  "period",
  "manager_id",
  "metric_id",
  "metric_name",
  "legacy_source",
  "legacy_value",
  "sales_os_source",
  "sales_os_value",
  "delta",
  "delta_pct",
  "absolute_tolerance",
  "relative_tolerance_pct",
  "status",
  "difference_reason",
  "definition_status",
  "source_updated_at",
  "checked_at"
] as const;

export const SALES_CUTOVER_READINESS_COLUMNS = [
  "metric_id",
  "metric_name",
  "definition_ready",
  "blocks_cutover",
  "latest_status",
  "latest_delta",
  "latest_delta_pct",
  "matched_days_7d",
  "matched_days_14d",
  "failed_syncs_7d",
  "schema_errors_7d",
  "latest_source_updated_at",
  "cutover_ready",
  "blocking_reason",
  "checked_at"
] as const;

export type DualRunMetricId =
  | "leads"
  | "deals"
  | "invoice_events"
  | "payments"
  | "paid_revenue"
  | "active_deals"
  | "active_pipeline_amount"
  | "manager_count";

export type DualRunMetricConfig = {
  metricId: DualRunMetricId;
  metricName: string;
  absoluteTolerance: number;
  relativeTolerancePct: number;
  definitionStatus: "aligned" | "partially_aligned" | "different_definition" | "pending_review";
  blocksCutover: boolean;
  legacySource: string;
  salesOsSource: string;
};

export const DUAL_RUN_METRICS: DualRunMetricConfig[] = [
  {
    metricId: "leads",
    metricName: "Leads",
    absoluteTolerance: 0,
    relativeTolerancePct: 0,
    definitionStatus: "pending_review",
    blocksCutover: false,
    legacySource: "none_in_02_Sales_Daily",
    salesOsSource: "99_EXPORT.leads"
  },
  {
    metricId: "deals",
    metricName: "Deals created",
    absoluteTolerance: 0,
    relativeTolerancePct: 0,
    definitionStatus: "aligned",
    blocksCutover: true,
    legacySource: "03_Orders created_at (sales funnel)",
    salesOsSource: "99_EXPORT.deals"
  },
  {
    metricId: "invoice_events",
    metricName: "Invoice events",
    absoluteTolerance: 0,
    relativeTolerancePct: 0,
    definitionStatus: "pending_review",
    blocksCutover: false,
    legacySource: "02_Sales_Daily.invoices",
    salesOsSource: "99_EXPORT.invoice_events"
  },
  {
    metricId: "payments",
    metricName: "Payments",
    absoluteTolerance: 0,
    relativeTolerancePct: 0,
    definitionStatus: "aligned",
    blocksCutover: true,
    legacySource: "03_Orders paid (funnel) / CLOSEDATE",
    salesOsSource: "99_EXPORT.payments (WON CLOSEDATE)"
  },
  {
    metricId: "paid_revenue",
    metricName: "Paid revenue",
    absoluteTolerance: 1,
    relativeTolerancePct: 0.1,
    definitionStatus: "aligned",
    blocksCutover: true,
    legacySource: "03_Orders paid amount (funnel)",
    salesOsSource: "99_EXPORT.paid_revenue (OPPORTUNITY on WON)"
  },
  {
    metricId: "active_deals",
    metricName: "Active deals",
    absoluteTolerance: 0,
    relativeTolerancePct: 0,
    definitionStatus: "aligned",
    blocksCutover: false,
    legacySource: "03_Orders stage_semantic=P (funnel)",
    salesOsSource: "99_EXPORT.active_deals"
  },
  {
    metricId: "active_pipeline_amount",
    metricName: "Active pipeline amount",
    absoluteTolerance: 1,
    relativeTolerancePct: 1,
    definitionStatus: "aligned",
    blocksCutover: false,
    legacySource: "03_Orders opportunity where stage_semantic=P",
    salesOsSource: "99_EXPORT.active_pipeline_amount"
  },
  {
    metricId: "manager_count",
    metricName: "Manager count",
    absoluteTolerance: 0,
    relativeTolerancePct: 0,
    definitionStatus: "aligned",
    blocksCutover: true,
    legacySource: "unique manager_id with create or pay in period",
    salesOsSource: "unique manager_id with create or pay in period"
  }
];

/** Max age of Sales OS export before ingest marks stale. */
export const EXPORT_STALE_MINUTES = 36 * 60;

export const CUTOVER_MATCHED_DAYS_REQUIRED = 7;
