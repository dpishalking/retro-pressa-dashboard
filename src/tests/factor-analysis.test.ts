import assert from "node:assert/strict";
import { buildFactorAnalysis } from "@/lib/analytics-os/factor-analysis";

const augustMtd = buildFactorAnalysis({
  daysElapsed: 13,
  calendarDays: 31,
  daysRemaining: 18,
  planRevenue: 46676,
  factRevenue: 11439,
  planLeads: 3334,
  factLeads: 990,
  planPaidLeads: 2667,
  factPaidLeads: 764,
  planOrganicLeads: 667,
  factOrganicLeads: 226,
  planCr: 0.2,
  factCr: 0.156,
  planAov: 70,
  factAov: 74,
  invoices: 164,
  paidOrders: 154,
  stuckAmount: 19185,
  stuckDeals: 40,
  adSpend: 1761,
  planSpend: 4500,
  sliced: false
});

assert.equal(augustMtd.ready, true);
assert.ok((augustMtd.planMtd ?? 0) > 19000 && (augustMtd.planMtd ?? 0) < 20000);
assert.equal(augustMtd.fact, 11439);
assert.ok((augustMtd.gapMtd ?? 0) < -7000);
const leads = augustMtd.factors.find((row) => row.id === "leads");
const cr = augustMtd.factors.find((row) => row.id === "conversion");
const aov = augustMtd.factors.find((row) => row.id === "aov");
assert.ok(leads && (leads.euroEffect ?? 0) < -5000);
assert.ok(cr && (cr.euroEffect ?? 0) < -2000);
assert.ok(aov && (aov.euroEffect ?? 0) > 400);
assert.equal(leads?.tone, "hurt");
assert.equal(aov?.tone, "help");
assert.match(augustMtd.headline, /лиды/i);
assert.match(augustMtd.pressNow, /маркетинг|трафик/i);
assert.ok(augustMtd.factors.some((row) => row.id === "mix"));
assert.ok(augustMtd.factors.some((row) => row.id === "funnel"));
assert.ok(augustMtd.factors.some((row) => row.id === "stuck"));
assert.ok(augustMtd.notes.some((note) => note.includes("13 из 31")));

const ahead = buildFactorAnalysis({
  ...{
    daysElapsed: 15,
    calendarDays: 30,
    daysRemaining: 15,
    planRevenue: 30000,
    factRevenue: 20000,
    planLeads: 1000,
    factLeads: 600,
    planPaidLeads: null,
    factPaidLeads: null,
    planOrganicLeads: null,
    factOrganicLeads: null,
    planCr: 0.2,
    factCr: 0.25,
    planAov: 70,
    factAov: 80,
    invoices: 180,
    paidOrders: 150,
    stuckAmount: null,
    stuckDeals: null,
    adSpend: null,
    planSpend: null,
    sliced: false
  }
});
assert.match(ahead.headline, /не отстаёт|плюсе/i);

console.log("factor-analysis tests ok");
