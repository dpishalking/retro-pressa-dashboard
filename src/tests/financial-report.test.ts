import assert from "node:assert/strict";
import { buildFallbackFinancialReport } from "@/lib/financial-report/fallback";
import { parsePeriodParam, periodToIsoMonth } from "@/lib/financial-report/period";

assert.equal(parsePeriodParam("2026-07"), "july-2026");
assert.equal(parsePeriodParam("june-2026"), "june-2026");
assert.equal(periodToIsoMonth("july-2026"), "2026-07");

const fact = buildFallbackFinancialReport("june-2026", { mode: "FACT" });
assert.equal(fact.planning.mode, "FACT");
assert.ok(fact.summary.revenue > 0);

const plan = buildFallbackFinancialReport("june-2026", { mode: "PLAN" });
assert.equal(plan.planning.mode, "PLAN");

const scenario = buildFallbackFinancialReport("june-2026", {
  mode: "SCENARIO",
  changes: [{ driverId: "avgCheck", deltaPercent: 0.07 }]
});
assert.equal(scenario.planning.mode, "SCENARIO");
assert.ok(scenario.explain.netProfit.children.length > 0);

console.log("financial-report tests passed");
