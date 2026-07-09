import type {
  CountryInvoiceMetrics,
  DailyMetrics,
  DialogueQualityMetrics,
  ManagerInvoiceMetrics,
  ManagerMetrics,
  MonthlyMetrics,
  PeriodKey,
  ProductInvoiceMetrics
} from "@/types/metrics";
import type { ConversationDashboardMetrics } from "@/types/metrics";

/** Official data source identifiers for SSOT. */
export type SnapshotSourceId =
  | "bitrix"
  | "google_marketing"
  | "google_finance"
  | "google_payroll"
  | "google_production"
  | "bank"
  | "conversation_analytics"
  | "training"
  | "demo_fallback"
  | "computed";

export type SnapshotDataMode = "live" | "partial" | "fallback";

export type SnapshotMetric<T extends number = number> = {
  value: T;
  source: SnapshotSourceId;
  updatedAt: string | null;
  available: boolean;
};

export type SourceAvailability = {
  id: SnapshotSourceId;
  available: boolean;
  updatedAt: string | null;
  note?: string;
};

export type ReconciliationSeverity = "info" | "warning" | "critical";

export type ReconciliationEntry = {
  metricId: string;
  label: string;
  primarySource: SnapshotSourceId;
  primaryValue: number;
  secondarySource: SnapshotSourceId;
  secondaryValue: number;
  delta: number;
  deltaPct: number;
  severity: ReconciliationSeverity;
  resolution: "primary_wins";
};

export type SnapshotMarketing = {
  paidLeads: SnapshotMetric;
  organicLeads: SnapshotMetric;
  qualifiedLeads: SnapshotMetric;
  adSpend: SnapshotMetric;
  cpl: SnapshotMetric;
  cpql: SnapshotMetric;
  daily: DailyMetrics[];
  markets: string[];
  channels: string[];
};

export type SnapshotSales = {
  revenue: SnapshotMetric;
  salesCount: SnapshotMetric;
  invoicesCount: SnapshotMetric;
  invoicesAmount: SnapshotMetric;
  cancelledInvoicesCount: SnapshotMetric;
  cancelledInvoicesAmount: SnapshotMetric;
  averagePaidCheck: SnapshotMetric;
  salesConversion: SnapshotMetric;
  invoiceConversion: SnapshotMetric;
  managers: ManagerMetrics[];
  invoiceCountries: CountryInvoiceMetrics[];
  invoiceManagers: ManagerInvoiceMetrics[];
  invoiceProducts: ProductInvoiceMetrics[];
  countryOptions: string[];
  productOptions: string[];
};

export type SnapshotFinance = {
  payroll: SnapshotMetric;
  overheadFixed: SnapshotMetric;
  unitCost: SnapshotMetric;
  taxRate: SnapshotMetric;
  discountRate: SnapshotMetric;
  deliveryCost: SnapshotMetric;
  cashBalance: SnapshotMetric;
};

export type SnapshotProduction = {
  productionHours: SnapshotMetric;
  hoursPerOrder: SnapshotMetric;
  defectRate: SnapshotMetric;
  maxOrders: SnapshotMetric;
  utilization: SnapshotMetric;
};

export type SnapshotHr = {
  managerCount: SnapshotMetric;
  productionStaff: SnapshotMetric;
  supportStaff: SnapshotMetric;
  avgSalary: SnapshotMetric;
  leadsPerManager: SnapshotMetric;
  managerProductivity: SnapshotMetric;
};

export type SnapshotQuality = {
  dialogue: DialogueQualityMetrics;
  conversation: ConversationDashboardMetrics | null;
  qualityScore: SnapshotMetric;
  potentialLostRevenue: SnapshotMetric;
};

export type SnapshotTraining = {
  activeTrainees: SnapshotMetric;
  completedModules: SnapshotMetric;
  averageQuizScore: SnapshotMetric;
};

export type SnapshotMeta = {
  period: PeriodKey;
  builtAt: string;
  dataMode: SnapshotDataMode;
  sources: SourceAvailability[];
  reconciliations: ReconciliationEntry[];
};

/**
 * Company Snapshot — единый снимок компании за период.
 * Все вычислительные модули OS One читают только этот объект.
 */
export type CompanySnapshot = {
  version: 1;
  meta: SnapshotMeta;

  marketing: SnapshotMarketing;
  sales: SnapshotSales;
  finance: SnapshotFinance;
  production: SnapshotProduction;
  hr: SnapshotHr;
  quality: SnapshotQuality;
  training: SnapshotTraining;

  /** Канонический месячный срез после применения SSOT-правил. */
  canonical: MonthlyMetrics;
  /** Канонический дневной срез (маркетинг + продажи по датам). */
  daily: DailyMetrics[];
};

export type BuildSnapshotOptions = {
  period: PeriodKey;
  refresh?: boolean;
  previousPeriod?: PeriodKey;
};

export type CompanySnapshotPayload = {
  snapshot: CompanySnapshot;
  previous: CompanySnapshot | null;
  builtAt: string;
  fromCache: boolean;
};
