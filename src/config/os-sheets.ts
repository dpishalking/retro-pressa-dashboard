/**
 * Business OS Google Sheets contract (management + predictive foundation).
 * Spreadsheet: docs/business-os — Orders bridge + Registry.
 * Schema source of truth for columns also lives in the sheet tabs + 99_Bitrix_Map.
 */

export const OS_SPREADSHEET_ID =
  process.env.GOOGLE_OS_SHEET_ID?.trim() || "1iahEEemT9KusDJts9HxtgdjRFy7AViG_QqzJDtsQEu8";

/** Full dialog transcripts live here — not copied into mother. */
export const OS_DIALOGS_SPREADSHEET_ID =
  process.env.GOOGLE_DIALOGS_SHEET_ID?.trim() || "1mQEcDnybKM6HLfJbOkgdNu3hMo3_3kxLbmRp_6DcQmo";

export const OS_DIALOGS_PERIOD_TABS = [
  { period: "may-2026", tab_title: "Сообщения май 2026", gid: 652664916 },
  { period: "june-2026", tab_title: "Сообщения июнь 2026", gid: 121529567 },
  { period: "july-2026", tab_title: "Июль 2026", gid: 733644567 }
] as const;

export const OS_TABS = {
  registry: "00_Registry",
  metricsRegistry: "00_Metrics_Registry",
  dataSources: "00_Data_Sources",
  changeLog: "00_Change_Log",
  syncRuns: "00_Sync_Runs",
  trafficDaily: "01_Traffic_Daily",
  organicDaily: "Органика",
  salesDaily: "02_Sales_Daily",
  orders: "03_Orders",
  productionJobs: "04_Production_Jobs",
  reviewsNps: "05_Reviews_NPS",
  products: "06_Products",
  financeDaily: "07_Finance_Daily",
  dialogExport: "08_Dialog_Export",
  countries: "10_Countries",
  channels: "11_Channels",
  employees: "12_Employees",
  customersCore: "21_Customers_Core",
  paymentsCore: "24_Payments_Core",
  companyDaily: "30_Company_Daily",
  companyMonthly: "31_Company_Monthly",
  reconciliation: "50_Reconciliation",
  bitrixMap: "99_Bitrix_Map"
} as const;

/** Verified marketing monthly KPIs (СВОД Retro Pressa → tab График). */
export const OS_SVOD_SPREADSHEET_ID =
  process.env.GOOGLE_TRAFFIC_SHEET_ID?.trim() || "1nItFm1eqBMVBJF1ZSBuBKZX-g03wx5v60l7h7Pqey4M";
export const OS_SVOD_TAB = "График";
export const OS_SVOD_GID = 341885213;

export const METRICS_REGISTRY_COLUMNS = [
  "metric_id",
  "metric_name",
  "description",
  "formula",
  "numerator_metric_id",
  "denominator_metric_id",
  "source_id",
  "grain",
  "canonical_scope",
  "owner",
  "currency",
  "status",
  "version",
  "updated_at"
] as const;

export type MetricsRegistryColumn = (typeof METRICS_REGISTRY_COLUMNS)[number];

export const DATA_SOURCES_COLUMNS = [
  "source_id",
  "source_name",
  "source_type",
  "spreadsheet_id",
  "sheet_name",
  "gid",
  "system_owner",
  "business_owner",
  "grain",
  "primary_key",
  "refresh_mode",
  "refresh_schedule",
  "canonical_for",
  "last_success_at",
  "last_status",
  "notes"
] as const;

export type DataSourcesColumn = (typeof DATA_SOURCES_COLUMNS)[number];

export const CHANGE_LOG_COLUMNS = [
  "change_id",
  "changed_at",
  "change_type",
  "system",
  "entity",
  "description",
  "reason",
  "author",
  "version"
] as const;

export type ChangeLogColumn = (typeof CHANGE_LOG_COLUMNS)[number];

export const SYNC_RUNS_COLUMNS = [
  "sync_id",
  "sync_name",
  "started_at",
  "finished_at",
  "status",
  "source",
  "target",
  "rows_read",
  "rows_written",
  "rows_skipped",
  "rows_rejected",
  "schema_version",
  "error_code",
  "error_message",
  "trigger_type"
] as const;

export type SyncRunsColumn = (typeof SYNC_RUNS_COLUMNS)[number];

export const COUNTRIES_COLUMNS = [
  "country_id",
  "country_name",
  "country_code",
  "currency",
  "is_active",
  "source",
  "updated_at"
] as const;

export const CHANNELS_COLUMNS = [
  "channel_id",
  "channel_name",
  "channel_group",
  "source_system",
  "is_paid",
  "is_active",
  "updated_at"
] as const;

export const EMPLOYEES_COLUMNS = [
  "employee_id",
  "employee_name",
  "department",
  "role",
  "bitrix_user_id",
  "is_active",
  "source",
  "updated_at"
] as const;

/** Grain: one row = one customer_key (derived from Orders). */
export const CUSTOMERS_COLUMNS = [
  "customer_key",
  "customer_key_type",
  "country",
  "first_order_id",
  "last_order_id",
  "first_deal_at",
  "last_deal_at",
  "deals_count",
  "paid_orders_count",
  "total_paid_revenue",
  "last_manager_id",
  "last_manager_name",
  "data_status",
  "last_sync_at"
] as const;

export type CustomersColumn = (typeof CUSTOMERS_COLUMNS)[number];

export const CUSTOMERS_NUMERIC_COLUMNS = [
  "deals_count",
  "paid_orders_count",
  "total_paid_revenue"
] as const satisfies ReadonlyArray<CustomersColumn>;

export const COMPANY_MONTHLY_COLUMNS = [
  "month",
  "traffic_leads",
  "organic_leads",
  "crm_deals",
  "invoices",
  "payments",
  "os_paid_revenue",
  "svod_attributed_revenue",
  "revenue_reconciliation_delta",
  "revenue_reconciliation_delta_pct",
  "ad_spend",
  "cpl",
  "cac",
  "roas",
  "average_check",
  "payroll",
  "opex",
  "gross_profit",
  "operating_profit",
  "data_as_of",
  "sync_updated_at"
] as const;

export type CompanyMonthlyColumn = (typeof COMPANY_MONTHLY_COLUMNS)[number];

export const COMPANY_MONTHLY_NUMERIC_COLUMNS = [
  "traffic_leads",
  "organic_leads",
  "crm_deals",
  "invoices",
  "payments",
  "os_paid_revenue",
  "svod_attributed_revenue",
  "revenue_reconciliation_delta",
  "revenue_reconciliation_delta_pct",
  "ad_spend",
  "cpl",
  "cac",
  "roas",
  "average_check",
  "payroll",
  "opex",
  "gross_profit",
  "operating_profit"
] as const satisfies ReadonlyArray<CompanyMonthlyColumn>;

export const COMPANY_MONTHLY_MANUAL_COLUMNS = ["payroll", "opex"] as const satisfies ReadonlyArray<CompanyMonthlyColumn>;

export const RECONCILIATION_COLUMNS = [
  "period",
  "metric_id",
  "source_a",
  "value_a",
  "source_b",
  "value_b",
  "delta",
  "delta_pct",
  "status",
  "comment",
  "owner",
  "updated_at"
] as const;

export type ReconciliationColumn = (typeof RECONCILIATION_COLUMNS)[number];

/** Grain: one row = one paid order / payment. */
export const PAYMENTS_COLUMNS = [
  "payment_id",
  "order_id",
  "deal_id",
  "customer_key",
  "paid_at",
  "amount",
  "currency",
  "manager_id",
  "manager_name",
  "product_sku",
  "product_name",
  "country",
  "data_status",
  "last_sync_at",
  "source_of_truth"
] as const;

export type PaymentsColumn = (typeof PAYMENTS_COLUMNS)[number];

export const PAYMENTS_NUMERIC_COLUMNS = ["amount"] as const satisfies ReadonlyArray<PaymentsColumn>;

/** Grain: one calendar day — company management view. */
export const COMPANY_DAILY_COLUMNS = [
  "date",
  "paid_leads",
  "organic_leads",
  "leads_total",
  "ad_spend",
  "deals_created",
  "invoices",
  "payments",
  "revenue",
  "average_check",
  "data_status",
  "last_sync_at",
  "source_of_truth"
] as const;

export type CompanyDailyColumn = (typeof COMPANY_DAILY_COLUMNS)[number];

export const COMPANY_DAILY_NUMERIC_COLUMNS = [
  "paid_leads",
  "organic_leads",
  "leads_total",
  "ad_spend",
  "deals_created",
  "invoices",
  "payments",
  "revenue",
  "average_check"
] as const satisfies ReadonlyArray<CompanyDailyColumn>;

/**
 * Grain: one row = one period pointer to the dialogs workbook.
 * No message bodies — transcripts stay in OS_DIALOGS_SPREADSHEET_ID.
 */
export const DIALOG_EXPORT_COLUMNS = [
  "period",
  "spreadsheet_id",
  "tab_title",
  "gid",
  "sheet_url",
  "rows_count",
  "grain_type",
  "data_status",
  "last_sync_at",
  "notes"
] as const;

export type DialogExportColumn = (typeof DIALOG_EXPORT_COLUMNS)[number];

/** Grain: one row = date + channel (+ source). Numbers must be real NUMBER cells. */
export const TRAFFIC_COLUMNS = [
  "date",
  "channel",
  "lead_kind",
  "source",
  "campaign",
  "country",
  "spend",
  "clicks",
  "leads",
  "qualified_leads",
  "cpl",
  "orders",
  "revenue",
  "data_status",
  "last_sync_at",
  "source_sheet"
] as const;

export type TrafficColumn = (typeof TRAFFIC_COLUMNS)[number];

export const TRAFFIC_NUMERIC_COLUMNS = [
  "spend",
  "clicks",
  "leads",
  "qualified_leads",
  "cpl",
  "orders",
  "revenue"
] as const satisfies ReadonlyArray<TrafficColumn>;

/**
 * Grain: one row = date + manager (daily sales summary, not event rows).
 * Auto-derived from 03_Orders activity dates.
 */
export const SALES_DAILY_COLUMNS = [
  "date",
  "manager_id",
  "manager_name",
  "deals_created",
  "invoices",
  "payments",
  "revenue",
  "average_check",
  "lost",
  "created_to_invoice_cr",
  "created_to_paid_cr",
  "data_status",
  "last_sync_at",
  "source_of_truth"
] as const;

export type SalesDailyColumn = (typeof SALES_DAILY_COLUMNS)[number];

export const SALES_DAILY_NUMERIC_COLUMNS = [
  "deals_created",
  "invoices",
  "payments",
  "revenue",
  "average_check",
  "lost",
  "created_to_invoice_cr",
  "created_to_paid_cr"
] as const satisfies ReadonlyArray<SalesDailyColumn>;

/**
 * Grain: one row = one calendar date (management P&L / cash day).
 * Auto from Orders+Traffic; manual fields are preserved on sync.
 */
export const FINANCE_COLUMNS = [
  "date",
  "fact_revenue",
  "cash_in",
  "cash_out",
  "ad_spend",
  "payroll",
  "opex",
  "net_cash_flow",
  "margin",
  "plan_revenue",
  "plan_cash_in",
  "mtd_revenue",
  "run_rate_revenue",
  "rr_pct",
  "plan_completion_pct",
  "forecast_revenue",
  "cash_balance",
  "paid_orders",
  "data_status",
  "source_of_truth",
  "last_sync_at",
  "notes"
] as const;

export type FinanceColumn = (typeof FINANCE_COLUMNS)[number];

export const FINANCE_NUMERIC_COLUMNS = [
  "fact_revenue",
  "cash_in",
  "cash_out",
  "ad_spend",
  "payroll",
  "opex",
  "net_cash_flow",
  "margin",
  "plan_revenue",
  "plan_cash_in",
  "mtd_revenue",
  "run_rate_revenue",
  "rr_pct",
  "plan_completion_pct",
  "forecast_revenue",
  "cash_balance",
  "paid_orders"
] as const satisfies ReadonlyArray<FinanceColumn>;

/** Manual / plan fields — never overwritten by auto sync. */
export const FINANCE_MANUAL_COLUMNS = [
  "cash_out",
  "payroll",
  "opex",
  "plan_revenue",
  "plan_cash_in",
  "forecast_revenue",
  "cash_balance",
  "notes"
] as const satisfies ReadonlyArray<FinanceColumn>;

/** Grain: one row = one order_id. v1 order_id = Bitrix deal.ID */
export const ORDERS_COLUMNS = [
  "order_id",
  "created_at",
  "lead_id",
  "deal_id",
  "deal_title",
  "bitrix_url",
  "customer_key",
  "customer_key_type",
  "manager_id",
  "manager_name",
  "country",
  "product_sku",
  "product_name",
  "amount",
  "opportunity",
  "currency",
  "invoice_amount",
  "invoice_at",
  "payment_status",
  "paid_at",
  "order_status",
  "stage_id",
  "stage_semantic",
  "production_status",
  "production_deadline",
  "shipment_id",
  "delivery_status",
  "delivery_deadline",
  "source_channel",
  "source_campaign",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "source_of_truth",
  "data_status",
  "updated_at",
  "notes"
] as const;

export type OrdersColumn = (typeof ORDERS_COLUMNS)[number];

/** Never overwritten by Bitrix sync — ops fills these in Sheets. */
export const ORDERS_MANUAL_COLUMNS = [
  "production_status",
  "production_deadline",
  "shipment_id",
  "delivery_status",
  "delivery_deadline",
  "notes"
] as const satisfies ReadonlyArray<OrdersColumn>;

export type OrdersManualColumn = (typeof ORDERS_MANUAL_COLUMNS)[number];

/** Must be real numbers in Sheets (SUM/AVERAGE), never text with apostrophe. */
export const ORDERS_NUMERIC_COLUMNS = ["amount", "opportunity", "invoice_amount"] as const satisfies ReadonlyArray<OrdersColumn>;

export type OrdersNumericColumn = (typeof ORDERS_NUMERIC_COLUMNS)[number];

export type OrdersBitrixMapping = {
  column: OrdersColumn;
  bitrixEntity: "deal" | "lead" | "user" | "productrows" | "none";
  bitrixField: string;
  transform: string;
  editableInSheets: boolean;
};

/**
 * Hybrid rule:
 * - Bitrix fills CRM fields on sync
 * - Sheets may override ops fields (production/delivery/notes/country/product)
 * - source_of_truth becomes "hybrid" when a manual override is present
 */
export const ORDERS_BITRIX_MAP: OrdersBitrixMapping[] = [
  { column: "order_id", bitrixEntity: "deal", bitrixField: "ID", transform: "order_id = deal.ID (v1)", editableInSheets: false },
  { column: "created_at", bitrixEntity: "deal", bitrixField: "DATE_CREATE", transform: "ISO datetime", editableInSheets: false },
  { column: "lead_id", bitrixEntity: "deal", bitrixField: "LEAD_ID", transform: "as-is", editableInSheets: false },
  { column: "deal_id", bitrixEntity: "deal", bitrixField: "ID", transform: "as-is", editableInSheets: false },
  { column: "bitrix_url", bitrixEntity: "deal", bitrixField: "ID", transform: "{portal}/crm/deal/details/{ID}/", editableInSheets: false },
  { column: "customer_key", bitrixEntity: "none", bitrixField: "TBD", transform: "CONTACT_ID or phone/email hash", editableInSheets: true },
  { column: "manager_id", bitrixEntity: "deal", bitrixField: "ASSIGNED_BY_ID", transform: "as-is", editableInSheets: false },
  { column: "manager_name", bitrixEntity: "user", bitrixField: "NAME+LAST_NAME", transform: "lookup user by ASSIGNED_BY_ID", editableInSheets: false },
  { column: "country", bitrixEntity: "deal", bitrixField: "UF_CRM_6797B3DA00D16", transform: "enum→label; fallback lead UF_CRM_1737995147", editableInSheets: true },
  { column: "product_sku", bitrixEntity: "productrows", bitrixField: "PRODUCT_ID", transform: "primary product row", editableInSheets: true },
  { column: "product_name", bitrixEntity: "productrows", bitrixField: "PRODUCT_NAME", transform: "primary product row", editableInSheets: true },
  { column: "amount", bitrixEntity: "deal", bitrixField: "OPPORTUNITY", transform: "number EUR", editableInSheets: true },
  { column: "currency", bitrixEntity: "none", bitrixField: "—", transform: "default EUR", editableInSheets: true },
  { column: "invoice_amount", bitrixEntity: "deal", bitrixField: "UF_CRM_1739982211", transform: "number; fallback OPPORTUNITY", editableInSheets: false },
  { column: "invoice_at", bitrixEntity: "deal", bitrixField: "UF_CRM_1758618010118", transform: "date; fallback stage history STAGE_ID=1", editableInSheets: false },
  { column: "payment_status", bitrixEntity: "deal", bitrixField: "STAGE_SEMANTIC_ID+invoice", transform: "unpaid|invoiced|paid|cancelled|lost", editableInSheets: true },
  { column: "paid_at", bitrixEntity: "deal", bitrixField: "CLOSEDATE", transform: "when STAGE_SEMANTIC_ID=S", editableInSheets: false },
  { column: "order_status", bitrixEntity: "deal", bitrixField: "STAGE_ID", transform: "new|in_progress|invoiced|paid|cancelled|lost", editableInSheets: true },
  { column: "stage_id", bitrixEntity: "deal", bitrixField: "STAGE_ID", transform: "as-is", editableInSheets: false },
  { column: "stage_semantic", bitrixEntity: "deal", bitrixField: "STAGE_SEMANTIC_ID", transform: "P|S|F", editableInSheets: false },
  { column: "production_status", bitrixEntity: "none", bitrixField: "—", transform: "manual / 04_Production_Jobs", editableInSheets: true },
  { column: "production_deadline", bitrixEntity: "none", bitrixField: "—", transform: "manual", editableInSheets: true },
  { column: "shipment_id", bitrixEntity: "none", bitrixField: "—", transform: "manual", editableInSheets: true },
  { column: "delivery_status", bitrixEntity: "none", bitrixField: "—", transform: "manual", editableInSheets: true },
  { column: "delivery_deadline", bitrixEntity: "none", bitrixField: "—", transform: "manual", editableInSheets: true },
  { column: "source_channel", bitrixEntity: "deal", bitrixField: "SOURCE_ID", transform: "paid FB/IG vs organic/other", editableInSheets: true },
  { column: "source_campaign", bitrixEntity: "deal", bitrixField: "UTM_CAMPAIGN", transform: "UTM / WEB extract", editableInSheets: true },
  { column: "utm_source", bitrixEntity: "lead", bitrixField: "UTM_SOURCE", transform: "extract", editableInSheets: false },
  { column: "utm_medium", bitrixEntity: "lead", bitrixField: "UTM_MEDIUM", transform: "extract", editableInSheets: false },
  { column: "utm_campaign", bitrixEntity: "lead", bitrixField: "UTM_CAMPAIGN", transform: "extract", editableInSheets: false },
  { column: "source_of_truth", bitrixEntity: "none", bitrixField: "—", transform: "bitrix|hybrid|manual", editableInSheets: false },
  { column: "data_status", bitrixEntity: "none", bitrixField: "—", transform: "live|partial|manual", editableInSheets: false },
  { column: "updated_at", bitrixEntity: "none", bitrixField: "—", transform: "sync timestamp", editableInSheets: false },
  { column: "notes", bitrixEntity: "none", bitrixField: "—", transform: "free text", editableInSheets: true }
];
