/**
 * Template — copy into src/config/os-manifests/{{domain}}-os.ts
 * Do not invent spreadsheet_id until workbook exists.
 */
import type { BusinessOsManifest } from "@/types/business-os-standard";

export const osManifestTemplate: BusinessOsManifest = {
  os_id: "{{domain}}_os",
  os_name: "{{OS_NAME}}",
  domain: "finance",
  version: "{{domain}}_os_v1",
  spreadsheet_id: "",
  owner: "{{owner_role}}",
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
  settings_source: "01_Settings",
  data_quality_sheets: [],
  reconciliation_sheets: [],
  sync_entrypoints: [],
  docs: ["docs/business-os/{{DOMAIN}}_OS.md"],
  status: "template",
  is_template: true
};
