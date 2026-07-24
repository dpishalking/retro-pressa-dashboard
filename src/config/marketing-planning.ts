/**
 * Marketing Planning workbook — predictive / planning layer (not Traffic warehouse).
 */

export const MARKETING_PLANNING_SPREADSHEET_ID_DEFAULT =
  "1Ru9H24Hs2WPNcP2TEGpvIEcRtjnDV8l-UyBnWNFakN4";

export const MARKETING_PREDICTIVE_CONTRACT_VERSION = "marketing_predictive_v1";
export const MARKETING_PREDICTIVE_EXPORT_VERSION = "marketing_predictive_export_v1";

export function getMarketingPlanningSpreadsheetId(): string {
  return (
    process.env.MARKETING_PLANNING_SPREADSHEET_ID?.trim() ||
    MARKETING_PLANNING_SPREADSHEET_ID_DEFAULT
  );
}

export const MARKETING_PLANNING_SHEETS = {
  readme: "00_Readme",
  settings: "01_Settings",
  planRegistry: "02_Plan_Registry",
  channelMap: "03_Channel_Map",
  methodMap: "04_Method_Map",
  landingMap: "05_Landing_Map",
  marketingDaily: "06_Marketing_Daily",
  marketingWeekly: "07_Marketing_Weekly",
  marketingMonthly: "08_Marketing_Monthly",
  paidDaily: "09_Paid_Daily",
  paidWeekly: "10_Paid_Weekly",
  paidMonthly: "11_Paid_Monthly",
  organicDaily: "12_Organic_Daily",
  organicWeekly: "13_Organic_Weekly",
  organicMonthly: "14_Organic_Monthly",
  channelFact: "15_Channel_Fact",
  methodFact: "16_Method_Fact",
  landingFact: "17_Landing_Fact",
  dataQuality: "18_Data_Quality",
  reconciliation: "19_Reconciliation",
  /** User-facing predictive tabs (Sales-Planning UX) */
  marketingGeneral: "Маркетинг общий",
  marketingPerformance: "Маркетинг Performance",
  organicMarketing: "Органический маркетинг",
  smm: "SMM",
  inboundCalls: "Входящие звонки",
  /** Legacy English keys — still written for compatibility */
  marketingPlanning: "Маркетинг общий",
  paidPlanning: "Маркетинг Performance",
  organicPlanning: "Органический маркетинг",
  channelPlanning: "23_Channel_Planning",
  landingPlanning: "24_Landing_Planning",
  methodsBacklog: "25_Methods_Backlog",
  export: "99_EXPORT"
} as const;

export type MarketingPlanningSheetKey = keyof typeof MARKETING_PLANNING_SHEETS;

export const SETTINGS_COLUMNS = [
  "setting_id",
  "setting_group",
  "setting_name",
  "setting_value",
  "value_type",
  "source",
  "approved_by",
  "approved_at",
  "is_active",
  "updated_at"
] as const;

export const PLAN_REGISTRY_COLUMNS = [
  "plan_id",
  "period_type",
  "period",
  "scope_type",
  "scope_id",
  "metric_id",
  "plan_value",
  "currency",
  "approved_by",
  "approved_at",
  "source",
  "status",
  "comment",
  "updated_at"
] as const;

export const CHANNEL_MAP_COLUMNS = [
  "channel_id",
  "channel_name",
  "traffic_type",
  "platform",
  "is_paid",
  "is_organic",
  "source_system",
  "mapping_status",
  "is_active",
  "owner",
  "comment",
  "updated_at"
] as const;

export const METHOD_MAP_COLUMNS = [
  "method_id",
  "method_name",
  "method_group",
  "channel_id",
  "traffic_type",
  "status",
  "data_source",
  "data_availability",
  "owner",
  "required_integration",
  "comment",
  "updated_at"
] as const;

export const LANDING_MAP_COLUMNS = [
  "landing_id",
  "landing_name",
  "domain",
  "url_pattern",
  "country",
  "language",
  "product",
  "funnel",
  "owner",
  "is_active",
  "mapping_status",
  "source",
  "updated_at"
] as const;

export const MARKETING_DAILY_COLUMNS = [
  "date",
  "traffic_type",
  "sessions",
  "users",
  "clicks",
  "leads",
  "deals",
  "invoice_events",
  "payments",
  "paid_revenue",
  "spend",
  "average_check",
  "session_to_lead_cr",
  "lead_to_deal_cr",
  "deal_to_invoice_cr",
  "invoice_to_payment_cr",
  "lead_to_payment_cr",
  "cpl",
  "cac",
  "roas",
  "data_quality_status",
  "source_updated_at",
  "sync_updated_at"
] as const;

export const DATA_QUALITY_COLUMNS = [
  "period",
  "metric_id",
  "check_id",
  "value",
  "status",
  "source",
  "notes",
  "sync_updated_at"
] as const;

export const RECON_COLUMNS = [
  "period",
  "metric_id",
  "source_a",
  "value_a",
  "source_b",
  "value_b",
  "delta",
  "status",
  "reason",
  "sync_updated_at"
] as const;

export const METHODS_BACKLOG_COLUMNS = [
  "method_id",
  "method_name",
  "traffic_type",
  "current_status",
  "facts_available",
  "plans_available",
  "spend_available",
  "sales_link_available",
  "missing_data",
  "required_integration",
  "next_action",
  "owner",
  "priority",
  "comment"
] as const;

export const EXPORT_COLUMNS = [
  "date",
  "traffic_type",
  "channel_id",
  "method_id",
  "sessions",
  "clicks",
  "leads",
  "deals",
  "invoice_events",
  "payments",
  "paid_revenue",
  "spend",
  "average_check",
  "session_to_lead_cr",
  "lead_to_payment_cr",
  "cpl",
  "cac",
  "roas",
  "plan_status",
  "forecast_status",
  "data_quality_score",
  "source_updated_at",
  "sync_updated_at",
  "contract_version"
] as const;

export const CHANNEL_FACT_COLUMNS = [
  "date",
  "channel_id",
  "traffic_type",
  "sessions",
  "leads",
  "deals",
  "invoice_events",
  "payments",
  "paid_revenue",
  "spend",
  "average_check",
  "data_quality_status",
  "sync_updated_at"
] as const;

export const METHOD_FACT_COLUMNS = [
  "date",
  "method_id",
  "traffic_type",
  "sessions",
  "leads",
  "deals",
  "payments",
  "paid_revenue",
  "spend",
  "data_quality_status",
  "sync_updated_at"
] as const;

export const LANDING_FACT_COLUMNS = [
  "date",
  "landing_id",
  "traffic_type",
  "sessions",
  "leads",
  "deals",
  "payments",
  "paid_revenue",
  "spend",
  "data_quality_status",
  "sync_updated_at"
] as const;

export const README_COLUMNS = ["section", "content"] as const;

/** Compact planning summary (channel / landing boards). */
export const PLANNING_SUMMARY_COLUMNS = [
  "scope_type",
  "scope_id",
  "scope_name",
  "metric_id",
  "plan_value",
  "fact_value",
  "run_rate_value",
  "gap_to_plan",
  "status",
  "data_quality",
  "main_constraint",
  "sync_updated_at"
] as const;
