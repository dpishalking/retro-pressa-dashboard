/**
 * Traffic Management Layer config (system defaults).
 * threshold_status = default_not_approved — not owner-approved marketing policy.
 * Do not use these thresholds for financial decisions without explicit approval.
 */

export const TRAFFIC_MANAGEMENT_CONTRACT_VERSION = "traffic_management_v1";
export const THRESHOLD_STATUS = "default_not_approved" as const;

/** System defaults — not approved marketing policy. */
export const TRAFFIC_MANAGEMENT_THRESHOLDS = {
  minimumSampleSize: 30,
  minimumLandingCoverage: 0.5,
  minimumChannelCoverage: 0.7,
  minimumAttributionCoverage: 0.5,
  minimumPaymentLinkage: 0.2,
  minimumRevenueLinkage: 0.15,
  unknownWarningThreshold: 0.2,
  unknownCriticalThreshold: 0.4,
  threshold_status: THRESHOLD_STATUS
} as const;

export type ManagementStatus =
  | "usable"
  | "limited"
  | "low_sample"
  | "low_coverage"
  | "unknown"
  | "conflict";

export type ManagementConfidence = "high" | "medium" | "low" | "unknown";

export const ORGANIC_TOTAL_TYPES = [
  "organic_social",
  "organic_search",
  "direct",
  "referral"
] as const;

export const TRAFFIC_MANAGEMENT_SHEETS = {
  trafficManagement: "16_Traffic_Management",
  trafficTypeFact: "17_Traffic_Type_Fact",
  channelManagement: "18_Channel_Management",
  landingManagement: "19_Landing_Management",
  campaignManagement: "20_Campaign_Management",
  salesCoverage: "21_Traffic_Sales_Coverage",
  alerts: "22_Traffic_Alerts",
  joinQuality: "23_Join_Quality",
  revenueAttribution: "24_Revenue_Attribution",
  attributionGaps: "25_Attribution_Gaps"
} as const;

export const JOIN_QUALITY_COLUMNS = [
  "join_rule",
  "join_type",
  "rows",
  "matched_rows",
  "coverage_pct",
  "confidence",
  "status",
  "false_match_risk",
  "comment",
  "source_updated_at",
  "sync_updated_at"
] as const;

export const REVENUE_ATTRIBUTION_COLUMNS = [
  "payment_id",
  "paid_at",
  "period",
  "deal_id",
  "lead_id",
  "contact_id",
  "customer_key",
  "traffic_type",
  "channel",
  "landing_id",
  "campaign_id",
  "attribution_method",
  "confidence",
  "cross_period",
  "paid_revenue",
  "gap_reason",
  "source_updated_at",
  "sync_updated_at"
] as const;

export const ATTRIBUTION_GAPS_COLUMNS = [
  "reason",
  "count",
  "revenue",
  "share_pct",
  "priority",
  "recommended_fix",
  "source_updated_at",
  "sync_updated_at"
] as const;

/** Baseline before Attribution Enrichment (Management sync 2026-07-22). */
export const ATTRIBUTION_ENRICHMENT_BASELINE = {
  deal_linkage_pct: 44.47,
  payment_linkage_pct: 7.55,
  revenue_linkage_pct: 7.5,
  revenue_amount_coverage_pct: 71.57,
  unknown_revenue_pct: 28.43,
  orphan_deals: 0,
  orphan_payments: 0
} as const;

export const TRAFFIC_MANAGEMENT_COLUMNS = [
  "month",
  "summary_block",
  "item_id",
  "item_name",
  "metric_id",
  "metric_name",
  "value",
  "share_pct",
  "coverage_pct",
  "confidence",
  "status",
  "comparison_value",
  "delta",
  "delta_pct",
  "comment",
  "source_updated_at",
  "sync_updated_at"
] as const;

export const TRAFFIC_TYPE_FACT_COLUMNS = [
  "date",
  "traffic_type",
  "leads",
  "deals",
  "invoice_events",
  "payments",
  "attributed_paid_revenue",
  "average_check",
  "lead_to_deal_cr",
  "deal_to_invoice_cr",
  "invoice_to_payment_cr",
  "lead_to_payment_cr",
  "lead_share_pct",
  "deal_share_pct",
  "payment_share_pct",
  "revenue_share_pct",
  "attributed_leads",
  "unknown_leads",
  "coverage_pct",
  "confidence",
  "data_quality_status",
  "source_updated_at",
  "sync_updated_at"
] as const;

export const CHANNEL_MANAGEMENT_COLUMNS = [
  "period_type",
  "period",
  "channel_id",
  "channel_name",
  "traffic_type",
  "leads",
  "deals",
  "invoice_events",
  "payments",
  "attributed_paid_revenue",
  "average_check",
  "lead_to_deal_cr",
  "deal_to_invoice_cr",
  "invoice_to_payment_cr",
  "lead_to_payment_cr",
  "lead_share_pct",
  "revenue_share_pct",
  "attribution_coverage_pct",
  "payment_linkage_pct",
  "revenue_linkage_pct",
  "confidence",
  "sample_size",
  "management_status",
  "comment",
  "source_updated_at",
  "sync_updated_at"
] as const;

export const LANDING_MANAGEMENT_COLUMNS = [
  "period_type",
  "period",
  "landing_id",
  "landing_name",
  "domain",
  "path",
  "country",
  "language",
  "product",
  "offer",
  "leads",
  "deals",
  "invoice_events",
  "payments",
  "attributed_paid_revenue",
  "average_check",
  "lead_to_deal_cr",
  "deal_to_payment_cr",
  "lead_to_payment_cr",
  "lead_share_pct",
  "revenue_share_pct",
  "landing_coverage_pct",
  "attribution_coverage_pct",
  "confidence",
  "sample_size",
  "management_status",
  "comment",
  "source_updated_at",
  "sync_updated_at"
] as const;

export const CAMPAIGN_MANAGEMENT_COLUMNS = [
  "period_type",
  "period",
  "campaign_id",
  "campaign_name",
  "channel_id",
  "traffic_type",
  "leads",
  "deals",
  "invoice_events",
  "payments",
  "attributed_paid_revenue",
  "average_check",
  "lead_to_deal_cr",
  "deal_to_payment_cr",
  "lead_to_payment_cr",
  "campaign_coverage_pct",
  "attribution_coverage_pct",
  "confidence",
  "sample_size",
  "management_status",
  "comment",
  "source_updated_at",
  "sync_updated_at"
] as const;

export const TRAFFIC_SALES_COVERAGE_COLUMNS = [
  "period",
  "metric_id",
  "traffic_os_value",
  "sales_os_value",
  "covered_value",
  "uncovered_value",
  "coverage_pct",
  "status",
  "difference_reason",
  "definition_status",
  "source_updated_at",
  "checked_at"
] as const;

export const TRAFFIC_ALERTS_COLUMNS = [
  "alert_id",
  "alert_date",
  "alert_type",
  "severity",
  "entity_type",
  "entity_id",
  "entity_name",
  "metric_id",
  "actual_value",
  "threshold",
  "status",
  "message",
  "recommended_action",
  "owner",
  "source_updated_at",
  "sync_updated_at",
  "bucket",
  "lifecycle_status"
] as const;

export const TRAFFIC_MANAGEMENT_MODULES = [
  "all",
  "traffic_management",
  "traffic_type_fact",
  "channel_management",
  "landing_management",
  "campaign_management",
  "sales_coverage",
  "alerts",
  "export",
  "foundation",
  "management",
  "marketing",
  "marketing_home",
  "unknown_center",
  "data_quality_center",
  "marketing_timeline"
] as const;

export type TrafficManagementModule = (typeof TRAFFIC_MANAGEMENT_MODULES)[number];
