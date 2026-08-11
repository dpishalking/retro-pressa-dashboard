export type PredictiveDomain = "sales" | "marketing" | "finance";

export type PredictiveMetricRow = {
  id: string;
  label: string;
  unit: "eur" | "count" | "ratio" | "text";
  plan: number | null;
  fact: number | null;
  forecast: number | null;
  gapToPlan: number | null;
  status: string;
  method?: string | null;
  planToDate?: number | null;
  pace?: number | null;
  requiredPace?: number | null;
  requiredPaceMultiplier?: number | null;
  currentPace?: number | null;
  metricType?: string;
  direction?: string;
  dataStatus?: string;
  planSource?: string;
  forecastConfidence?: string;
  owner?: string;
  primary?: boolean;
};

export type PredictiveDayRow = {
  date: string;
  leads: number | null;
  deals: number | null;
  invoiceEvents: number | null;
  payments: number | null;
  paidRevenue: number | null;
  spend: number | null;
  averageCheck: number | null;
  cpl: number | null;
  leadToPaymentCr: number | null;
  completeness: "complete" | "partial" | "future" | "missing_data";
};

export type PredictiveDiagnosis = {
  overallStatus: string;
  lagMetricId: string;
  lagLabel: string;
  forecast: number | null;
  plan: number | null;
  gap: number | null;
  firstBrokenDriverId: string | null;
  firstBrokenDriverLabel: string | null;
  positiveCompensatorId: string | null;
  positiveCompensatorLabel: string | null;
  requiredPaceMultiplier: number | null;
  summary: string;
  evidence: string[];
  missingData: string[];
  recommendedDrilldown: string;
};

export type PredictiveDriverNode = {
  id: string;
  label: string;
  unit: "eur" | "count" | "ratio" | "text";
  plan: number | null;
  planToDate: number | null;
  fact: number | null;
  forecast: number | null;
  pace: number | null;
  status: string;
  metricType?: string;
};

export type PredictiveDomainBlock = {
  domain: PredictiveDomain;
  title: string;
  subtitle: string;
  status: "ok" | "partial" | "blocked" | "error";
  message: string;
  method: string;
  asOf: string | null;
  updatedAt: string | null;
  metrics: PredictiveMetricRow[];
  notes: string[];
  /** Present for marketing: calendar days inside the selected month. */
  days?: PredictiveDayRow[];
  /** Marketing General PM extras. */
  driverChain?: PredictiveDriverNode[];
  diagnosis?: PredictiveDiagnosis;
  elapsedDays?: number;
  remainingDays?: number;
  planDistributionMethod?: string;
};

export type PredictiveOverview = {
  period: string;
  isoMonth: string;
  generatedAt: string;
  domains: {
    sales: PredictiveDomainBlock;
    marketing: PredictiveDomainBlock;
    finance: PredictiveDomainBlock;
  };
};
