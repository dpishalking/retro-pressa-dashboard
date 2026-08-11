import assert from "node:assert/strict";
import { buildMarketingGeneralPm } from "../lib/marketing-planning/marketing-general-pm";
import {
  classifyPmStatus,
  planToDateLinear,
  requiredPaceFields
} from "../lib/marketing-planning/pm-engine";

assert.equal(planToDateLinear(1000, 10, 31)?.toFixed(2), "322.58");
assert.equal(planToDateLinear(null, 10, 31), null);

const req = requiredPaceFields({
  kind: "additive",
  plan: 667,
  factToDate: 130,
  elapsed: 11,
  remaining: 20
});
assert.ok(req.requiredPace != null && Math.abs(req.requiredPace - 26.85) < 0.01);
assert.ok(req.requiredPaceMultiplier != null && req.requiredPaceMultiplier > 2);

assert.equal(
  classifyPmStatus({
    kind: "additive",
    direction: "HIGHER_IS_BETTER",
    plan: 100,
    factToDate: 50,
    forecast: 80
  }),
  "OFF_TRACK"
);

assert.equal(
  classifyPmStatus({
    kind: "additive",
    direction: "HIGHER_IS_BETTER",
    plan: 100,
    factToDate: 50,
    forecast: 97
  }),
  "ON_TRACK"
);

const pm = buildMarketingGeneralPm({
  facts: {
    paid_revenue: 10000,
    payments: 100,
    invoice_events: 40,
    leads: 800,
    spend: 1200,
    average_check: 100,
    cpl: 1.5,
    lead_to_payment_cr: 0.125,
    qualified_leads: null
  },
  plans: {
    paid_revenue: 46676,
    payments: 667,
    invoice_events: 733,
    leads: 3334,
    spend: 4500,
    average_check: null,
    cpl: null,
    lead_to_payment_cr: null,
    qualified_leads: 2334
  },
  elapsedDays: 11,
  remainingDays: 20,
  totalDays: 31
});

assert.equal(pm.planDistributionMethod, "LINEAR_FALLBACK");
assert.ok(pm.metrics.find((m) => m.id === "average_check")?.planSource === "DERIVED");
assert.ok(pm.diagnosis.lagMetricId === "paid_revenue");
assert.ok(pm.driverChain.length >= 5);
assert.ok(pm.metrics.find((m) => m.id === "paid_revenue")?.planToDate != null);

console.log("marketing-general-pm.test.ts: ok");
