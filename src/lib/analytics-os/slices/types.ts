import type { CohortGrain } from "@/lib/analytics-os/sales-cycle/types";

export type SliceDimensionId =
  | "country"
  | "product"
  | "manager"
  | "source"
  | "channel"
  | "gift"
  | "traffic"
  | "customer"
  | "time"
  | "cohort";

export type SliceMetricId = "revenue" | "sales" | "leads" | "cr" | "aov";

export type SliceRowStatus = "strong" | "attention" | "weak" | "low_data";

export type SliceFilters = {
  period: string;
  country: string | null;
  managerId: string | null;
  productId: string | null;
  sourceId: string | null;
  channel: string | null;
  traffic: string | null;
  gift: string | null;
  customer: string | null;
  timeKey: string | null;
  cohortKey: string | null;
};

export type SliceDimensionDef = {
  id: SliceDimensionId;
  label: string;
  /** URL / filter field this dimension writes on drill. */
  filterKey: keyof SliceFilters | null;
  dealOnly: boolean;
  supportsDrill: boolean;
  detailRoute?: string;
  detailLabel?: string;
  nextHints: SliceDimensionId[];
  coverageNote?: string;
};

export type SliceRow = {
  key: string;
  label: string;
  leads: number;
  sales: number;
  cr: number | null;
  revenue: number;
  aov: number | null;
  revenueShare: number | null;
  medianCycleDays: number | null;
  d7Cr: number | null;
  d30Cr: number | null;
  unknown: boolean;
  status: SliceRowStatus;
};

export type SliceTrendPoint = {
  key: string;
  label: string;
  leads: number;
  sales: number;
  cr: number | null;
  revenue: number;
};

export type SliceKpis = {
  leads: number;
  sales: number;
  cr: number | null;
  revenue: number;
  aov: number | null;
  medianCycleDays: number | null;
  d7Cr: number | null;
  d30Cr: number | null;
};

export type SliceReport = {
  period: string;
  grain: CohortGrain;
  dimension: SliceDimensionId;
  metric: SliceMetricId;
  filters: SliceFilters;
  kpis: SliceKpis;
  rows: SliceRow[];
  leaders: SliceRow[];
  attention: SliceRow[];
  unknownShareLeads: number | null;
  unknownShareRevenue: number | null;
  coverageNote: string | null;
  unavailable: string[];
  trend: SliceTrendPoint[];
  selectedKey: string | null;
};
