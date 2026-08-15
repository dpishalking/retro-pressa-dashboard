import {
  classifyAcquisitionChannel,
  customerKindLabel,
  trafficKindLabel,
  type CustomerKind,
  type TrafficKind
} from "@/lib/analytics-os/sales-cycle/cohort-dims";
import { cohortKeyForGrain, median, monthKeyInTz, roundDays } from "@/lib/analytics-os/sales-cycle/math";
import { bitrixSourceName } from "@/lib/traffic-os/taxonomy";
import type { CohortGrain, SalesCycleFact } from "@/lib/analytics-os/sales-cycle/types";
import { getSliceDimension } from "./registry";
import { ANALYTICS_SAMPLE_THRESHOLDS, isLowSample } from "./thresholds";
import type {
  SliceDimensionId,
  SliceFilters,
  SliceKpis,
  SliceMetricId,
  SliceReport,
  SliceRow,
  SliceRowStatus,
  SliceTrendPoint
} from "./types";

export type SliceLead = {
  id: string;
  dateCreate: string;
  sourceId: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  country: string | null;
  assignedById: string | null;
  contactId?: string | null;
};

type EnrichedLead = SliceLead & {
  channelKey: string;
  channelLabel: string;
  trafficKind: TrafficKind;
  customerKind: CustomerKind;
};

const UNKNOWN_KEYS = new Set(["", "—", "-", "unknown", "не указан"]);

export function emptySliceFilters(period: string): SliceFilters {
  return {
    period,
    country: null,
    managerId: null,
    productId: null,
    sourceId: null,
    channel: null,
    traffic: null,
    gift: null,
    customer: null,
    timeKey: null,
    cohortKey: null
  };
}

export function isUnknownSliceKey(key: string): boolean {
  return UNKNOWN_KEYS.has(key.trim().toLowerCase());
}

function enrichLeads(leads: SliceLead[], facts: SalesCycleFact[]): EnrichedLead[] {
  const firstPaidByContact = new Map<string, string>();
  for (const fact of facts) {
    if (!fact.customerKey || !fact.paidAt) continue;
    const prev = firstPaidByContact.get(fact.customerKey);
    if (!prev || fact.paidAt < prev) firstPaidByContact.set(fact.customerKey, fact.paidAt);
  }
  return leads.map((lead) => {
    const channel = classifyAcquisitionChannel({
      sourceId: lead.sourceId,
      utmSource: lead.utmSource ?? null,
      utmMedium: lead.utmMedium ?? null
    });
    let customerKind: CustomerKind = "unknown";
    if (lead.contactId) {
      const firstPaid = firstPaidByContact.get(lead.contactId);
      customerKind = firstPaid && firstPaid < lead.dateCreate ? "returning" : "new";
    }
    return {
      ...lead,
      channelKey: channel.key,
      channelLabel: channel.label,
      trafficKind: channel.trafficKind,
      customerKind
    };
  });
}

function timeBucket(iso: string | null, grain: CohortGrain): { key: string; label: string } | null {
  if (!iso) return null;
  const bucket = cohortKeyForGrain(iso, grain);
  return { key: bucket.key, label: bucket.key };
}

function applyFactFilters(facts: SalesCycleFact[], filters: SliceFilters, grain: CohortGrain): SalesCycleFact[] {
  return facts.filter((fact) => {
    if (filters.managerId && fact.managerId !== filters.managerId) return false;
    if (filters.country && fact.country !== filters.country) return false;
    if (filters.sourceId && fact.sourceId !== filters.sourceId) return false;
    if (filters.productId && fact.productId !== filters.productId) return false;
    if (filters.channel && (fact.channelKey || "unknown") !== filters.channel) return false;
    if (filters.traffic && fact.trafficKind !== filters.traffic) return false;
    if (filters.gift && (fact.giftType || "—") !== filters.gift) return false;
    if (filters.customer && fact.customerKind !== filters.customer) return false;
    if (filters.timeKey) {
      const bucket = timeBucket(fact.paidAt, grain);
      if (!bucket || bucket.key !== filters.timeKey) return false;
    }
    if (filters.cohortKey) {
      const bucket = timeBucket(fact.leadCreatedAt, grain);
      if (!bucket || bucket.key !== filters.cohortKey) return false;
    }
    return true;
  });
}

function applyLeadFilters(leads: EnrichedLead[], filters: SliceFilters, grain: CohortGrain): EnrichedLead[] {
  return leads.filter((lead) => {
    if (filters.managerId && lead.assignedById !== filters.managerId) return false;
    if (filters.country && lead.country !== filters.country) return false;
    if (filters.sourceId && lead.sourceId !== filters.sourceId) return false;
    if (filters.channel && lead.channelKey !== filters.channel) return false;
    if (filters.traffic && lead.trafficKind !== filters.traffic) return false;
    if (filters.customer && lead.customerKind !== filters.customer) return false;
    if (filters.cohortKey) {
      const bucket = timeBucket(lead.dateCreate, grain);
      if (!bucket || bucket.key !== filters.cohortKey) return false;
    }
    return true;
  });
}

function firstPaymentByLead(facts: SalesCycleFact[]): Map<string, SalesCycleFact> {
  const map = new Map<string, SalesCycleFact>();
  const sorted = [...facts]
    .filter((fact) => fact.leadId && fact.leadToWonHours != null)
    .sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());
  for (const fact of sorted) {
    if (!fact.leadId || map.has(fact.leadId)) continue;
    map.set(fact.leadId, fact);
  }
  return map;
}

function leadKey(lead: EnrichedLead, dim: SliceDimensionId, grain: CohortGrain): { key: string; label: string } {
  if (dim === "manager") return { key: lead.assignedById || "unknown", label: lead.assignedById || "Не указан" };
  if (dim === "country") return { key: lead.country || "—", label: lead.country || "Не указан" };
  if (dim === "source") {
    const key = lead.sourceId || "—";
    return { key, label: key === "—" ? "Не указан" : bitrixSourceName(key) || key };
  }
  if (dim === "channel") return { key: lead.channelKey || "unknown", label: lead.channelLabel || "Не указан" };
  if (dim === "traffic") return { key: lead.trafficKind, label: trafficKindLabel(lead.trafficKind) };
  if (dim === "customer") return { key: lead.customerKind, label: customerKindLabel(lead.customerKind) };
  if (dim === "cohort") return timeBucket(lead.dateCreate, grain) ?? { key: "—", label: "Не указан" };
  return { key: "all", label: "Все" };
}

function factKey(fact: SalesCycleFact, dim: SliceDimensionId, grain: CohortGrain): { key: string; label: string } {
  if (dim === "manager") return { key: fact.managerId || "unknown", label: fact.managerName || "Не указан" };
  if (dim === "product") {
    const key = fact.productId || fact.productName || "—";
    return { key, label: fact.productName || "Не указан" };
  }
  if (dim === "gift") return { key: fact.giftType || "—", label: fact.giftType || "Не указан" };
  if (dim === "country") return { key: fact.country || "—", label: fact.country || "Не указан" };
  if (dim === "source") {
    const key = fact.sourceId || "—";
    return { key, label: key === "—" ? "Не указан" : bitrixSourceName(key) || key };
  }
  if (dim === "channel") return { key: fact.channelKey || "unknown", label: fact.channelLabel || "Не указан" };
  if (dim === "traffic") return { key: fact.trafficKind, label: trafficKindLabel(fact.trafficKind) };
  if (dim === "customer") return { key: fact.customerKind, label: customerKindLabel(fact.customerKind) };
  if (dim === "time") return timeBucket(fact.paidAt, grain) ?? { key: "—", label: "Не указан" };
  if (dim === "cohort") return timeBucket(fact.leadCreatedAt, grain) ?? { key: "—", label: "Не указан" };
  return { key: "—", label: "Не указан" };
}

function metricValue(row: SliceRow, metric: SliceMetricId): number {
  if (metric === "sales") return row.sales;
  if (metric === "leads") return row.leads;
  if (metric === "cr") return row.cr ?? -1;
  if (metric === "aov") return row.aov ?? -1;
  return row.revenue;
}

function rowStatus(row: SliceRow, avgCr: number | null): SliceRowStatus {
  if (isLowSample(row.leads, row.sales)) return "low_data";
  if (avgCr == null || row.cr == null) return "attention";
  if (row.cr > avgCr * 1.15) return "strong";
  if (row.cr < avgCr * 0.8) return "weak";
  return "attention";
}

function sortRows(rows: SliceRow[], metric: SliceMetricId): SliceRow[] {
  return [...rows].sort((a, b) => {
    const delta = metricValue(b, metric) - metricValue(a, metric);
    if (delta !== 0) return delta;
    return b.leads - a.leads;
  });
}

export function buildSliceReport(input: {
  facts: SalesCycleFact[];
  leads: SliceLead[];
  filters: SliceFilters;
  dimension: SliceDimensionId;
  metric: SliceMetricId;
  grain: CohortGrain;
  selectedKey?: string | null;
}): SliceReport {
  const def = getSliceDimension(input.dimension);
  const allEnriched = enrichLeads(input.leads, input.facts);
  const facts = applyFactFilters(input.facts, input.filters, input.grain);
  const leads = applyLeadFilters(allEnriched, input.filters, input.grain);
  const periodLeads = leads.filter((lead) => monthKeyInTz(lead.dateCreate) === input.filters.period);
  const periodLeadIds = new Set(periodLeads.map((lead) => lead.id));
  const cohortFacts = facts.filter(
    (fact) =>
      (fact.leadId != null && periodLeadIds.has(fact.leadId)) ||
      (fact.leadCreatedAt != null && monthKeyInTz(fact.leadCreatedAt) === input.filters.period)
  );
  const universeFacts = input.dimension === "time" ? facts.filter((fact) => monthKeyInTz(fact.paidAt) === input.filters.period) : cohortFacts;
  const universeLeads = input.dimension === "time" ? [] : periodLeads;
  const firstPay = firstPaymentByLead(universeFacts);
  const dealOnly = Boolean(def?.dealOnly);

  const keys = new Map<string, string>();
  if (!dealOnly) {
    for (const lead of universeLeads) {
      const item = leadKey(lead, input.dimension, input.grain);
      keys.set(item.key, item.label);
    }
  }
  for (const fact of universeFacts) {
    const item = factKey(fact, input.dimension, input.grain);
    keys.set(item.key, item.label);
  }

  const rawRows: Array<Omit<SliceRow, "revenueShare" | "status">> = [];
  for (const [key, label] of keys) {
    const dimLeads = dealOnly ? [] : universeLeads.filter((lead) => leadKey(lead, input.dimension, input.grain).key === key);
    const dimFacts = universeFacts.filter((fact) => factKey(fact, input.dimension, input.grain).key === key);
    const paidFirst = [...firstPay.values()].filter((fact) => factKey(fact, input.dimension, input.grain).key === key);
    const leadCount = dealOnly ? paidFirst.length : dimLeads.length;
    const sales = dealOnly ? dimFacts.length : paidFirst.length;
    const revenue = dimFacts.reduce((sum, fact) => sum + fact.revenue, 0);
    const hours = paidFirst.map((fact) => fact.leadToWonHours).filter((value): value is number => value != null && value >= 0);
    const crAt = (limitHours: number) => {
      if (dealOnly || !leadCount) return null;
      const paid = paidFirst.filter((fact) => fact.leadToWonHours != null && fact.leadToWonHours <= limitHours).length;
      return paid / leadCount;
    };
    rawRows.push({
      key,
      label,
      leads: leadCount,
      sales,
      cr: dealOnly || !leadCount ? null : sales / leadCount,
      revenue: Math.round(revenue * 100) / 100,
      aov: dimFacts.length ? Math.round((revenue / dimFacts.length) * 100) / 100 : null,
      medianCycleDays: roundDays(median(hours)),
      d7Cr: crAt(192),
      d30Cr: crAt(720),
      unknown: isUnknownSliceKey(key)
    });
  }

  const totalRevenue = rawRows.reduce((sum, row) => sum + row.revenue, 0);
  const totalLeads = rawRows.reduce((sum, row) => sum + row.leads, 0);
  const totalSales = rawRows.reduce((sum, row) => sum + row.sales, 0);
  const avgCr = totalLeads > 0 ? totalSales / totalLeads : null;
  const rows = sortRows(
    rawRows.map((row) => ({
      ...row,
      revenueShare: totalRevenue > 0 ? row.revenue / totalRevenue : null,
      status: rowStatus(
        { ...row, revenueShare: null, status: "attention" },
        dealOnly ? null : avgCr
      )
    })),
    input.metric
  );

  const ranked = rows.filter((row) => row.status !== "low_data" && !row.unknown);
  const leaders = ranked.slice(0, 5);
  const attention = [...ranked]
    .filter((row) => row.status === "weak" || (row.cr != null && avgCr != null && row.cr < avgCr))
    .sort((a, b) => (a.cr ?? 1) - (b.cr ?? 1))
    .slice(0, 5);

  const unknownLeads = rows.filter((row) => row.unknown).reduce((sum, row) => sum + row.leads, 0);
  const unknownRevenue = rows.filter((row) => row.unknown).reduce((sum, row) => sum + row.revenue, 0);

  const kpis: SliceKpis = {
    leads: totalLeads,
    sales: totalSales,
    cr: dealOnly || totalLeads <= 0 ? null : totalSales / totalLeads,
    revenue: Math.round(totalRevenue * 100) / 100,
    aov: universeFacts.length ? Math.round((totalRevenue / universeFacts.length) * 100) / 100 : null,
    medianCycleDays: roundDays(
      median(
        [...firstPay.values()]
          .map((fact) => fact.leadToWonHours)
          .filter((value): value is number => value != null && value >= 0)
      )
    ),
    d7Cr: dealOnly || totalLeads <= 0
      ? null
      : [...firstPay.values()].filter((fact) => fact.leadToWonHours != null && fact.leadToWonHours <= 192).length / totalLeads,
    d30Cr: dealOnly || totalLeads <= 0
      ? null
      : [...firstPay.values()].filter((fact) => fact.leadToWonHours != null && fact.leadToWonHours <= 720).length / totalLeads
  };

  const selectedKey = input.selectedKey && rows.some((row) => row.key === input.selectedKey) ? input.selectedKey : null;
  const trend = selectedKey
    ? buildTrend(universeLeads, universeFacts, input.dimension, selectedKey, input.grain === "day" ? "day" : "week")
    : [];

  return {
    period: input.filters.period,
    grain: input.grain,
    dimension: input.dimension,
    metric: input.metric,
    filters: input.filters,
    kpis,
    rows,
    leaders,
    attention,
    unknownShareLeads: totalLeads > 0 ? unknownLeads / totalLeads : null,
    unknownShareRevenue: totalRevenue > 0 ? unknownRevenue / totalRevenue : null,
    coverageNote: def?.coverageNote ?? null,
    unavailable: [
      "Spend, CPL, CAC и ROAS недоступны: расход не размечен по этому срезу.",
      "Маржа / contribution profit не считаются в срезах v1."
    ],
    trend,
    selectedKey
  };
}

function buildTrend(
  leads: EnrichedLead[],
  facts: SalesCycleFact[],
  dim: SliceDimensionId,
  key: string,
  grain: CohortGrain
): SliceTrendPoint[] {
  const dimLeads = leads.filter((lead) => leadKey(lead, dim, grain).key === key);
  const dimFacts = facts.filter((fact) => factKey(fact, dim, grain).key === key);
  const buckets = new Map<string, SliceTrendPoint>();
  const add = (iso: string | null, kind: "lead" | "sale", revenue: number) => {
    const bucket = timeBucket(iso, grain);
    if (!bucket) return;
    const current = buckets.get(bucket.key) ?? {
      key: bucket.key,
      label: bucket.label,
      leads: 0,
      sales: 0,
      cr: null,
      revenue: 0
    };
    if (kind === "lead") current.leads += 1;
    if (kind === "sale") {
      current.sales += 1;
      current.revenue = Math.round((current.revenue + revenue) * 100) / 100;
    }
    buckets.set(bucket.key, current);
  };
  for (const lead of dimLeads) add(lead.dateCreate, "lead", 0);
  for (const fact of dimFacts) add(fact.paidAt, "sale", fact.revenue);
  return [...buckets.values()]
    .map((point) => ({
      ...point,
      cr: point.leads > 0 ? point.sales / point.leads : null
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-16);
}

export { ANALYTICS_SAMPLE_THRESHOLDS };
