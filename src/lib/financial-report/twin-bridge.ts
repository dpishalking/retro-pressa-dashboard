import type { CanonicalFinancialReport } from "@/lib/financial-report/types";
import type { ComputedMetric, TwinSnapshot } from "@/lib/digital-twin/types";

const financialMetricIds = new Set([
  "revenue",
  "netProfit",
  "ebitda",
  "cashFlow",
  "netMargin",
  "grossMargin",
  "forecast",
  "payroll"
]);

export function financialValuesFromReport(report: CanonicalFinancialReport) {
  const forecast30 = report.forecast.points.find((p) => p.horizonDays === 30);
  return {
    revenue: report.summary.revenue,
    netProfit: report.summary.netProfit,
    ebitda: report.summary.ebitda,
    cashFlow: report.cashFlow.netCashFlow.value,
    netMargin: report.pnl.netMargin.value,
    grossMargin: report.pnl.grossMargin.value,
    forecast: forecast30?.revenue ?? report.summary.revenue,
    payroll: report.pnl.payroll.value,
    grossProfit: report.summary.grossProfit,
    operatingProfit: report.summary.operatingProfit
  };
}

export function mergeTwinWithFinancialReport(
  twin: TwinSnapshot,
  report: CanonicalFinancialReport | null
): TwinSnapshot {
  if (!report) return twin;

  const values = financialValuesFromReport(report);
  const ceoMetrics: ComputedMetric[] = twin.ceoMetrics.map((metric) =>
    financialMetricIds.has(metric.id)
      ? { ...metric, value: values[metric.id as keyof typeof values] ?? metric.value }
      : metric
  );

  return {
    ...twin,
    ceoMetrics,
    financials: {
      ...twin.financials,
      revenue: values.revenue,
      grossProfit: values.grossProfit,
      operatingProfit: values.operatingProfit,
      netProfit: values.netProfit,
      ebitda: values.ebitda,
      cashFlow: values.cashFlow,
      netMargin: values.netMargin,
      grossMargin: values.grossMargin,
      payroll: values.payroll
    },
    computedAt: report.computedAt,
    computeMs: report.computeMs
  };
}
