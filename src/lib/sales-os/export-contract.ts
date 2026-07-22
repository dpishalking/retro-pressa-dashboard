/**
 * Sales OS export contract (child workbook → mother).
 * Mother must read ONLY 99_EXPORT, never internal Sales OS tabs.
 * Version remains sales_export_v1; column set is the dual-run contract.
 */

export const SALES_EXPORT_CONTRACT_VERSION = "sales_export_v1" as const;

export const SALES_EXPORT_COLUMNS = [
  "date",
  "manager_id",
  "leads",
  "deals",
  "invoice_events",
  "payments",
  "paid_revenue",
  "active_deals",
  "active_pipeline_amount",
  "stale_deals",
  "deals_without_next_activity",
  "lead_to_deal_cr",
  "deal_to_invoice_cr",
  "invoice_to_payment_cr",
  "deal_to_payment_cr",
  "average_check",
  "data_quality_score",
  "source_updated_at",
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
  const nonEmpty = normalized.filter(Boolean);
  const dupes = nonEmpty.filter((name, index) => nonEmpty.indexOf(name) !== index);
  if (dupes.length) errors.push(`Duplicate columns: ${[...new Set(dupes)].join(", ")}`);
  for (const column of SALES_EXPORT_COLUMNS) {
    if (!normalized.includes(column)) errors.push(`Missing column: ${column}`);
  }
  return { ok: errors.length === 0, errors };
}

export function validateSalesExportRows(rows: Array<Record<string, unknown>>): SalesExportValidationResult {
  const errors: string[] = [];
  const keys = new Set<string>();
  let contractVersion: string | null = null;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const date = String(row.date ?? "").trim();
    const managerId = String(row.manager_id ?? "").trim();
    if (!date) errors.push(`Row ${index + 1}: date required`);
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`Row ${index + 1}: invalid date`);
    if (!managerId) errors.push(`Row ${index + 1}: manager_id required`);

    const key = `${date}|${managerId}`;
    if (date && managerId) {
      if (keys.has(key)) errors.push(`Row ${index + 1}: duplicate primary key ${key}`);
      keys.add(key);
    }

    const version = String(row.contract_version ?? "").trim();
    if (!version) errors.push(`Row ${index + 1}: contract_version required`);
    else if (version !== SALES_EXPORT_CONTRACT_VERSION) {
      errors.push(`Row ${index + 1}: unsupported contract_version ${version}`);
    }
    if (contractVersion == null) contractVersion = version;
    else if (version && version !== contractVersion) {
      errors.push(`Row ${index + 1}: mixed contract_version`);
    }

    for (const field of ["leads", "deals", "invoice_events", "payments", "paid_revenue", "active_deals", "active_pipeline_amount"] as const) {
      const raw = row[field];
      if (raw == null || String(raw).trim() === "") continue;
      const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(n)) errors.push(`Row ${index + 1}: invalid numeric ${field}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export const EUR_ASSUMPTION_NOTE =
  "Current OS money fields assume EUR. amount_original/currency/exchange_rate/amount_eur are reserved for multi-currency migration without breaking existing contracts.";
