/**
 * Canonical KPI labels and short definitions for UI surfaces.
 * Keep wording identical across hub, contours, Analytics, and forecasts.
 */

export type MetricGlossaryEntry = {
  id: string;
  label: string;
  /** One-line definition shown in tooltips / captions. */
  definition: string;
};

export const METRIC_GLOSSARY: Record<string, MetricGlossaryEntry> = {
  revenue: {
    id: "revenue",
    label: "Выручка",
    definition: "Оплаченная выручка по сделкам Bitrix за период."
  },
  gross_profit: {
    id: "gross_profit",
    label: "Валовая прибыль",
    definition: "Выручка минус себестоимость по сопоставленным SKU."
  },
  leads: {
    id: "leads",
    label: "Лиды",
    definition: "Проверенные лиды CRM из СВОД (день + органика), не сырые карточки Bitrix."
  },
  paid_leads: {
    id: "paid_leads",
    label: "Лиды платные",
    definition: "Платный трафик: СВОД day минус органика (уже внутри общих лидов)."
  },
  organic_leads: {
    id: "organic_leads",
    label: "Лиды органика",
    definition: "Органические лиды CRM из СВОД вкладки «Органика»."
  },
  bitrix_cards: {
    id: "bitrix_cards",
    label: "Карточки Bitrix",
    definition: "Все созданные лиды в CRM за период, включая повторные чаты."
  },
  unique_leads: {
    id: "unique_leads",
    label: "Уникальные лиды",
    definition: "Карточки Bitrix без повторов по телефону/email/контакту (с учётом истории)."
  },
  paid_orders: {
    id: "paid_orders",
    label: "Оплаты",
    definition: "Число оплаченных заказов Bitrix за период."
  },
  conversion_rate: {
    id: "conversion_rate",
    label: "Конверсия",
    definition: "Оплаты / проверенные лиды СВОД за тот же период и cutoff."
  },
  unique_conversion_rate: {
    id: "unique_conversion_rate",
    label: "Конверсия уник.",
    definition: "Оплаты / уникальные люди (без повторных чатов WhatsApp/Telegram)."
  },
  aov: {
    id: "aov",
    label: "Средний чек",
    definition: "Средняя касса на заказ, включая доставку."
  },
  product_aov: {
    id: "product_aov",
    label: "Чек продукта",
    definition: "Средний чек без доставки: (касса − доставка) / оплаты."
  },
  product_revenue_net: {
    id: "product_revenue_net",
    label: "Выручка продукта",
    definition: "Оплаченная касса минус доставка (5,5% выручки)."
  },
  product_margin_rate: {
    id: "product_margin_rate",
    label: "Средняя маржа продуктов",
    definition: "Средняя валовая маржа по оплаченным заказам с себестоимостью из Product Hub."
  },
  delivery_revenue: {
    id: "delivery_revenue",
    label: "Доставка €",
    definition: "5,5% от оплаченной кассы за период."
  },
  delivery_share_pct: {
    id: "delivery_share_pct",
    label: "Доля доставки",
    definition: "Фиксированная доля 5,5% от кассы."
  },
  cac: {
    id: "cac",
    label: "CAC",
    definition: "Рекламный бюджет СВОД / новые покупатели за период (частичная метрика)."
  },
  cpl: {
    id: "cpl",
    label: "CPL",
    definition: "Рекламный бюджет СВОД / проверенные лиды СВОД (день + органика)."
  },
  landing_cpl: {
    id: "landing_cpl",
    label: "CPL лендинга",
    definition: "Расход лендинга ALX / лиды CRM с листа подрядчика (не СВОД компании)."
  },
  ad_spend: {
    id: "ad_spend",
    label: "Рекламный бюджет",
    definition: "Факт расход СВОД tab day (MTD до вчера), не план месяца и не сумма всех подрядчиков."
  },
  roas: {
    id: "roas",
    label: "ROAS",
    definition: "Кассовая выручка Bitrix / рекламный бюджет СВОД за период."
  },
  landing_roas: {
    id: "landing_roas",
    label: "ROAS лендинга",
    definition: "Выручка заказов с листа ALX / расход лендинга за месяц."
  },
  roas_d7: {
    id: "roas_d7",
    label: "ROAS D7",
    definition: "Накопительный ROAS лендинга за календарные дни 1–7 месяца (ALX). Не cohort payback."
  },
  roas_d30: {
    id: "roas_d30",
    label: "ROAS D30",
    definition: "Накопительный ROAS лендинга за календарные дни 1–30 месяца (ALX). Не cohort payback."
  },
  repeat_rate: {
    id: "repeat_rate",
    label: "Повтор",
    definition: "Доля клиентов с повторной покупкой."
  },
  pipeline_amount: {
    id: "pipeline_amount",
    label: "Воронка €",
    definition: "Сумма открытых сделок в воронке."
  },
  overdue: {
    id: "overdue",
    label: "Без касания",
    definition: "Число открытых сделок без активности ≥ 8 дней."
  },
  pipeline_stuck_amount: {
    id: "pipeline_stuck_amount",
    label: "Зависшие €",
    definition: "Сумма открытых сделок без касания ≥ 8 дней — фокус РОП."
  }
};

export function metricLabel(id: string, fallback?: string): string {
  return METRIC_GLOSSARY[id]?.label ?? fallback ?? id;
}

export function metricDefinition(id: string): string | null {
  return METRIC_GLOSSARY[id]?.definition ?? null;
}
