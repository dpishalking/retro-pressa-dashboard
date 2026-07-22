import { LEADS_RAW_COLUMNS, SELECT_LEAD, SF_FIELDS } from "@/config/sales-foundation";
import { bitrixListAll } from "@/lib/bitrix/rest-client";
import {
  asString,
  loadUserNames,
  multiValue,
  periodToRange,
  resolveSfCustomerKey
} from "@/lib/bitrix/sales-foundation/customer-key";

export type LeadRawRow = Record<(typeof LEADS_RAW_COLUMNS)[number], string>;

type BitrixLead = Record<string, unknown>;

export async function fetchLeadsRaw(periods: string[], syncedAt: string): Promise<{ rows: LeadRawRow[]; warnings: string[] }> {
  const warnings: string[] = [];
  const byId = new Map<string, LeadRawRow>();

  for (const period of periods) {
    const { startIso, endIso } = periodToRange(period);
    const leads = await bitrixListAll<BitrixLead>("crm.lead.list", {
      filter: {
        ">=DATE_CREATE": startIso.slice(0, 19),
        "<=DATE_CREATE": endIso.slice(0, 19)
      },
      select: [...SELECT_LEAD],
      order: { DATE_CREATE: "ASC" }
    });

    const userNames = await loadUserNames(leads.map((lead) => asString(lead.ASSIGNED_BY_ID)));

    for (const lead of leads) {
      const leadId = asString(lead.ID);
      if (!leadId) continue;
      const phones = multiValue(lead.PHONE);
      const emails = multiValue(lead.EMAIL);
      const identity = resolveSfCustomerKey({
        contactId: asString(lead.CONTACT_ID),
        phone: phones[0],
        email: emails[0],
        leadId
      });

      byId.set(leadId, {
        lead_id: leadId,
        created_at: asString(lead.DATE_CREATE),
        modified_at: asString(lead.DATE_MODIFY),
        status_id: asString(lead.STATUS_ID),
        status_semantic: asString(lead.STATUS_SEMANTIC_ID),
        source_id: asString(lead.SOURCE_ID),
        source_description: asString(lead.SOURCE_DESCRIPTION),
        assigned_by_id: asString(lead.ASSIGNED_BY_ID),
        assigned_by_name: userNames.get(asString(lead.ASSIGNED_BY_ID)) || "",
        company_id: asString(lead.COMPANY_ID),
        contact_id: asString(lead.CONTACT_ID),
        deal_id: "",
        utm_source: asString(lead.UTM_SOURCE),
        utm_medium: asString(lead.UTM_MEDIUM),
        utm_campaign: asString(lead.UTM_CAMPAIGN),
        utm_content: asString(lead.UTM_CONTENT),
        utm_term: asString(lead.UTM_TERM),
        country_raw: asString(lead[SF_FIELDS.leadCountry]),
        country_id: "",
        language_raw: "",
        product_interest_raw: "",
        form_name: asString(lead.UF_CRM_FORMNAME),
        phone_present: phones.length > 0 || lead.HAS_PHONE === "Y" ? "true" : "false",
        email_present: emails.length > 0 || lead.HAS_EMAIL === "Y" ? "true" : "false",
        customer_key: identity.customer_key,
        customer_key_type: identity.customer_key_type,
        is_converted: "",
        converted_at: "",
        is_lost: asString(lead.STATUS_SEMANTIC_ID) === "F" ? "true" : "false",
        closed_at: "",
        raw_updated_at: asString(lead.DATE_MODIFY) || asString(lead.DATE_CREATE),
        sync_updated_at: syncedAt
      });
    }
  }

  if (!byId.size) warnings.push("No leads returned for requested periods");
  return { rows: [...byId.values()].sort((a, b) => a.lead_id.localeCompare(b.lead_id, "en", { numeric: true })), warnings };
}

export function leadsToSheetRows(rows: LeadRawRow[]): Array<Array<string | number>> {
  return rows.map((row) => LEADS_RAW_COLUMNS.map((column) => row[column] ?? ""));
}
