/**
 * Registry: Bitrix gift type ↔ passport Google Spreadsheet ↔ knowledge-base visuals.
 * Order follows Bitrix «Паспорта продуктов» sheet.
 */

export type PassportVisualSource = {
  clientMaterialCategories?: string[];
  clientMaterialIdIncludes?: string[];
  clientMaterialIds?: string[];
  trainingProductId?: string;
};

export type PassportEconomySource = {
  /** Exact Bitrix crm.product NAME to use as the one retail line (RU catalog). */
  bitrixProductName?: string;
  /** Optional alternate names to try if exact missing. */
  bitrixProductNameFallbacks?: string[];
};

export type PassportRegistryEntry = {
  productId: string;
  bitrixName: string;
  spreadsheetId: string;
  visualTabName: string;
  economyTabName: string;
  visualSource: PassportVisualSource;
  economySource: PassportEconomySource;
};

/**
 * Visual taxonomy matches Bitrix product passports + shared buckets:
 * Репродукция, Оригинал, Персонализированный журнал/газета, Дигитальная версия,
 * Поздравительный журнал/газета, Оживи, Книга жизни, Наклейка, Семейное издание,
 * Упаковка, Видеоотзывы.
 *
 * Оригинал = archive on old paper.
 * Репродукция / поздравительные = modern-paper print (reprint or scan+personalization).
 */
export const PASSPORT_REGISTRY: PassportRegistryEntry[] = [
  {
    productId: "PRODUCT_REPRODUCTION",
    bitrixName: "Репродукция",
    spreadsheetId: "1oHeW8dhKeynjgEXqnjXlDNwyuOZoP5BRyICj-WIq71c",
    visualTabName: "Визуал",
    economyTabName: "Экономика",
    visualSource: {
      clientMaterialCategories: ["Репродукция", "Упаковка"],
      clientMaterialIdIncludes: ["reproduction", "packaging"],
    },
    economySource: {
      bitrixProductName: "Репродукция газеты",
      bitrixProductNameFallbacks: ["Репродукция газеты "],
    },
  },
  {
    productId: "PRODUCT_ORIGINAL",
    bitrixName: "Оригинал",
    spreadsheetId: "1Dv-VqiL23frMxruSz9-lK_wSMGJR6j9YjIZgzqBEe0A",
    visualTabName: "Визуал",
    economyTabName: "Экономика",
    visualSource: {
      trainingProductId: "personal-newspaper",
      clientMaterialCategories: ["Оригинал"],
    },
    economySource: {
      bitrixProductName: "Оригинальная газета",
      bitrixProductNameFallbacks: ["Оригинальный журнал"],
    },
  },
  {
    productId: "PRODUCT_PERSONAL_MAGAZINE",
    bitrixName: "Персонализированный журнал",
    spreadsheetId: "1RDUSWCMRqdA8SwJEf4VveCUnwQiztzts4sEdRry1hvs",
    visualTabName: "Визуал",
    economyTabName: "Экономика",
    visualSource: {
      trainingProductId: "glossy-magazine",
      clientMaterialCategories: ["Персонализированный журнал"],
    },
    economySource: {},
  },
  {
    productId: "PRODUCT_PERSONAL_NEWSPAPER",
    bitrixName: "Персонализированная газета",
    spreadsheetId: "1yh_l72nOi_JIdWDAfRnNaVZ203M8F2A8Y-3fyQJIZPo",
    visualTabName: "Визуал",
    economyTabName: "Экономика",
    visualSource: {
      trainingProductId: "gift-edition",
      clientMaterialCategories: ["Персонализированная газета"],
    },
    economySource: {
      bitrixProductName: "Персонализированная газета - 4 страницы",
    },
  },
  {
    productId: "PRODUCT_DIGITAL",
    bitrixName: "Дигитальная версия",
    spreadsheetId: "1Qd_ijOcosCQTNnfxwq5wgmY6mnVueOTk_RpPBN9VOH4",
    visualTabName: "Визуал",
    economyTabName: "Экономика",
    visualSource: {
      clientMaterialCategories: ["Дигитальная версия"],
    },
    economySource: {
      bitrixProductName: "Электронная версия журнала",
    },
  },
  {
    productId: "PRODUCT_CONGRATS_MAGAZINE",
    bitrixName: "Поздравительный журнал",
    spreadsheetId: "13kBEKhTs9c8ZT2gOOYPE4A1LatiC3Lo_G5uTWB-GPnU",
    visualTabName: "Визуал",
    economyTabName: "Экономика",
    visualSource: {
      trainingProductId: "retro-newspaper",
      clientMaterialCategories: ["Поздравительный журнал"],
    },
    economySource: {
      bitrixProductName: "Поздравительный журнал (16 страниц)",
    },
  },
  {
    productId: "PRODUCT_CONGRATS_NEWSPAPER",
    bitrixName: "Поздравительная газета",
    spreadsheetId: "1NH_n8JyILoupxOZxkMDy4ysBOYoTGQXIt0ScbSJNoZs",
    visualTabName: "Визуал",
    economyTabName: "Экономика",
    visualSource: {
      trainingProductId: "retro-newspaper",
      clientMaterialCategories: ["Поздравительная газета"],
    },
    economySource: {
      bitrixProductName: "Поздравительная газета",
    },
  },
  {
    productId: "PRODUCT_ANIMATE",
    bitrixName: "Оживи",
    spreadsheetId: "1i8SfxuLvtJ9jhwHxAWnJco4TxNX6yvhq0OKg46umq4g",
    visualTabName: "Визуал",
    economyTabName: "Экономика",
    visualSource: {
      clientMaterialCategories: ["Оживи"],
    },
    economySource: {
      bitrixProductName: "Оживить 1 фото",
    },
  },
  {
    productId: "PRODUCT_LIFE_BOOK",
    bitrixName: "Книга жизни",
    spreadsheetId: "1q2WKgcCCVeomg7KhFWEr68re4ReE3xuak4LusmXyPSU",
    visualTabName: "Визуал",
    economyTabName: "Экономика",
    visualSource: {
      trainingProductId: "personal-magazine",
      clientMaterialCategories: ["Книга жизни"],
      clientMaterialIdIncludes: ["life-book"],
      clientMaterialIds: ["review-life-book-vyx"],
    },
    economySource: {
      bitrixProductName: "Книга жизни в заголовках газет",
    },
  },
  {
    productId: "PRODUCT_STICKER",
    bitrixName: "Наклейка",
    spreadsheetId: "1FE7oNSwAbOU7kf1Am5h7J3jQZrJ2THMFpWF5oO6ZcoY",
    visualTabName: "Визуал",
    economyTabName: "Экономика",
    visualSource: {
      clientMaterialCategories: ["Наклейка"],
    },
    economySource: {
      bitrixProductName: "Наклейка",
    },
  },
  {
    productId: "PRODUCT_FAMILY_EDITION",
    bitrixName: "Семейное издание",
    spreadsheetId: "1ibkA_8g45i2jXbditUqsAhkt-G1pC8WtYNnCj25vga4",
    visualTabName: "Визуал",
    economyTabName: "Экономика",
    visualSource: {
      clientMaterialCategories: ["Семейное издание"],
    },
    economySource: {},
  },
  {
    productId: "PRODUCT_CONGRATS_SONG",
    bitrixName: "Поздравительная песня",
    spreadsheetId: "1E__1xcrf4I2OPmXaIPDGdrpTK3bC1ezEl76zebpofmU",
    visualTabName: "Визуал",
    economyTabName: "Экономика",
    visualSource: {
      clientMaterialCategories: ["Поздравительная песня"],
    },
    economySource: {
      bitrixProductName: "Поздравительная песня",
    },
  },
];

export function findPassportByProductId(productId: string): PassportRegistryEntry | undefined {
  return PASSPORT_REGISTRY.find((e) => e.productId === productId);
}

export function findPassportBySpreadsheetId(spreadsheetId: string): PassportRegistryEntry | undefined {
  return PASSPORT_REGISTRY.find((e) => e.spreadsheetId === spreadsheetId);
}
