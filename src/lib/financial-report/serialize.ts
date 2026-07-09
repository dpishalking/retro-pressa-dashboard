import type { FinancialReport } from "@/lib/financial-engine/types";
import type { LineageNode } from "@/lib/financial-engine/types";
import type { PlanningMetadata } from "@/lib/planning-layer";
import { periodToIsoMonth } from "./period";
import type { CanonicalFinancialReport, FinancialReportSummary } from "./types";

export function buildFinancialReportSummary(report: FinancialReport): FinancialReportSummary {
  return {
    revenue: report.pnl.revenue.value,
    grossProfit: report.pnl.grossProfit.value,
    operatingProfit: report.pnl.operatingProfit.value,
    netProfit: report.pnl.netProfit.value,
    ebitda: report.pnl.ebitda.value,
    cash: report.cashFlow.closingBalance.value,
    burnRate: report.health.burnRate.value,
    runway: report.health.runwayDays.value
  };
}

export function serializeFinancialReport(
  report: FinancialReport,
  meta: {
    builtAt: string;
    fromCache: boolean;
    planning: PlanningMetadata;
    explain?: Record<string, LineageNode>;
  }
): CanonicalFinancialReport {
  return {
    ok: true,
    version: 1,
    period: report.period,
    periodIso: periodToIsoMonth(report.period),
    builtAt: meta.builtAt,
    fromCache: meta.fromCache,
    dataMode: report.dataMode,
    computedAt: report.computedAt,
    computeMs: report.computeMs,
    summary: buildFinancialReportSummary(report),
    pnl: report.pnl,
    cashFlow: report.cashFlow,
    unitEconomics: report.unitEconomics,
    health: report.health,
    forecast: report.forecast,
    explain: meta.explain ?? report.explain,
    dataQuality: report.dataQuality,
    slices: report.slices,
    tree: report.tree,
    planning: meta.planning
  };
}
