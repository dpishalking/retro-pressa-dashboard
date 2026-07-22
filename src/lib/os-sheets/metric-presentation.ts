/**
 * UI / snapshot labels for dual revenue canons.
 * Do not display two unlabeled "выручка" metrics.
 */

export type MetricPresentation = {
  metricId: string;
  titleRu: string;
  sourceLabelRu: string;
  canonicalScope: string;
};

export const METRIC_PRESENTATIONS: MetricPresentation[] = [
  {
    metricId: "os_paid_revenue",
    titleRu: "Оплаченная выручка",
    sourceLabelRu: "Источник: OS / Bitrix Payments",
    canonicalScope: "company,finance,sales"
  },
  {
    metricId: "svod_attributed_revenue",
    titleRu: "Атрибутированная выручка",
    sourceLabelRu: "Источник: Маркетинговый СВОД",
    canonicalScope: "marketing"
  },
  {
    metricId: "ad_spend",
    titleRu: "Рекламный бюджет",
    sourceLabelRu: "Источник: СВОД / Traffic",
    canonicalScope: "marketing,finance"
  },
  {
    metricId: "average_check",
    titleRu: "Средний чек (OS)",
    sourceLabelRu: "Источник: OS Payments",
    canonicalScope: "company,sales,finance"
  }
];

export function getMetricPresentation(metricId: string): MetricPresentation | undefined {
  return METRIC_PRESENTATIONS.find((item) => item.metricId === metricId);
}
