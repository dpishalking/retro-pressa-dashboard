export type DriverCategory = "marketing" | "sales" | "production" | "hr" | "finance";

export type DriverUnit = "currency" | "percent" | "count" | "ratio" | "days" | "hours";

export type Trend = "up" | "down" | "flat";

export type ScenarioId = "baseline" | "optimistic" | "conservative" | "aggressive" | "custom";

export type DriverInput = {
  id: string;
  label: string;
  category: DriverCategory;
  unit: DriverUnit;
  actual: number;
  plan: number;
  owner: string;
  editable: boolean;
  description?: string;
};

export type DriverState = DriverInput & {
  forecast: number;
  delta: number;
  trend: Trend;
  lastUpdated: string;
};

export type ComputedMetric = {
  id: string;
  label: string;
  value: number;
  plan: number;
  forecast: number;
  delta: number;
  trend: Trend;
  unit: DriverUnit;
  owner: string;
  lineage: string[];
};

export type FinancialStatement = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  marketingSpend: number;
  payroll: number;
  productionCost: number;
  logisticsCost: number;
  overhead: number;
  operatingExpenses: number;
  ebitda: number;
  operatingProfit: number;
  operatingMargin: number;
  taxes: number;
  netProfit: number;
  netMargin: number;
  cashFlow: number;
};

export type UnitEconomics = {
  productId: string;
  productName: string;
  price: number;
  discount: number;
  avgSellingPrice: number;
  unitCost: number;
  contributionMargin: number;
  grossMargin: number;
  operatingMargin: number;
  netProfit: number;
  maxCac: number;
  minSellingPrice: number;
  breakEvenUnits: number;
  roi: number;
};

export type ConstraintResult = {
  id: string;
  department: string;
  label: string;
  capacity: number;
  demand: number;
  utilization: number;
  isBottleneck: boolean;
  owner: string;
  suggestion?: string;
};

export type Recommendation = {
  rank: number;
  driverId: string;
  driverLabel: string;
  action: string;
  changePct: number;
  profitImpact: number;
  revenueImpact: number;
  confidence: "high" | "medium" | "low";
};

export type DriverTreeNode = {
  id: string;
  label: string;
  value: number;
  unit: DriverUnit;
  owner: string;
  children: DriverTreeNode[];
  isDriver: boolean;
  limitsGrowth?: boolean;
};

export type ScenarioOverrides = Partial<Record<string, number>>;

export type Scenario = {
  id: ScenarioId;
  name: string;
  description: string;
  overrides: ScenarioOverrides;
};

export type TwinSnapshot = {
  drivers: DriverState[];
  financials: FinancialStatement;
  unitEconomics: UnitEconomics[];
  constraints: ConstraintResult[];
  recommendations: Recommendation[];
  driverTree: DriverTreeNode;
  ceoMetrics: ComputedMetric[];
  strategicGoal: {
    targetRevenue: number;
    targetNetMargin: number;
    achievable: boolean;
    gap: number;
    limitingFactor: string;
  };
  computedAt: string;
  computeMs: number;
};
