import { BITRIX_INVOICE_AMOUNT_FIELD, BITRIX_INVOICE_DATE_FIELD, BITRIX_INVOICE_FLAG_FIELD, BITRIX_SALES_CATEGORY_ID } from "@/lib/bitrix/metric-definitions";

export const SALES_FOUNDATION_CONTRACT_VERSION = "sales_foundation_v1";

export const SALES_FOUNDATION_TABS = {
  leadsRaw: "60_Bitrix_Leads_Raw",
  dealsRaw: "61_Bitrix_Deals_Raw",
  contactsRaw: "62_Bitrix_Contacts_Raw",
  stageHistory: "63_Bitrix_Stage_History",
  stages: "64_Bitrix_Stages",
  pipeline: "65_Bitrix_Pipeline",
  activities: "66_Bitrix_Activities",
  dialogLinks: "67_Bitrix_Dialog_Links",
  fieldCatalog: "68_Bitrix_Field_Catalog",
  dataQuality: "69_Bitrix_Data_Quality"
} as const;

export type SalesFoundationModule =
  | "field_catalog"
  | "stages"
  | "leads"
  | "deals"
  | "contacts"
  | "stage_history"
  | "pipeline"
  | "activities"
  | "dialog_links"
  | "data_quality"
  | "all";

export const SALES_FOUNDATION_SYNC_ORDER: Exclude<SalesFoundationModule, "all">[] = [
  "field_catalog",
  "stages",
  "leads",
  "deals",
  "contacts",
  "stage_history",
  "pipeline",
  "activities",
  "dialog_links",
  "data_quality"
];

export const SALES_CATEGORY_ID = BITRIX_SALES_CATEGORY_ID;

export const SF_FIELDS = {
  invoiceDate: BITRIX_INVOICE_DATE_FIELD,
  invoiceAmount: BITRIX_INVOICE_AMOUNT_FIELD,
  invoiceFlag: BITRIX_INVOICE_FLAG_FIELD,
  dealCountry: "UF_CRM_6797B3DA00D16",
  leadCountry: "UF_CRM_1737995147"
} as const;

export const QUALITY_THRESHOLDS = {
  good: 90,
  acceptable: 70,
  poor: 30
} as const;

export const BATCH_LIMIT = 50;

export const DEFAULT_SF_PERIODS = ["2026-05", "2026-06", "2026-07"] as const;

export const LEADS_RAW_COLUMNS = [
  "lead_id", "created_at", "modified_at", "status_id", "status_semantic", "source_id", "source_description",
  "assigned_by_id", "assigned_by_name", "company_id", "contact_id", "deal_id",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "country_raw", "country_id", "language_raw", "product_interest_raw", "form_name",
  "phone_present", "email_present", "customer_key", "customer_key_type",
  "is_converted", "converted_at", "is_lost", "closed_at", "raw_updated_at", "sync_updated_at"
] as const;

export const DEALS_RAW_COLUMNS = [
  "deal_id", "lead_id", "contact_id", "company_id", "created_at", "modified_at", "closed_at",
  "stage_id", "stage_semantic", "category_id", "is_open", "is_won", "is_lost",
  "assigned_by_id", "assigned_by_name", "source_id", "currency", "opportunity",
  "invoice_amount", "invoice_at", "invoice_flag", "country_raw", "country_id",
  "primary_product_id", "primary_product_name", "product_rows_count",
  "customer_key", "customer_key_type", "last_activity_at", "next_activity_at",
  "raw_updated_at", "sync_updated_at"
] as const;

export const CONTACTS_RAW_COLUMNS = [
  "contact_id", "created_at", "modified_at", "assigned_by_id",
  "phone_count", "email_count", "has_phone", "has_email", "phone_hash", "email_hash",
  "country_raw", "language_raw", "customer_key", "customer_key_type", "duplicate_group_key",
  "raw_updated_at", "sync_updated_at"
] as const;

export const STAGE_HISTORY_COLUMNS = [
  "event_id", "deal_id", "category_id", "stage_id", "stage_name", "stage_semantic",
  "entered_at", "left_at", "duration_minutes", "is_current_stage", "event_source", "sync_updated_at"
] as const;

export const STAGES_COLUMNS = [
  "stage_id", "category_id", "stage_name", "sort", "semantic", "is_final", "is_success", "is_failure",
  "business_stage_id", "business_stage_name", "is_active", "sync_updated_at"
] as const;

export const PIPELINE_COLUMNS = [
  "snapshot_date", "deal_id", "created_at", "days_open", "stage_id", "stage_name", "days_in_stage",
  "assigned_by_id", "assigned_by_name", "lead_id", "contact_id", "customer_key", "country_id",
  "primary_product_id", "primary_product_name", "opportunity", "currency",
  "last_activity_at", "next_activity_at", "days_since_last_activity",
  "is_overdue", "is_without_next_activity", "stage_probability", "weighted_amount", "sync_updated_at"
] as const;

export const ACTIVITIES_COLUMNS = [
  "activity_id", "owner_type_id", "owner_id", "deal_id", "lead_id", "contact_id",
  "activity_type_id", "provider_id", "provider_type_id", "subject", "direction",
  "created_at", "start_time", "end_time", "deadline", "completed",
  "responsible_id", "responsible_name", "is_overdue", "activity_group", "sync_updated_at"
] as const;

export const DIALOG_LINKS_COLUMNS = [
  "dialog_id", "session_id", "chat_id", "owner_type_id", "owner_id",
  "lead_id", "deal_id", "contact_id", "manager_id", "manager_name",
  "first_message_at", "last_message_at", "messages_count", "client_messages_count", "manager_messages_count",
  "customer_key", "crm_link_status", "sync_updated_at"
] as const;

export const FIELD_CATALOG_COLUMNS = [
  "entity_type", "field_id", "field_title", "field_type", "is_required", "is_read_only", "is_multiple",
  "is_user_field", "enum_values_json", "used_in_current_sync", "mapped_target_column", "notes", "sync_updated_at"
] as const;

export const DATA_QUALITY_COLUMNS = [
  "period", "entity_type", "field_id", "field_name", "records_total", "records_filled", "fill_rate_pct",
  "records_valid", "valid_rate_pct", "records_unique", "duplicate_rate_pct",
  "source_sheet", "quality_status", "notes", "sync_updated_at"
] as const;

export const SELECT_LEAD = [
  "ID", "DATE_CREATE", "DATE_MODIFY", "STATUS_ID", "STATUS_SEMANTIC_ID", "SOURCE_ID", "SOURCE_DESCRIPTION",
  "ASSIGNED_BY_ID", "COMPANY_ID", "CONTACT_ID", "PHONE", "EMAIL",
  "UTM_SOURCE", "UTM_MEDIUM", "UTM_CAMPAIGN", "UTM_CONTENT", "UTM_TERM",
  SF_FIELDS.leadCountry, "UF_CRM_FORMNAME", "HAS_PHONE", "HAS_EMAIL"
] as const;

export const SELECT_DEAL = [
  "ID", "TITLE", "LEAD_ID", "CONTACT_ID", "COMPANY_ID", "DATE_CREATE", "DATE_MODIFY", "CLOSEDATE", "CLOSED",
  "STAGE_ID", "STAGE_SEMANTIC_ID", "CATEGORY_ID", "ASSIGNED_BY_ID", "SOURCE_ID",
  "CURRENCY_ID", "OPPORTUNITY", SF_FIELDS.dealCountry, "UTM_CAMPAIGN",
  SF_FIELDS.invoiceDate, SF_FIELDS.invoiceAmount, SF_FIELDS.invoiceFlag,
  "LAST_ACTIVITY_TIME", "NEXT_ACTIVITY_TIME"
] as const;
