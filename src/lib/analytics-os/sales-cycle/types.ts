export type JoinMethod = "lead_id" | "contact_id" | "customer_key" | "deal_only";
export type JoinConfidence = "high" | "medium" | "low" | "unmatched";
export type CohortGrain = "day" | "week" | "month";

export type SalesCycleFact = {
  leadId: string | null;
  dealId: string;
  customerKey: string | null;
  leadCreatedAt: string | null;
  dealCreatedAt: string;
  paidAt: string;
  leadToWonHours: number | null;
  leadToWonDays: number | null;
  dealToWonHours: number;
  dealToWonDays: number;
  revenue: number;
  currency: string | null;
  managerId: string | null;
  managerName: string | null;
  country: string | null;
  productId: string | null;
  productName: string | null;
  giftType: string | null;
  sourceId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  channelKey: string | null;
  channelLabel: string | null;
  trafficKind: "paid" | "organic" | "unknown";
  customerKind: "new" | "returning" | "unknown";
  joinMethod: JoinMethod;
  joinConfidence: JoinConfidence;
};

export type CycleBucketRow = {
  id: string;
  label: string;
  count: number;
  sharePct: number | null;
  revenue: number;
  revenueSharePct: number | null;
};

export type MaturityPoint = {
  id: string;
  /** null = cohort not old enough (NOT MATURED) */
  value: number | null;
  matured: boolean;
};

export type CohortRow = {
  cohortKey: string;
  cohortStart: string;
  cohortEnd: string;
  ageDays: number;
  leads: number;
  paid: number;
  revenue: number;
  revenuePerLead: number | null;
  /** Cohort Conversion Maturity (paid unique leads / cohort leads) */
  conversion: MaturityPoint[];
  /** Revenue by age checkpoint */
  revenueByAge: MaturityPoint[];
  /** Revenue / lead by age */
  revenuePerLeadByAge: MaturityPoint[];
};

export type CashVsCohort = {
  cashPeriod: string;
  cashRevenue: number;
  fromSelectedCohort: number;
  fromPreviousMonth: number;
  fromOlder: number;
  byLeadCohortMonth: Array<{ cohortMonth: string; revenue: number; orders: number }>;
};

export type RevenueMatrixCell = {
  leadCohortMonth: string;
  paymentMonth: string;
  revenue: number;
  orders: number;
};

export type SalesCycleDataQuality = {
  totalWon: number;
  matchedWon: number;
  unmatchedWon: number;
  directLeadJoinPct: number | null;
  contactFallbackPct: number | null;
  customerFallbackPct: number | null;
  unmatchedPct: number | null;
  highConfidencePct: number | null;
  mediumConfidencePct: number | null;
  lowConfidencePct: number | null;
  notes: string[];
};

export type SalesCycleSummary = {
  medianLeadToWonDays: number | null;
  averageLeadToWonDays: number | null;
  p25LeadToWonDays: number | null;
  p75LeadToWonDays: number | null;
  p90LeadToWonDays: number | null;
  medianDealToWonDays: number | null;
  /** Share of paid deals that closed by checkpoint (Paid Customer Maturity) */
  paidCustomerMaturity: MaturityPoint[];
  directJoinCoverage: number | null;
  totalWon: number;
  matchedWon: number;
  cohortLeadsInPeriod: number;
  /** Unique leads in focus month (phone/email/contact). */
  uniqueLeadsInPeriod: number;
  /** Lead CR at D7 / D30 — unique denominator when identity coverage is OK */
  createdLeadCrD7: number | null;
  createdLeadCrD30: number | null;
  /** Overall cohort CR (unique when available) */
  uniqueLeadCr: number | null;
  statusNote: string;
};

export type BenchmarkPoint = {
  id: string;
  current: number | null;
  historical: number | null;
  deltaPp: number | null;
  matured: boolean;
};

export type SalesCyclePayload = {
  asOf: string;
  period: string;
  cohortGrain: CohortGrain;
  timezone: string;
  filters: {
    managerId: string | null;
    productId: string | null;
    country: string | null;
    sourceId: string | null;
  };
  summary: SalesCycleSummary;
  cycleDistribution: CycleBucketRow[];
  /** Cohort Conversion Maturity for focus month (Created Lead CR) */
  conversionMaturity: MaturityPoint[];
  /** Paid Customer Maturity (among WON with lead join) */
  paidMaturity: MaturityPoint[];
  revenueMaturity: MaturityPoint[];
  cohorts: CohortRow[];
  cashVsCohort: CashVsCohort;
  revenueCohortMatrix: RevenueMatrixCell[];
  currentVsBenchmark: BenchmarkPoint[];
  forecast: {
    available: boolean;
    message: string;
    estimatedD30Revenue: number | null;
    confidence: "calculated" | "insufficient_history";
  };
  dataQuality: SalesCycleDataQuality;
  availablePeriods: string[];
};
