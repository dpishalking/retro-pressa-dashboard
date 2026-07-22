/**
 * GA4 Foundation contract inside Traffic OS warehouse.
 * Sheet numbers 26–29 / 34–36 — 16–22 already used by Management Layer.
 */

export const GA4_FOUNDATION_CONTRACT_VERSION = "ga4_foundation_v1";

export const GA4_FOUNDATION_SHEETS = {
  pageDaily: "26_GA4_Page_Daily",
  channelDaily: "27_GA4_Channel_Daily",
  sourceDaily: "28_GA4_Source_Daily",
  campaignDaily: "29_GA4_Campaign_Daily",
  landingDaily: "34_GA4_Landing_Daily",
  eventDaily: "35_GA4_Event_Daily",
  dataQuality: "36_GA4_Data_Quality"
} as const;

export const GA4_PAGE_DAILY_COLUMNS = [
  "date",
  "host_name",
  "page_path",
  "users",
  "sessions",
  "views",
  "engagement_rate",
  "avg_engagement_time_sec",
  "conversions",
  "property_id",
  "sync_updated_at"
] as const;

export const GA4_CHANNEL_DAILY_COLUMNS = [
  "date",
  "channel_group",
  "users",
  "sessions",
  "views",
  "conversions",
  "property_id",
  "sync_updated_at"
] as const;

export const GA4_SOURCE_DAILY_COLUMNS = [
  "date",
  "source",
  "medium",
  "users",
  "sessions",
  "views",
  "conversions",
  "property_id",
  "sync_updated_at"
] as const;

export const GA4_CAMPAIGN_DAILY_COLUMNS = [
  "date",
  "campaign",
  "source",
  "medium",
  "users",
  "sessions",
  "views",
  "conversions",
  "property_id",
  "sync_updated_at"
] as const;

export const GA4_LANDING_DAILY_COLUMNS = [
  "date",
  "host_name",
  "landing_path",
  "landing_url",
  "users",
  "sessions",
  "views",
  "engagement_rate",
  "conversions",
  "property_id",
  "sync_updated_at"
] as const;

export const GA4_EVENT_DAILY_COLUMNS = [
  "date",
  "event_name",
  "event_count",
  "users",
  "property_id",
  "sync_updated_at"
] as const;

export const GA4_DQ_COLUMNS = [
  "metric_id",
  "metric_name",
  "value",
  "denominator",
  "share_pct",
  "status",
  "definition",
  "source",
  "sync_updated_at"
] as const;

/** Soft map GA4 sessionDefaultChannelGroup → Traffic OS traffic_type (evidence only). */
export const GA4_CHANNEL_GROUP_TO_TRAFFIC_TYPE: Record<string, string> = {
  "Paid Search": "paid",
  "Paid Social": "paid",
  "Paid Other": "paid",
  "Paid Video": "paid",
  Display: "paid",
  "Organic Search": "organic_search",
  "Organic Social": "organic_social",
  "Organic Video": "organic_social",
  Direct: "direct",
  Referral: "referral",
  Email: "email",
  Affiliates: "partner",
  Audio: "unknown",
  "Cross-network": "unknown",
  Unassigned: "unknown",
  "(Other)": "unknown"
};
