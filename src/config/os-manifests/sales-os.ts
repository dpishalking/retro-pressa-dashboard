import type { BusinessOsManifest } from "@/types/business-os-standard";

/**
 * Sales OS manifest — Business OS Standard v1.
 * Spreadsheet from env SALES_OS_SPREADSHEET_ID (default documented in config/sales-os.ts).
 */
export const salesOsManifest: BusinessOsManifest = {
  os_id: "sales_os",
  os_name: "Sales OS",
  domain: "sales",
  version: "sales_os_v1",
  spreadsheet_id: "1Zj_jLoJzJx0zuzJK0ZJIFKaS5TTQR_WyctAevB1ARwY",
  owner: "rop",
  layers: [
    "settings",
    "registry",
    "warehouse",
    "management",
    "prediction",
    "dashboard",
    "export",
    "data_quality",
    "reconciliation"
  ],
  sheets: [
    {
      sheet_key: "readme",
      sheet_name: "00_Readme",
      layer: "registry",
      status: "partially_compliant",
      notes: "Readme exists; full Sheet Registry not in child book"
    },
    {
      sheet_key: "settings",
      sheet_name: "01_Settings",
      layer: "settings",
      manual_fields: ["plan_month", "plan_paid_revenue_eur", "plan_payments_count"],
      sync_type: "upsert",
      status: "partially_compliant",
      notes: "Settings key/value present; approval_status not on every setting"
    },
    {
      sheet_key: "managers",
      sheet_name: "02_Managers",
      layer: "warehouse",
      warehouse_type: "dictionary",
      grain: "manager_id",
      primary_key: ["manager_id"],
      status: "legacy_but_working"
    },
    {
      sheet_key: "leads",
      sheet_name: "03_Leads",
      layer: "warehouse",
      warehouse_type: "normalized_core",
      grain: "lead_id",
      primary_key: ["lead_id"],
      source: "Mother 60_Bitrix_Leads_Raw",
      status: "compliant"
    },
    {
      sheet_key: "deals",
      sheet_name: "04_Deals",
      layer: "warehouse",
      warehouse_type: "normalized_core",
      grain: "deal_id",
      primary_key: ["deal_id"],
      status: "compliant"
    },
    {
      sheet_key: "stageMap",
      sheet_name: "05_Stage_Map",
      layer: "settings",
      warehouse_type: "mapping",
      manual_fields: ["business_stage"],
      status: "partially_compliant"
    },
    {
      sheet_key: "stageHistory",
      sheet_name: "06_Stage_History",
      layer: "warehouse",
      warehouse_type: "event_log",
      primary_key: ["event_id"],
      status: "compliant"
    },
    {
      sheet_key: "invoiceEvents",
      sheet_name: "07_Invoice_Events",
      layer: "warehouse",
      warehouse_type: "event_log",
      primary_key: ["event_id"],
      status: "compliant"
    },
    {
      sheet_key: "paymentEvents",
      sheet_name: "08_Payment_Events",
      layer: "warehouse",
      warehouse_type: "event_log",
      primary_key: ["event_id"],
      status: "compliant"
    },
    {
      sheet_key: "activePipeline",
      sheet_name: "09_Active_Pipeline",
      layer: "management",
      grain: "snapshot_date × deal",
      status: "legacy_but_working"
    },
    {
      sheet_key: "dialogLinks",
      sheet_name: "10_Dialog_Links",
      layer: "warehouse",
      status: "legacy_but_working"
    },
    {
      sheet_key: "dataQuality",
      sheet_name: "11_Data_Quality",
      layer: "data_quality",
      status: "partially_compliant",
      notes: "DQ exists; threshold approval_status incomplete"
    },
    {
      sheet_key: "dailyFact",
      sheet_name: "12_Daily_Fact",
      layer: "management",
      grain: "date × manager_id",
      primary_key: ["date", "manager_id"],
      status: "compliant"
    },
    {
      sheet_key: "funnelFact",
      sheet_name: "13_Funnel_Fact",
      layer: "management",
      status: "compliant"
    },
    {
      sheet_key: "ropBoard",
      sheet_name: "14_ROP_Board",
      layer: "dashboard",
      status: "legacy_but_working"
    },
    {
      sheet_key: "mariaDaily",
      sheet_name: "15_Maria_Daily",
      layer: "warehouse",
      sync_type: "manual",
      manual_fields: ["paid_revenue", "payments", "notes"],
      status: "legacy_but_working",
      notes: "Manual truth preserved across sync"
    },
    {
      sheet_key: "mariaSnapshot",
      sheet_name: "16_Maria_Snapshot",
      layer: "management",
      sync_type: "manual",
      status: "legacy_but_working"
    },
    {
      sheet_key: "export",
      sheet_name: "99_EXPORT",
      layer: "export",
      grain: "date × manager_id",
      primary_key: ["date", "manager_id"],
      contract_version: "sales_export_v1",
      external_consumers: ["Mother dual-run"],
      status: "compliant"
    },
    {
      sheet_key: "predictive_external",
      sheet_name: "Предиктивка продажи (external workbook)",
      layer: "prediction",
      status: "needs_migration",
      notes: "Prediction lives outside Sales OS numbering; needs Prediction Layer alignment"
    }
  ],
  exports: [
    {
      sheet_name: "99_EXPORT",
      contract_version: "sales_export_v1",
      grain: "date × manager_id",
      primary_key: ["date", "manager_id"],
      columns_ref: "src/lib/sales-os/export-contract.ts",
      mother_ingest: "dual_run"
    }
  ],
  metrics_registry_source: "Mother 00_Metrics_Registry + docs/business-os/METRIC_DEFINITIONS.md",
  settings_source: "01_Settings",
  data_quality_sheets: ["11_Data_Quality"],
  reconciliation_sheets: [
    "Mother 51_Sales_Reconciliation",
    "Mother 52_Sales_Cutover_Readiness"
  ],
  sync_entrypoints: [
    {
      name: "sync:sales-os",
      kind: "script",
      path: "src/scripts/sync-sales-os.ts",
      dry_run_supported: true
    },
    {
      name: "POST /api/sync/sales-os",
      kind: "api",
      path: "src/app/api/sync/sales-os/route.ts",
      dry_run_supported: true
    },
    {
      name: "sync:sales-os-ingest",
      kind: "script",
      path: "src/scripts/sync-sales-os-ingest.ts",
      dry_run_supported: true
    }
  ],
  docs: [
    "docs/business-os/SALES_OS.md",
    "docs/business-os/SALES_OS_DUAL_RUN.md",
    "docs/business-os/BITRIX_SALES_FOUNDATION.md",
    "docs/business-os/BUSINESS_OS_STANDARD_V1.md"
  ],
  status: "active",
  notes: [
    "Prediction not yet in-sheet under 40–49 numbering",
    "Reconciliation primarily on Mother (51/52) — pointer declared",
    "Settings approval_status not fully standardized"
  ]
};
