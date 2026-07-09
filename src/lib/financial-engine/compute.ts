import type { CompanySnapshot } from "@/lib/company-snapshot/types";
import { snapshotToDriverInputs } from "@/lib/company-snapshot/to-drivers";
import { applyDriverOverridesToSnapshot, buildFinancialContext } from "./context";
import { computeCashFlow } from "./cash-flow";
import { buildRevenueLineage } from "./explainability";
import { computeForecast } from "./forecast";
import { buildFinancialTree } from "./financial-tree";
import { computeHealth } from "./health";
import { computePnL } from "./pnl";
import { computeSlices, computeUnitEconomics } from "./slices";
import type { ComputeFinancialReportOptions, FinancialReport } from "./types";

export type FinancialReportOptions = ComputeFinancialReportOptions & {
  driverOverrides?: Partial<Record<string, number>>;
};

/**
 * Financial Operating System — единственный канонический финансовый движок.
 * Все финансовые расчёты проекта должны проходить через эту функцию.
 */
export function computeFinancialReport(
  snapshot: CompanySnapshot,
  options: FinancialReportOptions = {}
): FinancialReport {
  const start = performance.now();
  const effectiveSnapshot = options.driverOverrides
    ? applyDriverOverridesToSnapshot(snapshot, options.driverOverrides)
    : snapshot;

  const ctx = buildFinancialContext(effectiveSnapshot, options.elapsedDays);
  const { pnl, netProfitLineage } = computePnL(ctx);
  const cashFlow = computeCashFlow(effectiveSnapshot, ctx, pnl);
  const slices = computeSlices(effectiveSnapshot, ctx, pnl);
  const discountRate = snapshotToDriverInputs(effectiveSnapshot).find((d) => d.id === "discountRate")?.actual ?? 0;
  const unitEconomics = computeUnitEconomics(slices, ctx, pnl, discountRate);
  const health = computeHealth(ctx, pnl, cashFlow);
  const forecast = computeForecast(effectiveSnapshot, ctx, pnl);
  const tree = buildFinancialTree(ctx, pnl);

  return {
    version: 1,
    period: effectiveSnapshot.meta.period,
    dataMode: effectiveSnapshot.meta.dataMode,
    computedAt: new Date().toISOString(),
    computeMs: performance.now() - start,
    pnl,
    cashFlow,
    unitEconomics,
    slices,
    health,
    forecast,
    tree,
    dataQuality: ctx.issues,
    explain: {
      netProfit: netProfitLineage,
      revenue: buildRevenueLineage(ctx)
    }
  };
}
