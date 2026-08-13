import type { BitrixSnapshotDeal, BitrixSnapshotLead } from "@/lib/bitrix/snapshot-store";

function countryName(value: string | null | undefined): string {
  const text = String(value || "").trim();
  if (!text || text === "Не указана" || text === "Не указано") return "";
  if (/^\d+$/.test(text)) return "";
  return text;
}

/**
 * SPA paid invoices do not store country. Fill from the linked lead
 * (leadId, then contactId) so unit economics / geography can group.
 */
export function attachDealCountries<T extends BitrixSnapshotDeal>(
  deals: T[],
  leads: BitrixSnapshotLead[]
): T[] {
  const byId = new Map<string, BitrixSnapshotLead>();
  const byContact = new Map<string, BitrixSnapshotLead[]>();
  for (const lead of leads) {
    if (!lead?.id) continue;
    if (!byId.has(lead.id)) byId.set(lead.id, lead);
    const contactId = lead.contactId?.trim();
    if (!contactId || !countryName(lead.country)) continue;
    const list = byContact.get(contactId) || [];
    list.push(lead);
    byContact.set(contactId, list);
  }
  for (const list of byContact.values()) {
    list.sort((a, b) => String(b.dateCreate || "").localeCompare(String(a.dateCreate || "")));
  }

  return deals.map((deal) => {
    const own = countryName(deal.country);
    if (own) return own === deal.country ? deal : { ...deal, country: own };
    const fromLead = deal.leadId ? countryName(byId.get(deal.leadId)?.country) : "";
    if (fromLead) return { ...deal, country: fromLead };
    const contactId = deal.contactId?.trim();
    const fromContact = contactId ? countryName(byContact.get(contactId)?.[0]?.country) : "";
    if (fromContact) return { ...deal, country: fromContact };
    return deal;
  });
}
