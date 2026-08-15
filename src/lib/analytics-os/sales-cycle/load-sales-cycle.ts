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
import { readSalesCycleCache, writeSalesCycleCache } from "./cache-store";
import type { CohortGrain, SalesCyclePayload } from "./types";

export type LoadSalesCycleOptions = {
  period?: string | null;
  cohortGrain?: CohortGrain | string | null;
  managerId?: string | null;
  productId?: string | null;
  country?: string | null;
  sourceId?: string | null;
  now?: Date;
  /** Skip disk cache and rewrite it after compute. */
  forceRefresh?: boolean;
};

const LEGACY_TO_ISO: Record<string, string> = {
  "may-2026": "2026-05",
  "june-2026": "2026-06",
  "july-2026": "2026-07",
  "august-2026": "2026-08"
};

/** Shared Bitrix corpus for sales-cycle and slices. No new warehouse. */
export async function loadSalesCycleCorpus() {
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
  return "month";
}

export async function loadSalesCycle(options: LoadSalesCycleOptions = {}): Promise<SalesCyclePayload> {
  const now = options.now ?? new Date();
  const period = parseAnalyticsPeriod(options.period, now);
  const cohortGrain = parseGrain(options.cohortGrain);
  const cacheKey = {
    period,
    cohortGrain,
    managerId: options.managerId || null,
    productId: options.productId || null,
    country: options.country || null,
    sourceId: options.sourceId || null
  };

  if (!options.forceRefresh) {
    const cached = await readSalesCycleCache(cacheKey, { allowStale: true });
    if (cached) return cached.payload;
  }

  const corpus = await loadSalesCycleCorpus();
  const facts = buildFactsFromCorpus({
    leads: corpus.leads,
    paidDeals: corpus.paidDeals
  });

  const payload = aggregateSalesCycle({
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
    cohortGrain,
    asOf: now,
    filters: {
      managerId: options.managerId || null,
      productId: options.productId || null,
      country: options.country || null,
      sourceId: options.sourceId || null
    },
    availablePeriods: corpus.availablePeriods
  });

  await writeSalesCycleCache(cacheKey, payload).catch(() => {
    // Cache is best-effort — UI still gets a live payload.
  });
  return payload;
}

export async function warmSalesCycleCaches(options: {
  periods?: string[];
  grains?: CohortGrain[];
} = {}): Promise<{
  built: Array<{ period: string; grain: CohortGrain; ms: number; cohorts: number }>;
  errors: Array<{ period: string; grain: CohortGrain; error: string }>;
}> {
  const now = new Date();
  const corpus = await loadSalesCycleCorpus();
  const facts = buildFactsFromCorpus({
    leads: corpus.leads,
    paidDeals: corpus.paidDeals
  });
  const cohortLeads = corpus.leads.map((lead) => ({
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
  }));
  const periods = options.periods?.length
    ? options.periods.map((item) => parseAnalyticsPeriod(item, now))
    : corpus.availablePeriods;
  const grains: CohortGrain[] = options.grains?.length ? options.grains : ["month", "week"];
  const built: Array<{ period: string; grain: CohortGrain; ms: number; cohorts: number }> = [];
  const errors: Array<{ period: string; grain: CohortGrain; error: string }> = [];

  for (const period of periods) {
    for (const grain of grains) {
      const started = Date.now();
      try {
        const payload = aggregateSalesCycle({
          facts,
          cohortLeads,
          period,
          cohortGrain: grain,
          asOf: now,
          filters: {
            managerId: null,
            productId: null,
            country: null,
            sourceId: null
          },
          availablePeriods: corpus.availablePeriods
        });
        await writeSalesCycleCache({ period, cohortGrain: grain }, payload);
        built.push({
          period,
          grain,
          ms: Date.now() - started,
          cohorts: payload.cohorts.length
        });
      } catch (error) {
        errors.push({
          period,
          grain,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  return { built, errors };
}

export async function loadSalesCycleCompact(options: LoadSalesCycleOptions = {}) {
  const payload = await loadSalesCycle({ ...options, cohortGrain: "month" });
  return compactSalesCycleCard(payload);
}
