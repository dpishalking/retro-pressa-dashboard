import { countUniqueLeads, countUniqueLeadsWithHistory } from "@/lib/analytics-os/decision-extras";
import { daysElapsedInPeriod } from "@/lib/analytics-os/period";
import type { AnalyticsPeriod } from "@/types/analytics-os";
import {
  classifyAcquisitionChannel,
  customerKindLabel,
  trafficKindLabel,
  type CustomerKind,
  type TrafficKind
} from "./cohort-dims";
import {
  FINAL_REVENUE_HOURS,
  MATURITY_CHECKPOINTS,
  MIN_MATURE_COHORTS_FOR_FORECAST,
  SALES_CYCLE_TIMEZONE
} from "./config";
import {
  average,
  buildCycleDistribution,
  cohortAgeDays,
  cohortKeyForGrain,
  median,
  monthKeyInTz,
  percentile,
  roundDays,
  roundPct
} from "./math";
import type {
  BenchmarkPoint,
  BreakdownRow,
  CashVsCohort,
  CohortGrain,
  CohortRow,
  MaturityPoint,
  RevenueMatrixCell,
  SalesCycleDataQuality,
  SalesCycleFact,
  SalesCyclePayload,
  SalesCycleSummary
} from "./types";

export type AggregateInput = {
  facts: SalesCycleFact[];
  /** All leads in corpus (for cohort denominators) */
  cohortLeads: Array<{
    id: string;
    dateCreate: string;
    sourceId: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    country: string | null;
    assignedById: string | null;
    contactId?: string | null;
    phones?: string[];
    emails?: string[];
  }>;
  period: string; // YYYY-MM focus cash/cohort month
  cohortGrain: CohortGrain;
  asOf: Date;
  filters: SalesCyclePayload["filters"];
  availablePeriods: string[];
};

type EnrichedLead = AggregateInput["cohortLeads"][number] & {
  channelKey: string;
  channelLabel: string;
  trafficKind: TrafficKind;
  customerKind: CustomerKind;
};

function enrichLeads(
  leads: AggregateInput["cohortLeads"],
  facts: SalesCycleFact[]
): EnrichedLead[] {
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
      if (firstPaid) {
        customerKind = firstPaid < lead.dateCreate ? "returning" : "new";
      } else {
        customerKind = "new";
      }
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

function applyFilters(facts: SalesCycleFact[], filters: AggregateInput["filters"]): SalesCycleFact[] {
  return facts.filter((fact) => {
    if (filters.managerId && fact.managerId !== filters.managerId) return false;
    if (filters.country && fact.country !== filters.country) return false;
    if (filters.sourceId && fact.sourceId !== filters.sourceId) return false;
    if (filters.productId && fact.productId !== filters.productId) return false;
    return true;
  });
}

function filterLeads<T extends AggregateInput["cohortLeads"][number]>(
  leads: T[],
  filters: AggregateInput["filters"]
): T[] {
  return leads.filter((lead) => {
    if (filters.managerId && lead.assignedById !== filters.managerId) return false;
    if (filters.country && lead.country !== filters.country) return false;
    if (filters.sourceId && lead.sourceId !== filters.sourceId) return false;
    return true;
  });
}

function firstPaymentByLead(facts: SalesCycleFact[]): Map<string, SalesCycleFact> {
  const map = new Map<string, SalesCycleFact>();
  const sorted = [...facts]
    .filter((f) => f.leadId && f.leadToWonHours != null)
    .sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());
  for (const fact of sorted) {
    if (!fact.leadId) continue;
    if (!map.has(fact.leadId)) map.set(fact.leadId, fact);
  }
  return map;
}

function maturityFromHours(
  hoursList: number[],
  availableHours: number,
  mode: "share_of_paid" | "cumulative_count",
  denominator?: number
): MaturityPoint[] {
  return MATURITY_CHECKPOINTS.map((cp) => {
    const matured = availableHours >= cp.hours;
    if (!matured) return { id: cp.id, value: null, matured: false };
    const count = hoursList.filter((h) => h <= cp.hours).length;
    if (mode === "share_of_paid") {
      return { id: cp.id, value: roundPct(count, hoursList.length), matured: true };
    }
    const den = denominator ?? 0;
    return { id: cp.id, value: roundPct(count, den), matured: true };
  });
}

function revenueMaturityCurve(
  factsWithLead: SalesCycleFact[],
  availableHours: number,
  finalHours = FINAL_REVENUE_HOURS
): MaturityPoint[] {
  const maturedFinal = availableHours >= finalHours;
  const finalRevenue = factsWithLead
    .filter((f) => f.leadToWonHours != null && f.leadToWonHours <= finalHours)
    .reduce((a, f) => a + f.revenue, 0);

  return MATURITY_CHECKPOINTS.map((cp) => {
    const matured = availableHours >= cp.hours;
    if (!matured) return { id: cp.id, value: null, matured: false };
    if (cp.hours > finalHours && !maturedFinal) return { id: cp.id, value: null, matured: false };
    const rev = factsWithLead
      .filter((f) => f.leadToWonHours != null && f.leadToWonHours <= cp.hours)
      .reduce((a, f) => a + f.revenue, 0);
    if (cp.hours >= finalHours) {
      return { id: cp.id, value: finalRevenue > 0 ? 100 : null, matured: maturedFinal };
    }
    if (!maturedFinal || finalRevenue <= 0) {
      // Show share of observed revenue to-date when D30 not matured yet — mark partial via value of observed
      const observed = factsWithLead.reduce((a, f) => a + f.revenue, 0);
      return { id: cp.id, value: roundPct(rev, observed), matured: true };
    }
    return { id: cp.id, value: roundPct(rev, finalRevenue), matured: true };
  });
}

function buildCashVsCohort(facts: SalesCycleFact[], period: string): CashVsCohort {
  const cashFacts = facts.filter((f) => monthKeyInTz(f.paidAt) === period);
  const cashRevenue = cashFacts.reduce((a, f) => a + f.revenue, 0);
  const byMonth = new Map<string, { revenue: number; orders: number }>();
  for (const fact of cashFacts) {
    const cohortMonth = fact.leadCreatedAt ? monthKeyInTz(fact.leadCreatedAt) : "unmatched";
    const row = byMonth.get(cohortMonth) || { revenue: 0, orders: 0 };
    row.revenue += fact.revenue;
    row.orders += 1;
    byMonth.set(cohortMonth, row);
  }
  const prev = (() => {
    const [y, m] = period.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  })();

  let fromSelected = 0;
  let fromPrevious = 0;
  let fromOlder = 0;
  for (const [month, row] of byMonth) {
    if (month === period) fromSelected += row.revenue;
    else if (month === prev) fromPrevious += row.revenue;
    else if (month !== "unmatched" && month < period) fromOlder += row.revenue;
    else if (month === "unmatched") fromOlder += row.revenue;
  }

  return {
    cashPeriod: period,
    cashRevenue: Math.round(cashRevenue * 100) / 100,
    fromSelectedCohort: Math.round(fromSelected * 100) / 100,
    fromPreviousMonth: Math.round(fromPrevious * 100) / 100,
    fromOlder: Math.round(fromOlder * 100) / 100,
    byLeadCohortMonth: [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cohortMonth, row]) => ({
        cohortMonth,
        revenue: Math.round(row.revenue * 100) / 100,
        orders: row.orders
      }))
  };
}

function buildRevenueMatrix(facts: SalesCycleFact[]): RevenueMatrixCell[] {
  const map = new Map<string, RevenueMatrixCell>();
  for (const fact of facts) {
    if (!fact.leadCreatedAt || fact.leadToWonHours == null) continue;
    const leadCohortMonth = monthKeyInTz(fact.leadCreatedAt);
    const paymentMonth = monthKeyInTz(fact.paidAt);
    const key = `${leadCohortMonth}|${paymentMonth}`;
    const cell = map.get(key) || { leadCohortMonth, paymentMonth, revenue: 0, orders: 0 };
    cell.revenue += fact.revenue;
    cell.orders += 1;
    map.set(key, cell);
  }
  return [...map.values()]
    .map((c) => ({ ...c, revenue: Math.round(c.revenue * 100) / 100 }))
    .sort((a, b) => a.leadCohortMonth.localeCompare(b.leadCohortMonth) || a.paymentMonth.localeCompare(b.paymentMonth));
}

function buildCohortRows(
  leads: AggregateInput["cohortLeads"],
  facts: SalesCycleFact[],
  grain: CohortGrain,
  asOf: Date
): CohortRow[] {
  const firstPay = firstPaymentByLead(facts);
  const leadGroups = new Map<string, { start: string; end: string; leads: typeof leads }>();
  for (const lead of leads) {
    const { key, start, end } = cohortKeyForGrain(lead.dateCreate, grain);
    const g = leadGroups.get(key) || { start, end, leads: [] };
    g.leads.push(lead);
    leadGroups.set(key, g);
  }

  const rows: CohortRow[] = [];
  for (const [cohortKey, group] of [...leadGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ageDays = cohortAgeDays(group.end, asOf);
    const availableHours = ageDays * 24;
    const leadIds = new Set(group.leads.map((l) => l.id));
    const paidFacts = [...firstPay.values()].filter((f) => f.leadId && leadIds.has(f.leadId));
    // Revenue: first-order only in Phase 1 for cohort CR/revenue maturity
    const revenue = paidFacts.reduce((a, f) => a + f.revenue, 0);
    const hours = paidFacts.map((f) => f.leadToWonHours!).filter((h) => h >= 0);

    const conversion: MaturityPoint[] = MATURITY_CHECKPOINTS.map((cp) => {
      const matured = availableHours >= cp.hours;
      if (!matured) return { id: cp.id, value: null, matured: false };
      const paidBy = paidFacts.filter((f) => f.leadToWonHours != null && f.leadToWonHours <= cp.hours).length;
      return { id: cp.id, value: roundPct(paidBy, group.leads.length), matured: true };
    });

    const revenueByAge: MaturityPoint[] = MATURITY_CHECKPOINTS.map((cp) => {
      const matured = availableHours >= cp.hours;
      if (!matured) return { id: cp.id, value: null, matured: false };
      const rev = paidFacts
        .filter((f) => f.leadToWonHours != null && f.leadToWonHours <= cp.hours)
        .reduce((a, f) => a + f.revenue, 0);
      return { id: cp.id, value: Math.round(rev * 100) / 100, matured: true };
    });

    const revenuePerLeadByAge: MaturityPoint[] = revenueByAge.map((p) => ({
      id: p.id,
      matured: p.matured,
      value: p.value == null || !group.leads.length ? null : Math.round((p.value / group.leads.length) * 100) / 100
    }));

    rows.push({
      cohortKey,
      cohortStart: group.start,
      cohortEnd: group.end,
      ageDays,
      leads: group.leads.length,
      paid: paidFacts.length,
      revenue: Math.round(revenue * 100) / 100,
      revenuePerLead: group.leads.length ? Math.round((revenue / group.leads.length) * 100) / 100 : null,
      conversion,
      revenueByAge,
      revenuePerLeadByAge
    });
  }
  return rows;
}

type BreakdownDim =
  | "manager"
  | "product"
  | "country"
  | "source"
  | "channel"
  | "gift"
  | "customer"
  | "traffic";

function breakdown(
  leads: EnrichedLead[],
  facts: SalesCycleFact[],
  dim: BreakdownDim,
  asOf: Date
): BreakdownRow[] {
  const firstPay = firstPaymentByLead(facts);
  const keys = new Map<string, string>();
  const dealOnlyDims: BreakdownDim[] = ["product", "gift"];

  const leadKey = (lead: EnrichedLead) => {
    if (dim === "manager") return lead.assignedById || "unknown";
    if (dim === "country") return lead.country || "—";
    if (dim === "source") return lead.sourceId || "—";
    if (dim === "channel") return lead.channelKey || "unknown";
    if (dim === "traffic") return lead.trafficKind;
    if (dim === "customer") return lead.customerKind;
    return "all";
  };
  const leadLabel = (lead: EnrichedLead, key: string) => {
    if (dim === "channel") return lead.channelLabel || key;
    if (dim === "traffic") return trafficKindLabel(lead.trafficKind);
    if (dim === "customer") return customerKindLabel(lead.customerKind);
    return key;
  };
  const factKey = (fact: SalesCycleFact) => {
    if (dim === "manager") return fact.managerId || "unknown";
    if (dim === "product") return fact.productId || fact.productName || "—";
    if (dim === "gift") return fact.giftType || "—";
    if (dim === "country") return fact.country || "—";
    if (dim === "source") return fact.sourceId || "—";
    if (dim === "channel") return fact.channelKey || "unknown";
    if (dim === "traffic") return fact.trafficKind;
    if (dim === "customer") return fact.customerKind;
    return "—";
  };
  const factLabel = (fact: SalesCycleFact, key: string) => {
    if (dim === "manager") return fact.managerName || key;
    if (dim === "product") return fact.productName || key;
    if (dim === "gift") return fact.giftType || key;
    if (dim === "channel") return fact.channelLabel || key;
    if (dim === "traffic") return trafficKindLabel(fact.trafficKind);
    if (dim === "customer") return customerKindLabel(fact.customerKind);
    return key;
  };

  if (!dealOnlyDims.includes(dim)) {
    for (const lead of leads) {
      const key = leadKey(lead);
      keys.set(key, leadLabel(lead, key));
    }
  }
  for (const fact of facts) {
    const key = factKey(fact);
    keys.set(key, factLabel(fact, key));
  }

  const rows: BreakdownRow[] = [];
  for (const [key, label] of keys) {
    const dimLeads = dealOnlyDims.includes(dim) ? [] : leads.filter((l) => leadKey(l) === key);
    const dimFacts = facts.filter((f) => factKey(f) === key);
    const paidFirst = [...firstPay.values()].filter((f) => factKey(f) === key);
    const leadHours = paidFirst.map((f) => f.leadToWonHours!).filter((h) => h >= 0);
    const dealHours = dimFacts.map((f) => f.dealToWonHours).filter((h) => h >= 0);
    const leadCount = dealOnlyDims.includes(dim) ? paidFirst.length : dimLeads.length;
    const crAt = (hours: number) => {
      if (dealOnlyDims.includes(dim) || !leadCount) return null;
      const paid = paidFirst.filter((f) => f.leadToWonHours != null && f.leadToWonHours <= hours).length;
      return roundPct(paid, leadCount);
    };
    const revenue = dimFacts.reduce((a, f) => a + f.revenue, 0);
    rows.push({
      key,
      label,
      leads: leadCount,
      paid: dealOnlyDims.includes(dim) ? paidFirst.length : paidFirst.length,
      revenue: Math.round(revenue * 100) / 100,
      medianLeadToWonDays: roundDays(median(leadHours)),
      medianDealToWonDays: roundDays(median(dealHours)),
      d3Cr: crAt(96),
      d7Cr: crAt(192),
      d14Cr: crAt(360),
      d30Cr: crAt(720),
      revenuePerLead: leadCount ? Math.round((revenue / leadCount) * 100) / 100 : null,
      aov: dimFacts.length ? Math.round((revenue / dimFacts.length) * 100) / 100 : null
    });
  }
  return rows.sort((a, b) => b.revenue - a.revenue).slice(0, 40);
}

function buildBenchmark(cohorts: CohortRow[], focusMonth: string): BenchmarkPoint[] {
  const current = [...cohorts].reverse().find((c) => c.cohortKey.startsWith(focusMonth) || c.cohortStart.startsWith(focusMonth));
  const mature = cohorts.filter((c) => c.ageDays >= 30 && (!current || c.cohortKey !== current.cohortKey));
  return MATURITY_CHECKPOINTS.filter((cp) => ["D3", "D7", "D14", "D30"].includes(cp.id)).map((cp) => {
    const curPt = current?.conversion.find((p) => p.id === cp.id);
    const histValues = mature
      .map((c) => c.conversion.find((p) => p.id === cp.id))
      .filter((p): p is MaturityPoint => Boolean(p?.matured && p.value != null))
      .map((p) => p.value as number);
    const historical = histValues.length ? Math.round((histValues.reduce((a, b) => a + b, 0) / histValues.length) * 10) / 10 : null;
    const currentVal = curPt?.matured ? curPt.value : null;
    return {
      id: cp.id,
      current: currentVal,
      historical,
      deltaPp: currentVal != null && historical != null ? Math.round((currentVal - historical) * 10) / 10 : null,
      matured: Boolean(curPt?.matured)
    };
  });
}

function buildForecast(cohorts: CohortRow[], focusMonth: string): SalesCyclePayload["forecast"] {
  const mature = cohorts.filter((c) => c.ageDays >= 30);
  if (mature.length < MIN_MATURE_COHORTS_FOR_FORECAST) {
    return {
      available: false,
      message: `Insufficient history: нужно ≥${MIN_MATURE_COHORTS_FOR_FORECAST} зрелых когорт (D30), сейчас ${mature.length}.`,
      estimatedD30Revenue: null,
      confidence: "insufficient_history"
    };
  }
  const ratios = mature
    .map((c) => {
      const d7 = c.revenueByAge.find((p) => p.id === "D7")?.value;
      const d30 = c.revenueByAge.find((p) => p.id === "D30")?.value;
      if (d7 == null || d30 == null || d30 <= 0) return null;
      return d7 / d30;
    })
    .filter((x): x is number => x != null && x > 0);
  const avgRatio = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;
  const current = [...cohorts].reverse().find((c) => c.cohortKey.startsWith(focusMonth) || c.cohortStart.startsWith(focusMonth));
  const currentD7 = current?.revenueByAge.find((p) => p.id === "D7");
  if (!avgRatio || !currentD7?.matured || currentD7.value == null) {
    return {
      available: false,
      message: "Текущая когорта ещё не созрела до D7 или нет коэффициента.",
      estimatedD30Revenue: null,
      confidence: "insufficient_history"
    };
  }
  return {
    available: true,
    message: "CALCULATED: D7 / historical(D7÷D30)",
    estimatedD30Revenue: Math.round((currentD7.value / avgRatio) * 100) / 100,
    confidence: "calculated"
  };
}

export function aggregateSalesCycle(input: AggregateInput): SalesCyclePayload {
  const facts = applyFilters(input.facts, input.filters);
  const leads = filterLeads(enrichLeads(input.cohortLeads, input.facts), input.filters);
  const withLeadHours = facts.filter((f) => f.leadToWonHours != null && f.leadToWonHours >= 0);
  const leadHours = withLeadHours.map((f) => f.leadToWonHours!);
  const dealHours = facts.map((f) => f.dealToWonHours).filter((h) => h >= 0);

  // Open month: age = days elapsed in period (not “youngest lead = 0”).
  const focusAvailableHours = daysElapsedInPeriod(input.period as AnalyticsPeriod, input.asOf) * 24;

  const periodLeads = leads.filter((l) => monthKeyInTz(l.dateCreate) === input.period);
  const historyLeads = leads.filter((l) => monthKeyInTz(l.dateCreate) < input.period);
  const firstPay = firstPaymentByLead(facts);
  const periodPaidFirst = [...firstPay.values()].filter(
    (f) => f.leadCreatedAt && monthKeyInTz(f.leadCreatedAt) === input.period
  );

  const uniqueLeadStats = countUniqueLeadsWithHistory(periodLeads, historyLeads);
  const leadById = new Map(periodLeads.map((l) => [l.id, l]));
  const paidLeadIdentities = periodPaidFirst.map((f) => {
    const lead = f.leadId ? leadById.get(f.leadId) : undefined;
    return lead || { id: f.leadId || f.dealId, phones: [], emails: [], contactId: null };
  });
  const uniquePaidStats = countUniqueLeadsWithHistory(paidLeadIdentities, historyLeads);
  const useUnique = uniqueLeadStats.coverageWithIdentity > 0.3;
  const crDenom = useUnique ? uniqueLeadStats.unique : periodLeads.length;

  const conversionMaturity = maturityFromHours(
    periodPaidFirst.map((f) => f.leadToWonHours!),
    focusAvailableHours,
    "cumulative_count",
    crDenom
  );

  const paidMaturity = maturityFromHours(leadHours, 10_000, "share_of_paid");
  const revenueMaturity = revenueMaturityCurve(
    withLeadHours.filter((f) => f.leadCreatedAt && monthKeyInTz(f.leadCreatedAt) === input.period),
    focusAvailableHours
  );

  const crAt = (hours: number, available: number) => {
    if (available < hours) return null;
    const paidFacts = periodPaidFirst.filter((f) => f.leadToWonHours != null && f.leadToWonHours <= hours);
    if (!useUnique) return roundPct(paidFacts.length, periodLeads.length);
    const paidUnique = countUniqueLeads(
      paidFacts.map((f) => {
        const lead = f.leadId ? leadById.get(f.leadId) : undefined;
        return lead || { id: f.leadId || f.dealId, phones: [], emails: [], contactId: null };
      })
    ).unique;
    return roundPct(paidUnique, crDenom);
  };

  const summary: SalesCycleSummary = {
    medianLeadToWonDays: roundDays(median(leadHours)),
    averageLeadToWonDays: roundDays(average(leadHours)),
    p25LeadToWonDays: roundDays(percentile(leadHours, 25)),
    p75LeadToWonDays: roundDays(percentile(leadHours, 75)),
    p90LeadToWonDays: roundDays(percentile(leadHours, 90)),
    medianDealToWonDays: roundDays(median(dealHours)),
    paidCustomerMaturity: paidMaturity.filter((p) => ["D3", "D7", "D14", "D30"].includes(p.id)),
    directJoinCoverage: roundPct(facts.filter((f) => f.joinMethod === "lead_id").length, facts.length),
    totalWon: facts.length,
    matchedWon: facts.filter((f) => f.joinConfidence !== "unmatched").length,
    cohortLeadsInPeriod: periodLeads.length,
    uniqueLeadsInPeriod: uniqueLeadStats.unique,
    createdLeadCrD7: crAt(192, focusAvailableHours),
    createdLeadCrD30: crAt(720, focusAvailableHours),
    uniqueLeadCr:
      crDenom > 0 ? roundPct(useUnique ? uniquePaidStats.unique : periodPaidFirst.length, crDenom) : null,
    statusNote: useUnique
      ? `Unique Lead CR: ${uniqueLeadStats.unique} уник. новых (карточек ${periodLeads.length}, дубли ≈ ${uniqueLeadStats.duplicateApprox}, из истории ${uniqueLeadStats.historyDuplicates}). Lead→WON = first payment.`
      : "Created Lead CR (PARTIAL): в снапшотах мало phone/email — обновите Bitrix sync для Unique Lead CR."
  };

  const cohorts = buildCohortRows(leads, facts, input.cohortGrain, input.asOf);
  const cashVsCohort = buildCashVsCohort(facts, input.period);

  const byMethod = {
    lead_id: facts.filter((f) => f.joinMethod === "lead_id").length,
    contact_id: facts.filter((f) => f.joinMethod === "contact_id").length,
    customer_key: facts.filter((f) => f.joinMethod === "customer_key").length,
    unmatched: facts.filter((f) => f.joinConfidence === "unmatched").length
  };

  const dataQuality: SalesCycleDataQuality = {
    totalWon: facts.length,
    matchedWon: summary.matchedWon,
    unmatchedWon: byMethod.unmatched,
    directLeadJoinPct: roundPct(byMethod.lead_id, facts.length),
    contactFallbackPct: roundPct(byMethod.contact_id, facts.length),
    customerFallbackPct: roundPct(byMethod.customer_key, facts.length),
    unmatchedPct: roundPct(byMethod.unmatched, facts.length),
    highConfidencePct: roundPct(facts.filter((f) => f.joinConfidence === "high").length, facts.length),
    mediumConfidencePct: roundPct(facts.filter((f) => f.joinConfidence === "medium").length, facts.length),
    lowConfidencePct: roundPct(facts.filter((f) => f.joinConfidence === "low").length, facts.length),
    notes: [
      "Источник Phase 1: data/bitrix-snapshots (merge периодов), не Mother 60/61 напрямую.",
      "D0/D1 = elapsed hours (<24h / 24–48h), timezone Europe/Riga для календарных когорт.",
      "У лидов в старых снапшотах может не быть contactId — contact fallback через сделки с тем же contact.",
      useUnique
        ? `Unique Lead CR + история до ${input.period} (coverage ${Math.round(uniqueLeadStats.coverageWithIdentity * 100)}%, history dups ${uniqueLeadStats.historyDuplicates}).`
        : "Unique-lead dedup слабый → CR по карточкам (Created Lead CR)."
    ]
  };

  return {
    asOf: input.asOf.toISOString(),
    period: input.period,
    cohortGrain: input.cohortGrain,
    timezone: SALES_CYCLE_TIMEZONE,
    filters: input.filters,
    summary,
    cycleDistribution: buildCycleDistribution(withLeadHours.map((f) => ({ hours: f.leadToWonHours!, revenue: f.revenue }))),
    conversionMaturity,
    paidMaturity,
    revenueMaturity,
    cohorts: input.cohortGrain === "day"
      ? cohorts.filter((c) => c.cohortStart >= `${input.period}-01` || c.ageDays <= 45).slice(-45)
      : cohorts,
    cashVsCohort,
    revenueCohortMatrix: buildRevenueMatrix(facts),
    currentVsBenchmark: buildBenchmark(cohorts, input.period),
    forecast: buildForecast(cohorts, input.period),
    breakdowns: {
      managers: breakdown(leads, facts, "manager", input.asOf),
      products: breakdown(leads, facts, "product", input.asOf),
      countries: breakdown(leads, facts, "country", input.asOf),
      sources: breakdown(leads, facts, "source", input.asOf),
      channels: breakdown(leads, facts, "channel", input.asOf),
      gifts: breakdown(leads, facts, "gift", input.asOf),
      customers: breakdown(leads, facts, "customer", input.asOf),
      traffic: breakdown(leads, facts, "traffic", input.asOf)
    },
    dataQuality,
    availablePeriods: input.availablePeriods
  };
}

export function compactSalesCycleCard(payload: SalesCyclePayload) {
  return {
    medianLeadToWonDays: payload.summary.medianLeadToWonDays,
    paidCustomerMaturity: payload.summary.paidCustomerMaturity,
    createdLeadCrD7: payload.summary.createdLeadCrD7,
    createdLeadCrD30: payload.summary.createdLeadCrD30,
    cashVsCohort: {
      cashRevenue: payload.cashVsCohort.cashRevenue,
      fromSelectedCohort: payload.cashVsCohort.fromSelectedCohort,
      fromPreviousMonth: payload.cashVsCohort.fromPreviousMonth,
      fromOlder: payload.cashVsCohort.fromOlder
    },
    coverage: payload.summary.directJoinCoverage,
    asOf: payload.asOf
  };
}
