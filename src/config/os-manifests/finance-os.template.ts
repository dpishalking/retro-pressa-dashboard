import type { BusinessOsManifest } from "@/types/business-os-standard";

/**
 * Finance OS template — no spreadsheet ID, no invented sources.
 * Fill after Finance Coverage Audit.
 */
export const financeOsManifestTemplate: BusinessOsManifest = {
  os_id: "finance_os",
  os_name: "Finance OS",
  domain: "finance",
  version: "finance_os_template_v1",
  spreadsheet_id: "",
  owner: "finance_owner_tbd",
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
  sheets: [],
  exports: [],
  metrics_registry_source: "requires_audit",
  settings_source: "01_Settings (planned)",
  data_quality_sheets: [],
  reconciliation_sheets: [],
  sync_entrypoints: [],
  docs: [
    "docs/business-os/FINANCE_OS_BLUEPRINT.md",
    "docs/business-os/BUSINESS_OS_STANDARD_V1.md",
    "docs/business-os/templates/OS_README_TEMPLATE.md"
  ],
  status: "template",
  is_template: true,
  notes: [
    "candidate sources: Mother 07_Finance_Daily, bank statements, payroll sheets — requires_audit",
    "Do not invent cash metrics until Coverage Audit",
    "Expected export name when ready: finance_export_v1"
  ]
};
