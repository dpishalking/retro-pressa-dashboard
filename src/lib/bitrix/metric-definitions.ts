/**
 * Canonical Bitrix metric definitions for the analytics dashboard.
 * Values must come from pullable CRM fields — never hand-tuned targets.
 */

export const BITRIX_INVOICE_DATE_FIELD = "UF_CRM_1758618010118"; // «Выставлен счет»
export const BITRIX_INVOICE_AMOUNT_FIELD = "UF_CRM_1739982211"; // «Сумма для счета»
export const BITRIX_INVOICE_FLAG_FIELD = "UF_CRM_1778244823819"; // «Счет выставлен?»
export const BITRIX_INVOICE_FLAG_YES = "2752";
export const BITRIX_INVOICE_STAGE_ID = "1"; // «Выставление счета»
export const BITRIX_SALES_CATEGORY_ID = 0; // воронка «Продажа»

/** Deal ↔ SPA «Вид подарка» (entityTypeId 1038). Used when productrows are empty. */
export const BITRIX_DEAL_GIFT_LINKS_FIELD = "UF_CRM_1784794322";
/** Shipping amount on deal (not a product row). */
export const BITRIX_DELIVERY_PRICE_FIELD = "UF_CRM_1739981844877";
export const BITRIX_GIFT_SPA_ENTITY_TYPE_ID = 1038;
/** SPA field «Тип подарка» on entity 1038. */
export const BITRIX_GIFT_SPA_TYPE_FIELD = "ufCrm8_1777620552";

/** Stable enum IDs for SPA «Тип подарка» (crm.item.fields entityTypeId=1038). */
export const BITRIX_GIFT_TYPE_ENUM: Record<string, string> = {
  "2728": "Оригинал",
  "2730": "Репродукция",
  "2732": "Поздравительная газета",
  "2734": "Персонализированный журнал",
  "2736": "Персонализированная газета",
  "2738": "Оживи",
  "2740": "Книга жизни",
  "2750": "Дигитальная версия",
  "2790": "Наклейка",
  "2792": "Песня",
  "2794": "Поздравительный журнал",
  "2796": "Упаковка"
};

/** Lead statuses excluded from operational lead totals. */
export const EXCLUDED_LEAD_STATUS_IDS = ["1", "3"] as const; // СПАМ, Отзывы

/**
 * Paid social sources in this Bitrix (there is no SOURCE_ID=ORGANIC).
 * Everything else counts as organic/other for the paid/organic split only.
 */
export const PAID_LEAD_SOURCE_IDS = [
  "UC_GQ92V4", // Facebook
  "UC_PXE40M", // Instagram
  "UC_LL4UYE", // Facebook comments
  "UC_61GF35", // Instagram Your Story
  "UC_YY5741" // Instagram (хочу узнать)
] as const;

export const BITRIX_METRIC_DEFINITIONS = {
  invoices: {
    label: "Выставлено счетов",
    source: "bitrix",
    definition:
      "Сделки воронки «Продажа» (CATEGORY_ID=0), у которых дата «Выставлен счет» (UF_CRM_1758618010118) попадает в период; если даты нет — первый переход в стадию «Выставление счета» (STAGE_ID=1) в периоде. Сумма: «Сумма для счета» (UF_CRM_1739982211), иначе OPPORTUNITY."
  },
  paid: {
    label: "Оплачено счетов",
    source: "bitrix",
    definition:
      "Сделки воронки «Продажа» со STAGE_SEMANTIC_ID=S (Выиграно) и CLOSEDATE в календарном периоде. Не когорта выставленных счетов. Сумма: OPPORTUNITY."
  },
  leads: {
    label: "Лиды",
    source: "bitrix",
    definition:
      "crm.lead.list по DATE_CREATE в периоде, без статусов СПАМ (STATUS_ID=1) и Отзывы (STATUS_ID=3). Платные = Facebook/Instagram SOURCE_ID; остальное — органика/прочее (в CRM нет SOURCE_ID=ORGANIC)."
  },
  qualifiedLeads: {
    label: "Qualified лиды",
    source: "google_marketing",
    definition: "Колонка QL из Google Sheets (маркетинговая сводная). В Bitrix отдельного поля QL в текущей выгрузке нет."
  },
  adSpend: {
    label: "Бюджет трафика",
    source: "google_marketing",
    definition: "Сумма spend из Google Sheets (Facebook сводная подрядчиков + органика). В Bitrix рекламного бюджета нет."
  }
} as const;

export type BitrixKnownGap = {
  metric: string;
  pullable: string;
  reported?: string;
  cause: string;
};

export function buildKnownGaps(input: {
  invoicesCount: number;
  invoicesAmount: number;
  salesCount: number;
  revenue: number;
  leadsCount: number;
  leadsRaw: number;
  adSpend: number;
}): BitrixKnownGap[] {
  const gaps: BitrixKnownGap[] = [
    {
      metric: "Выставлено счетов",
      pullable: `${input.invoicesCount} / ${Math.round(input.invoicesAmount)} €`,
      reported: "278 / 17 888 € (ручной срез)",
      cause:
        "Тянем только поле «Выставлен счет» + fallback стадии «Выставление счета» в воронке Продажа. Ручной отчёт, вероятно, включает сделки без заполненной даты/с другим фильтром воронки — API-набор уже этого фильтра не воспроизводит 1:1."
    },
    {
      metric: "Оплачено счетов",
      pullable: `${input.salesCount} / ${Math.round(input.revenue)} €`,
      reported: "212 / 13 970 € (ручной срез)",
      cause:
        "Календарные WON по CLOSEDATE в воронке Продажа. Раньше на дашборде была когорта «оплаты среди счетов месяца» — это занижало факт. Остаточный зазор к ручному отчёту возможен из‑за другого поля даты оплаты или включения соседней воронки."
    },
    {
      metric: "Лиды",
      pullable: `${input.leadsCount} (из ${input.leadsRaw} сырых)`,
      reported: "1 276 без спама/отзывов, «с кем работали менеджеры»",
      cause:
        "Исключаем только СПАМ и Отзывы. Условие «работали менеджеры» в CRM не задано отдельным полем; если в отчёте ещё режут Дубль/Тест/NEW — цифры разъедутся. При доп. исключении Дубль+Тест получается ~1 265. Платные = Facebook/Instagram SOURCE_ID; остальное считается органикой/прочим."
    },
    {
      metric: "Бюджет трафика",
      pullable: `${Math.round(input.adSpend)} € (Google Sheets)`,
      reported: "1 761 € (ручной учёт)",
      cause: "В Bitrix бюджета нет. Берём spend из Sheets; расхождение — разные вкладки/подрядчики/период учёта, не ошибка деления."
    }
  ];

  return gaps;
}
