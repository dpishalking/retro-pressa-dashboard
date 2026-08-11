import { listBitrixSnapshotPeriods, readBitrixSnapshot } from "@/lib/bitrix/snapshot-store";
import { knownLegacyAnalyticsPeriods, parseAnalyticsPeriod } from "@/lib/analytics-os/period";
import { aggregateSalesCycle, compactSalesCycleCard } from "./aggregate";
import {
  buildFactsFromCorpus,
  leadFromSnapshot,
  paidDealFromSnapshot,
  type CycleLead,
  type CyclePaidDeal
} from "./build-facts";
import type { CohortGrain, SalesCyclePayload } from "./types";

export type LoadSalesCycleOptions = {
  period?: string | null;
  cohortGrain?: CohortGrain | string | null;
  managerId?: string | null;
  productId?: string | null;
  country?: string | null;
  sourceId?: string | null;
  now?: Date;
};

const LEGACY_TO_ISO: Record<string, string> = {
  "may-2026": "2026-05",
  "june-2026": "2026-06",
  "july-2026": "2026-07",
  "august-2026": "2026-08"
};

async function loadCorpus() {
  const periods = await listBitrixSnapshotPeriods();
  const leadsById = new Map<string, CycleLead>();
  const paidById = new Map<string, CyclePaidDeal>();
  const available: string[] = [];

  for (const period of periods) {
    const snap = await readBitrixSnapshot(period);
    if (!snap) continue;
    const iso = LEGACY_TO_ISO[period];
    if (iso) available.push(iso);

    for (const lead of [...(snap.leads || []), ...(snap.recentLeads || [])]) {
      const normalized = leadFromSnapshot(lead);
      if (!normalized) continue;
      const prev = leadsById.get(normalized.id);
      if (!prev) {
        leadsById.set(normalized.id, normalized);
        continue;
      }
      leadsById.set(normalized.id, {
        ...prev,
        contactId: prev.contactId || normalized.contactId,
        phones: prev.phones?.length ? prev.phones : normalized.phones,
        emails: prev.emails?.length ? prev.emails : normalized.emails
      });
    }

    for (const deal of snap.paidDeals || []) {
      const normalized = paidDealFromSnapshot(deal);
      if (!normalized) continue;
      paidById.set(normalized.id, normalized);
    }
  }

  return {
    leads: [...leadsById.values()],
    paidDeals: [...paidById.values()],
    availablePeriods: [...new Set(available.length ? available : knownLegacyAnalyticsPeriods())].sort()
  };
}

function parseGrain(value: string | null | undefined): CohortGrain {
  if (value === "week" || value === "month" || value === "day") return value;
  return "day";
}

export async function loadSalesCycle(options: LoadSalesCycleOptions = {}): Promise<SalesCyclePayload> {
  const now = options.now ?? new Date();
  const corpus = await loadCorpus();
  const period = parseAnalyticsPeriod(options.period, now);
  const facts = buildFactsFromCorpus({
    leads: corpus.leads,
    paidDeals: corpus.paidDeals
  });

  return aggregateSalesCycle({
    facts,
    cohortLeads: corpus.leads.map((lead) => ({
      id: lead.id,
      dateCreate: lead.dateCreate,
      sourceId: lead.sourceId,
      utmSource: lead.utmSource,
      utmMedium: lead.utmMedium,
      country: lead.country,
      assignedById: lead.assignedById,
      contactId: lead.contactId ?? null,
      phones: lead.phones || [],
      emails: lead.emails || []
    })),
    period,
    cohortGrain: parseGrain(options.cohortGrain),
    asOf: now,
    filters: {
      managerId: options.managerId || null,
      productId: options.productId || null,
      country: options.country || null,
      sourceId: options.sourceId || null
    },
    availablePeriods: corpus.availablePeriods
  });
}

export async function loadSalesCycleCompact(options: LoadSalesCycleOptions = {}) {
  const payload = await loadSalesCycle({ ...options, cohortGrain: "month" });
  return compactSalesCycleCard(payload);
}
