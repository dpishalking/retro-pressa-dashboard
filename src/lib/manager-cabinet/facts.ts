import { dealCashAmount } from "@/lib/analytics-os/aggregate-from-bitrix";
import {
  BITRIX_QUALIFIED_LEAD_STATUS_ID,
  EXCLUDED_LEAD_STATUS_IDS
} from "@/lib/bitrix/metric-definitions";
import type { BitrixSnapshot, BitrixSnapshotDeal, BitrixSnapshotLead } from "@/lib/bitrix/snapshot-store";
import type { CabinetDealRow, ManagerCabinetFacts } from "@/lib/manager-cabinet/types";

/** Extra statuses dropped from payroll leads (transcription: junk/spam-like). */
const CABINET_EXCLUDED_LEAD_STATUS = new Set<string>([...EXCLUDED_LEAD_STATUS_IDS, "JUNK"]);

function isoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function inRange(iso: string | null, start: string, end: string): boolean {
  return Boolean(iso && iso >= start && iso <= end);
}

function isTakenLead(lead: BitrixSnapshotLead): boolean {
  const status = lead.statusId || "";
  return !CABINET_EXCLUDED_LEAD_STATUS.has(status);
}

function paidDate(deal: BitrixSnapshotDeal): string | null {
  return isoDay(deal.paymentDate) || isoDay(deal.closeDate) || isoDay(deal.invoiceDate);
}

function invoiceDate(deal: BitrixSnapshotDeal): string | null {
  return isoDay(deal.invoiceDate) || isoDay(deal.closeDate);
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function aggregateManagerCabinetFacts(input: {
  snapshot: BitrixSnapshot;
  bitrixUserId: string;
  managerName: string;
  start: string;
  end: string;
}): ManagerCabinetFacts {
  const leads = input.snapshot.leads.filter(
    (lead) => lead.assignedById === input.bitrixUserId && inRange(isoDay(lead.dateCreate), input.start, input.end) && isTakenLead(lead)
  );
  const qualifiedLeads = leads.filter((lead) => lead.statusId === BITRIX_QUALIFIED_LEAD_STATUS_ID).length;
  const invoices = input.snapshot.deals.filter(
    (deal) => deal.assignedById === input.bitrixUserId && inRange(invoiceDate(deal), input.start, input.end)
  ).length;
  const paid = input.snapshot.paidDeals.filter(
    (deal) => deal.assignedById === input.bitrixUserId && inRange(paidDate(deal), input.start, input.end)
  );
  const revenueEur = round2(paid.reduce((sum, deal) => sum + dealCashAmount(deal), 0));
  const payments = paid.length;
  const deals: CabinetDealRow[] = paid
    .map((deal) => ({
      id: deal.id,
      title: deal.title || `Счёт ${deal.id}`,
      date: paidDate(deal),
      amountEur: round2(dealCashAmount(deal))
    }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return {
    bitrixUserId: input.bitrixUserId,
    managerName: input.managerName,
    leads: leads.length,
    qualifiedLeads,
    invoices,
    payments,
    revenueEur,
    avgCheckEur: payments > 0 ? round2(revenueEur / payments) : null,
    invoiceCrPct: leads.length > 0 ? invoices / leads.length : null,
    paymentCrPct: leads.length > 0 ? payments / leads.length : null,
    qualifiedCrPct: leads.length > 0 ? qualifiedLeads / leads.length : null,
    deals
  };
}

export function mergeCabinetFacts(
  rows: ManagerCabinetFacts[],
  bitrixUserId: string,
  managerName: string
): ManagerCabinetFacts {
  const deals = new Map<string, CabinetDealRow>();
  let leads = 0;
  let qualifiedLeads = 0;
  let invoices = 0;
  let payments = 0;
  let revenueEur = 0;
  for (const row of rows) {
    leads += row.leads;
    qualifiedLeads += row.qualifiedLeads;
    invoices += row.invoices;
    payments += row.payments;
    revenueEur += row.revenueEur;
    for (const deal of row.deals) deals.set(deal.id, deal);
  }
  revenueEur = round2(revenueEur);
  const dealRows = [...deals.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return {
    bitrixUserId,
    managerName,
    leads,
    qualifiedLeads,
    invoices,
    payments,
    revenueEur,
    avgCheckEur: payments > 0 ? round2(revenueEur / payments) : null,
    invoiceCrPct: leads > 0 ? invoices / leads : null,
    paymentCrPct: leads > 0 ? payments / leads : null,
    qualifiedCrPct: leads > 0 ? qualifiedLeads / leads : null,
    deals: dealRows
  };
}
