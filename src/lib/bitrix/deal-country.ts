import type { BitrixSnapshotDeal, BitrixSnapshotLead } from "@/lib/bitrix/snapshot-store";

function countryName(value: string | null | undefined): string {
  const text = String(value || "").trim();
  if (!text || text === "Не указана" || text === "Не указано") return "";
  if (/^\d+$/.test(text)) return "";
  return text;
}

function usableId(value: string | null | undefined): string {
  const text = String(value || "").trim();
  if (!text || text === "0") return "";
  return text;
}

function recencyKey(row: { dateCreate?: string | null; closeDate?: string | null; paymentDate?: string | null; invoiceDate?: string | null }): string {
  return String(row.paymentDate || row.closeDate || row.invoiceDate || row.dateCreate || "");
}

/**
 * SPA paid invoices do not store country. Fill from the linked lead
 * (leadId, then contactId) and from CRM deals that already have a named country
 * so unit economics / geography can group without waiting for a new sync.
 */
export function attachDealCountries<T extends BitrixSnapshotDeal>(
  deals: T[],
  leads: BitrixSnapshotLead[],
  sourceDeals: BitrixSnapshotDeal[] = []
): T[] {
  const leadById = new Map<string, BitrixSnapshotLead>();
  const leadsByContact = new Map<string, BitrixSnapshotLead[]>();
  for (const lead of leads) {
    if (!lead?.id) continue;
    if (!leadById.has(lead.id)) leadById.set(lead.id, lead);
    const contactId = usableId(lead.contactId);
    if (!contactId || !countryName(lead.country)) continue;
    const list = leadsByContact.get(contactId) || [];
    list.push(lead);
    leadsByContact.set(contactId, list);
  }
  for (const list of leadsByContact.values()) {
    list.sort((a, b) => recencyKey(b).localeCompare(recencyKey(a)));
  }

  const dealById = new Map<string, string>();
  const dealByLeadId = new Map<string, string>();
  const dealsByContact = new Map<string, BitrixSnapshotDeal[]>();
  for (const deal of sourceDeals) {
    const country = countryName(deal.country);
    if (!country) continue;
    const id = usableId(deal.id);
    if (id && !dealById.has(id)) dealById.set(id, country);
    const leadId = usableId(deal.leadId);
    if (leadId && !dealByLeadId.has(leadId)) dealByLeadId.set(leadId, country);
    const contactId = usableId(deal.contactId);
    if (!contactId) continue;
    const list = dealsByContact.get(contactId) || [];
    list.push(deal);
    dealsByContact.set(contactId, list);
  }
  for (const list of dealsByContact.values()) {
    list.sort((a, b) => recencyKey(b).localeCompare(recencyKey(a)));
  }

  return deals.map((deal) => {
    const own = countryName(deal.country);
    if (own) return own === deal.country ? deal : { ...deal, country: own };

    const parentId = usableId(deal.parentDealId);
    const fromParent = parentId ? dealById.get(parentId) || "" : "";
    if (fromParent) return { ...deal, country: fromParent };

    const leadId = usableId(deal.leadId);
    const fromLead = leadId ? countryName(leadById.get(leadId)?.country) : "";
    if (fromLead) return { ...deal, country: fromLead };
    const fromLeadDeal = leadId ? dealByLeadId.get(leadId) || "" : "";
    if (fromLeadDeal) return { ...deal, country: fromLeadDeal };

    const contactId = usableId(deal.contactId);
    const fromContactLead = contactId ? countryName(leadsByContact.get(contactId)?.[0]?.country) : "";
    if (fromContactLead) return { ...deal, country: fromContactLead };
    const fromContactDeal = contactId ? countryName(dealsByContact.get(contactId)?.[0]?.country) : "";
    if (fromContactDeal) return { ...deal, country: fromContactDeal };

    return { ...deal, country: "" };
  });
}
