import type { AnalysisScenarioDef } from "@/lib/analytics-os/analysis-scenarios/types";

/** Catalog only — no new KPIs. Each row maps to existing OS screens or an honest gap. */
export const ANALYSIS_SCENARIOS: AnalysisScenarioDef[] = [
  {
    id: "revenue-plan",
    number: 1,
    title: "Почему не выполняем план выручки?",
    question: "Где дыра: лиды, конверсия или чек?",
    trigger: "Прогноз или факт ниже плана MTD",
    readiness: "live",
    requiredMetrics: ["revenue", "leads", "conversion_rate", "aov"],
    dimensions: ["channel", "funnel"],
    reuse: "Факторный анализ /os/factors — те же три рычага, без второй формулы.",
    steps: [
      { title: "Разрыв", check: "План MTD, факт, прогноз", href: "/os/plan" },
      { title: "Факторы", check: "Лиды × CR × чек в евро", href: "/os/factors" },
      { title: "Куда идти", check: "Маркетинг, воронка или продукт", href: "/os/marketing" }
    ]
  },
  {
    id: "sales-drop",
    number: 2,
    title: "Почему стало меньше продаж?",
    question: "Мало лидов, слабая обработка или слабый оффер?",
    trigger: "Оплаты ниже темпа плана",
    readiness: "live",
    requiredMetrics: ["paid_orders", "leads", "conversion_rate"],
    dimensions: ["funnel"],
    reuse: "Воронка Bitrix + KPI оплат. Нет сравнения «вчера/7 дней» в CEO-снимке.",
    steps: [
      { title: "Оплаты", check: "Факт vs план MTD", href: "/os/plan" },
      { title: "Лиды", check: "Объём в темпе или нет", href: "/os/marketing" },
      { title: "Воронка", check: "Лид → счёт → оплата", href: "/os/funnel" }
    ]
  },
  {
    id: "cac-up",
    number: 3,
    title: "Почему вырос CAC?",
    question: "Дороже лид, хуже CR или больше расход?",
    trigger: "CAC выше плана",
    readiness: "live",
    requiredMetrics: ["cac", "cpl", "conversion_rate", "ad_spend"],
    dimensions: ["channel"],
    reuse: "Маркетинг-панель CEO. Нет истории CAC — только уровень vs план.",
    steps: [
      { title: "Уровень", check: "CAC vs план", href: "/os/marketing" },
      { title: "CPL и CR", check: "Что сильнее тянет CAC", href: "/os/unit-economics" },
      { title: "Канал", check: "Paid vs органика", href: "/os/marketing" }
    ]
  },
  {
    id: "cpl-up",
    number: 4,
    title: "CPL вырос. Почему?",
    question: "Аукцион, креатив или лендинг?",
    trigger: "CPL выше плана",
    readiness: "guided",
    requiredMetrics: ["cpl", "ad_spend", "leads"],
    dimensions: ["channel", "landing"],
    reuse: "CPL есть. CPM/CTR/Frequency нет — Ads API не подключён.",
    blockedReason: "Нет CPM, CTR, Frequency. Дальше — маркетинг и лендинги.",
    steps: [
      { title: "CPL", check: "Факт vs план", href: "/os/marketing" },
      { title: "Лендинги", check: "Подрядные книги ALX/ART", href: "/marketing" },
      { title: "GA4", check: "Каналы и посадочные", href: "/ad-analytics" }
    ]
  },
  {
    id: "leads-no-sales",
    number: 5,
    title: "Лиды есть, продаж нет",
    question: "Плохой трафик или плохая обработка?",
    trigger: "Лиды в темпе, оплаты нет",
    readiness: "live",
    requiredMetrics: ["leads", "paid_orders", "conversion_rate"],
    dimensions: ["funnel", "manager"],
    reuse: "Воронка + зависшие € + менеджеры.",
    steps: [
      { title: "Темп лидов", check: "Лиды vs план MTD", href: "/os/factors" },
      { title: "Счёт и оплата", check: "Где отвал", href: "/os/funnel" },
      { title: "Команда", check: "CR по менеджерам", href: "/os/slices?dim=manager&metric=cr" }
    ]
  },
  {
    id: "marketing-vs-sales",
    number: 6,
    title: "Маркетинг или продажи?",
    question: "Один источник у всех менеджеров слабый — или один менеджер слабый на всех источниках?",
    trigger: "Спор «плохие лиды» vs «плохая обработка»",
    readiness: "live",
    requiredMetrics: ["conversion_rate"],
    dimensions: ["manager"],
    reuse: "CR по менеджерам. Source × Manager в CEO-снимке нет — не утверждаем источник.",
    steps: [
      { title: "Разброс CR", check: "Менеджеры с ≥10 лидами", href: "/os/slices?dim=manager&metric=cr" },
      { title: "Воронка", check: "Лид → счёт vs счёт → оплата", href: "/os/funnel" },
      { title: "Срезы: канал", check: "CR по каналу на тех же фактах", href: "/os/slices?dim=channel&metric=cr" }
    ]
  },
  {
    id: "where-budget",
    number: 7,
    title: "Куда дать больше бюджета?",
    question: "Куда следующие €1 000?",
    trigger: "Есть свободный бюджет или слабый ROAS",
    readiness: "guided",
    requiredMetrics: ["ad_spend", "roas", "cac"],
    dimensions: ["country", "product", "channel"],
    reuse: "Гео, продукты, маркетинг. Нет матрицы Country × Product × Channel × JTBD.",
    steps: [
      { title: "ROAS / CAC", check: "Юнит и маркетинг", href: "/os/unit-economics" },
      { title: "Страны", check: "Где деньги и маржа", href: "/os/geography" },
      { title: "Продукты", check: "Что тянет кассу", href: "/os/products" }
    ]
  },
  {
    id: "what-to-stop",
    number: 8,
    title: "Что отключить?",
    question: "Где расход без вклада — и хватает ли выборки?",
    trigger: "Расход есть, продаж мало",
    readiness: "guided",
    requiredMetrics: ["ad_spend", "paid_orders"],
    dimensions: ["channel"],
    reuse: "Не выключаем кампанию по одному дню. Нет campaign grain в CEO.",
    steps: [
      { title: "Расход", check: "Бюджет vs оплаты", href: "/os/marketing" },
      { title: "Лендинги", check: "Payback подрядчиков", href: "/marketing" },
      { title: "Реклама", check: "GA4 кампании", href: "/ad-analytics" }
    ]
  },
  {
    id: "product-growth",
    number: 9,
    title: "Какой продукт сейчас растёт?",
    question: "Где объём, чек и маржа вместе?",
    trigger: "Нужно выбрать, что масштабировать в ассортименте",
    readiness: "guided",
    requiredMetrics: ["revenue"],
    dimensions: ["product"],
    reuse: "/os/products. Нет 7д vs 7д в CEO-снимке.",
    steps: [
      { title: "Топ SKU", check: "Выручка и доля", href: "/os/slices?dim=product&metric=revenue" },
      { title: "Чек", check: "AOV продукта", href: "/os/unit-economics" },
      { title: "Гео", check: "Продукт × страна вручную", href: "/os/geography" }
    ]
  },
  {
    id: "country-opportunity",
    number: 10,
    title: "Какая страна самая перспективная?",
    question: "Не только выручка — ещё маржа, CR, объём.",
    trigger: "Выбор рынка для роста",
    readiness: "guided",
    requiredMetrics: ["revenue"],
    dimensions: ["country"],
    reuse: "/os/geography + фильтр страны на сводке.",
    steps: [
      { title: "Касса", check: "Страны по выручке", href: "/os/geography" },
      { title: "Срез", check: "Фильтр страны на /os", href: "/os" },
      { title: "Юнит", check: "Экономика заказа", href: "/os/unit-economics" }
    ]
  },
  {
    id: "country-drop",
    number: 11,
    title: "Почему просела конкретная страна?",
    question: "Продукт, канал, воронка или менеджер?",
    trigger: "Выбрана страна, факт слабый",
    readiness: "guided",
    requiredMetrics: ["revenue"],
    dimensions: ["country", "product", "manager"],
    reuse: "Фильтр страны уже режет CEO-снимок. План на срез общий — осторожно.",
    steps: [
      { title: "Страны", check: "Где просадка", href: "/os/slices?dim=country&metric=revenue" },
      { title: "Продукт", check: "Что внутри страны", href: "/os/slices?dim=product&metric=revenue" },
      { title: "Источник", check: "Откуда лиды", href: "/os/slices?dim=source&metric=cr" }
    ]
  },
  {
    id: "jtbd",
    number: 12,
    title: "Какой JTBD лучше продаёт?",
    question: "Какой мотив клиента даёт деньги, не клики?",
    trigger: "Выбор оффера / угла",
    readiness: "blocked",
    requiredMetrics: [],
    dimensions: ["jtbd"],
    reuse: "Доска аудиторий на /marketing — качественная, без join к кассе.",
    blockedReason: "JTBD не связан с лидами и оплатами.",
    steps: [{ title: "Аудитории", check: "Качественные сегменты", href: "/marketing" }]
  },
  {
    id: "creatives-scale",
    number: 13,
    title: "Какие креативы масштабировать?",
    question: "Не CTR, а вклад до оплаты.",
    trigger: "Нужно усилить работающие смыслы",
    readiness: "blocked",
    requiredMetrics: [],
    dimensions: ["creative"],
    reuse: "Контур /os/creatives — заглушка. Ads API нет.",
    blockedReason: "Нет creative id, hook, frequency в данных.",
    steps: [{ title: "Реклама", check: "Пока только GA4 кампании", href: "/ad-analytics" }]
  },
  {
    id: "creative-fatigue",
    number: 14,
    title: "Креатив выгорел?",
    question: "Frequency ↑ и CTR ↓?",
    trigger: "Растёт CPL при том же бюджете",
    readiness: "blocked",
    requiredMetrics: [],
    dimensions: ["creative"],
    reuse: "Нет Frequency/CTR time series.",
    blockedReason: "Нет Ads API и частоты показов.",
    steps: [{ title: "CPL", check: "Косвенный сигнал", href: "/os/marketing" }]
  },
  {
    id: "landing-cr",
    number: 15,
    title: "Почему лендинг хуже конвертирует?",
    question: "Трафик, страница или качество лида после неё?",
    trigger: "Слабый лендинг у подрядчика",
    readiness: "guided",
    requiredMetrics: [],
    dimensions: ["landing"],
    reuse: "/marketing/landings — книги ALX/ART. Не путать с кассой компании.",
    steps: [
      { title: "Лендинги", check: "CPL и payback подрядчика", href: "/marketing" },
      { title: "GA4", check: "Посадочные", href: "/ad-analytics" }
    ]
  },
  {
    id: "content-sales",
    number: 16,
    title: "Контент даёт продажи или просмотры?",
    question: "Revenue per 1 000 views",
    trigger: "Спор про контент",
    readiness: "blocked",
    requiredMetrics: [],
    dimensions: ["content"],
    reuse: "Нет content → lead → sale.",
    blockedReason: "Нет reach/views/DM в BI.",
    steps: []
  },
  {
    id: "margin-drop",
    number: 17,
    title: "Почему упала маржинальность?",
    question: "Микс, доставка, COGS или реклама?",
    trigger: "Валовая прибыль слабее выручки",
    readiness: "guided",
    requiredMetrics: ["gross_profit", "delivery_revenue"],
    dimensions: ["product"],
    reuse: "Юнит-экономика и доставка 5,5%. Скидки/fees не разложены.",
    steps: [
      { title: "Маржа", check: "Gross и покрытие SKU", href: "/os/unit-economics" },
      { title: "Доставка", check: "Доля 5,5%", href: "/os/products" },
      { title: "Расход", check: "CAC / ROAS", href: "/os/marketing" }
    ]
  },
  {
    id: "cash-vs-cohort",
    number: 18,
    title: "Касса vs когорта",
    question: "Почему месяц в кассе хороший, а когорта слабая?",
    trigger: "Расхождение cash и lead-cohort",
    readiness: "guided",
    requiredMetrics: ["revenue"],
    dimensions: ["cohort"],
    reuse: "/os/cohorts уже считает оплаты по дате лида. Не дублируем модель.",
    steps: [
      { title: "Касса", check: "Оплаты периода", href: "/os/plan" },
      { title: "Когорта", check: "Лиды месяца → оплаты", href: "/os/cohorts" },
      { title: "Цикл", check: "Лаг D0–D30", href: "/os/sales-cycle" }
    ]
  },
  {
    id: "sales-cycle",
    number: 19,
    title: "Какой реальный цикл сделки?",
    question: "Медиана, P75, хвост D15+",
    trigger: "Нужен лаг для прогноза",
    readiness: "guided",
    requiredMetrics: [],
    dimensions: ["manager", "country", "channel"],
    reuse: "/os/sales-cycle — не пишем вторую модель.",
    steps: [
      { title: "Цикл", check: "D0–D30, медиана, касса vs когорта", href: "/os/sales-cycle" },
      { title: "Срезы", check: "Менеджер / страна / канал", href: "/os/slices?dim=manager&metric=cr" }
    ]
  },
  {
    id: "catch-plan",
    number: 20,
    title: "Догоним ли мы план?",
    question: "Какой темп нужен на оставшиеся дни?",
    trigger: "Всегда в середине месяца",
    readiness: "live",
    requiredMetrics: ["revenue", "paid_orders", "leads", "aov"],
    dimensions: [],
    reuse: "Прогноз run-rate из CEO-снимка. Не вторая predictive-модель.",
    steps: [
      { title: "Факт / план / прогноз", check: "Текущий темп", href: "/os/plan" },
      { title: "Нужный темп", check: "€/день, оплаты, лиды", href: "/os/factors" }
    ]
  },
  {
    id: "daily-delta",
    number: 21,
    title: "Что изменилось со вчера?",
    question: "5–7 сдвигов с денежным весом",
    trigger: "Утро собственника",
    readiness: "blocked",
    requiredMetrics: [],
    dimensions: [],
    reuse: "CEO-снимок — месяц, не день-к-дню.",
    blockedReason: "Нет вчерашнего CEO-снимка в API.",
    steps: [{ title: "Касса", check: "Пока только MTD", href: "/os" }]
  },
  {
    id: "weekly-delta",
    number: 22,
    title: "Что изменилось за неделю?",
    question: "Рост, просадка, новые возможности",
    trigger: "Еженедельный разбор",
    readiness: "blocked",
    requiredMetrics: [],
    dimensions: [],
    reuse: "Нет week-over-week в ceo-snapshot.",
    blockedReason: "Нужен недельный ряд, его нет в сводке.",
    steps: [{ title: "Когорты", check: "Неделя создания лида", href: "/os/cohorts" }]
  },
  {
    id: "month-decomp",
    number: 23,
    title: "Итог месяца: почему такой результат?",
    question: "Что дало рост и что забрало деньги?",
    trigger: "Закрытие месяца",
    readiness: "live",
    requiredMetrics: ["revenue", "leads", "conversion_rate", "aov"],
    dimensions: ["channel"],
    reuse: "Тот же факторный разбор, что сценарий 1. Не второй движок.",
    steps: [
      { title: "План vs факт", check: "Полный месяц или MTD", href: "/os/plan" },
      { title: "Рычаги", check: "Лиды, CR, чек", href: "/os/factors" }
    ]
  }
];

export function getAnalysisScenario(id: string): AnalysisScenarioDef | null {
  return ANALYSIS_SCENARIOS.find((item) => item.id === id) ?? null;
}
