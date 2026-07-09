import assert from "node:assert/strict";
import { buildFallbackFinancialReport } from "@/lib/financial-report/fallback";
import { parsePeriodParam, periodToIsoMonth } from "@/lib/financial-report/period";
import { buildFinancialReportSummary } from "@/lib/financial-report/serialize";

assert.equal(parsePeriodParam("2026-07"), "july-2026");
assert.equal(parsePeriodParam("june-2026"), "june-2026");
assert.equal(periodToIsoMonth("july-2026"), "2026-07");

const report = buildFallbackFinancialReport("june-2026");
assert.equal(report.ok, true);
assert.ok(report.summary.revenue > 0);
assert.ok(report.summary.netProfit !== undefined);
assert.equal(report.summary.revenue, report.pnl.revenue.value);
assert.equal(report.summary.netProfit, report.pnl.netProfit.value);
assert.ok(report.explain.netProfit.children.length > 0);
assert.equal(report.forecast.points.length, 3);
assert.equal(buildFinancialReportSummary(report).ebitda, report.pnl.ebitda.value);

console.log("financial-report tests passed");
