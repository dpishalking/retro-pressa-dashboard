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
    definition: "Средняя оплаченная выручка на заказ."
  },
  cac: {
    id: "cac",
    label: "CAC",
    definition: "Рекламный бюджет / число оплат."
  },
  cpl: {
    id: "cpl",
    label: "CPL",
    definition: "Рекламный бюджет / проверенные лиды СВОД."
  },
  ad_spend: {
    id: "ad_spend",
    label: "Рекламный бюджет",
    definition: "Расход на рекламу из СВОД / Traffic."
  },
  roas: {
    id: "roas",
    label: "ROAS",
    definition: "Атрибутированная выручка маркетинга / рекламный бюджет."
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
  production_load: {
    id: "production_load",
    label: "Производство",
    definition: "Загрузка производства (когда источник подключён)."
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
  },
  cash: {
    id: "cash",
    label: "Касса",
    definition: "Денежный остаток из финансового снимка."
  }
};

export function metricLabel(id: string, fallback?: string): string {
  return METRIC_GLOSSARY[id]?.label ?? fallback ?? id;
}

export function metricDefinition(id: string): string | null {
  return METRIC_GLOSSARY[id]?.definition ?? null;
}
