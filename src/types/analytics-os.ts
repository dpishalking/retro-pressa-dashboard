export type MetricDataStatus = "live" | "calculated" | "manual" | "demo" | "no_data";

export type MetricConfidence = "high" | "medium" | "low";

export type AnalyticsMetricValue = {
  metricId: string;
  value: number | null;
  status: MetricDataStatus;
  asOf: string | null;
  source: string;
  confidence: MetricConfidence;
  decisionHint?: string;
  /** Optional plan/target for the same unit as value. */
  plan?: number | null;
  /** Relative change vs previous period (−0.1 = −10%). Null when unknown. */
  changePct?: number | null;
  unit?: "eur" | "count" | "pct" | "ratio" | "minutes";
};

export type AnalyticsPeriod = string; // YYYY-MM

export type AnalyticsNamedAmount = {
  id: string;
  name: string;
  revenue: number;
  orders: number;
  share: number;
  aov: number;
};

export type AnalyticsFunnelStage = {
  id: string;
  label: string;
  count: number | null;
  status: MetricDataStatus;
  conversionFromPrevious: number | null;
  dropOffFromPrevious: number | null;
  medianDaysInStage: number | null;
  note?: string;
};

export type AnalyticsManagerRow = {
  managerId: string;
  managerName: string;
  leads: number;
  paidOrders: number;
  revenue: number;
  conversionRate: number | null;
  aov: number | null;
  productsPerOrder: number | null;
  responseMinutes: number | null;
  responseConfidence: MetricConfidence;
  isTopPerformer: boolean;
};

export type AnalyticsProductRow = {
  productId: string;
  productName: string;
  orders: number;
  revenue: number;
  aov: number;
  share: number;
  productsPerOrder: number;
};

export type AnalyticsCountryRow = {
  country: string;
  revenue: number;
  orders: number;
  aov: number;
  share: number;
  /** Lead-country CR when lead country available; null otherwise. */
  leadConversionRate: number | null;
  leads: number | null;
};

export type AnalyticsPlanBlock = {
  planRevenue: AnalyticsMetricValue;
  factRevenue: AnalyticsMetricValue;
  forecastRevenue: AnalyticsMetricValue;
  gap: AnalyticsMetricValue;
  planCompletion: AnalyticsMetricValue;
  daysElapsed: number;
  daysRemaining: number;
  calendarDays: number;
  forecastSource: string;
};

export type AnalyticsReconciliation = {
  bitrixRevenue: AnalyticsMetricValue;
  mariaRevenue: AnalyticsMetricValue;
  svodAttributedRevenue: AnalyticsMetricValue;
  bitrixVsMariaDelta: AnalyticsMetricValue;
  bitrixVsMariaDeltaPct: AnalyticsMetricValue;
};

export type AnalyticsPipeline = {
  openDeals: AnalyticsMetricValue;
  pipelineAmount: AnalyticsMetricValue;
  weightedAmount: AnalyticsMetricValue;
  overdueDeals: AnalyticsMetricValue;
};

export type AnalyticsCustomers = {
  customers: AnalyticsMetricValue;
  newCustomers: AnalyticsMetricValue;
  repeatCustomers: AnalyticsMetricValue;
  repeatRate: AnalyticsMetricValue;
  avgCustomerRevenue: AnalyticsMetricValue;
};

export type AnalyticsMarketing = {
  adSpend: AnalyticsMetricValue;
  cpl: AnalyticsMetricValue;
  cac: AnalyticsMetricValue;
  roas: AnalyticsMetricValue;
  note: string;
};

export type AnalyticsProduction = {
  status: MetricDataStatus;
  message: string;
  available: string[];
  missing: string[];
};

export type AnalyticsSourceCard = {
  id: string;
  name: string;
  connection: "connected" | "partial" | "not_connected";
  lastSync: string | null;
  note?: string;
};

export type AnalyticsDataQuality = {
  overallScore: number;
  label: string;
  mode: "audit_baseline" | "live";
  domains: Array<{ id: string; name: string; score: number }>;
};

export type OwnerIntelligenceCard = {
  id: "why" | "what_to_do" | "what_if" | "where_is_the_money" | "what_breaks_at_x10";
  title: string;
  body: string;
  status: MetricDataStatus;
  href?: string;
};

export type CeoControlCenterSnapshot = {
  period: AnalyticsPeriod;
  legacyPeriodKey: string | null;
  asOf: string | null;
  filters: {
    country: string | null;
    managerId: string | null;
    productId: string | null;
  };
  availablePeriods: AnalyticsPeriod[];
  filterOptions: {
    countries: string[];
    managers: Array<{ id: string; name: string }>;
    products: Array<{ id: string; name: string }>;
  };
  metrics: Record<string, AnalyticsMetricValue>;
  plan: AnalyticsPlanBlock;
  revenueTree: {
    total: AnalyticsMetricValue;
    countries: AnalyticsNamedAmount[];
    products: AnalyticsNamedAmount[];
    managers: AnalyticsNamedAmount[];
  };
  funnel: AnalyticsFunnelStage[];
  managers: AnalyticsManagerRow[];
  products: AnalyticsProductRow[];
  countries: AnalyticsCountryRow[];
  customers: AnalyticsCustomers;
  pipeline: AnalyticsPipeline;
  marketing: AnalyticsMarketing;
  production: AnalyticsProduction;
  reconciliation: AnalyticsReconciliation;
  sources: AnalyticsSourceCard[];
  dataQuality: AnalyticsDataQuality;
  ownerIntelligence: OwnerIntelligenceCard[];
  multiProductOrdersPct: AnalyticsMetricValue;
};
