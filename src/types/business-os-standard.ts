/**
 * Business OS Standard v1 — shared contracts for all domain OS.
 * Docs: docs/business-os/BUSINESS_OS_STANDARD_V1.md
 */

export type OsDomain =
  | "mother"
  | "sales"
  | "traffic"
  | "finance"
  | "product"
  | "production"
  | "executive";

export type OsLayer =
  | "settings"
  | "registry"
  | "warehouse"
  | "management"
  | "prediction"
  | "dashboard"
  | "export"
  | "data_quality"
  | "reconciliation"
  | "sync_health";

export type MetricValueType = "FACT" | "PLAN" | "FORECAST" | "SCENARIO" | "UNKNOWN";

export type MetricDataType =
  | "count"
  | "currency"
  | "percentage"
  | "duration"
  | "snapshot"
  | "status"
  | "score";

export type MetricGroup = "lagging" | "leading";

export type MetricRole =
  | "result"
  | "driver"
  | "conversion"
  | "capacity"
  | "quality"
  | "constraint";

export type PlanStatus = "draft" | "approved" | "superseded" | "cancelled" | "NO_PLAN";

export type ForecastMethod =
  | "calendar_run_rate"
  | "working_day_run_rate"
  | "weekly_pace"
  | "funnel_based"
  | "manual_forecast"
  | "unsupported";

export type ConfidenceStatus = "high" | "medium" | "low" | "unknown";

export type DataQualityStatus = "good" | "acceptable" | "poor" | "critical" | "unknown";

export type SyncStatus = "running" | "success" | "partial" | "failed" | "skipped";

export type ReconciliationStatus =
  | "matched"
  | "within_tolerance"
  | "expected_difference"
  | "mismatch"
  | "pending_definition"
  | "missing_source"
  | "stale_source";

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertStatus = "open" | "acknowledged" | "resolved" | "ignored";

export type ApprovalStatus =
  | "approved"
  | "draft"
  | "default_not_approved"
  | "deprecated";

export type SheetComplianceStatus =
  | "compliant"
  | "partially_compliant"
  | "legacy_but_working"
  | "temporary"
  | "needs_migration"
  | "deprecated"
  | "unknown";

export type OsComplianceStatus = "compliant" | "partially_compliant" | "non_compliant";

/** Domain export version: sales_export_v1, traffic_export_v3, … */
export type ContractVersion = `${string}_export_v${number}` | `${string}_v${number}`;

export type WarehouseTableType =
  | "raw"
  | "staging"
  | "normalized_core"
  | "event_log"
  | "mapping"
  | "dictionary"
  | "identity"
  | "attribution";

export type ManualFieldType =
  | "business_mapping"
  | "plan"
  | "threshold"
  | "owner"
  | "comment"
  | "status_override"
  | "approval";

export type SheetRoleDeclaration = {
  sheet_key: string;
  sheet_name: string;
  layer: OsLayer;
  warehouse_type?: WarehouseTableType;
  grain?: string;
  primary_key?: string[];
  source?: string;
  manual_fields?: string[];
  sync_type?: "full_replace" | "upsert" | "append" | "manual" | "none";
  external_consumers?: string[];
  contract_version?: string;
  status: SheetComplianceStatus;
  notes?: string;
};

export type ExportDeclaration = {
  sheet_name: string;
  contract_version: string;
  grain: string;
  primary_key: string[];
  columns_ref?: string;
  mother_ingest?: "enabled" | "dual_run" | "blocked" | "not_applicable";
};

export type SyncEntrypoint = {
  name: string;
  kind: "script" | "api" | "lib";
  path: string;
  dry_run_supported: boolean;
};

export type BusinessOsManifest = {
  os_id: string;
  os_name: string;
  domain: OsDomain;
  version: string;
  /** Empty string allowed for templates (no spreadsheet yet). */
  spreadsheet_id: string;
  owner: string;
  layers: OsLayer[];
  sheets: SheetRoleDeclaration[];
  exports: ExportDeclaration[];
  metrics_registry_source: string;
  settings_source: string;
  data_quality_sheets: string[];
  reconciliation_sheets: string[];
  sync_entrypoints: SyncEntrypoint[];
  docs: string[];
  status: "active" | "template" | "planned" | "blocked";
  is_template?: boolean;
  notes?: string[];
};

/** Standard gap_to_plan sign: run_rate - plan (positive = above plan). */
export const GAP_TO_PLAN_FORMULA = "run_rate - plan" as const;

export const STANDARD_SHEET_NUMBERING = {
  "00-09": "readme / settings / registries",
  "10-19": "raw / staging / source maps",
  "20-29": "normalized core / events / attribution",
  "30-39": "management",
  "40-49": "prediction",
  "50-59": "reconciliation / quality / readiness",
  "80-89": "dashboards",
  "99": "export"
} as const;

export const OS_READINESS_LEVELS = [
  "foundation_ready",
  "management_ready",
  "prediction_ready",
  "dashboard_ready"
] as const;

export type OsReadinessLevel = (typeof OS_READINESS_LEVELS)[number];
