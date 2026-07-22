import {
  METRICS_REGISTRY_COLUMNS,
  OS_SPREADSHEET_ID,
  OS_TABS,
  type MetricsRegistryColumn
} from "@/config/os-sheets";
import { safeReplaceSheet } from "@/lib/os-sheets/safe-write";
import { withSyncRun } from "@/lib/os-sheets/sync-runs";
import { readGoogleServiceAccount } from "@/lib/google/sheets-client";

export type SyncOsMetricsRegistryOptions = {
  spreadsheetId?: string;
  dryRun?: boolean;
  triggerType?: "cron" | "manual" | "api" | "script";
};

function buildMetrics(updatedAt: string): Array<Record<MetricsRegistryColumn, string>> {
  const rows: Array<Omit<Record<MetricsRegistryColumn, string>, never>> = [
    {
      metric_id: "os_paid_revenue",
      metric_name: "Оплаченная выручка",
      description: "Bitrix WON / Payments_Core by paid_at",
      formula: "SUM(Payments_Core.amount)",
      numerator_metric_id: "",
      denominator_metric_id: "",
      source_id: "bitrix_payments",
      grain: "day|month",
      canonical_scope: "company,finance,sales",
      owner: "sales_finance",
      currency: "EUR",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "svod_attributed_revenue",
      metric_name: "Атрибутированная выручка (СВОД)",
      description: "Marketing-attributed revenue from СВОД График",
      formula: "График.Выручка",
      numerator_metric_id: "",
      denominator_metric_id: "",
      source_id: "svod_grafik",
      grain: "month",
      canonical_scope: "marketing",
      owner: "marketing",
      currency: "EUR",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "revenue_reconciliation_delta",
      metric_name: "Дельта сверки выручки",
      description: "os_paid_revenue − svod_attributed_revenue",
      formula: "os_paid_revenue - svod_attributed_revenue",
      numerator_metric_id: "os_paid_revenue",
      denominator_metric_id: "svod_attributed_revenue",
      source_id: "reconciliation",
      grain: "month",
      canonical_scope: "finance,marketing",
      owner: "finance",
      currency: "EUR",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "revenue_reconciliation_delta_pct",
      metric_name: "Дельта сверки выручки %",
      description: "delta / svod_attributed_revenue",
      formula: "revenue_reconciliation_delta / svod_attributed_revenue",
      numerator_metric_id: "revenue_reconciliation_delta",
      denominator_metric_id: "svod_attributed_revenue",
      source_id: "reconciliation",
      grain: "month",
      canonical_scope: "finance,marketing",
      owner: "finance",
      currency: "",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "os_payments_count",
      metric_name: "Оплаты (шт)",
      description: "Count of paid Orders / Payments_Core",
      formula: "COUNT(Payments_Core)",
      numerator_metric_id: "",
      denominator_metric_id: "",
      source_id: "bitrix_payments",
      grain: "day|month",
      canonical_scope: "company,sales,finance",
      owner: "sales_finance",
      currency: "",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "os_deals_count",
      metric_name: "Сделки CRM",
      description: "Orders spine deals created in period",
      formula: "COUNT(Orders by created_at)",
      numerator_metric_id: "",
      denominator_metric_id: "",
      source_id: "bitrix_orders",
      grain: "day|month",
      canonical_scope: "sales",
      owner: "sales",
      currency: "",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "os_invoices_count",
      metric_name: "Счета (шт)",
      description: "Orders with invoice_at in period",
      formula: "COUNT(Orders with invoice_at)",
      numerator_metric_id: "",
      denominator_metric_id: "",
      source_id: "bitrix_orders",
      grain: "day|month",
      canonical_scope: "sales",
      owner: "sales",
      currency: "",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "traffic_leads_raw",
      metric_name: "Лиды трафик (raw)",
      description: "Лиды CRM from marketing day / Traffic_Daily paid",
      formula: "SUM(Traffic_Daily.leads where paid)",
      numerator_metric_id: "",
      denominator_metric_id: "",
      source_id: "svod_day",
      grain: "day|month",
      canonical_scope: "traffic,marketing",
      owner: "marketing",
      currency: "",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "traffic_leads_verified",
      metric_name: "Лиды трафик (СВОД verified)",
      description: "Monthly verified leads from СВОД График",
      formula: "График.Лиды",
      numerator_metric_id: "",
      denominator_metric_id: "",
      source_id: "svod_grafik",
      grain: "month",
      canonical_scope: "marketing",
      owner: "marketing",
      currency: "",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "crm_leads",
      metric_name: "Лиды CRM (Bitrix)",
      description: "Operational Bitrix leads excluding spam/reviews",
      formula: "COUNT(Bitrix leads)",
      numerator_metric_id: "",
      denominator_metric_id: "",
      source_id: "bitrix_leads",
      grain: "month",
      canonical_scope: "sales",
      owner: "sales",
      currency: "",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "paid_leads",
      metric_name: "Платные лиды (Traffic)",
      description: "Paid social leads from Traffic_Daily",
      formula: "SUM(paid_leads)",
      numerator_metric_id: "",
      denominator_metric_id: "",
      source_id: "svod_day",
      grain: "day|month",
      canonical_scope: "traffic,marketing",
      owner: "marketing",
      currency: "",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "ad_spend",
      metric_name: "Рекламный бюджет",
      description: "Verified spend from СВОД / Traffic",
      formula: "SUM(spend)",
      numerator_metric_id: "",
      denominator_metric_id: "",
      source_id: "svod_grafik",
      grain: "day|month",
      canonical_scope: "marketing,finance",
      owner: "marketing",
      currency: "EUR",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "cpl",
      metric_name: "CPL",
      description: "ad_spend / traffic_leads_verified",
      formula: "ad_spend / traffic_leads_verified",
      numerator_metric_id: "ad_spend",
      denominator_metric_id: "traffic_leads_verified",
      source_id: "svod_grafik",
      grain: "month",
      canonical_scope: "marketing",
      owner: "marketing",
      currency: "EUR",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "cac",
      metric_name: "CAC",
      description: "ad_spend / svod sales count",
      formula: "ad_spend / svod_sales_count",
      numerator_metric_id: "ad_spend",
      denominator_metric_id: "",
      source_id: "svod_grafik",
      grain: "month",
      canonical_scope: "marketing",
      owner: "marketing",
      currency: "EUR",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "roas",
      metric_name: "ROAS",
      description: "svod_attributed_revenue / ad_spend",
      formula: "svod_attributed_revenue / ad_spend",
      numerator_metric_id: "svod_attributed_revenue",
      denominator_metric_id: "ad_spend",
      source_id: "svod_grafik",
      grain: "month",
      canonical_scope: "marketing",
      owner: "marketing",
      currency: "",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "average_check",
      metric_name: "Средний чек (OS)",
      description: "os_paid_revenue / os_payments_count",
      formula: "os_paid_revenue / os_payments_count",
      numerator_metric_id: "os_paid_revenue",
      denominator_metric_id: "os_payments_count",
      source_id: "bitrix_payments",
      grain: "day|month",
      canonical_scope: "company,sales,finance",
      owner: "sales_finance",
      currency: "EUR",
      status: "active",
      version: "1",
      updated_at: updatedAt
    },
    {
      metric_id: "payment_conversion",
      metric_name: "Конверсия в оплату",
      description: "os_payments_count / os_deals_count",
      formula: "os_payments_count / os_deals_count",
      numerator_metric_id: "os_payments_count",
      denominator_metric_id: "os_deals_count",
      source_id: "bitrix_orders",
      grain: "month",
      canonical_scope: "sales",
      owner: "sales",
      currency: "",
      status: "active",
      version: "1",
      updated_at: updatedAt
    }
  ];
  return rows;
}

export async function syncOsMetricsRegistryToSheet(options: SyncOsMetricsRegistryOptions = {}) {
  if (!readGoogleServiceAccount()) throw new Error("Google service account is not configured");
  const spreadsheetId = options.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  const syncedAt = new Date().toISOString();
  const rows = buildMetrics(syncedAt);
  const sheetRows = rows.map((row) => METRICS_REGISTRY_COLUMNS.map((column) => row[column]));

  if (options.dryRun) {
    return { ok: true as const, spreadsheetId, tabTitle: OS_TABS.metricsRegistry, rowsWritten: rows.length, dryRun: true, syncedAt, rowsRead: rows.length };
  }

  return withSyncRun({
    syncName: "os-metrics-registry",
    source: "contracts",
    target: OS_TABS.metricsRegistry,
    spreadsheetId,
    startedAt: syncedAt,
    schemaVersion: "2",
    triggerType: options.triggerType || "script"
  }, async () => {
    await safeReplaceSheet({
      spreadsheetId,
      tabTitle: OS_TABS.metricsRegistry,
      expectedColumns: METRICS_REGISTRY_COLUMNS,
      rows: sheetRows,
      clearRange: `'${OS_TABS.metricsRegistry}'!A:N`,
      schemaVersion: "2"
    });
    return {
      ok: true as const,
      spreadsheetId,
      tabTitle: OS_TABS.metricsRegistry,
      rowsWritten: rows.length,
      rowsRead: rows.length,
      dryRun: false,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      syncedAt
    };
  });
}
