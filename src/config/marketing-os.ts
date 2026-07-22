/**
 * Marketing Operating System (Control Layer) config.
 * Health score weights are system defaults — not approved marketing policy.
 */

export const MARKETING_OS_CONTRACT_VERSION = "marketing_os_v1";
export const MARKETING_THRESHOLD_STATUS = "default_not_approved" as const;

/** Weights must sum to 1.0. Stored also in 01_Settings on sync. */
export const TRAFFIC_HEALTH_WEIGHTS = {
  unknown: 0.25,
  channel_coverage: 0.2,
  landing_coverage: 0.15,
  revenue_coverage: 0.2,
  broken_utm: 0.1,
  freshness: 0.1,
  threshold_status: MARKETING_THRESHOLD_STATUS
} as const;

export const MARKETING_OS_SHEETS = {
  marketingHome: "30_Marketing_Home",
  unknownCenter: "31_Unknown_Center",
  dataQualityCenter: "32_Data_Quality_Center",
  marketingTimeline: "33_Marketing_Timeline"
} as const;

export const MARKETING_HOME_COLUMNS = [
  "block",
  "item_id",
  "item_name",
  "metric_id",
  "metric_name",
  "value",
  "status",
  "priority",
  "definition",
  "source",
  "confidence",
  "coverage_pct",
  "owner",
  "comment",
  "sync_updated_at"
] as const;

export const UNKNOWN_CENTER_COLUMNS = [
  "rank",
  "entity_type",
  "entity_id",
  "entity_name",
  "leads",
  "lead_share_pct",
  "attributed_revenue",
  "revenue_share_pct",
  "impact_score",
  "reason",
  "recommended_action",
  "owner",
  "sync_updated_at"
] as const;

export const DATA_QUALITY_CENTER_COLUMNS = [
  "metric_id",
  "metric_name",
  "value",
  "previous_value",
  "delta",
  "status",
  "threshold",
  "definition",
  "source",
  "owner",
  "sync_updated_at"
] as const;

export const MARKETING_TIMELINE_COLUMNS = [
  "event_id",
  "event_at",
  "metric_id",
  "metric_name",
  "value",
  "previous_value",
  "delta",
  "direction",
  "note",
  "sync_run_id",
  "sync_updated_at"
] as const;
