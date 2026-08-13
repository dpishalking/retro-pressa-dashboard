import assert from "node:assert/strict";
import type { BitrixSnapshot } from "@/lib/bitrix/snapshot-store";
import {
  aggregateCountries,
  aggregateManagers,
  aggregateRevenueTree,
  aovFromBitrix,
  conversionFromBitrix,
  filterSnapshot,
  sumPaidRevenue
} from "@/lib/analytics-os/aggregate-from-bitrix";
import { displayMetricNumber, metricValue, noDataMetric } from "@/lib/analytics-os/metric-value";
import {
  analyticsPeriodToLegacy,
  currentAnalyticsPeriod,
  isAnalyticsPeriod,
  parseAnalyticsPeriod
} from "@/lib/analytics-os/period";
import { attachDealCountries } from "@/lib/bitrix/deal-country";
import { buildUnitEconomicsUnits } from "@/lib/analytics-os/unit-economics-units";

const snapshot = {
  version: 2,
  period: "july-2026",
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31",
  factualEnd: "2026-07-21",
  createdAt: "2026-07-21T12:00:00.000Z",
  countryOptions: ["Латвия", "Германия"],
  productOptions: ["Газета", "Журнал"],
  leads: [
    {
      id: "10",
      dateCreate: "2026-07-02T10:00:00+03:00",
      statusId: "NEW",
      sourceId: "UC_GQ92V4",
      assignedById: "1",
      managerName: "Иван",
      country: "Латвия",
      utmSource: "facebook",
      utmMedium: "paid_social",
      utmCampaign: "july_test",
      utmContent: null,
      utmTerm: null,
      landingPage: null,
      formName: null
    },
    {
      id: "11",
      dateCreate: "2026-07-03T10:00:00+03:00",
      statusId: "NEW",
      sourceId: "CALL",
      assignedById: "2",
      managerName: "Мария",
      country: "Германия",
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      landingPage: null,
      formName: null
    }
  ],
  recentLeads: [],
  deals: [],
  paidDeals: [
    {
      id: "100",
      title: "Deal A",
      leadId: "10",
      contactId: "55",
      dateCreate: "2026-07-03T10:00:00+03:00",
      closeDate: "2026-07-05",
      invoiceDate: "2026-07-04",
      opportunity: 80,
      currencyId: "EUR",
      invoiceAmount: 80,
      stageId: "WON",
      stageSemanticId: "S",
      sourceId: "UC_GQ92V4",
      assignedById: "1",
      managerName: "Иван",
      country: "Латвия",
      utmCampaign: "july_test",
      landingPage: null,
      phone: null,
      email: null,
      products: [{ productId: "sku-1", productName: "Газета", quantity: 1, price: 80 }]
    },
    {
      id: "101",
      title: "Deal B",
      leadId: "11",
      contactId: "56",
      dateCreate: "2026-07-04T10:00:00+03:00",
      closeDate: "2026-07-06",
      invoiceDate: "2026-07-05",
      opportunity: 120,
      currencyId: "EUR",
      invoiceAmount: 120,
      stageId: "WON",
      stageSemanticId: "S",
      sourceId: "CALL",
      assignedById: "2",
      managerName: "Мария",
      country: "Германия",
      utmCampaign: null,
      landingPage: null,
      phone: null,
      email: null,
      products: [
        { productId: "sku-2", productName: "Журнал", quantity: 1, price: 100 },
        { productId: "sku-3", productName: "Наклейка", quantity: 1, price: 20 }
      ]
    }
  ]
} satisfies BitrixSnapshot;

// Period handling
assert.equal(isAnalyticsPeriod("2026-08"), true);
assert.equal(isAnalyticsPeriod("july-2026"), false);
assert.equal(parseAnalyticsPeriod("july-2026"), "2026-07");
assert.equal(parseAnalyticsPeriod("2026-08"), "2026-08");
assert.equal(analyticsPeriodToLegacy("2026-07"), "july-2026");
assert.equal(analyticsPeriodToLegacy("2026-08"), "august-2026");
assert.match(currentAnalyticsPeriod(new Date("2026-08-08T12:00:00Z")), /^\d{4}-\d{2}$/);

// Revenue / orders / AOV
const { paidDeals, leads } = filterSnapshot(snapshot);
assert.equal(sumPaidRevenue(paidDeals), 200);
const tree = aggregateRevenueTree(paidDeals);
assert.equal(tree.orders, 2);
assert.equal(tree.revenue, 200);
assert.equal(aovFromBitrix(tree.revenue, tree.orders), 100);
assert.equal(conversionFromBitrix(leads.length, paidDeals.length), 1);

// Managers
const managers = aggregateManagers({ leads, paidDeals });
assert.equal(managers.length, 2);
assert.equal(managers[0].revenue >= managers[1].revenue, true);
assert.equal(managers.some((row) => row.isTopPerformer), true);

// Countries
const countries = aggregateCountries({ paidDeals, leads });
assert.equal(countries.find((row) => row.country === "Германия")?.revenue, 120);
assert.equal(countries.find((row) => row.country === "Латвия")?.orders, 1);

// Country filter
const filtered = filterSnapshot(snapshot, { country: "Германия" });
assert.equal(filtered.paidDeals.length, 1);
assert.equal(sumPaidRevenue(filtered.paidDeals), 120);

// NO DATA !== 0
const noData = noDataMetric("production_load", "Production OS", undefined, "pct");
assert.equal(noData.value, null);
assert.equal(noData.status, "no_data");
assert.equal(displayMetricNumber(noData), null);

const liveZero = metricValue({
  metricId: "paid_orders",
  value: 0,
  status: "live",
  source: "Bitrix",
  unit: "count"
});
assert.equal(liveZero.value, 0);
assert.equal(displayMetricNumber(liveZero), 0);

const forced = metricValue({
  metricId: "x",
  value: 0,
  status: "no_data",
  source: "test"
});
assert.equal(forced.value, null);

const spaInvoices = attachDealCountries(
  [
    {
      ...paidDeals[0],
      id: "si31-1",
      country: "",
      leadId: "10"
    },
    {
      ...paidDeals[1],
      id: "si31-2",
      country: "2840",
      leadId: "11"
    }
  ],
  snapshot.leads
);
assert.equal(spaInvoices[0].country, "Латвия");
assert.equal(spaInvoices[1].country, "Германия");

const units = buildUnitEconomicsUnits({
  paidDeals: spaInvoices,
  leads: snapshot.leads,
  catalog: null,
  adSpend: null,
  cpl: null,
  cac: null
});
const countryUnits = units.filter((unit) => unit.kind === "country");
assert.equal(countryUnits.some((unit) => unit.name === "Латвия"), true);
assert.equal(countryUnits.some((unit) => unit.name === "Германия"), true);
assert.equal(countryUnits.some((unit) => unit.name === "Не указана"), false);

console.log("analytics-os.test.ts: ok");
