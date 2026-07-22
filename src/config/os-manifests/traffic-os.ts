import type { BusinessOsManifest } from "@/types/business-os-standard";

/**
 * Traffic OS manifest — Business OS Standard v1.
 */
export const trafficOsManifest: BusinessOsManifest = {
  os_id: "traffic_os",
  os_name: "Traffic OS",
  domain: "traffic",
  version: "traffic_os_v1",
  spreadsheet_id: "1jBUvTiDC-m9xK6ho0TJky2CLEWIMwrrDpjT1dvZA9Wg",
  owner: "marketing_ops",
  layers: [
    "settings",
    "registry",
    "warehouse",
    "management",
    "dashboard",
    "export",
    "data_quality",
    "reconciliation"
  ],
  sheets: [
    { sheet_key: "readme", sheet_name: "00_Readme", layer: "registry", status: "partially_compliant" },
    {
      sheet_key: "settings",
      sheet_name: "01_Settings",
      layer: "settings",
      status: "partially_compliant",
      notes: "Includes health weights; threshold_status=default_not_approved"
    },
    {
      sheet_key: "sourceMap",
      sheet_name: "02_Source_Map",
      layer: "warehouse",
      warehouse_type: "mapping",
      manual_fields: ["traffic_type", "mapping_status", "comment"],
      sync_type: "upsert",
      status: "compliant",
      notes: "Manual overrides preserved"
    },
    {
      sheet_key: "landingMap",
      sheet_name: "03_Landing_Map",
      layer: "warehouse",
      warehouse_type: "mapping",
      status: "compliant"
    },
    {
      sheet_key: "campaignMap",
      sheet_name: "04_Campaign_Map",
      layer: "warehouse",
      warehouse_type: "mapping",
      status: "compliant"
    },
    {
      sheet_key: "trafficRaw",
      sheet_name: "05_Traffic_Raw",
      layer: "warehouse",
      warehouse_type: "raw",
      status: "compliant"
    },
    {
      sheet_key: "organicRaw",
      sheet_name: "06_Organic_Raw",
      layer: "warehouse",
      warehouse_type: "raw",
      status: "compliant"
    },
    {
      sheet_key: "crmLeads",
      sheet_name: "07_CRM_Leads",
      layer: "warehouse",
      warehouse_type: "normalized_core",
      primary_key: ["lead_id"],
      status: "compliant"
    },
    {
      sheet_key: "attribution",
      sheet_name: "08_Attribution",
      layer: "warehouse",
      warehouse_type: "attribution",
      primary_key: ["lead_id"],
      status: "compliant"
    },
    {
      sheet_key: "landingFact",
      sheet_name: "09_Landing_Fact",
      layer: "management",
      grain: "date × landing_id",
      status: "legacy_but_working",
      notes: "Standard would place facts in 30–39; leave as legacy"
    },
    {
      sheet_key: "channelFact",
      sheet_name: "10_Channel_Fact",
      layer: "management",
      status: "legacy_but_working"
    },
    {
      sheet_key: "campaignFact",
      sheet_name: "11_Campaign_Fact",
      layer: "management",
      status: "legacy_but_working"
    },
    {
      sheet_key: "dailyFact",
      sheet_name: "12_Daily_Fact",
      layer: "management",
      status: "legacy_but_working"
    },
    {
      sheet_key: "monthlyFact",
      sheet_name: "13_Monthly_Fact",
      layer: "management",
      status: "legacy_but_working"
    },
    {
      sheet_key: "dataQuality",
      sheet_name: "14_Data_Quality",
      layer: "data_quality",
      status: "partially_compliant"
    },
    {
      sheet_key: "reconciliation",
      sheet_name: "15_Reconciliation",
      layer: "reconciliation",
      status: "partially_compliant"
    },
    {
      sheet_key: "trafficManagement",
      sheet_name: "16_Traffic_Management",
      layer: "management",
      status: "compliant"
    },
    {
      sheet_key: "trafficTypeFact",
      sheet_name: "17_Traffic_Type_Fact",
      layer: "management",
      status: "compliant"
    },
    {
      sheet_key: "channelManagement",
      sheet_name: "18_Channel_Management",
      layer: "management",
      status: "compliant"
    },
    {
      sheet_key: "landingManagement",
      sheet_name: "19_Landing_Management",
      layer: "management",
      status: "compliant"
    },
    {
      sheet_key: "campaignManagement",
      sheet_name: "20_Campaign_Management",
      layer: "management",
      status: "compliant"
    },
    {
      sheet_key: "salesCoverage",
      sheet_name: "21_Traffic_Sales_Coverage",
      layer: "reconciliation",
      status: "compliant"
    },
    {
      sheet_key: "alerts",
      sheet_name: "22_Traffic_Alerts",
      layer: "management",
      status: "partially_compliant",
      notes: "Has severity buckets; full alert lifecycle fields incomplete"
    },
    {
      sheet_key: "joinQuality",
      sheet_name: "23_Join_Quality",
      layer: "data_quality",
      status: "compliant"
    },
    {
      sheet_key: "revenueAttribution",
      sheet_name: "24_Revenue_Attribution",
      layer: "warehouse",
      warehouse_type: "attribution",
      status: "compliant"
    },
    {
      sheet_key: "attributionGaps",
      sheet_name: "25_Attribution_Gaps",
      layer: "data_quality",
      status: "compliant"
    },
    {
      sheet_key: "ga4Page",
      sheet_name: "26_GA4_Page_Daily",
      layer: "warehouse",
      warehouse_type: "raw",
      grain: "date × host × page",
      primary_key: ["date", "host_name", "page_path"],
      status: "compliant"
    },
    {
      sheet_key: "ga4Channel",
      sheet_name: "27_GA4_Channel_Daily",
      layer: "warehouse",
      status: "compliant"
    },
    {
      sheet_key: "ga4Source",
      sheet_name: "28_GA4_Source_Daily",
      layer: "warehouse",
      status: "compliant"
    },
    {
      sheet_key: "ga4Campaign",
      sheet_name: "29_GA4_Campaign_Daily",
      layer: "warehouse",
      status: "compliant"
    },
    {
      sheet_key: "marketingHome",
      sheet_name: "30_Marketing_Home",
      layer: "dashboard",
      status: "compliant"
    },
    {
      sheet_key: "unknownCenter",
      sheet_name: "31_Unknown_Center",
      layer: "dashboard",
      status: "compliant"
    },
    {
      sheet_key: "dqCenter",
      sheet_name: "32_Data_Quality_Center",
      layer: "data_quality",
      status: "compliant"
    },
    {
      sheet_key: "timeline",
      sheet_name: "33_Marketing_Timeline",
      layer: "dashboard",
      status: "compliant"
    },
    {
      sheet_key: "ga4Landing",
      sheet_name: "34_GA4_Landing_Daily",
      layer: "warehouse",
      status: "compliant"
    },
    {
      sheet_key: "ga4Event",
      sheet_name: "35_GA4_Event_Daily",
      layer: "warehouse",
      status: "compliant"
    },
    {
      sheet_key: "ga4Dq",
      sheet_name: "36_GA4_Data_Quality",
      layer: "data_quality",
      status: "compliant"
    },
    {
      sheet_key: "export",
      sheet_name: "99_EXPORT",
      layer: "export",
      grain: "date × traffic_type × channel_id × landing_id × campaign_id",
      primary_key: ["date", "traffic_type", "channel_id", "landing_id", "campaign_id"],
      contract_version: "traffic_export_v3",
      external_consumers: ["Mother (blocked cutover)"],
      status: "compliant"
    }
  ],
  exports: [
    {
      sheet_name: "99_EXPORT",
      contract_version: "traffic_export_v3",
      grain: "date × traffic_type × channel_id × landing_id × campaign_id",
      primary_key: ["date", "traffic_type", "channel_id", "landing_id", "campaign_id"],
      columns_ref: "src/lib/traffic-os/export-contract.ts",
      mother_ingest: "blocked"
    }
  ],
  metrics_registry_source: "docs/business-os/TRAFFIC_MANAGEMENT_LAYER.md + Mother metrics registry",
  settings_source: "01_Settings",
  data_quality_sheets: [
    "14_Data_Quality",
    "23_Join_Quality",
    "25_Attribution_Gaps",
    "32_Data_Quality_Center",
    "36_GA4_Data_Quality"
  ],
  reconciliation_sheets: ["15_Reconciliation", "21_Traffic_Sales_Coverage"],
  sync_entrypoints: [
    {
      name: "sync:traffic-os",
      kind: "script",
      path: "src/scripts/sync-traffic-os.ts",
      dry_run_supported: true
    },
    {
      name: "POST /api/sync/traffic-os",
      kind: "api",
      path: "src/app/api/sync/traffic-os/route.ts",
      dry_run_supported: true
    }
  ],
  docs: [
    "docs/business-os/TRAFFIC_OS.md",
    "docs/business-os/TRAFFIC_MANAGEMENT_LAYER.md",
    "docs/business-os/MARKETING_OS.md",
    "docs/business-os/GA4_AUDIT.md",
    "docs/business-os/BUSINESS_OS_STANDARD_V1.md"
  ],
  status: "active",
  notes: [
    "Prediction layer absent (blocked)",
    "Sheet numbering diverges from Standard 00–99 map (legacy_but_working)",
    "Do not mass-rename sheets"
  ]
};
