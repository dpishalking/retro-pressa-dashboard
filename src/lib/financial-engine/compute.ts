import { snapshotToDriverInputs } from "@/lib/company-snapshot/to-drivers";
import type { CompanySnapshot } from "@/lib/company-snapshot/types";
import { computeCashFlow } from "./cash-flow";
import { buildRevenueLineage } from "./explainability";
import { computeForecast } from "./forecast";
import { buildFinancialTree } from "./financial-tree";
import { computeHealth } from "./health";
import { computePnL } from "./pnl";
import { computeSlices, computeUnitEconomics } from "./slices";
import { buildFinancialContext } from "./context";
import type { FinancialComputationContext, FinancialReport } from "./types";

/**
 * Financial Operating System — единственный канонический финансовый движок.
 * Принимает FinancialComputationContext без знания о FACT / PLAN / SCENARIO.
 */
export function computeFinancialReport(context: FinancialComputationContext): FinancialReport {
  const start = performance.now();
  const { snapshot, elapsedDays } = context;

  const ctx = buildFinancialContext(snapshot, elapsedDays);
  const { pnl, netProfitLineage } = computePnL(ctx);
  const cashFlow = computeCashFlow(snapshot, ctx, pnl);
  const slices = computeSlices(snapshot, ctx, pnl);
  const discountRate = snapshotToDriverInputs(snapshot).find((d) => d.id === "discountRate")?.actual ?? 0;
  const unitEconomics = computeUnitEconomics(slices, ctx, pnl, discountRate);
  const health = computeHealth(ctx, pnl, cashFlow);
  const forecast = computeForecast(snapshot, ctx, pnl);
  const tree = buildFinancialTree(ctx, pnl);

  return {
    version: 1,
    period: snapshot.meta.period,
    dataMode: snapshot.meta.dataMode,
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

/** @deprecated Use Planning Layer → computeFinancialReport(context) */
export function computeFinancialReportFromSnapshot(
  snapshot: CompanySnapshot,
  options?: { elapsedDays?: number }
): FinancialReport {
  return computeFinancialReport({ snapshot, elapsedDays: options?.elapsedDays });
}
