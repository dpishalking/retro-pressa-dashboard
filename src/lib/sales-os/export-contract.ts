/**
 * Sales OS export contract (child workbook → mother).
 * Mother must read ONLY 99_EXPORT, never internal Sales OS tabs.
 */

export const SALES_EXPORT_CONTRACT_VERSION = "sales_export_v1" as const;

export const SALES_OS_TABS = [
  "00_Readme",
  "01_Settings",
  "02_Managers",
  "03_Leads",
  "04_Deals",
  "05_Payments",
  "06_Daily_Fact",
  "07_Manager_KPI",
  "08_Funnel",
  "09_Forecast",
  "10_Dialog_Daily",
  "11_Data_Quality",
  "99_EXPORT"
] as const;

export const SALES_EXPORT_COLUMNS = [
  "date",
  "manager_id",
  "leads",
  "deals",
  "invoices",
  "payments",
  "revenue",
  "active_pipeline_amount",
  "weighted_pipeline_amount",
  "forecast_revenue",
  "median_first_response_minutes",
  "dialog_to_payment_cr",
  "sync_updated_at",
  "contract_version"
] as const;

export type SalesExportColumn = (typeof SALES_EXPORT_COLUMNS)[number];
export type SalesExportRow = Record<SalesExportColumn, string | number>;

export type SalesExportValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validateSalesExportHeader(header: string[]): SalesExportValidationResult {
  const errors: string[] = [];
  const normalized = header.map((cell) => String(cell ?? "").trim());
  if (normalized[0] && /^https?:\/\//i.test(normalized[0])) {
    errors.push("First header cell looks like a URL");
  }
  for (const column of SALES_EXPORT_COLUMNS) {
    if (!normalized.includes(column)) errors.push(`Missing column: ${column}`);
  }
  return { ok: errors.length === 0, errors };
}

export function validateSalesExportRows(rows: Array<Record<string, unknown>>): SalesExportValidationResult {
  const errors: string[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.date) errors.push(`Row ${index + 1}: date required`);
    if (!row.manager_id) errors.push(`Row ${index + 1}: manager_id required`);
    if (row.contract_version && row.contract_version !== SALES_EXPORT_CONTRACT_VERSION) {
      errors.push(`Row ${index + 1}: unsupported contract_version`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Future mother sheet — dialog daily aggregates (not message row counts). */
export const DIALOG_DAILY_COLUMNS = [
  "date",
  "manager_id",
  "dialogs_started",
  "unique_leads",
  "dialogs_with_reply",
  "dialogs_with_offer",
  "dialogs_with_calculation",
  "dialogs_with_invoice",
  "dialogs_with_payment",
  "median_first_response_minutes",
  "avg_messages_per_dialog",
  "lost_dialogs",
  "dialog_to_payment_cr",
  "sync_updated_at"
] as const;

export const DIALOG_ID_PRIORITY = [
  "source conversation ID",
  "Bitrix lead/deal ID",
  "deterministic composite fallback"
] as const;

/** Currency migration notes for financial entities. */
export type MoneyFields = {
  amount_original?: number;
  currency?: string;
  exchange_rate?: number;
  amount_eur?: number;
};

export const EUR_ASSUMPTION_NOTE =
  "Current OS money fields assume EUR. amount_original/currency/exchange_rate/amount_eur are reserved for multi-currency migration without breaking existing contracts.";
