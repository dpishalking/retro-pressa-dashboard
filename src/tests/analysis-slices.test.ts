import assert from "node:assert/strict";
import { buildFactsFromCorpus, type CycleLead, type CyclePaidDeal } from "@/lib/analytics-os/sales-cycle/build-facts";
import {
  buildSliceReport,
  emptySliceFilters,
  isUnknownSliceKey,
  parseSliceDimension,
  sliceExplorerHref
} from "@/lib/analytics-os/slices";

function lead(partial: Partial<CycleLead> & Pick<CycleLead, "id" | "dateCreate">): CycleLead {
  return {
    contactId: partial.contactId ?? partial.id,
    sourceId: "WEB",
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "x",
    country: "Латвия",
    assignedById: "1",
    managerName: "Анна",
    ...partial
  };
}

function deal(
  partial: Partial<CyclePaidDeal> & Pick<CyclePaidDeal, "id" | "dateCreate" | "closeDate">
): CyclePaidDeal {
  const opportunity = partial.opportunity ?? 100;
  return {
    leadId: null,
    contactId: null,
    title: null,
    paymentDate: partial.closeDate,
    opportunity,
    invoiceAmount: partial.invoiceAmount ?? opportunity,
    currencyId: "EUR",
    assignedById: "1",
    managerName: "Анна",
    country: "Латвия",
    sourceId: "WEB",
    utmCampaign: null,
    productId: "P1",
    productName: "Газета",
    giftTypes: ["Оригинал"],
    ...partial
  };
}

const leads: CycleLead[] = [
  lead({ id: "L1", dateCreate: "2026-08-02T10:00:00+03:00", country: "Германия", assignedById: "1", sourceId: "WEB" }),
  lead({ id: "L2", dateCreate: "2026-08-03T10:00:00+03:00", country: "Германия", assignedById: "2", sourceId: "CALL", utmSource: null, utmMedium: null }),
  lead({ id: "L3", dateCreate: "2026-08-04T10:00:00+03:00", country: "Латвия", assignedById: "1", sourceId: "WEB" }),
  lead({ id: "L4", dateCreate: "2026-08-05T10:00:00+03:00", country: null, assignedById: "1", sourceId: null, utmSource: null, utmMedium: null }),
  lead({ id: "L5", dateCreate: "2026-07-20T10:00:00+03:00", country: "Германия", assignedById: "1", sourceId: "WEB" })
];

const deals: CyclePaidDeal[] = [
  deal({
    id: "D1",
    leadId: "L1",
    contactId: "L1",
    dateCreate: "2026-08-03T10:00:00+03:00",
    closeDate: "2026-08-04T10:00:00+03:00",
    opportunity: 80,
    country: "Германия",
    productId: "P-JOURNAL",
    productName: "Journal",
    assignedById: "1"
  }),
  deal({
    id: "D2",
    leadId: "L2",
    contactId: "L2",
    dateCreate: "2026-08-04T10:00:00+03:00",
    closeDate: "2026-08-10T10:00:00+03:00",
    opportunity: 120,
    country: "Германия",
    productId: "P-NEWS",
    productName: "Газета",
    assignedById: "2",
    sourceId: "CALL"
  }),
  deal({
    id: "D3",
    leadId: "L3",
    contactId: "L3",
    dateCreate: "2026-08-05T10:00:00+03:00",
    closeDate: "2026-08-06T10:00:00+03:00",
    opportunity: 70,
    country: "Латвия",
    productId: "P-JOURNAL",
    productName: "Journal",
    assignedById: "1"
  })
];

const facts = buildFactsFromCorpus({ leads, paidDeals: deals });
const sliceLeads = leads.map((item) => ({
  id: item.id,
  dateCreate: item.dateCreate,
  sourceId: item.sourceId,
  utmSource: item.utmSource,
  utmMedium: item.utmMedium,
  country: item.country,
  assignedById: item.assignedById,
  contactId: item.contactId
}));

assert.equal(parseSliceDimension("missing"), "country");
assert.equal(isUnknownSliceKey("—"), true);
assert.equal(isUnknownSliceKey("unknown"), true);
{
  const href = new URL(sliceExplorerHref({ dim: "manager", metric: "cr", period: "2026-08", country: "Латвия" }), "https://rp-bi.site");
  assert.equal(href.pathname, "/os/slices");
  assert.equal(href.searchParams.get("dim"), "manager");
  assert.equal(href.searchParams.get("metric"), "cr");
  assert.equal(href.searchParams.get("period"), "2026-08");
  assert.equal(href.searchParams.get("country"), "Латвия");
}

const countries = buildSliceReport({
  facts,
  leads: sliceLeads,
  filters: emptySliceFilters("2026-08"),
  dimension: "country",
  metric: "revenue",
  grain: "month"
});

const countryRevenue = countries.rows.reduce((sum, row) => sum + row.revenue, 0);
assert.equal(Math.round(countryRevenue * 100) / 100, countries.kpis.revenue);
assert.equal(countries.kpis.revenue, 270);
assert.ok(countries.rows.some((row) => row.label === "Германия"));
assert.ok(countries.rows.some((row) => row.unknown));
assert.ok((countries.unknownShareLeads ?? 0) > 0);

const germany = countries.rows.find((row) => row.key === "Германия");
assert.ok(germany);
assert.equal(germany.leads, 2);
assert.equal(germany.sales, 2);
assert.equal(germany.revenue, 200);

const germanyProducts = buildSliceReport({
  facts,
  leads: sliceLeads,
  filters: { ...emptySliceFilters("2026-08"), country: "Германия" },
  dimension: "product",
  metric: "revenue",
  grain: "month"
});
assert.equal(germanyProducts.rows.reduce((sum, row) => sum + row.revenue, 0), germanyProducts.kpis.revenue);
assert.equal(germanyProducts.kpis.revenue, 200);
assert.ok(germanyProducts.rows.some((row) => row.label === "Journal" && row.revenue === 80));
assert.ok(!germanyProducts.rows.some((row) => row.label === "Journal" && row.revenue === 150));

const journalSources = buildSliceReport({
  facts,
  leads: sliceLeads,
  filters: { ...emptySliceFilters("2026-08"), country: "Германия", productId: "P-JOURNAL" },
  dimension: "source",
  metric: "cr",
  grain: "month"
});
assert.equal(journalSources.kpis.revenue, 80);
assert.ok(journalSources.rows.some((row) => row.revenue === 80));
assert.equal(
  journalSources.rows.reduce((sum, row) => sum + row.revenue, 0),
  journalSources.kpis.revenue
);

const cleared = buildSliceReport({
  facts,
  leads: sliceLeads,
  filters: emptySliceFilters("2026-08"),
  dimension: "source",
  metric: "leads",
  grain: "month"
});
assert.ok(cleared.kpis.revenue > journalSources.kpis.revenue);
assert.ok(cleared.rows.some((row) => row.unknown));

const empty = buildSliceReport({
  facts,
  leads: sliceLeads,
  filters: emptySliceFilters("2026-01"),
  dimension: "country",
  metric: "revenue",
  grain: "month"
});
assert.equal(empty.rows.length, 0);
assert.equal(empty.kpis.revenue, 0);

const managers = buildSliceReport({
  facts,
  leads: sliceLeads,
  filters: emptySliceFilters("2026-08"),
  dimension: "manager",
  metric: "cr",
  grain: "month"
});
assert.ok(managers.rows.some((row) => row.key === "1"));
assert.ok(managers.rows.some((row) => row.key === "2"));

const traffic = buildSliceReport({
  facts,
  leads: sliceLeads,
  filters: emptySliceFilters("2026-08"),
  dimension: "traffic",
  metric: "leads",
  grain: "month"
});
assert.ok(traffic.rows.some((row) => row.key === "paid" || row.key === "organic" || row.key === "unknown"));

const customers = buildSliceReport({
  facts,
  leads: sliceLeads,
  filters: emptySliceFilters("2026-08"),
  dimension: "customer",
  metric: "leads",
  grain: "month"
});
assert.ok(customers.rows.some((row) => row.key === "new" || row.key === "unknown"));

const dealIds = facts.map((fact) => fact.dealId);
assert.equal(new Set(dealIds).size, dealIds.length);

console.log("analysis-slices tests ok");
