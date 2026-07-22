import { FIELD_CATALOG_COLUMNS, SELECT_DEAL, SELECT_LEAD, SF_FIELDS } from "@/config/sales-foundation";
import { bitrixResult } from "@/lib/bitrix/rest-client";
import { asString } from "@/lib/bitrix/sales-foundation/customer-key";

export type FieldCatalogRow = Record<(typeof FIELD_CATALOG_COLUMNS)[number], string>;

type BitrixField = {
  type?: string;
  isRequired?: boolean;
  isReadOnly?: boolean;
  isMultiple?: boolean;
  title?: string;
  formLabel?: string;
  listLabel?: string;
  items?: Array<{ ID?: string | number; VALUE?: string }>;
};

const USED_FIELDS = new Set<string>([
  ...SELECT_LEAD,
  ...SELECT_DEAL,
  "PHONE",
  "EMAIL",
  SF_FIELDS.leadCountry,
  SF_FIELDS.dealCountry,
  SF_FIELDS.invoiceDate,
  SF_FIELDS.invoiceAmount,
  SF_FIELDS.invoiceFlag
]);

const MAPPED: Record<string, string> = {
  ID: "lead_id|deal_id|contact_id",
  DATE_CREATE: "created_at",
  DATE_MODIFY: "modified_at",
  UTM_SOURCE: "utm_source",
  UTM_MEDIUM: "utm_medium",
  UTM_CAMPAIGN: "utm_campaign",
  CONTACT_ID: "contact_id",
  LEAD_ID: "lead_id",
  STAGE_ID: "stage_id",
  STAGE_SEMANTIC_ID: "stage_semantic",
  OPPORTUNITY: "opportunity",
  [SF_FIELDS.invoiceDate]: "invoice_at",
  [SF_FIELDS.invoiceAmount]: "invoice_amount",
  [SF_FIELDS.invoiceFlag]: "invoice_flag"
};

function normalizeFields(entityType: string, fields: Record<string, BitrixField>, syncedAt: string): FieldCatalogRow[] {
  return Object.entries(fields).map(([fieldId, meta]) => {
    const enumValues = Array.isArray(meta.items)
      ? meta.items.map((item) => ({ id: asString(item.ID), label: asString(item.VALUE) }))
      : [];
    return {
      entity_type: entityType,
      field_id: fieldId,
      field_title: asString(meta.title || meta.formLabel || meta.listLabel || fieldId),
      field_type: asString(meta.type),
      is_required: meta.isRequired ? "true" : "false",
      is_read_only: meta.isReadOnly ? "true" : "false",
      is_multiple: meta.isMultiple ? "true" : "false",
      is_user_field: fieldId.startsWith("UF_") ? "true" : "false",
      enum_values_json: enumValues.length ? JSON.stringify(enumValues) : "",
      used_in_current_sync: USED_FIELDS.has(fieldId) ? "true" : "false",
      mapped_target_column: MAPPED[fieldId] || "",
      notes: "",
      sync_updated_at: syncedAt
    };
  });
}

export async function fetchFieldCatalogRaw(syncedAt: string): Promise<{
  rows: FieldCatalogRow[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const rows: FieldCatalogRow[] = [];

  const specs: Array<{ entity: string; method: string }> = [
    { entity: "lead", method: "crm.lead.fields" },
    { entity: "deal", method: "crm.deal.fields" },
    { entity: "contact", method: "crm.contact.fields" }
  ];

  for (const spec of specs) {
    try {
      const fields = await bitrixResult<Record<string, BitrixField>>(spec.method, {});
      rows.push(...normalizeFields(spec.entity, fields || {}, syncedAt));
    } catch (error) {
      warnings.push(`${spec.method} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  rows.sort((a, b) => `${a.entity_type}:${a.field_id}`.localeCompare(`${b.entity_type}:${b.field_id}`));
  return { rows, warnings };
}

export function fieldCatalogToSheetRows(rows: FieldCatalogRow[]): Array<Array<string | number>> {
  return rows.map((row) => FIELD_CATALOG_COLUMNS.map((column) => row[column] ?? ""));
}
