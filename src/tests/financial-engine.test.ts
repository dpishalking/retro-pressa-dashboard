import assert from "node:assert/strict";
import { buildFallbackCompanySnapshot } from "@/lib/company-snapshot/fallback";
import { computeFinancialReport } from "@/lib/financial-engine/compute";
import { resolvePlanningContext } from "@/lib/planning-layer";
import { toFinancialStatement } from "@/lib/financial-engine/adapter";
import { computeTwin } from "@/lib/digital-twin/compute";

const snapshot = buildFallbackCompanySnapshot("june-2026");
const fact = resolvePlanningContext(snapshot, { mode: "FACT", period: "june-2026" });
const report = computeFinancialReport(fact.computation);

assert.equal(report.version, 1);
assert.ok(report.pnl.revenue.value > 0);
assert.ok(report.pnl.netProfit.lineage.children.length > 0);
assert.ok(report.cashFlow.closingBalance.value !== undefined);
assert.ok(report.unitEconomics.length > 0);
assert.ok(report.health.breakEvenRevenue.value >= 0);
assert.equal(report.forecast.points.length, 3);
assert.ok(report.tree.children.length > 0);

const legacy = toFinancialStatement(report);
assert.equal(legacy.revenue, report.pnl.revenue.value);
assert.equal(legacy.netProfit, report.pnl.netProfit.value);

const scenario = resolvePlanningContext(snapshot, {
  mode: "SCENARIO",
  period: "june-2026",
  overrides: { avgCheck: snapshot.sales.averagePaidCheck.value * 1.1 }
});
const scenarioReport = computeFinancialReport(scenario.computation);
const twin = computeTwin({ snapshot, overrides: { avgCheck: snapshot.sales.averagePaidCheck.value * 1.1 } });
assert.equal(twin.financials.netProfit, scenarioReport.pnl.netProfit.value);

console.log("financial-engine tests passed");
