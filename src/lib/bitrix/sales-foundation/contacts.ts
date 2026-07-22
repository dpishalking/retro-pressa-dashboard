import { CONTACTS_RAW_COLUMNS } from "@/config/sales-foundation";
import { bitrixBatch, chunkIds } from "@/lib/bitrix/rest-client";
import {
  asString,
  multiValue,
  pickStableEmailHash,
  pickStablePhoneHash,
  resolveSfCustomerKey
} from "@/lib/bitrix/sales-foundation/customer-key";
import type { DealRawRow } from "@/lib/bitrix/sales-foundation/deals";
import type { LeadRawRow } from "@/lib/bitrix/sales-foundation/leads";

export type ContactRawRow = Record<(typeof CONTACTS_RAW_COLUMNS)[number], string>;

type BitrixContact = Record<string, unknown>;

/**
 * Load unique contacts referenced by leads/deals via crm.contact.get batch.
 * Phone/email strategy: normalize all values, sort lexicographically, use first as hash primary.
 * duplicate_group_key = phone_hash || email_hash (analytical signal only).
 */
export async function fetchContactsRaw(input: {
  leads: LeadRawRow[];
  deals: DealRawRow[];
  syncedAt: string;
}): Promise<{ rows: ContactRawRow[]; warnings: string[]; errorCode?: string }> {
  const warnings: string[] = [];
  const ids = [
    ...new Set([
      ...input.leads.map((row) => row.contact_id),
      ...input.deals.map((row) => row.contact_id)
    ].filter((id) => Boolean(id) && id !== "0"))
  ];

  if (!ids.length) {
    warnings.push("No CONTACT_ID values on leads/deals for contact pull");
    return { rows: [], warnings };
  }

  const byId = new Map<string, ContactRawRow>();

  try {
    for (const chunk of chunkIds(ids, 50)) {
      const cmd: Record<string, string> = {};
      chunk.forEach((id, index) => {
        cmd[`c${index}`] = `crm.contact.get?id=${encodeURIComponent(id)}`;
      });
      const result = await bitrixBatch<BitrixContact>(cmd);
      chunk.forEach((id, index) => {
        const contact = result[`c${index}`];
        if (!contact || typeof contact !== "object") {
          warnings.push(`contact ${id}: empty batch result`);
          return;
        }
        const contactId = asString(contact.ID) || id;
        const phoneMeta = pickStablePhoneHash(multiValue(contact.PHONE));
        const emailMeta = pickStableEmailHash(multiValue(contact.EMAIL));
        // Prefer contact:id; hashes stored separately for duplicate analytics.
        const identity = resolveSfCustomerKey({ contactId });
        const duplicate = phoneMeta.hash || emailMeta.hash || "";

        byId.set(contactId, {
          contact_id: contactId,
          created_at: asString(contact.DATE_CREATE),
          modified_at: asString(contact.DATE_MODIFY),
          assigned_by_id: asString(contact.ASSIGNED_BY_ID),
          phone_count: String(phoneMeta.count),
          email_count: String(emailMeta.count),
          has_phone: phoneMeta.present ? "true" : "false",
          has_email: emailMeta.present ? "true" : "false",
          phone_hash: phoneMeta.hash,
          email_hash: emailMeta.hash,
          country_raw: asString(contact.UF_CRM_COUNTRY) || asString(contact.ADDRESS_COUNTRY),
          language_raw: asString(contact.UF_CRM_LANGUAGE),
          customer_key: identity.customer_key,
          customer_key_type: identity.customer_key_type,
          duplicate_group_key: duplicate,
          raw_updated_at: asString(contact.DATE_MODIFY) || asString(contact.DATE_CREATE),
          sync_updated_at: input.syncedAt
        });
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`crm.contact.get failed: ${message}`);
    return { rows: [], warnings, errorCode: "BITRIX_CONTACT_DENIED" };
  }

  return {
    rows: [...byId.values()].sort((a, b) => a.contact_id.localeCompare(b.contact_id, "en", { numeric: true })),
    warnings
  };
}

export function contactsToSheetRows(rows: ContactRawRow[]): Array<Array<string | number>> {
  return rows.map((row) => CONTACTS_RAW_COLUMNS.map((column) => row[column] ?? ""));
}
