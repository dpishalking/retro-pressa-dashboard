export type {
  CashFlowStatement,
  ComputeFinancialReportOptions,
  DataQualityIssue,
  FinancialContext,
  FinancialForecast,
  FinancialHealth,
  FinancialMetric,
  FinancialReport,
  FinancialSlice,
  FinancialTreeNode,
  ForecastPoint,
  LineageNode,
  PnLStatement,
  SliceDimension,
  UnitEconomicsItem
} from "./types";

export { computeFinancialReport } from "./compute";
export type { FinancialReportOptions } from "./compute";
export { buildFinancialContext, applyDriverOverridesToSnapshot } from "./context";
export { toFinancialStatement, toUnitEconomics } from "./adapter";
export { buildNetProfitLineage, buildRevenueLineage, lineageNode } from "./explainability";
export { SLICE_BUILDERS } from "./slices";
export { safeDiv, margin, trailingDailyAverage } from "./math";
