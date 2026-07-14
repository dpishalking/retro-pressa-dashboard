import type { SnapshotSourceId } from "./types";

export type MetricSsotRule = {
  metricId: string;
  label: string;
  primarySource: SnapshotSourceId;
  /** Secondary source used only for reconciliation, never for the canonical value. */
  reconcileWith?: SnapshotSourceId;
  warningDeltaPct?: number;
  criticalDeltaPct?: number;
};

/**
 * Single Source of Truth rules.
 * Each metric has exactly one authoritative source.
 */
export const SSOT_RULES: MetricSsotRule[] = [
  { metricId: "paidLeads", label: "Платные лиды", primarySource: "bitrix", reconcileWith: "google_marketing", warningDeltaPct: 0.08, criticalDeltaPct: 0.15 },
  { metricId: "organicLeads", label: "Органические лиды", primarySource: "bitrix", reconcileWith: "google_marketing", warningDeltaPct: 0.1, criticalDeltaPct: 0.2 },
  { metricId: "qualifiedLeads", label: "Квал-лиды", primarySource: "google_marketing", reconcileWith: "bitrix", warningDeltaPct: 0.1, criticalDeltaPct: 0.2 },
  { metricId: "adSpend", label: "Рекламный бюджет", primarySource: "google_marketing" },
  { metricId: "cpl", label: "CPL", primarySource: "computed" },
  { metricId: "cpql", label: "CPQL", primarySource: "computed" },

  { metricId: "revenue", label: "Выручка", primarySource: "bitrix" },
  { metricId: "salesCount", label: "Продажи", primarySource: "bitrix" },
  { metricId: "invoicesCount", label: "Счета", primarySource: "bitrix" },
  { metricId: "invoicesAmount", label: "Сумма счетов", primarySource: "bitrix" },
  { metricId: "cancelledInvoicesCount", label: "Отменённые счета", primarySource: "bitrix" },
  { metricId: "cancelledInvoicesAmount", label: "Сумма отмен", primarySource: "bitrix" },
  { metricId: "averagePaidCheck", label: "Средний чек", primarySource: "computed" },
  { metricId: "salesConversion", label: "Конверсия в продажу", primarySource: "computed" },
  { metricId: "invoiceConversion", label: "Конверсия в счёт", primarySource: "computed" },

  { metricId: "payroll", label: "ФОТ", primarySource: "google_payroll", reconcileWith: "demo_fallback" },
  { metricId: "overheadFixed", label: "Постоянные расходы", primarySource: "google_finance", reconcileWith: "demo_fallback" },
  { metricId: "unitCost", label: "Себестоимость", primarySource: "google_production", reconcileWith: "demo_fallback" },
  { metricId: "taxRate", label: "Налоги", primarySource: "google_finance", reconcileWith: "demo_fallback" },
  { metricId: "cashBalance", label: "Остаток на счёте", primarySource: "bank" },

  { metricId: "productionHours", label: "Производственные часы", primarySource: "google_production", reconcileWith: "demo_fallback" },
  { metricId: "hoursPerOrder", label: "Часов на заказ", primarySource: "google_production", reconcileWith: "demo_fallback" },
  { metricId: "defectRate", label: "Брак", primarySource: "google_production", reconcileWith: "demo_fallback" },

  { metricId: "managerCount", label: "Менеджеры", primarySource: "bitrix", reconcileWith: "demo_fallback" },
  { metricId: "avgSalary", label: "Средняя зарплата", primarySource: "google_payroll", reconcileWith: "demo_fallback" },

  { metricId: "qualityScore", label: "Качество переписок", primarySource: "conversation_analytics" },
  { metricId: "dialogueQuality", label: "Метрики качества диалогов", primarySource: "conversation_analytics", reconcileWith: "demo_fallback" },

  { metricId: "trainingProgress", label: "Прогресс обучения", primarySource: "training" }
];

export function ssotRule(metricId: string): MetricSsotRule | undefined {
  return SSOT_RULES.find((rule) => rule.metricId === metricId);
}
