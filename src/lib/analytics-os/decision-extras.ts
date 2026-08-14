/**
 * Easy decision analytics: delivery-net, pricing vs list, unique leads,
 * pipeline age, manager benchmark, opportunity gaps.
 */

import type { BitrixSnapshotDeal, BitrixSnapshotLead } from "@/lib/bitrix/snapshot-store";
import { paidInvoiceAmount } from "@/lib/bitrix/paid-revenue";
import type { ProductHubMarginCatalog } from "@/lib/product-hub/sku-margin-catalog";
import { resolveLineCogs } from "@/lib/product-hub/sku-margin-catalog";

const SERVICE_PHONE_TAILS = ["28373939"];

export function normalizePhone(value: unknown): string {
  const d = String(value || "").replace(/\D/g, "");
  if (!d) return "";
  if (SERVICE_PHONE_TAILS.some((tail) => d === tail || d.endsWith(tail))) return "";
  return d.length >= 10 ? d.slice(-10) : d;
}

export function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export type LeadIdentity = {
  id: string;
  phones?: string[];
  emails?: string[];
  contactId?: string | null;
};

export function leadIdentityKeys(lead: LeadIdentity): string[] {
  const keys: string[] = [];
  for (const phone of lead.phones || []) {
    const n = normalizePhone(phone);
    if (n) keys.push(`p:${n}`);
  }
  for (const email of lead.emails || []) {
    const n = normalizeEmail(email);
    if (n) keys.push(`e:${n}`);
  }
  if (lead.contactId) keys.push(`c:${lead.contactId}`);
  if (!keys.length) keys.push(`id:${lead.id}`);
  return keys;
}

/** Unique leads in cohort: first lead per phone/email/contact wins. */
export function countUniqueLeads(leads: Array<LeadIdentity | BitrixSnapshotLead>): {
  created: number;
  unique: number;
  duplicateApprox: number;
  coverageWithIdentity: number;
} {
  return countUniqueLeadsWithHistory(leads, []);
}

/**
 * Unique new leads in `periodLeads` after seeding identity from `historyLeads`
 * (leads created before the period). Matches ops rule from bitrix-leads-day.
 */
export function countUniqueLeadsWithHistory(
  periodLeads: Array<LeadIdentity | BitrixSnapshotLead>,
  historyLeads: Array<LeadIdentity | BitrixSnapshotLead>
): {
  created: number;
  unique: number;
  duplicateApprox: number;
  coverageWithIdentity: number;
  historyDuplicates: number;
} {
  const seen = new Set<string>();
  for (const lead of historyLeads) {
    for (const key of leadIdentityKeys(lead)) {
      if (!key.startsWith("id:")) seen.add(key);
    }
  }

  let unique = 0;
  let withIdentity = 0;
  let historyDuplicates = 0;
  for (const lead of periodLeads) {
    const keys = leadIdentityKeys(lead);
    const hasReal = keys.some((k) => !k.startsWith("id:"));
    if (hasReal) withIdentity += 1;
    const hitHistory = hasReal && keys.some((k) => !k.startsWith("id:") && seen.has(k));
    if (hitHistory) historyDuplicates += 1;
    if (keys.some((k) => seen.has(k))) continue;
    for (const k of keys) seen.add(k);
    unique += 1;
  }
  return {
    created: periodLeads.length,
    unique,
    duplicateApprox: Math.max(0, periodLeads.length - unique),
    coverageWithIdentity: periodLeads.length ? withIdentity / periodLeads.length : 0,
    historyDuplicates
  };
}

/** Company rule: delivery is 5.5% of cash revenue (SPA invoices have no delivery UF). */
export const IMPLIED_DELIVERY_RATE = 0.055;

export function sumDelivery(paidDeals: BitrixSnapshotDeal[]): {
  cash: number;
  delivery: number;
  productRevenue: number;
  dealsWithDelivery: number;
  dealsWithField: number;
  deliverySharePct: number | null;
  fieldCoveragePct: number | null;
} {
  let cash = 0;
  let dealsWithDelivery = 0;
  let dealsWithField = 0;
  for (const deal of paidDeals) {
    cash += paidInvoiceAmount(deal.invoiceAmount, deal.opportunity);
    if (deal.deliveryPrice == null) continue;
    dealsWithField += 1;
    if ((Number(deal.deliveryPrice) || 0) > 0) dealsWithDelivery += 1;
  }
  const delivery = Math.round(cash * IMPLIED_DELIVERY_RATE * 100) / 100;
  return {
    cash,
    delivery,
    productRevenue: Math.max(0, Math.round((cash - delivery) * 100) / 100),
    dealsWithDelivery,
    dealsWithField,
    deliverySharePct: cash > 0 ? IMPLIED_DELIVERY_RATE : null,
    fieldCoveragePct: paidDeals.length ? dealsWithField / paidDeals.length : null
  };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export type PricingCompareRow = {
  productName: string;
  orders: number;
  listPrice: number | null;
  soldAvg: number | null;
  soldMedian: number | null;
  deltaPct: number | null;
};

export function compareListVsSold(
  paidDeals: BitrixSnapshotDeal[],
  catalog: ProductHubMarginCatalog | null
): PricingCompareRow[] {
  if (!catalog) return [];
  const buckets = new Map<string, { list: number | null; prices: number[] }>();

  for (const deal of paidDeals) {
    const lines = deal.products || [];
    if (!lines.length) continue;
    const hasLinePrice = lines.some((l) => Number(l.price) > 0);
    if (hasLinePrice) {
      for (const line of lines) {
        const sold = Number(line.price) || 0;
        if (sold <= 0) continue;
        const { entry } = resolveLineCogs(line, catalog);
        const list = entry?.retailModelEur ?? null;
        const key = entry?.giftType || entry?.name || line.productName || "—";
        const row = buckets.get(key) || { list, prices: [] };
        if (list != null) row.list = list;
        row.prices.push(sold);
        buckets.set(key, row);
      }
    } else if (lines.length === 1) {
      const delivery = Number(deal.deliveryPrice) || 0;
      const sold = Math.max(0, (Number(deal.opportunity) || 0) - delivery);
      if (sold <= 0) continue;
      const { entry } = resolveLineCogs(lines[0], catalog);
      const list = entry?.retailModelEur ?? null;
      const key = entry?.giftType || entry?.name || lines[0].productName || "—";
      const row = buckets.get(key) || { list, prices: [] };
      if (list != null) row.list = list;
      row.prices.push(sold);
      buckets.set(key, row);
    }
  }

  return [...buckets.entries()]
    .map(([productName, row]) => {
      const soldAvg = avg(row.prices);
      const soldMedian = median(row.prices);
      const deltaPct =
        row.list && soldAvg != null && row.list > 0 ? soldAvg / row.list - 1 : null;
      return {
        productName,
        orders: row.prices.length,
        listPrice: row.list,
        soldAvg: soldAvg == null ? null : Math.round(soldAvg * 10) / 10,
        soldMedian: soldMedian == null ? null : Math.round(soldMedian * 10) / 10,
        deltaPct: deltaPct == null ? null : Math.round(deltaPct * 1000) / 10
      };
    })
    .sort((a, b) => b.orders - a.orders);
}

export type PipelineAgeBucket = {
  id: string;
  label: string;
  deals: number;
  amount: number;
};

export type PipelineStageRow = {
  stageId: string;
  stageName: string;
  deals: number;
  amount: number;
};

export function pipelineAgeAnalysis(
  openDeals: BitrixSnapshotDeal[],
  asOf = new Date()
): {
  buckets: PipelineAgeBucket[];
  stuckOver7d: { deals: number; amount: number };
  totalAmount: number;
  byStage: PipelineStageRow[];
  activityCoveragePct: number | null;
} {
  const defs = [
    { id: "0-1", label: "0–1 дн. без касания", min: 0, max: 2 },
    { id: "2-3", label: "2–3 дн.", min: 2, max: 4 },
    { id: "4-7", label: "4–7 дн.", min: 4, max: 8 },
    { id: "8-14", label: "8–14 дн.", min: 8, max: 15 },
    { id: "15-30", label: "15–30 дн.", min: 15, max: 31 },
    { id: "30+", label: "30+ дн.", min: 31, max: Number.POSITIVE_INFINITY }
  ];
  const buckets = defs.map((d) => ({ id: d.id, label: d.label, deals: 0, amount: 0 }));
  const byStageMap = new Map<string, PipelineStageRow>();
  let stuckDeals = 0;
  let stuckAmount = 0;
  let totalAmount = 0;
  let withActivity = 0;
  const now = asOf.getTime();

  for (const deal of openDeals) {
    const anchor = deal.lastActivityAt || deal.dateCreate;
    if (!anchor) continue;
    if (deal.lastActivityAt) withActivity += 1;
    const idleDays = Math.max(0, Math.floor((now - new Date(anchor).getTime()) / 86_400_000));
    const amount = Number(deal.opportunity) || 0;
    totalAmount += amount;
    const bucket = defs.find((d) => idleDays >= d.min && idleDays < d.max);
    if (bucket) {
      const row = buckets.find((b) => b.id === bucket.id)!;
      row.deals += 1;
      row.amount += amount;
    }
    if (idleDays >= 8) {
      stuckDeals += 1;
      stuckAmount += amount;
    }
    const stageId = deal.stageId || "unknown";
    const stageName = deal.stageName || stageId;
    const stageRow = byStageMap.get(stageId) || {
      stageId,
      stageName,
      deals: 0,
      amount: 0
    };
    stageRow.deals += 1;
    stageRow.amount += amount;
    if (deal.stageName) stageRow.stageName = deal.stageName;
    byStageMap.set(stageId, stageRow);
  }

  return {
    buckets: buckets.map((b) => ({ ...b, amount: Math.round(b.amount * 100) / 100 })),
    stuckOver7d: { deals: stuckDeals, amount: Math.round(stuckAmount * 100) / 100 },
    totalAmount: Math.round(totalAmount * 100) / 100,
    byStage: [...byStageMap.values()]
      .map((r) => ({ ...r, amount: Math.round(r.amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount),
    activityCoveragePct: openDeals.length ? withActivity / openDeals.length : null
  };
}

export type ManagerBenchmarkRow = {
  managerId: string;
  managerName: string;
  leads: number;
  paid: number;
  revenue: number;
  cr: number | null;
  revenuePerLead: number | null;
  aov: number | null;
  isTop20: boolean;
};

export function managerBenchmark(
  leads: BitrixSnapshotLead[],
  paidDeals: BitrixSnapshotDeal[]
): {
  rows: ManagerBenchmarkRow[];
  medianCr: number | null;
  p80Cr: number | null;
  medianRevenuePerLead: number | null;
  p80RevenuePerLead: number | null;
} {
  const byManager = new Map<string, ManagerBenchmarkRow>();
  for (const lead of leads) {
    const id = lead.assignedById || "unknown";
    const row = byManager.get(id) || {
      managerId: id,
      managerName: lead.managerName || id,
      leads: 0,
      paid: 0,
      revenue: 0,
      cr: null,
      revenuePerLead: null,
      aov: null,
      isTop20: false
    };
    row.leads += 1;
    byManager.set(id, row);
  }
  for (const deal of paidDeals) {
    const id = deal.assignedById || "unknown";
    const row = byManager.get(id) || {
      managerId: id,
      managerName: deal.managerName || id,
      leads: 0,
      paid: 0,
      revenue: 0,
      cr: null,
      revenuePerLead: null,
      aov: null,
      isTop20: false
    };
    row.paid += 1;
    row.revenue += paidInvoiceAmount(deal.invoiceAmount, deal.opportunity);
    if (!row.managerName) row.managerName = deal.managerName || id;
    byManager.set(id, row);
  }

  const rows = [...byManager.values()]
    .filter((r) => r.leads >= 10)
    .map((r) => ({
      ...r,
      revenue: Math.round(r.revenue * 100) / 100,
      cr: r.leads ? r.paid / r.leads : null,
      revenuePerLead: r.leads ? r.revenue / r.leads : null,
      aov: r.paid ? r.revenue / r.paid : null
    }))
    .sort((a, b) => (b.revenuePerLead || 0) - (a.revenuePerLead || 0));

  const topN = Math.max(1, Math.ceil(rows.length * 0.2));
  rows.forEach((r, i) => {
    r.isTop20 = i < topN;
  });

  const crs = rows.map((r) => r.cr!).filter((x) => x != null);
  const rpls = rows.map((r) => r.revenuePerLead!).filter((x) => x != null);
  const sortedCr = [...crs].sort((a, b) => a - b);
  const sortedRpl = [...rpls].sort((a, b) => a - b);
  const p80 = (arr: number[]) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.8))] : null);

  return {
    rows,
    medianCr: median(crs),
    p80Cr: p80(sortedCr),
    medianRevenuePerLead: median(rpls),
    p80RevenuePerLead: p80(sortedRpl)
  };
}

export type OpportunityGap = {
  id: string;
  title: string;
  body: string;
  euroImpact: number | null;
};

export function opportunityGaps(input: {
  countries: Array<{ country: string; leads: number | null; leadConversionRate: number | null; aov: number }>;
  managers: ManagerBenchmarkRow[];
  medianCountryCr: number | null;
  medianManagerRpl: number | null;
}): OpportunityGap[] {
  const gaps: OpportunityGap[] = [];
  const countryMedian =
    input.medianCountryCr ??
    median(
      input.countries
        .filter((c) => (c.leads || 0) >= 30 && c.leadConversionRate != null)
        .map((c) => c.leadConversionRate as number)
    );

  if (countryMedian != null) {
    for (const c of input.countries) {
      if ((c.leads || 0) < 40 || c.leadConversionRate == null) continue;
      const gapPp = countryMedian - c.leadConversionRate;
      if (gapPp < 0.02) continue;
      const euro = (c.leads || 0) * gapPp * (c.aov || 0);
      if (euro < 200) continue;
      gaps.push({
        id: `country-${c.country}`,
        title: `${c.country}: CR ниже медианы`,
        body: `CR ${(c.leadConversionRate * 100).toFixed(1)}% vs медиана ${(countryMedian * 100).toFixed(1)}% · ${c.leads} лидов · AOV €${Math.round(c.aov)}`,
        euroImpact: Math.round(euro)
      });
    }
  }

  if (input.medianManagerRpl != null) {
    for (const m of input.managers) {
      if (m.leads < 40 || m.revenuePerLead == null) continue;
      const gap = input.medianManagerRpl - m.revenuePerLead;
      if (gap < 2) continue;
      const euro = m.leads * gap;
      if (euro < 200) continue;
      gaps.push({
        id: `manager-${m.managerId}`,
        title: `${m.managerName}: €/лид ниже медианы`,
        body: `€${m.revenuePerLead.toFixed(1)}/лид vs медиана €${input.medianManagerRpl.toFixed(1)} · ${m.leads} лидов`,
        euroImpact: Math.round(euro)
      });
    }
  }

  return gaps.sort((a, b) => (b.euroImpact || 0) - (a.euroImpact || 0)).slice(0, 8);
}
