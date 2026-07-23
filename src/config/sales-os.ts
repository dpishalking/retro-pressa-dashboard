import { OS_SPREADSHEET_ID } from "@/config/os-sheets";
import { SALES_FOUNDATION_TABS } from "@/config/sales-foundation";
import { SALES_EXPORT_COLUMNS, SALES_EXPORT_CONTRACT_VERSION } from "@/lib/sales-os/export-contract";
import {
  PLAN_COLUMNS,
  PREDICTION_DRIVER_COLUMNS,
  PREDICTION_EXPORT_COLUMNS,
  PREDICTION_FACT_COLUMNS,
  PREDICTION_MODEL_COLUMNS,
  PREDICTION_QUALITY_COLUMNS,
  PREDICTION_RECON_COLUMNS,
  PREDICTION_VIEW_COLUMNS
} from "@/lib/sales-os/prediction/contract";

/** Approved child Sales OS workbook. Env overrides fallback. */
export const SALES_OS_SPREADSHEET_ID_DEFAULT = "1Zj_jLoJzJx0zuzJK0ZJIFKaS5TTQR_WyctAevB1ARwY";

export function getSalesOsSpreadsheetId(): string {
  return process.env.SALES_OS_SPREADSHEET_ID?.trim() || SALES_OS_SPREADSHEET_ID_DEFAULT;
}

export function getSalesOsSourceSpreadsheetId(): string {
  return process.env.GOOGLE_OS_SHEET_ID?.trim() || OS_SPREADSHEET_ID;
}

export const SALES_OS_CONTRACT_VERSION = SALES_EXPORT_CONTRACT_VERSION;

export const SALES_OS_SHEETS = {
  readme: "00_Readme",
  settings: "01_Settings",
  managers: "02_Managers",
  leads: "03_Leads",
  deals: "04_Deals",
  stageMap: "05_Stage_Map",
  stageHistory: "06_Stage_History",
  invoiceEvents: "07_Invoice_Events",
  paymentEvents: "08_Payment_Events",
  activePipeline: "09_Active_Pipeline",
  dialogLinks: "10_Dialog_Links",
  dataQuality: "11_Data_Quality",
  dailyFact: "12_Daily_Fact",
  funnelFact: "13_Funnel_Fact",
  ropBoard: "14_ROP_Board",
  mariaDaily: "15_Maria_Daily",
  mariaSnapshot: "16_Maria_Snapshot",
  salesPlans: "40_Sales_Plans",
  predictionFact: "41_Sales_Prediction_Fact",
  predictionModel: "42_Sales_Prediction_Model",
  predictionDrivers: "43_Sales_Prediction_Drivers",
  predictionQuality: "44_Sales_Prediction_Quality",
  predictionView: "45_Sales_Prediction_View",
  predictionRecon: "46_Sales_Prediction_Reconciliation",
  predictionExport: "98_PREDICTION_EXPORT",
  export: "99_EXPORT"
} as const;

export type SalesOsSheetKey = keyof typeof SALES_OS_SHEETS;

/** Mother staging sources for this child OS. */
export const SALES_OS_SOURCE_TABS = SALES_FOUNDATION_TABS;

export const README_COLUMNS = ["section", "content"] as const;

export const SETTINGS_COLUMNS = ["key", "value", "notes", "updated_at"] as const;

export const MANAGERS_COLUMNS = [
  "manager_id", "manager_name", "is_active", "source", "sync_updated_at"
] as const;

export const LEADS_COLUMNS = [
  "lead_id", "created_at", "modified_at", "status_id", "status_semantic", "source_id",
  "assigned_by_id", "assigned_by_name", "contact_id", "customer_key", "customer_key_type",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "country_raw", "form_name", "phone_present", "email_present",
  "is_lost", "period", "sync_updated_at"
] as const;

export const DEALS_COLUMNS = [
  "deal_id", "lead_id", "contact_id", "created_at", "modified_at", "closed_at",
  "stage_id", "stage_semantic", "category_id", "is_open", "is_won", "is_lost",
  "assigned_by_id", "assigned_by_name", "source_id", "currency", "opportunity",
  "invoice_amount", "invoice_at", "invoice_flag", "country_raw",
  "primary_product_id", "primary_product_name", "product_rows_count",
  "customer_key", "customer_key_type", "period", "sync_updated_at"
] as const;

export const STAGE_MAP_COLUMNS = [
  "stage_id", "category_id", "stage_name", "sort", "semantic",
  "is_final", "is_success", "is_failure",
  "business_stage_id", "business_stage_name", "is_active", "sync_updated_at"
] as const;

export const STAGE_HISTORY_COLUMNS = [
  "event_id", "deal_id", "category_id", "stage_id", "stage_name", "stage_semantic",
  "entered_at", "left_at", "duration_minutes", "is_current_stage", "period", "sync_updated_at"
] as const;

export const INVOICE_EVENTS_COLUMNS = [
  "event_id", "deal_id", "lead_id", "contact_id", "manager_id", "manager_name",
  "invoice_at", "invoice_amount", "currency", "invoice_flag", "customer_key",
  "period", "sync_updated_at"
] as const;

export const PAYMENT_EVENTS_COLUMNS = [
  "event_id", "deal_id", "lead_id", "contact_id", "manager_id", "manager_name",
  "paid_at", "amount", "currency", "customer_key", "period", "sync_updated_at"
] as const;

export const PIPELINE_COLUMNS = [
  "snapshot_date", "deal_id", "created_at", "days_open", "stage_id", "stage_name", "days_in_stage",
  "assigned_by_id", "assigned_by_name", "lead_id", "contact_id", "customer_key",
  "primary_product_id", "primary_product_name", "opportunity", "currency",
  "last_activity_at", "next_activity_at", "days_since_last_activity",
  "is_overdue", "is_without_next_activity", "stage_probability", "weighted_amount",
  "sync_updated_at"
] as const;

export const DIALOG_LINKS_COLUMNS = [
  "dialog_id", "session_id", "chat_id", "lead_id", "deal_id", "contact_id",
  "manager_id", "manager_name", "first_message_at", "last_message_at",
  "messages_count", "client_messages_count", "manager_messages_count",
  "customer_key", "crm_link_status", "sync_updated_at"
] as const;

export const DATA_QUALITY_COLUMNS = [
  "period", "entity_type", "field_id", "field_name", "records_total", "records_filled",
  "fill_rate_pct", "quality_status", "source_sheet", "notes", "sync_updated_at"
] as const;

export const DAILY_FACT_COLUMNS = [
  "date", "manager_id", "manager_name",
  "leads", "deals_created", "invoices", "invoice_amount",
  "payments", "revenue", "active_pipeline_deals", "active_pipeline_amount",
  "dialogs", "stale_deals", "deals_without_next_activity", "sync_updated_at"
] as const;

export const FUNNEL_FACT_COLUMNS = [
  "period", "manager_id", "manager_name",
  "leads", "deals", "invoices", "payments",
  "lead_to_deal_pct", "deal_to_invoice_pct", "invoice_to_payment_pct",
  "revenue", "avg_payment", "sync_updated_at"
] as const;

/** ROP morning board — sectioned rows, not a flat fact table. */
export const ROP_BOARD_COLUMNS = [
  "section", "item", "value", "status", "hint"
] as const;

/**
 * Operational flueger — daily invoice/payment facts from Maria (manual).
 * Sync never deletes or overwrites non-empty cells for an existing date.
 */
export const MARIA_DAILY_COLUMNS = [
  "date",
  "invoices_count",
  "invoices_amount",
  "paid_same_day_count",
  "paid_same_day_amount",
  "paid_total_count",
  "paid_total_amount",
  "notes",
  "source",
  "updated_at"
] as const;

/** Key/value mirror of Maria truth sheet (yesterday + month + plan). */
export const MARIA_SNAPSHOT_COLUMNS = [
  "key", "value", "notes", "updated_at"
] as const;

/** Manual plan keys in 01_Settings — preserved across sync. */
export const ROP_PLAN_SETTING_KEYS = [
  "plan_month",
  "plan_paid_revenue_eur",
  "plan_payments_count",
  "traffic_light_yellow_pct",
  "traffic_light_red_pct",
  "overload_active_deals_threshold",
  "rop_flueger_source"
] as const;

export const ROP_PLAN_SETTING_DEFAULTS: Record<(typeof ROP_PLAN_SETTING_KEYS)[number], string> = {
  plan_month: "2026-07",
  plan_paid_revenue_eur: "",
  plan_payments_count: "",
  traffic_light_yellow_pct: "-5",
  traffic_light_red_pct: "-15",
  overload_active_deals_threshold: "40",
  rop_flueger_source: "maria"
};

export const SALES_OS_COLUMN_CONTRACTS = {
  [SALES_OS_SHEETS.readme]: README_COLUMNS,
  [SALES_OS_SHEETS.settings]: SETTINGS_COLUMNS,
  [SALES_OS_SHEETS.managers]: MANAGERS_COLUMNS,
  [SALES_OS_SHEETS.leads]: LEADS_COLUMNS,
  [SALES_OS_SHEETS.deals]: DEALS_COLUMNS,
  [SALES_OS_SHEETS.stageMap]: STAGE_MAP_COLUMNS,
  [SALES_OS_SHEETS.stageHistory]: STAGE_HISTORY_COLUMNS,
  [SALES_OS_SHEETS.invoiceEvents]: INVOICE_EVENTS_COLUMNS,
  [SALES_OS_SHEETS.paymentEvents]: PAYMENT_EVENTS_COLUMNS,
  [SALES_OS_SHEETS.activePipeline]: PIPELINE_COLUMNS,
  [SALES_OS_SHEETS.dialogLinks]: DIALOG_LINKS_COLUMNS,
  [SALES_OS_SHEETS.dataQuality]: DATA_QUALITY_COLUMNS,
  [SALES_OS_SHEETS.dailyFact]: DAILY_FACT_COLUMNS,
  [SALES_OS_SHEETS.funnelFact]: FUNNEL_FACT_COLUMNS,
  [SALES_OS_SHEETS.ropBoard]: ROP_BOARD_COLUMNS,
  [SALES_OS_SHEETS.mariaDaily]: MARIA_DAILY_COLUMNS,
  [SALES_OS_SHEETS.mariaSnapshot]: MARIA_SNAPSHOT_COLUMNS,
  [SALES_OS_SHEETS.salesPlans]: PLAN_COLUMNS,
  [SALES_OS_SHEETS.predictionFact]: PREDICTION_FACT_COLUMNS,
  [SALES_OS_SHEETS.predictionModel]: PREDICTION_MODEL_COLUMNS,
  [SALES_OS_SHEETS.predictionDrivers]: PREDICTION_DRIVER_COLUMNS,
  [SALES_OS_SHEETS.predictionQuality]: PREDICTION_QUALITY_COLUMNS,
  [SALES_OS_SHEETS.predictionView]: PREDICTION_VIEW_COLUMNS,
  [SALES_OS_SHEETS.predictionRecon]: PREDICTION_RECON_COLUMNS,
  [SALES_OS_SHEETS.predictionExport]: PREDICTION_EXPORT_COLUMNS,
  [SALES_OS_SHEETS.export]: SALES_EXPORT_COLUMNS
} as const;

export const SALES_OS_SYNC_ORDER = [
  "readme",
  "settings",
  "managers",
  "stage_map",
  "leads",
  "deals",
  "stage_history",
  "invoice_events",
  "payment_events",
  "pipeline",
  "dialog_links",
  "data_quality",
  "daily_fact",
  "funnel_fact",
  "rop_board",
  "maria_daily",
  "maria_snapshot",
  "export"
] as const;

export type SalesOsModule = (typeof SALES_OS_SYNC_ORDER)[number] | "all";

export const DEFAULT_SALES_OS_PERIODS = ["2026-05", "2026-06", "2026-07"] as const;

export const salesOsConfig = {
  get spreadsheetId() {
    return getSalesOsSpreadsheetId();
  },
  get sourceSpreadsheetId() {
    return getSalesOsSourceSpreadsheetId();
  },
  sheetNames: SALES_OS_SHEETS,
  columnContracts: SALES_OS_COLUMN_CONTRACTS,
  contractVersion: SALES_OS_CONTRACT_VERSION,
  sourceTabs: SALES_OS_SOURCE_TABS
} as const;
