import assert from "node:assert/strict";
import {
  buildFactsFromCorpus,
  buildSalesCycleFact,
  resolveLeadForDeal,
  indexLeadsForJoin,
  type CycleLead,
  type CyclePaidDeal
} from "@/lib/analytics-os/sales-cycle/build-facts";
import { aggregateSalesCycle } from "@/lib/analytics-os/sales-cycle/aggregate";
import { bucketForHours, hoursBetween, percentile, median } from "@/lib/analytics-os/sales-cycle/math";

const leadA: CycleLead = {
  id: "L1",
  dateCreate: "2026-07-01T10:00:00+03:00",
  contactId: "C1",
  sourceId: "WEB",
  utmSource: "google",
  utmMedium: "cpc",
  utmCampaign: "x",
  country: "Латвия",
  assignedById: "1",
  managerName: "Анна"
};

const leadOlder: CycleLead = {
  id: "L0",
  dateCreate: "2026-06-01T10:00:00+03:00",
  contactId: "C1",
  sourceId: "WEB",
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  country: "Латвия",
  assignedById: "1",
  managerName: "Анна"
};

function deal(partial: Partial<CyclePaidDeal> & Pick<CyclePaidDeal, "id" | "dateCreate" | "closeDate">): CyclePaidDeal {
  const opportunity = partial.opportunity ?? 100;
  return {
    leadId: null,
    contactId: null,
    title: null,
    paymentDate: null,
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
    giftTypes: [],
    ...partial,
    opportunity: partial.opportunity ?? opportunity,
    invoiceAmount: partial.invoiceAmount ?? partial.opportunity ?? opportunity
  };
}

// Direct lead_id join
{
  const paid = deal({
    id: "D1",
    leadId: "L1",
    contactId: "C1",
    dateCreate: "2026-07-01T12:00:00+03:00",
    closeDate: "2026-07-02T12:00:00+03:00"
  });
  const { leadsById, leadsByContact } = indexLeadsForJoin([leadA], [paid]);
  const match = resolveLeadForDeal(paid, leadsById, leadsByContact);
  assert.equal(match.joinMethod, "lead_id");
  assert.equal(match.joinConfidence, "high");
  assert.equal(match.lead?.id, "L1");
  const fact = buildSalesCycleFact(paid, match);
  assert.ok(fact.leadToWonHours != null && fact.leadToWonHours >= 24 && fact.leadToWonHours < 48);
}

// Contact fallback picks latest eligible lead
{
  const paid = deal({
    id: "D2",
    contactId: "C1",
    dateCreate: "2026-07-10T12:00:00+03:00",
    closeDate: "2026-07-11T12:00:00+03:00"
  });
  const { leadsById, leadsByContact } = indexLeadsForJoin([leadOlder, leadA], [paid]);
  const match = resolveLeadForDeal(paid, leadsById, leadsByContact);
  assert.equal(match.joinMethod, "contact_id");
  assert.equal(match.joinConfidence, "medium");
  assert.equal(match.lead?.id, "L1");
}

// Payment before lead → invalid lead hours
{
  const futureLead: CycleLead = { ...leadA, id: "L9", dateCreate: "2026-08-01T10:00:00+03:00" };
  const paid = deal({
    id: "D3",
    leadId: "L9",
    dateCreate: "2026-07-01T12:00:00+03:00",
    closeDate: "2026-07-02T12:00:00+03:00"
  });
  const { leadsById, leadsByContact } = indexLeadsForJoin([futureLead], [paid]);
  const match = resolveLeadForDeal(paid, leadsById, leadsByContact);
  assert.equal(match.joinConfidence, "unmatched");
}

// D0 / D1 boundaries
assert.equal(bucketForHours(0), "D0");
assert.equal(bucketForHours(23.9), "D0");
assert.equal(bucketForHours(24), "D1");
assert.equal(bucketForHours(47.9), "D1");
assert.equal(bucketForHours(48), "D2-3");

// Percentiles
assert.equal(median([1, 2, 3]), 2);
assert.ok(Math.abs((percentile([1, 2, 3, 4], 75) ?? 0) - 3.25) < 1e-9);

// hoursBetween
assert.ok(Math.abs(hoursBetween("2026-07-01T00:00:00Z", "2026-07-02T00:00:00Z") - 24) < 1e-6);

// Aggregate: not matured cells + cash vs cohort
{
  const leads = [
    leadA,
    { ...leadA, id: "L2", dateCreate: "2026-07-20T10:00:00+03:00" },
    { ...leadOlder, id: "L3", dateCreate: "2026-06-15T10:00:00+03:00", contactId: "C2" }
  ];
  const paidDeals = [
    deal({
      id: "D10",
      leadId: "L1",
      dateCreate: "2026-07-01T12:00:00+03:00",
      closeDate: "2026-07-01T18:00:00+03:00",
      opportunity: 50
    }),
    deal({
      id: "D11",
      leadId: "L3",
      contactId: "C2",
      dateCreate: "2026-06-16T12:00:00+03:00",
      closeDate: "2026-07-05T12:00:00+03:00",
      opportunity: 200
    })
  ];
  const facts = buildFactsFromCorpus({ leads, paidDeals });
  const payload = aggregateSalesCycle({
    facts,
    cohortLeads: leads.map((l) => ({
      id: l.id,
      dateCreate: l.dateCreate,
      sourceId: l.sourceId,
      country: l.country,
      assignedById: l.assignedById
    })),
    period: "2026-07",
    cohortGrain: "month",
    asOf: new Date("2026-08-10T12:00:00Z"),
    filters: { managerId: null, productId: null, country: null, sourceId: null },
    availablePeriods: ["2026-06", "2026-07", "2026-08"]
  });

  assert.equal(payload.cashVsCohort.cashRevenue, 250);
  assert.equal(payload.cashVsCohort.fromSelectedCohort, 50);
  assert.equal(payload.cashVsCohort.fromPreviousMonth, 200);

  const julyCohort = payload.cohorts.find((c) => c.cohortKey === "2026-07");
  assert.ok(julyCohort);
  const d7 = julyCohort!.conversion.find((p) => p.id === "D7");
  assert.equal(d7?.matured, true);
  assert.ok(d7?.value != null);

  // July time-cohort stays scoped to that month (L1 + L2). Dimension tables live in slices.
  assert.equal(julyCohort!.leads, 2);
  assert.equal("breakdowns" in payload, false);

  // Fresh August day cohort is not D30-matured
  const dayPayload = aggregateSalesCycle({
    facts,
    cohortLeads: [
      {
        id: "L8",
        dateCreate: "2026-08-08T10:00:00+03:00",
        sourceId: "WEB",
        country: "Латвия",
        assignedById: "1"
      }
    ],
    period: "2026-08",
    cohortGrain: "day",
    asOf: new Date("2026-08-09T12:00:00Z"),
    filters: { managerId: null, productId: null, country: null, sourceId: null },
    availablePeriods: ["2026-08"]
  });
  const augDay = dayPayload.cohorts.find((c) => c.cohortKey === "2026-08-08");
  assert.ok(augDay);
  const d30 = augDay!.conversion.find((p) => p.id === "D30");
  assert.equal(d30?.matured, false);
  assert.equal(d30?.value, null);

  assert.ok(payload.summary.medianLeadToWonDays != null);
  assert.ok(payload.dataQuality.totalWon >= 2);
}

console.log("sales-cycle.test.ts: ok");
