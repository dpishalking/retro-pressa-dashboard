import type { SnapshotDataMode } from "@/lib/company-snapshot/types";
import type { DeltaMetricRow, PlanningMetadata } from "@/lib/planning-layer";
import type {
  CashFlowStatement,
  DataQualityIssue,
  FinancialForecast,
  FinancialHealth,
  FinancialTreeNode,
  LineageNode,
  PnLStatement,
  SliceDimension,
  FinancialSlice,
  UnitEconomicsItem
} from "@/lib/financial-engine/types";
import type { PeriodKey } from "@/types/metrics";

export type FinancialReportSummary = {
  revenue: number;
  grossProfit: number;
  operatingProfit: number;
  netProfit: number;
  ebitda: number;
  cash: number;
  burnRate: number;
  runway: number;
};

/** Canonical Financial Report — единый объект для UI и будущих модулей. */
export type CanonicalFinancialReport = {
  ok: true;
  version: 1;
  period: PeriodKey;
  periodIso: string;
  builtAt: string;
  fromCache: boolean;
  dataMode: SnapshotDataMode;
  computedAt: string;
  computeMs: number;
  summary: FinancialReportSummary;
  pnl: PnLStatement;
  cashFlow: CashFlowStatement;
  unitEconomics: UnitEconomicsItem[];
  health: FinancialHealth;
  forecast: FinancialForecast;
  explain: Record<string, LineageNode>;
  dataQuality: DataQualityIssue[];
  slices: Record<SliceDimension, FinancialSlice[]>;
  tree: FinancialTreeNode;
  planning: PlanningMetadata;
  delta?: DeltaMetricRow[];
};

export type FinancialReportError = {
  ok: false;
  error: string;
};

export type FinancialReportResponse = CanonicalFinancialReport | FinancialReportError;
