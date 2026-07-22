/**
 * Traffic OS child workbook contract (warehouse, not dashboards).
 * Spreadsheet: 1jBUvTiDC-m9xK6ho0TJky2CLEWIMwrrDpjT1dvZA9Wg
 */

export const TRAFFIC_OS_SPREADSHEET_ID_DEFAULT = "1jBUvTiDC-m9xK6ho0TJky2CLEWIMwrrDpjT1dvZA9Wg";
export const TRAFFIC_OS_CONTRACT_VERSION = "traffic_os_v1";

export function getTrafficOsSpreadsheetId(): string {
  return process.env.TRAFFIC_OS_SPREADSHEET_ID?.trim() || TRAFFIC_OS_SPREADSHEET_ID_DEFAULT;
}

export const TRAFFIC_TYPES = [
  "paid",
  "organic_social",
  "organic_search",
  "direct",
  "referral",
  "partner",
  "messenger",
  "email",
  "offline",
  "unknown",
  "excluded"
] as const;

export type TrafficType = (typeof TRAFFIC_TYPES)[number];

export const TRAFFIC_OS_SHEETS = {
  readme: "00_Readme",
  settings: "01_Settings",
  sourceMap: "02_Source_Map",
  landingMap: "03_Landing_Map",
  campaignMap: "04_Campaign_Map",
  trafficRaw: "05_Traffic_Raw",
  organicRaw: "06_Organic_Raw",
  crmLeads: "07_CRM_Leads",
  attribution: "08_Attribution",
  landingFact: "09_Landing_Fact",
  channelFact: "10_Channel_Fact",
  campaignFact: "11_Campaign_Fact",
  dailyFact: "12_Daily_Fact",
  monthlyFact: "13_Monthly_Fact",
  dataQuality: "14_Data_Quality",
  reconciliation: "15_Reconciliation",
  trafficManagement: "16_Traffic_Management",
  trafficTypeFact: "17_Traffic_Type_Fact",
  channelManagement: "18_Channel_Management",
  landingManagement: "19_Landing_Management",
  campaignManagement: "20_Campaign_Management",
  salesCoverage: "21_Traffic_Sales_Coverage",
  alerts: "22_Traffic_Alerts",
  joinQuality: "23_Join_Quality",
  revenueAttribution: "24_Revenue_Attribution",
  attributionGaps: "25_Attribution_Gaps",
  ga4PageDaily: "26_GA4_Page_Daily",
  ga4ChannelDaily: "27_GA4_Channel_Daily",
  ga4SourceDaily: "28_GA4_Source_Daily",
  ga4CampaignDaily: "29_GA4_Campaign_Daily",
  marketingHome: "30_Marketing_Home",
  unknownCenter: "31_Unknown_Center",
  dataQualityCenter: "32_Data_Quality_Center",
  marketingTimeline: "33_Marketing_Timeline",
  ga4LandingDaily: "34_GA4_Landing_Daily",
  ga4EventDaily: "35_GA4_Event_Daily",
  ga4DataQuality: "36_GA4_Data_Quality",
  export: "99_EXPORT"
} as const;

export type TrafficOsSheetKey = keyof typeof TRAFFIC_OS_SHEETS;

export const README_COLUMNS = ["section", "content"] as const;
export const SETTINGS_COLUMNS = ["key", "value", "notes", "updated_at"] as const;

/** Identity Source Map — verified/derived/manual/unknown. Sync preserves manual rows. */
export const SOURCE_MAP_COLUMNS = [
  "source_key",
  "match_type",
  "match_value",
  "source_raw",
  "source_name",
  "utm_source",
  "utm_medium",
  "traffic_type",
  "channel",
  "source_group",
  "is_paid",
  "mapping_status",
  "confidence",
  "mapping_rule",
  "comment",
  "lead_count",
  "updated_at",
  "sync_updated_at"
] as const;

export const LANDING_MAP_COLUMNS = [
  "landing_id",
  "url",
  "domain",
  "path",
  "landing_name",
  "country",
  "language",
  "product",
  "offer",
  "funnel",
  "form_name",
  "owner",
  "status",
  "source_evidence",
  "notes",
  "updated_at",
  "sync_updated_at"
] as const;

export const CAMPAIGN_MAP_COLUMNS = [
  "campaign_key",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "traffic_type",
  "buyer",
  "status",
  "notes",
  "updated_at",
  "sync_updated_at"
] as const;

/** Raw paid media day from СВОД `day` — evidence only (no CPL/ROAS as canon). */
export const TRAFFIC_RAW_COLUMNS = [
  "date",
  "source_sheet",
  "spend",
  "clicks",
  "leads_crm",
  "qualified_leads",
  "sales_count_svod",
  "revenue_svod",
  "sync_updated_at"
] as const;

export const ORGANIC_RAW_COLUMNS = [
  "date",
  "source_sheet",
  "impressions",
  "clicks",
  "leads_sheet",
  "leads_crm",
  "qualified_leads",
  "sales_count_svod",
  "revenue_svod",
  "sync_updated_at"
] as const;

export const CRM_LEADS_COLUMNS = [
  "lead_id",
  "created_at",
  "date",
  "period",
  "status_id",
  "source_id",
  "source_name",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "form_name",
  "country_raw",
  "country_normalized",
  "language_raw",
  "language",
  "landing_url",
  "landing_id",
  "domain",
  "website",
  "source_description",
  "phone_present",
  "email_present",
  "sync_updated_at"
] as const;

export const ATTRIBUTION_COLUMNS = [
  "lead_id",
  "date",
  "traffic_type",
  "channel",
  "source_group",
  "source_id",
  "source_name",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "campaign_key",
  "landing_id",
  "domain",
  "website",
  "form_name",
  "country_normalized",
  "language",
  "deal_id",
  "deal_created_at",
  "invoice_events",
  "payments",
  "paid_revenue",
  "attribution_method",
  "attribution_status",
  "attribution_confidence",
  "reason",
  "mapping_status",
  "sync_updated_at"
] as const;

export const LANDING_FACT_COLUMNS = [
  "date",
  "landing_id",
  "domain",
  "leads",
  "deals",
  "invoices",
  "payments",
  "paid_revenue",
  "lead_to_deal_cr",
  "deal_to_invoice_cr",
  "invoice_to_payment_cr",
  "lead_to_payment_cr",
  "aov",
  "sync_updated_at"
] as const;

export const CHANNEL_FACT_COLUMNS = [
  "date",
  "traffic_type",
  "channel",
  "leads",
  "deals",
  "invoices",
  "payments",
  "paid_revenue",
  "unknown_leads",
  "lead_to_deal_cr",
  "deal_to_invoice_cr",
  "invoice_to_payment_cr",
  "lead_to_payment_cr",
  "aov",
  "sync_updated_at"
] as const;

export const CAMPAIGN_FACT_COLUMNS = [
  "date",
  "campaign_key",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "traffic_type",
  "leads",
  "deals",
  "invoices",
  "payments",
  "paid_revenue",
  "aov",
  "sync_updated_at"
] as const;

export const DAILY_FACT_COLUMNS = [
  "date",
  "leads",
  "deals",
  "invoices",
  "payments",
  "paid_revenue",
  "unknown_leads",
  "svod_paid_leads_crm",
  "svod_organic_leads_crm",
  "svod_spend",
  "aov",
  "sync_updated_at"
] as const;

export const MONTHLY_FACT_COLUMNS = [
  "month",
  "leads",
  "deals",
  "invoices",
  "payments",
  "paid_revenue",
  "unknown_leads",
  "svod_paid_leads_crm",
  "svod_organic_leads_crm",
  "svod_spend",
  "aov",
  "sync_updated_at"
] as const;

export const DATA_QUALITY_COLUMNS = [
  "period",
  "entity_type",
  "field_id",
  "field_name",
  "records_total",
  "records_filled",
  "fill_rate_pct",
  "quality_status",
  "source_sheet",
  "notes",
  "sync_updated_at"
] as const;

export const RECONCILIATION_COLUMNS = [
  "check_id",
  "period",
  "metric",
  "traffic_os_value",
  "sales_os_value",
  "delta",
  "delta_pct",
  "status",
  "explanation",
  "sync_updated_at"
] as const;

export const DEFAULT_TRAFFIC_OS_PERIODS = ["2026-05", "2026-06", "2026-07"] as const;
