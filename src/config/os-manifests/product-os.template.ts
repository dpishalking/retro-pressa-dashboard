import type { BusinessOsManifest } from "@/types/business-os-standard";

/**
 * Product OS template — no spreadsheet ID, no invented sources.
 */
export const productOsManifestTemplate: BusinessOsManifest = {
  os_id: "product_os",
  os_name: "Product OS",
  domain: "product",
  version: "product_os_template_v1",
  spreadsheet_id: "",
  owner: "product_owner_tbd",
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
    "docs/business-os/PRODUCT_OS_BLUEPRINT.md",
    "docs/business-os/BUSINESS_OS_STANDARD_V1.md",
    "docs/business-os/templates/OS_README_TEMPLATE.md"
  ],
  status: "template",
  is_template: true,
  notes: [
    "Mother 06_Products is title-only stub — blocked until product catalog source audit",
    "Expected export name when ready: product_export_v1",
    "Do not invent SKU margins without finance+product evidence"
  ]
};
