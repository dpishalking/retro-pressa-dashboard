/**
 * Business OS Google Sheets contract (management + predictive foundation).
 * Spreadsheet: docs/business-os — Orders bridge + Registry.
 * Schema source of truth for columns also lives in the sheet tabs + 99_Bitrix_Map.
 */

export const OS_SPREADSHEET_ID =
  process.env.GOOGLE_OS_SHEET_ID?.trim() || "1iahEEemT9KusDJts9HxtgdjRFy7AViG_QqzJDtsQEu8";

export const OS_TABS = {
  registry: "00_Registry",
  trafficDaily: "01_Traffic_Daily",
  organicDaily: "Органика",
  salesDaily: "02_Sales_Daily",
  orders: "03_Orders",
  productionJobs: "04_Production_Jobs",
  reviewsNps: "05_Reviews_NPS",
  products: "06_Products",
  financeDaily: "07_Finance_Daily",
  dialogExport: "08_Dialog_Export",
  bitrixMap: "99_Bitrix_Map"
} as const;

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
  "bitrix_url",
  "customer_key",
  "manager_id",
  "manager_name",
  "country",
  "product_sku",
  "product_name",
  "amount",
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
export const ORDERS_NUMERIC_COLUMNS = ["amount", "invoice_amount"] as const satisfies ReadonlyArray<OrdersColumn>;

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
