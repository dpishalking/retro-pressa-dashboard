/**
 * Template — domain config skeleton.
 * Replace DOMAIN; do not invent sheet titles before audit.
 */

export const OS_CONTRACT_VERSION = "{{domain}}_os_v1" as const;
export const OS_SPREADSHEET_ID_DEFAULT = ""; // fill after workbook created

export const OS_SHEETS = {
  readme: "00_Readme",
  settings: "01_Settings",
  // 10–19 warehouse…
  // 30–39 management…
  // 40–49 prediction…
  // 50–59 dq/recon…
  // 80–89 dashboards…
  export: "99_EXPORT"
} as const;

export const SETTINGS_COLUMNS = [
  "setting_id",
  "setting_group",
  "setting_name",
  "setting_value",
  "value_type",
  "owner",
  "approval_status",
  "is_active",
  "updated_at"
] as const;
