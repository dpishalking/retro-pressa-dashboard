/**
 * Product Hub bootstrap schema (columns + dictionaries).
 * Shared by generate / validate / push-to-sheets scripts.
 */

export type FieldDef = {
  name: string;
  required: boolean;
  type: "id" | "text" | "long_text" | "enum" | "boolean" | "number" | "date" | "url" | "id_list";
  enumKey?: keyof typeof DICTIONARIES;
};

export const TARGET_SHEETS = [
  "00_README",
  "01_PRODUCTS",
  "02_VARIANTS",
  "03_MARKET_PRICES",
  "04_PRODUCTION_DELIVERY",
  "05_SALES_PLAYBOOK",
  "06_ASSETS",
  "07_DICTIONARIES",
  "08_READINESS",
] as const;

export type TargetSheet = (typeof TARGET_SHEETS)[number];

export const EMPTY_DEFAULT_SHEETS = new Set(["Лист1", "Sheet1"]);

export const DICTIONARIES = {
  category: [
    "archive_print",
    "personal_print",
    "life_book",
    "family_edition",
    "digital",
    "animation",
    "gift",
  ],
  product_status: ["draft", "active", "temporarily_unavailable", "archived"],
  product_type: ["physical", "digital", "physical_and_digital"],
  asset_type: [
    "photo",
    "video",
    "mockup",
    "example",
    "case",
    "review",
    "instruction",
    "presentation",
    "landing",
    "document",
  ],
  asset_status: ["draft", "active", "archived"],
  currency: ["EUR", "USD", "CLP", "RUB", "GBP", "PLN"],
  country_code: ["LV", "EE", "LT", "DE", "PL", "FI", "SE", "FR", "IT", "ES", "RU", "CL", "US", "GB"],
  boolean: ["TRUE", "FALSE"],
} as const;

export const DICTIONARY_COLUMNS = Object.keys(DICTIONARIES) as Array<keyof typeof DICTIONARIES>;

export const PRODUCTS_FIELDS: FieldDef[] = [
  { name: "product_id", required: true, type: "id" },
  { name: "product_name", required: true, type: "text" },
  { name: "short_name", required: false, type: "text" },
  { name: "category", required: true, type: "enum", enumKey: "category" },
  { name: "status", required: true, type: "enum", enumKey: "product_status" },
  { name: "physical_or_digital", required: true, type: "enum", enumKey: "product_type" },
  { name: "short_description", required: true, type: "long_text" },
  { name: "full_description", required: false, type: "long_text" },
  { name: "owner", required: false, type: "text" },
  { name: "primary_audience", required: false, type: "text" },
  { name: "primary_occasion", required: false, type: "text" },
  { name: "default_country_code", required: false, type: "enum", enumKey: "country_code" },
  { name: "default_currency", required: false, type: "enum", enumKey: "currency" },
  { name: "hero_image_url", required: false, type: "url" },
  { name: "landing_url", required: false, type: "url" },
  { name: "manager_short_pitch", required: false, type: "long_text" },
  { name: "internal_notes", required: false, type: "long_text" },
];

export const VARIANTS_FIELDS: FieldDef[] = [
  { name: "variant_id", required: true, type: "id" },
  { name: "product_id", required: true, type: "id" },
  { name: "variant_name", required: true, type: "text" },
  { name: "format", required: false, type: "text" },
  { name: "size", required: false, type: "text" },
  { name: "page_count", required: false, type: "number" },
  { name: "cover_type", required: false, type: "text" },
  { name: "paper_type", required: false, type: "text" },
  { name: "binding_type", required: false, type: "text" },
  { name: "production_type", required: false, type: "text" },
  { name: "is_active", required: true, type: "boolean", enumKey: "boolean" },
  { name: "variant_description", required: false, type: "long_text" },
];

export const MARKET_PRICES_FIELDS: FieldDef[] = [
  { name: "price_id", required: true, type: "id" },
  { name: "product_id", required: true, type: "id" },
  { name: "variant_id", required: false, type: "id" },
  { name: "country_code", required: true, type: "enum", enumKey: "country_code" },
  { name: "currency", required: true, type: "enum", enumKey: "currency" },
  { name: "retail_price", required: true, type: "number" },
  { name: "cost_price", required: false, type: "number" },
  { name: "minimum_price", required: false, type: "number" },
  { name: "partner_price", required: false, type: "number" },
  { name: "urgent_price", required: false, type: "number" },
  { name: "additional_page_price", required: false, type: "number" },
  { name: "valid_from", required: false, type: "date" },
  { name: "valid_to", required: false, type: "date" },
  { name: "is_active", required: true, type: "boolean", enumKey: "boolean" },
  { name: "price_notes", required: false, type: "long_text" },
];

export const PRODUCTION_DELIVERY_FIELDS: FieldDef[] = [
  { name: "rule_id", required: true, type: "id" },
  { name: "product_id", required: true, type: "id" },
  { name: "variant_id", required: false, type: "id" },
  { name: "country_code", required: true, type: "enum", enumKey: "country_code" },
  { name: "production_min_days", required: true, type: "number" },
  { name: "production_max_days", required: true, type: "number" },
  { name: "urgent_min_days", required: false, type: "number" },
  { name: "urgent_max_days", required: false, type: "number" },
  { name: "supplier", required: false, type: "text" },
  { name: "production_location", required: false, type: "text" },
  { name: "delivery_service", required: false, type: "text" },
  { name: "delivery_price", required: false, type: "number" },
  { name: "delivery_currency", required: false, type: "enum", enumKey: "currency" },
  { name: "delivery_min_days", required: false, type: "number" },
  { name: "delivery_max_days", required: false, type: "number" },
  { name: "tracking_available", required: false, type: "boolean", enumKey: "boolean" },
  { name: "materials_required", required: false, type: "long_text" },
  { name: "production_requirements", required: false, type: "long_text" },
  { name: "limitations", required: false, type: "long_text" },
  { name: "is_active", required: true, type: "boolean", enumKey: "boolean" },
];

export const SALES_PLAYBOOK_FIELDS: FieldDef[] = [
  { name: "playbook_id", required: true, type: "id" },
  { name: "product_id", required: true, type: "id" },
  { name: "audience", required: true, type: "text" },
  { name: "occasion", required: true, type: "text" },
  { name: "client_situation", required: false, type: "long_text" },
  { name: "client_problem", required: false, type: "long_text" },
  { name: "desired_result", required: false, type: "long_text" },
  { name: "desired_emotion", required: false, type: "text" },
  { name: "main_offer", required: false, type: "long_text" },
  { name: "short_pitch", required: true, type: "long_text" },
  { name: "qualification_questions", required: false, type: "long_text" },
  { name: "key_arguments", required: false, type: "long_text" },
  { name: "common_objections", required: false, type: "long_text" },
  { name: "objection_responses", required: false, type: "long_text" },
  { name: "upsell_product_ids", required: false, type: "id_list" },
  { name: "alternative_product_ids", required: false, type: "id_list" },
  { name: "manager_notes", required: false, type: "long_text" },
  { name: "is_active", required: true, type: "boolean", enumKey: "boolean" },
];

export const ASSETS_FIELDS: FieldDef[] = [
  { name: "asset_id", required: true, type: "id" },
  { name: "product_id", required: true, type: "id" },
  { name: "variant_id", required: false, type: "id" },
  { name: "asset_type", required: true, type: "enum", enumKey: "asset_type" },
  { name: "title", required: true, type: "text" },
  { name: "url", required: true, type: "url" },
  { name: "preview_url", required: false, type: "url" },
  { name: "language", required: false, type: "text" },
  { name: "country_code", required: false, type: "enum", enumKey: "country_code" },
  { name: "status", required: true, type: "enum", enumKey: "asset_status" },
  { name: "internal_notes", required: false, type: "long_text" },
];

export const SHEET_FIELDS: Record<string, FieldDef[]> = {
  "01_PRODUCTS": PRODUCTS_FIELDS,
  "02_VARIANTS": VARIANTS_FIELDS,
  "03_MARKET_PRICES": MARKET_PRICES_FIELDS,
  "04_PRODUCTION_DELIVERY": PRODUCTION_DELIVERY_FIELDS,
  "05_SALES_PLAYBOOK": SALES_PLAYBOOK_FIELDS,
  "06_ASSETS": ASSETS_FIELDS,
};

export const ID_FIELDS: Record<string, string> = {
  "01_PRODUCTS": "product_id",
  "02_VARIANTS": "variant_id",
  "03_MARKET_PRICES": "price_id",
  "04_PRODUCTION_DELIVERY": "rule_id",
  "05_SALES_PLAYBOOK": "playbook_id",
  "06_ASSETS": "asset_id",
};

export const README_ROWS: Array<[string, string]> = [
  [
    "ВНИМАНИЕ",
    "Это рабочая структура Retro Pressa Product Hub. Не меняйте имена листов и колонок. ID после первого импорта не переименовывать.",
  ],
  ["Правило строк", "Одна строка = одна сущность. Не писать несколько стран/цен/вариантов в одну ячейку."],
  ["Правильно", "одна строка = одна цена для одного варианта в одной стране"],
  ["Неправильно", "Германия — 120 €, Франция — 130 € в одной ячейке"],
  ["01_PRODUCTS", "Карточки продуктов. Связь: product_id"],
  ["02_VARIANTS", "Варианты формата/обложки/страниц. Связь: variant_id → product_id"],
  ["03_MARKET_PRICES", "Цены по рынкам. Число без символа валюты; валюта отдельно. Цены не выдумывать."],
  ["04_PRODUCTION_DELIVERY", "Сроки производства и доставки по стране. Дни — целые числа в отдельных колонках."],
  ["05_SALES_PLAYBOOK", "Сценарии продаж: аудитория + повод"],
  ["06_ASSETS", "Материалы только через URL. Не вставлять файлы в ячейки."],
  ["07_DICTIONARIES", "Справочники для выпадающих списков (расширяемые)"],
  ["08_READINESS", "Формулы готовности паспортов — не редактировать вручную без нужды"],
  ["Страны", "ISO alpha-2: LV, EE, LT, DE…"],
  ["Валюты", "EUR, USD, CLP… без символа €"],
  ["Статусы продукта", "draft | active | temporarily_unavailable | archived"],
];

export const EXPECTED_PRODUCT_IDS = [
  "PRODUCT_DATE_NEWSPAPER",
  "PRODUCT_PERSONAL_MAGAZINE",
  "PRODUCT_PERSONAL_NEWSPAPER",
  "PRODUCT_CONGRATULATORY_NEWSPAPER",
  "PRODUCT_LIFE_BOOK",
  "PRODUCT_FAMILY_EDITION",
  "PRODUCT_DIGITAL_VERSION",
  "PRODUCT_PHOTO_ANIMATION",
] as const;
