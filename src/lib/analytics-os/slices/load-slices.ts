import { parseAnalyticsPeriod } from "@/lib/analytics-os/period";
import { buildFactsFromCorpus } from "@/lib/analytics-os/sales-cycle/build-facts";
import { loadSalesCycleCorpus } from "@/lib/analytics-os/sales-cycle/load-sales-cycle";
import type { CohortGrain } from "@/lib/analytics-os/sales-cycle/types";
import { buildSliceReport, emptySliceFilters } from "./build-slices";
import { parseSliceDimension, parseSliceMetric } from "./registry";
import type { SliceFilters, SliceReport } from "./types";

export type LoadSliceExplorerOptions = {
  period?: string | null;
  grain?: string | null;
  dimension?: string | null;
  metric?: string | null;
  selectedKey?: string | null;
  country?: string | null;
  managerId?: string | null;
  productId?: string | null;
  sourceId?: string | null;
  channel?: string | null;
  traffic?: string | null;
  gift?: string | null;
  customer?: string | null;
  timeKey?: string | null;
  cohortKey?: string | null;
  now?: Date;
};

function parseGrain(value: string | null | undefined): CohortGrain {
  if (value === "week" || value === "day" || value === "month") return value;
  return "month";
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function filtersFromOptions(options: LoadSliceExplorerOptions, period: string): SliceFilters {
  return {
    ...emptySliceFilters(period),
    country: clean(options.country),
    managerId: clean(options.managerId),
    productId: clean(options.productId),
    sourceId: clean(options.sourceId),
    channel: clean(options.channel),
    traffic: clean(options.traffic),
    gift: clean(options.gift),
    customer: clean(options.customer),
    timeKey: clean(options.timeKey),
    cohortKey: clean(options.cohortKey)
  };
}

export async function loadSliceExplorer(options: LoadSliceExplorerOptions = {}): Promise<SliceReport> {
  const now = options.now ?? new Date();
  const period = parseAnalyticsPeriod(options.period, now);
  const grain = parseGrain(options.grain);
  const corpus = await loadSalesCycleCorpus();
  const facts = buildFactsFromCorpus({
    leads: corpus.leads,
    paidDeals: corpus.paidDeals
  });
  return buildSliceReport({
    facts,
    leads: corpus.leads.map((lead) => ({
      id: lead.id,
      dateCreate: lead.dateCreate,
      sourceId: lead.sourceId,
      utmSource: lead.utmSource,
      utmMedium: lead.utmMedium,
      country: lead.country,
      assignedById: lead.assignedById,
      contactId: lead.contactId
    })),
    filters: filtersFromOptions(options, period),
    dimension: parseSliceDimension(options.dimension),
    metric: parseSliceMetric(options.metric),
    grain,
    selectedKey: clean(options.selectedKey)
  });
}
