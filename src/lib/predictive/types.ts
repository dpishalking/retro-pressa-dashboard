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
