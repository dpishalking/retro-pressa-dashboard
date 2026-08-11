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
