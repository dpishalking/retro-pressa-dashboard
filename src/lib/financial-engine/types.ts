import type { SnapshotDataMode, SnapshotSourceId } from "@/lib/company-snapshot/types";
import type { CompanySnapshot } from "@/lib/company-snapshot/types";
import type { PeriodKey } from "@/types/metrics";

export type FinancialUnit = "currency" | "percent" | "count" | "days" | "ratio";

export type SliceDimension = "product" | "country" | "channel" | "manager" | "segment";

export type DataQualityIssue = {
  metricId: string;
  label: string;
  reason: string;
  source: SnapshotSourceId;
  fallbackUsed: boolean;
};

export type LineageNode = {
  id: string;
  label: string;
  value: number;
  unit: FinancialUnit;
  source: SnapshotSourceId;
  available: boolean;
  formula?: string;
  children: LineageNode[];
};

export type FinancialMetric = {
  id: string;
  label: string;
  value: number;
  unit: FinancialUnit;
  source: SnapshotSourceId;
  available: boolean;
  lineage: LineageNode;
};

export type PnLStatement = {
  revenue: FinancialMetric;
  repeatRevenue: FinancialMetric;
  cogs: FinancialMetric;
  defectCost: FinancialMetric;
  grossProfit: FinancialMetric;
  grossMargin: FinancialMetric;
  marketingSpend: FinancialMetric;
  payroll: FinancialMetric;
  productionCost: FinancialMetric;
  logisticsCost: FinancialMetric;
  overhead: FinancialMetric;
  operatingExpenses: FinancialMetric;
  ebitda: FinancialMetric;
  operatingProfit: FinancialMetric;
  operatingMargin: FinancialMetric;
  taxes: FinancialMetric;
  netProfit: FinancialMetric;
  netMargin: FinancialMetric;
};

export type CashFlowStatement = {
  cashInflows: FinancialMetric;
  cashOutflows: FinancialMetric;
  netCashFlow: FinancialMetric;
  openingBalance: FinancialMetric;
  closingBalance: FinancialMetric;
  forecast7d: FinancialMetric;
  forecast30d: FinancialMetric;
  forecast90d: FinancialMetric;
};

export type UnitEconomicsItem = {
  sliceId: string;
  sliceLabel: string;
  dimension: SliceDimension;
  price: FinancialMetric;
  discount: FinancialMetric;
  avgSellingPrice: FinancialMetric;
  unitCost: FinancialMetric;
  contributionMargin: FinancialMetric;
  grossMargin: FinancialMetric;
  operatingMargin: FinancialMetric;
  netMargin: FinancialMetric;
  maxCac: FinancialMetric;
  profitPerOrder: FinancialMetric;
  orders: FinancialMetric;
  revenue: FinancialMetric;
  roi: FinancialMetric;
};

export type FinancialSlice = {
  dimension: SliceDimension;
  id: string;
  label: string;
  revenue: number;
  orders: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  contributionMargin: number;
  shareOfRevenue: number;
  source: SnapshotSourceId;
};

export type FinancialHealth = {
  grossMargin: FinancialMetric;
  operatingMargin: FinancialMetric;
  netMargin: FinancialMetric;
  contributionMargin: FinancialMetric;
  ebitdaMargin: FinancialMetric;
  burnRate: FinancialMetric;
  runwayDays: FinancialMetric;
  breakEvenRevenue: FinancialMetric;
  breakEvenOrders: FinancialMetric;
};

export type ForecastPoint = {
  horizonDays: number;
  revenue: number;
  netProfit: number;
  cashBalance: number;
  method: string;
  drivers: Record<string, number>;
};

export type FinancialForecast = {
  points: ForecastPoint[];
  dailyRunRateRevenue: number;
  dailyRunRateProfit: number;
  dailyRunRateCash: number;
};

export type FinancialTreeNode = {
  id: string;
  label: string;
  value: number;
  unit: FinancialUnit;
  source: SnapshotSourceId;
  available: boolean;
  children: FinancialTreeNode[];
};

export type FinancialReport = {
  version: 1;
  period: PeriodKey;
  dataMode: SnapshotDataMode;
  computedAt: string;
  computeMs: number;
  pnl: PnLStatement;
  cashFlow: CashFlowStatement;
  unitEconomics: UnitEconomicsItem[];
  slices: Record<SliceDimension, FinancialSlice[]>;
  health: FinancialHealth;
  forecast: FinancialForecast;
  tree: FinancialTreeNode;
  dataQuality: DataQualityIssue[];
  explain: Record<string, LineageNode>;
};

export type FinancialContext = {
  period: PeriodKey;
  dataMode: SnapshotDataMode;
  calendarDays: number;
  elapsedDays: number;
  paidLeads: number;
  organicLeads: number;
  qualifiedLeads: number;
  totalLeads: number;
  salesCount: number;
  orders: number;
  avgCheck: number;
  baseRevenue: number;
  repeatSalesRate: number;
  revenue: number;
  unitCost: number;
  defectRate: number;
  deliveryCost: number;
  cogs: number;
  defectCost: number;
  logisticsCost: number;
  marketingSpend: number;
  payroll: number;
  overhead: number;
  taxRate: number;
  cashBalance: number;
  sources: Record<string, { source: SnapshotSourceId; available: boolean }>;
  issues: DataQualityIssue[];
};

export type ComputeFinancialReportOptions = {
  elapsedDays?: number;
};

/** Mode-agnostic input for FOS. Planning Layer resolves FACT/PLAN/SCENARIO into this shape. */
export type FinancialComputationContext = {
  snapshot: CompanySnapshot;
  elapsedDays?: number;
};
