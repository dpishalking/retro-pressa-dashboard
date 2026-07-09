import assert from "node:assert/strict";
import { buildFallbackCompanySnapshot } from "@/lib/company-snapshot/fallback";
import { computeFinancialReport } from "@/lib/financial-engine/compute";
import { toFinancialStatement } from "@/lib/financial-engine/adapter";
import { computeTwin } from "@/lib/digital-twin/compute";

const snapshot = buildFallbackCompanySnapshot("june-2026");
const report = computeFinancialReport(snapshot);

assert.equal(report.version, 1);
assert.ok(report.pnl.revenue.value > 0);
assert.ok(report.pnl.netProfit.lineage.children.length > 0);
assert.ok(report.cashFlow.closingBalance.value !== undefined);
assert.ok(report.unitEconomics.length > 0);
assert.ok(report.slices.product.length >= 0);
assert.ok(report.slices.country.length >= 0);
assert.ok(report.health.breakEvenRevenue.value >= 0);
assert.equal(report.forecast.points.length, 3);
assert.ok(report.forecast.points.some((p) => p.horizonDays === 7));
assert.ok(report.forecast.points.some((p) => p.horizonDays === 30));
assert.ok(report.forecast.points.some((p) => p.horizonDays === 90));
assert.ok(report.forecast.dailyRunRateRevenue > 0);
assert.ok(report.tree.children.length > 0);
assert.ok(report.explain.netProfit.children.length > 0);

const legacy = toFinancialStatement(report);
assert.equal(legacy.revenue, report.pnl.revenue.value);
assert.equal(legacy.netProfit, report.pnl.netProfit.value);

const twin = computeTwin({ snapshot });
assert.equal(twin.financials.netProfit, report.pnl.netProfit.value);

const scenario = computeFinancialReport(snapshot, { driverOverrides: { avgCheck: snapshot.sales.averagePaidCheck.value * 1.1 } });
assert.ok(scenario.pnl.netProfit.value !== report.pnl.netProfit.value || scenario.pnl.revenue.value >= report.pnl.revenue.value);

console.log("financial-engine tests passed");
