import {
  DATA_QUALITY_COLUMNS,
  QUALITY_THRESHOLDS,
  SALES_FOUNDATION_TABS
} from "@/config/sales-foundation";
import { qualityStatus } from "@/lib/bitrix/sales-foundation/customer-key";
import type { ContactRawRow } from "@/lib/bitrix/sales-foundation/contacts";
import type { DealRawRow } from "@/lib/bitrix/sales-foundation/deals";
import type { LeadRawRow } from "@/lib/bitrix/sales-foundation/leads";

export type DataQualityRow = Record<(typeof DATA_QUALITY_COLUMNS)[number], string>;

type QualitySpec = {
  field_id: string;
  field_name: string;
  getter: (row: Record<string, string>) => string;
  notes?: string;
};

function filled(value: string) {
  return Boolean(String(value ?? "").trim());
}

function metricFor(
  period: string,
  entityType: string,
  sourceSheet: string,
  records: Array<Record<string, string>>,
  spec: QualitySpec,
  syncedAt: string
): DataQualityRow {
  const total = records.length;
  const filledCount = records.filter((row) => filled(spec.getter(row))).length;
  const values = records.map((row) => String(spec.getter(row) ?? "").trim()).filter(Boolean);
  const unique = new Set(values).size;
  const fillRate = total ? (filledCount / total) * 100 : null;
  const validRate = fillRate;
  const duplicateRate = values.length ? ((values.length - unique) / values.length) * 100 : null;
  const status = qualityStatus(fillRate);

  return {
    period,
    entity_type: entityType,
    field_id: spec.field_id,
    field_name: spec.field_name,
    records_total: String(total),
    records_filled: String(filledCount),
    fill_rate_pct: fillRate == null ? "" : fillRate.toFixed(2),
    records_valid: String(filledCount),
    valid_rate_pct: validRate == null ? "" : validRate.toFixed(2),
    records_unique: String(unique),
    duplicate_rate_pct: duplicateRate == null ? "" : duplicateRate.toFixed(2),
    source_sheet: sourceSheet,
    quality_status: status,
    notes: spec.notes || `thresholds good>=${QUALITY_THRESHOLDS.good} acceptable>=${QUALITY_THRESHOLDS.acceptable} poor>=${QUALITY_THRESHOLDS.poor}`,
    sync_updated_at: syncedAt
  };
}

function periodOf(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "unknown";
  const date = new Date(d);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildDataQualityRows(input: {
  leads: LeadRawRow[];
  deals: DealRawRow[];
  contacts: ContactRawRow[];
  periods: string[];
  syncedAt: string;
}): DataQualityRow[] {
  const rows: DataQualityRow[] = [];
  const periods = input.periods.length ? input.periods : ["all"];

  const leadSpecs: QualitySpec[] = [
    { field_id: "UTM_SOURCE", field_name: "UTM Source", getter: (r) => r.utm_source },
    { field_id: "UTM_MEDIUM", field_name: "UTM Medium", getter: (r) => r.utm_medium },
    { field_id: "UTM_CAMPAIGN", field_name: "UTM Campaign", getter: (r) => r.utm_campaign },
    { field_id: "UTM_CONTENT", field_name: "UTM Content", getter: (r) => r.utm_content },
    { field_id: "SOURCE_ID", field_name: "Source", getter: (r) => r.source_id },
    { field_id: "ASSIGNED_BY_ID", field_name: "Assigned", getter: (r) => r.assigned_by_id },
    { field_id: "CONTACT_ID", field_name: "Contact link", getter: (r) => r.contact_id },
    { field_id: "country", field_name: "Country", getter: (r) => r.country_raw },
    { field_id: "form_name", field_name: "Form", getter: (r) => r.form_name },
    { field_id: "deal_relation", field_name: "Converted deal relation", getter: (r) => r.deal_id, notes: "empty unless Bitrix provides link" }
  ];

  const dealSpecs: QualitySpec[] = [
    { field_id: "LEAD_ID", field_name: "Lead link", getter: (r) => r.lead_id },
    { field_id: "CONTACT_ID", field_name: "Contact link", getter: (r) => r.contact_id },
    { field_id: "ASSIGNED_BY_ID", field_name: "Assigned", getter: (r) => r.assigned_by_id },
    { field_id: "STAGE_ID", field_name: "Stage", getter: (r) => r.stage_id },
    { field_id: "STAGE_SEMANTIC_ID", field_name: "Stage semantic", getter: (r) => r.stage_semantic },
    { field_id: "OPPORTUNITY", field_name: "Opportunity", getter: (r) => r.opportunity },
    { field_id: "CURRENCY_ID", field_name: "Currency", getter: (r) => r.currency },
    { field_id: "invoice_at", field_name: "Invoice date", getter: (r) => r.invoice_at },
    { field_id: "invoice_amount", field_name: "Invoice amount", getter: (r) => r.invoice_amount },
    { field_id: "invoice_flag", field_name: "Invoice flag", getter: (r) => r.invoice_flag },
    { field_id: "CLOSEDATE", field_name: "Close date", getter: (r) => r.closed_at },
    { field_id: "product_rows", field_name: "Product rows", getter: (r) => r.product_rows_count },
    { field_id: "country", field_name: "Country", getter: (r) => r.country_raw }
  ];

  const contactSpecs: QualitySpec[] = [
    { field_id: "PHONE", field_name: "Phone present", getter: (r) => (r.has_phone === "true" ? "1" : "") },
    { field_id: "EMAIL", field_name: "Email present", getter: (r) => (r.has_email === "true" ? "1" : "") },
    { field_id: "ASSIGNED_BY_ID", field_name: "Assigned", getter: (r) => r.assigned_by_id },
    { field_id: "country", field_name: "Country", getter: (r) => r.country_raw },
    { field_id: "language", field_name: "Language", getter: (r) => r.language_raw }
  ];

  for (const period of periods) {
    const leads = input.leads.filter((row) => periodOf(row.created_at) === period || period === "all");
    const deals = input.deals.filter((row) => periodOf(row.created_at) === period || period === "all");
    // Contacts are not period-sliced by create date in this pass — attribute to period "all" and each requested period as snapshot.
    const contacts = input.contacts;

    for (const spec of leadSpecs) {
      rows.push(metricFor(period, "lead", SALES_FOUNDATION_TABS.leadsRaw, leads, spec, input.syncedAt));
    }
    for (const spec of dealSpecs) {
      rows.push(metricFor(period, "deal", SALES_FOUNDATION_TABS.dealsRaw, deals, spec, input.syncedAt));
    }
    for (const spec of contactSpecs) {
      rows.push(metricFor(period, "contact", SALES_FOUNDATION_TABS.contactsRaw, contacts, spec, input.syncedAt));
    }
  }

  return rows;
}

export function dataQualityToSheetRows(rows: DataQualityRow[]): Array<Array<string | number>> {
  return rows.map((row) => DATA_QUALITY_COLUMNS.map((column) => row[column] ?? ""));
}
