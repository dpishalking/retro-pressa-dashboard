import assert from "node:assert/strict";
import { buildFallbackCompanySnapshot } from "@/lib/company-snapshot/fallback";
import {
  buildDefaultPlanDocument,
  resolvePlanningContext,
  resolveScenarioChanges,
  applyScenarioToSnapshot,
  buildDeltaView
} from "@/lib/planning-layer";
import { buildFinancialReportSummary } from "@/lib/financial-report/serialize";
import { computeFinancialReport, computeFinancialReportFromSnapshot } from "@/lib/financial-engine/compute";

const factSnapshot = buildFallbackCompanySnapshot("june-2026");

const factResolved = resolvePlanningContext(factSnapshot, { mode: "FACT", period: "june-2026" });
const planResolved = resolvePlanningContext(factSnapshot, { mode: "PLAN", period: "june-2026" }, {
  planDocument: buildDefaultPlanDocument("june-2026")
});
const scenarioResolved = resolvePlanningContext(
  factSnapshot,
  {
    mode: "SCENARIO",
    period: "june-2026",
    changes: [{ driverId: "avgCheck", deltaPercent: 0.07 }]
  }
);

assert.equal(factResolved.metadata.mode, "FACT");
assert.equal(planResolved.metadata.mode, "PLAN");
assert.equal(scenarioResolved.metadata.mode, "SCENARIO");
assert.notEqual(
  scenarioResolved.computation.snapshot.sales.averagePaidCheck.value,
  factResolved.computation.snapshot.sales.averagePaidCheck.value
);

const factReport = computeFinancialReport(factResolved.computation);
const scenarioReport = computeFinancialReport(scenarioResolved.computation);
assert.ok(scenarioReport.pnl.revenue.value !== factReport.pnl.revenue.value);

const overrides = resolveScenarioChanges(factSnapshot, [{ driverId: "defectRate", value: 0 }]);
assert.equal(overrides.defectRate, 0);

const conversionScenario = applyScenarioToSnapshot(factSnapshot, { salesConversion: 0.3 });
assert.ok(conversionScenario.sales.revenue.value > factSnapshot.sales.revenue.value);

const checkScenario = applyScenarioToSnapshot(factSnapshot, { avgCheck: factSnapshot.sales.averagePaidCheck.value * 1.2 });
assert.ok(checkScenario.sales.revenue.value > factSnapshot.sales.revenue.value);

const paidLeadsScenario = applyScenarioToSnapshot(factSnapshot, { paidLeads: 3000 });
assert.equal(paidLeadsScenario.marketing.paidLeads.value, 3000);
assert.ok(paidLeadsScenario.marketing.adSpend.value > factSnapshot.marketing.adSpend.value);

const delta = buildDeltaView({
  fact: buildFinancialReportSummary(factReport),
  plan: buildFinancialReportSummary(computeFinancialReport(planResolved.computation)),
  scenario: buildFinancialReportSummary(scenarioReport)
});
assert.ok(delta.some((row) => row.metricId === "revenue"));

assert.ok(computeFinancialReportFromSnapshot(factSnapshot).pnl.revenue.value > 0);

console.log("planning-layer tests passed");
