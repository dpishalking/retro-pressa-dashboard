import type { BitrixSnapshotDeal, BitrixSnapshotLead } from "@/lib/bitrix/snapshot-store";
import { paidInvoiceAmount } from "@/lib/bitrix/paid-revenue";
import { classifyAcquisitionChannel, resolveGiftTypeLabel } from "./cohort-dims";
import { LEAD_MATCH_LOOKBACK_DAYS } from "./config";
import { daysFromHours, hoursBetween } from "./math";
import type { JoinConfidence, JoinMethod, SalesCycleFact } from "./types";

export type CycleLead = {
  id: string;
  dateCreate: string;
  contactId: string | null;
  phones?: string[];
  emails?: string[];
  sourceId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  country: string | null;
  assignedById: string | null;
  managerName: string | null;
};

export type CyclePaidDeal = {
  id: string;
  leadId: string | null;
  contactId: string | null;
  title: string | null;
  dateCreate: string;
  closeDate: string;
  opportunity: number;
  currencyId: string | null;
  assignedById: string;
  managerName: string;
  country: string;
  sourceId: string | null;
  utmCampaign: string | null;
  productId: string | null;
  productName: string | null;
  giftTypes: string[];
};

function parseTs(iso: string): number {
  return new Date(iso).getTime();
}

export function leadFromSnapshot(lead: BitrixSnapshotLead): CycleLead | null {
  if (!lead.dateCreate) return null;
  return {
    id: String(lead.id),
    dateCreate: lead.dateCreate,
    contactId: lead.contactId ?? null,
    phones: lead.phones || [],
    emails: lead.emails || [],
    sourceId: lead.sourceId,
    utmSource: lead.utmSource,
    utmMedium: lead.utmMedium,
    utmCampaign: lead.utmCampaign,
    country: lead.country || null,
    assignedById: lead.assignedById,
    managerName: lead.managerName
  };
}

export function paidDealFromSnapshot(deal: BitrixSnapshotDeal): CyclePaidDeal | null {
  if (!deal.dateCreate || !deal.closeDate) return null;
  const primary = deal.products?.[0];
  return {
    id: String(deal.id),
    leadId: deal.leadId ? String(deal.leadId) : null,
    contactId: deal.contactId ? String(deal.contactId) : null,
    title: deal.title ?? null,
    dateCreate: deal.dateCreate,
    closeDate: deal.closeDate,
    opportunity: Number(deal.opportunity) || 0,
    currencyId: deal.currencyId,
    assignedById: deal.assignedById,
    managerName: deal.managerName,
    country: deal.country || "",
    sourceId: deal.sourceId,
    utmCampaign: deal.utmCampaign,
    productId: primary?.productId || null,
    productName: primary?.productName || null,
    giftTypes: deal.giftTypes || []
  };
}

function pickLead(
  candidates: CycleLead[],
  paidAt: string,
  dealCreatedAt: string,
  lookbackDays: number
): CycleLead | null {
  const paidTs = parseTs(paidAt);
  const dealTs = parseTs(dealCreatedAt);
  const minTs = paidTs - lookbackDays * 86_400_000;
  const eligible = candidates
    .filter((lead) => {
      const created = parseTs(lead.dateCreate);
      return created <= paidTs && created <= dealTs && created >= minTs;
    })
    .sort((a, b) => parseTs(b.dateCreate) - parseTs(a.dateCreate));
  return eligible[0] ?? null;
}

export function resolveLeadForDeal(
  deal: CyclePaidDeal,
  leadsById: Map<string, CycleLead>,
  leadsByContact: Map<string, CycleLead[]>,
  lookbackDays = LEAD_MATCH_LOOKBACK_DAYS
): { lead: CycleLead | null; joinMethod: JoinMethod; joinConfidence: JoinConfidence } {
  if (deal.leadId) {
    const direct = leadsById.get(deal.leadId);
    if (direct) {
      const created = parseTs(direct.dateCreate);
      const paid = parseTs(deal.closeDate);
      if (created <= paid) {
        return { lead: direct, joinMethod: "lead_id", joinConfidence: "high" };
      }
    }
  }

  if (deal.contactId) {
    const byContact = leadsByContact.get(deal.contactId) || [];
    const picked = pickLead(byContact, deal.closeDate, deal.dateCreate, lookbackDays);
    if (picked) {
      return { lead: picked, joinMethod: "contact_id", joinConfidence: "medium" };
    }
  }

  return { lead: null, joinMethod: "deal_only", joinConfidence: "unmatched" };
}

export function buildSalesCycleFact(deal: CyclePaidDeal, match: ReturnType<typeof resolveLeadForDeal>): SalesCycleFact {
  const dealHours = hoursBetween(deal.dateCreate, deal.closeDate);
  const lead = match.lead;
  const leadHours =
    lead && lead.dateCreate ? hoursBetween(lead.dateCreate, deal.closeDate) : null;
  // Invalid: payment before lead
  const safeLeadHours = leadHours != null && leadHours >= 0 ? leadHours : null;

  const channel = classifyAcquisitionChannel({
    sourceId: lead?.sourceId ?? deal.sourceId,
    utmSource: lead?.utmSource ?? null,
    utmMedium: lead?.utmMedium ?? null
  });
  const giftType = resolveGiftTypeLabel({
    giftTypes: deal.giftTypes,
    productName: deal.productName,
    title: deal.title
  });

  return {
    leadId: lead?.id ?? deal.leadId,
    dealId: deal.id,
    customerKey: deal.contactId,
    leadCreatedAt: lead?.dateCreate ?? null,
    dealCreatedAt: deal.dateCreate,
    paidAt: deal.paymentDate || deal.closeDate,
    leadToWonHours: safeLeadHours,
    leadToWonDays: safeLeadHours != null ? daysFromHours(safeLeadHours) : null,
    dealToWonHours: dealHours,
    dealToWonDays: daysFromHours(dealHours),
    revenue: paidInvoiceAmount(deal.invoiceAmount, deal.opportunity),
    currency: deal.currencyId,
    managerId: deal.assignedById,
    managerName: deal.managerName,
    country: deal.country || lead?.country || null,
    productId: deal.productId,
    productName: deal.productName,
    giftType,
    sourceId: lead?.sourceId ?? deal.sourceId,
    utmSource: lead?.utmSource ?? null,
    utmMedium: lead?.utmMedium ?? null,
    utmCampaign: lead?.utmCampaign ?? deal.utmCampaign,
    channelKey: channel.key,
    channelLabel: channel.label,
    trafficKind: channel.trafficKind,
    customerKind: "unknown",
    joinMethod: match.joinMethod,
    joinConfidence: match.joinConfidence
  };
}

/**
 * Build contact → leads index from leads with contactId and from deals that carry both ids.
 */
export function indexLeadsForJoin(
  leads: CycleLead[],
  deals: CyclePaidDeal[]
): { leadsById: Map<string, CycleLead>; leadsByContact: Map<string, CycleLead[]> } {
  const leadsById = new Map<string, CycleLead>();
  for (const lead of leads) leadsById.set(lead.id, lead);

  const leadsByContact = new Map<string, CycleLead[]>();
  const push = (contactId: string, lead: CycleLead) => {
    const list = leadsByContact.get(contactId) || [];
    if (!list.some((item) => item.id === lead.id)) list.push(lead);
    leadsByContact.set(contactId, list);
  };

  for (const lead of leads) {
    if (lead.contactId) push(lead.contactId, lead);
  }

  // Infer contact→lead from deals that already have lead_id (boosts medium join without lead.contactId in old snapshots)
  for (const deal of deals) {
    if (!deal.contactId || !deal.leadId) continue;
    const lead = leadsById.get(deal.leadId);
    if (lead) push(deal.contactId, lead);
  }

  return { leadsById, leadsByContact };
}

/** First paidAt per contact — used to mark new vs returning at lead entry. */
export function annotateCustomerKinds(facts: SalesCycleFact[]): SalesCycleFact[] {
  const firstPaidByContact = new Map<string, string>();
  for (const fact of facts) {
    if (!fact.customerKey || !fact.paidAt) continue;
    const prev = firstPaidByContact.get(fact.customerKey);
    if (!prev || fact.paidAt < prev) firstPaidByContact.set(fact.customerKey, fact.paidAt);
  }

  return facts.map((fact) => {
    if (!fact.customerKey) return { ...fact, customerKind: "unknown" as const };
    const firstPaid = firstPaidByContact.get(fact.customerKey);
    if (!firstPaid) return { ...fact, customerKind: "unknown" as const };
    // Returning = contact already had an earlier payment than this one.
    const customerKind = firstPaid < fact.paidAt ? ("returning" as const) : ("new" as const);
    return { ...fact, customerKind };
  });
}

export function buildFactsFromCorpus(input: {
  leads: CycleLead[];
  paidDeals: CyclePaidDeal[];
  lookbackDays?: number;
}): SalesCycleFact[] {
  const { leadsById, leadsByContact } = indexLeadsForJoin(input.leads, input.paidDeals);
  const facts: SalesCycleFact[] = [];
  for (const deal of input.paidDeals) {
    const match = resolveLeadForDeal(deal, leadsById, leadsByContact, input.lookbackDays);
    facts.push(buildSalesCycleFact(deal, match));
  }
  return annotateCustomerKinds(facts);
}
