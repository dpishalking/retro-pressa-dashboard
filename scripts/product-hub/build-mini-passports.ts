/**
 * Analyst mini-passports in «Паспорта Retro Pressa».
 * Template = sheet 01_Оригинал (simple A/B fields).
 *
 * Preserve policy:
 *   - Never wipe analyst-owned values already on a sheet
 *   - Only fill empty analyst fields / refresh system fields
 *   - 01_Оригинал is never overwritten (etalon)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/product-hub/build-mini-passports.ts
 *   npx tsx --env-file=.env.local scripts/product-hub/build-mini-passports.ts --force   # overwrite analyst fields too
 */

import {
  ensureSheetTab,
  getGoogleAccessToken,
  readGoogleServiceAccount,
  readSheetValues,
  writeSheetValues,
} from "../../src/lib/google/sheets-client";
import { PASSPORT_REGISTRY } from "./passport-registry";
import { BITRIX_GIFT_TYPES_SHEET_ID } from "./bitrix-aligned-catalog";

const SPREADSHEET_ID = BITRIX_GIFT_TYPES_SHEET_ID;
const COGS_MASTER = "https://docs.google.com/spreadsheets/d/1qyINXMJVZoJiidEYXyoeRvjUIF9p8Te0sSkYlAKWdAU/edit";
const ETALON_TAB = "01_Оригинал";

/** Column A labels in display order (must match etalon). */
const FIELD_ORDER = [
  "Обновлено",
  "Категория",
  "Название для ОП",
  "Название типа в Bitrix",
  "PRODUCT_ID",
  "Статус",
  "Что это",
  "Цена витрина",
  "Цена 4х страниц",
  "Валовая маржа",
  "Маржинальность",
  "Себестоимость COGS €",
  "Себестоимость 4х страниц",
  "Срок готовности",
  "Что входит в цену",
  "Полный паспорт",
  "Drive визуал (корень)",
  "Мастер COGS",
] as const;

type FieldKey = (typeof FIELD_ORDER)[number];

/** Safe to refresh from registry/system every run. */
const SYSTEM_FIELDS = new Set<FieldKey>([
  "Название типа в Bitrix",
  "PRODUCT_ID",
  "Полный паспорт",
  "Мастер COGS",
]);

/** Analyst-owned: never overwrite non-empty unless --force. */
const ANALYST_FIELDS = new Set<FieldKey>(FIELD_ORDER.filter((f) => !SYSTEM_FIELDS.has(f)));

type ProductSeed = {
  productId: string;
  tabName: string;
  titleName: string;
  category: string;
  shortWhat: string;
  priceMin?: number;
  priceMax?: number;
  priceFixed?: number;
  priceFrom?: number;
  priceTiers?: number[];
  priceDisplay?: string;
  cogs?: number;
  leadTime: string;
  included: string;
  driveUrls: string[];
  status?: string;
};

const DRIVE = {
  gazeta: "https://drive.google.com/drive/folders/1G8Etm7wn6haFVq_KS_3FgIxG3-XRE8wR",
  journal: "https://drive.google.com/drive/folders/1Qbnq8KOqlh9psSo9poxnnNhPqnHhw901",
  reproduction: "https://drive.google.com/drive/folders/1sCVNs_XyV_lv2eyDQiZ_MLECmNpyA4Ka",
  persGazeta: "https://drive.google.com/drive/folders/1w97nzsIsec6n752wExMDXFmgtp27o3x_",
  pozdGazeta: "https://drive.google.com/drive/folders/1Zy2zIw9AtZ3dI4P6etjAE1ERm6V9GvwV",
  pozdZhurnal: "https://drive.google.com/drive/folders/1rMWbypAXR-xxwL2G7M_KUv_ojnO2hq7E",
  glossy: "https://drive.google.com/drive/folders/14tKmcYa2bklT84Z4pAchdr_ZN3YhW3W_",
  digital: "https://drive.google.com/drive/folders/1YkHAFhRTrP4qZD50y85epwc7pSnBt09Q",
  family: "https://drive.google.com/drive/folders/1gRUmyYPM2Fwzf9vl8KJhaef3TJO77nDp",
  life: "https://drive.google.com/drive/folders/14N-wqx3QdOshzS6371ZM5CFwrmUDApGC",
  stickers: "https://drive.google.com/drive/folders/1aq9wB6IpbXGYDngWEBFHo9dMUH8n3ZX9",
  ozivi: "https://drive.google.com/drive/folders/1uETfGWsIcKN6UFLmualw6GO0UfgajvnL",
  song: "https://drive.google.com/drive/folders/1E9aLgTWhEysVFepM9yDIGf0viFPb15Ev",
};

const SEEDS: ProductSeed[] = [
  {
    productId: "PRODUCT_ORIGINAL",
    tabName: "01_Оригинал",
    titleName: "Оригинал",
    category: "Издание из даты",
    shortWhat:
      "Настоящая газета или журнал из архива за нужную дату. Не копия — физический экземпляр со склада.",
    priceMin: 15,
    priceMax: 51,
    cogs: 8,
    leadTime: "1 раб. день",
    included: "подбор по дате, проверка наличия, упаковка",
    driveUrls: [DRIVE.gazeta, DRIVE.journal],
  },
  {
    productId: "PRODUCT_REPRODUCTION",
    tabName: "02_Репродукция",
    titleName: "Репродукция",
    category: "Издание из даты",
    shortWhat: "Точная печатная копия издания из нужной даты, когда оригинала на складе нет.",
    priceMin: 45,
    priceMax: 75,
    cogs: 19,
    leadTime: "скан → макет → печать",
    included: "скан, макет, печать в натуральную величину",
    driveUrls: [DRIVE.reproduction],
  },
  {
    productId: "PRODUCT_CONGRATS_NEWSPAPER",
    tabName: "03_Поздр_газета",
    titleName: "Поздравительная газета",
    category: "Ретро + личное",
    shortWhat: "Копия архивной газеты + до 7 фото и поздравительный текст.",
    priceMin: 50,
    priceMax: 72,
    cogs: 24,
    leadTime: "до 7 раб. дней",
    included: "подготовка по оригиналу, до 7 фото, текст, печать",
    driveUrls: [DRIVE.pozdGazeta],
  },
  {
    productId: "PRODUCT_CONGRATS_MAGAZINE",
    tabName: "04_Поздр_журнал",
    titleName: "Поздравительный журнал",
    category: "Ретро + личное",
    shortWhat: "Журнал из своего месяца: обложка + персональные развороты, остальное как в оригинале.",
    priceFrom: 135,
    cogs: 56,
    leadTime: "до 7 раб. дней",
    included: "изменение обложки, 2 разворота с фото/статьями, печать",
    driveUrls: [DRIVE.pozdZhurnal],
  },
  {
    productId: "PRODUCT_PERSONAL_NEWSPAPER",
    tabName: "05_Перс_газета",
    titleName: "Персонализированная газета",
    category: "Персональный подарок",
    shortWhat: "Газета с нуля про человека или повод (Party Page и аналоги).",
    priceTiers: [55, 85, 115],
    cogs: 14,
    leadTime: "макет 1–2 дня после материалов",
    included: "шаблон, тексты по анкете, дизайн, вёрстка; печать — по тарифу",
    driveUrls: [DRIVE.persGazeta],
  },
  {
    productId: "PRODUCT_PERSONAL_MAGAZINE",
    tabName: "06_Перс_журнал",
    titleName: "Персонализированный журнал",
    category: "Персональный подарок",
    shortWhat: "Глянцевый «журнал о человеке»: истории, фото, интервью, пожелания.",
    priceFrom: 240,
    priceTiers: [240, 360, 480, 600],
    cogs: 33,
    leadTime: "от 14 дней",
    included: "тексты, дизайн, вёрстка, обработка фото, печать",
    driveUrls: [DRIVE.glossy],
  },
  {
    productId: "PRODUCT_LIFE_BOOK",
    tabName: "07_Книга_жизни",
    titleName: "Книга жизни",
    category: "Масштаб жизни",
    shortWhat: "Книга в твёрдом переплёте: один год — один газетный блок.",
    priceFrom: 240,
    cogs: 73,
    leadTime: "от 14 дней",
    included: "подбор газет по годам/регионам, сборка, печать",
    driveUrls: [DRIVE.life],
  },
  {
    productId: "PRODUCT_FAMILY_EDITION",
    tabName: "08_Семейное",
    titleName: "Семейное издание",
    category: "Семейная память",
    shortWhat: "Семейный журнал воспоминаний: истории, фото, важные даты.",
    priceFrom: 145,
    leadTime: "от 15 дней",
    included: "анкета/интервью, тексты, оформление фото, вёрстка, печать",
    driveUrls: [DRIVE.family],
  },
  {
    productId: "PRODUCT_DIGITAL",
    tabName: "09_Дигитал",
    titleName: "Дигитальная версия",
    category: "Цифровая версия",
    shortWhat: "Электронная версия издания (PDF) без физической печати/доставки.",
    priceMin: 15,
    priceMax: 45,
    leadTime: "быстрее печатного",
    included: "цифровой файл",
    driveUrls: [DRIVE.digital],
  },
  {
    productId: "PRODUCT_ANIMATE",
    tabName: "10_Оживи",
    titleName: "Оживи",
    category: "Анимация фото",
    shortWhat: "Оживление фото: пакеты 1 / 5 / 10 / 15 / 20.",
    priceMin: 6,
    priceMax: 79,
    cogs: 0.005,
    leadTime: "операционный срок",
    included: "анимация выбранного числа фото",
    driveUrls: [DRIVE.ozivi],
  },
  {
    productId: "PRODUCT_STICKER",
    tabName: "11_Наклейка",
    titleName: "Наклейка",
    category: "Микро-апселл",
    shortWhat: "Праздничная наклейка к комплекту.",
    priceFixed: 3.5,
    cogs: 0.2,
    leadTime: "со склада / в комплекте",
    included: "наклейка",
    driveUrls: [DRIVE.stickers],
  },
  {
    productId: "PRODUCT_CONGRATS_SONG",
    tabName: "12_Песня",
    titleName: "Поздравительная песня",
    category: "Музыкальное поздравление",
    shortWhat: "Персональная песня по брифу: текст + аранжировка + трек.",
    priceTiers: [20, 40],
    cogs: 1,
    leadTime: "до 24 ч / экспресс 2 ч",
    included: "текст, аранжировка, финальный трек",
    driveUrls: [DRIVE.song],
  },
];

function quote(title: string, a1: string) {
  return `'${title.replace(/'/g, "''")}'!${a1}`;
}

function giftType(productId: string) {
  return PASSPORT_REGISTRY.find((e) => e.productId === productId)?.bitrixName || "";
}

function passportUrl(productId: string) {
  const entry = PASSPORT_REGISTRY.find((e) => e.productId === productId);
  return entry ? `https://docs.google.com/spreadsheets/d/${entry.spreadsheetId}/edit` : "";
}

function fmtMoney(n: number) {
  if (Number.isInteger(n)) return String(n);
  return String(n).replace(".", ",");
}

function fmtPct(n: number) {
  return `${Math.round(n)}%`;
}

function priceEdges(seed: ProductSeed): { min?: number; max?: number; mode: "range" | "from" | "fixed" | "tiers" } {
  if (seed.priceMin != null && seed.priceMax != null) return { min: seed.priceMin, max: seed.priceMax, mode: "range" };
  // «от X» wins over tier list for витрина/маржа (тиры — справочно в цене при желании)
  if (seed.priceFrom != null) return { min: seed.priceFrom, mode: "from" };
  if (seed.priceTiers?.length) {
    const sorted = [...seed.priceTiers].sort((a, b) => a - b);
    return { min: sorted[0], max: sorted[sorted.length - 1], mode: "tiers" };
  }
  if (seed.priceFixed != null) return { min: seed.priceFixed, max: seed.priceFixed, mode: "fixed" };
  return { mode: "fixed" };
}

function computePriceDisplay(seed: ProductSeed): string {
  if (seed.priceDisplay) return seed.priceDisplay;
  if (seed.productId === "PRODUCT_CONGRATS_SONG") return "20 € / 24ч · 40 € / 2ч";
  if (seed.productId === "PRODUCT_PERSONAL_NEWSPAPER") return "55 / 85 / 115 €";
  const e = priceEdges(seed);
  if (e.mode === "range" && e.min != null && e.max != null) return `${fmtMoney(e.min)}–${fmtMoney(e.max)} €`;
  if (e.mode === "from" && e.min != null) return `от ${fmtMoney(e.min)} €`;
  if (e.mode === "tiers" && e.min != null && e.max != null) return `${fmtMoney(e.min)}–${fmtMoney(e.max)} €`;
  if (e.min != null) return `${fmtMoney(e.min)} €`;
  return "TBD";
}

function computeMargin(seed: ProductSeed): { gross: string; pct: string } {
  const cogs = seed.cogs;
  const e = priceEdges(seed);
  if (cogs == null || e.min == null) return { gross: "TBD", pct: "TBD" };

  if (e.mode === "fixed" || (e.max != null && e.min === e.max)) {
    const g = e.min - cogs;
    return { gross: `${fmtMoney(g)} €`, pct: fmtPct((g / e.min) * 100) };
  }
  if (e.mode === "from") {
    const g = e.min - cogs;
    return { gross: `от ${fmtMoney(g)} €`, pct: `от ${fmtPct((g / e.min) * 100)}` };
  }
  // range / tiers
  const max = e.max ?? e.min;
  const gMin = e.min - cogs;
  const gMax = max - cogs;
  const pMin = (gMin / e.min) * 100;
  const pMax = (gMax / max) * 100;
  return {
    gross: `${fmtMoney(gMin)} - ${fmtMoney(gMax)} €`,
    pct: `${fmtPct(Math.min(pMin, pMax))} - ${fmtPct(Math.max(pMin, pMax))}`,
  };
}

function normalizeLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").replace(/:$/, "");
}

/** Read existing A/B pairs; tolerate old bloated layout. */
function parseExisting(values: string[][]): {
  title?: string;
  fields: Partial<Record<string, string>>;
  /** true when sheet already uses etalon layout — safe to preserve analyst cells */
  isEtalonFormat: boolean;
} {
  const fields: Partial<Record<string, string>> = {};
  let title: string | undefined;
  let isEtalonFormat = false;
  for (const row of values) {
    const a = String(row[0] ?? "").trim();
    const b = String(row[1] ?? "").trim();
    if (!a) continue;
    if (/^подарок:/i.test(a)) {
      title = a;
      isEtalonFormat = true;
      continue;
    }
    if (/^мини-паспорт|^===/i.test(a)) {
      isEtalonFormat = false;
      continue;
    }
    const label = normalizeLabel(a);
    if (b && (fields[label] == null || fields[label] === "")) {
      fields[label] = b;
    }
    if (label.startsWith("Маржинальность") && b) {
      fields["Маржинальность"] = b;
    }
  }
  return { title, fields, isEtalonFormat };
}

function defaultsFor(seed: ProductSeed): Record<FieldKey, string> {
  const margin = computeMargin(seed);
  const today = new Date().toISOString().slice(0, 10);
  return {
    Обновлено: today,
    Категория: seed.category,
    "Название для ОП": giftType(seed.productId) || seed.titleName,
    "Название типа в Bitrix": giftType(seed.productId) || seed.titleName,
    PRODUCT_ID: seed.productId,
    Статус: seed.status || "active",
    "Что это": seed.shortWhat,
    "Цена витрина": computePriceDisplay(seed),
    "Цена 4х страниц": seed.productId === "PRODUCT_PERSONAL_MAGAZINE" ? "60 €" : "",
    "Валовая маржа": margin.gross,
    Маржинальность: margin.pct,
    "Себестоимость COGS €": seed.cogs != null ? fmtMoney(seed.cogs) : "TBD",
    "Себестоимость 4х страниц":
      seed.productId === "PRODUCT_PERSONAL_MAGAZINE" && seed.cogs != null
        ? fmtMoney(Math.round((seed.cogs / 16) * 4 * 100) / 100)
        : "",
    "Срок готовности": seed.leadTime,
    "Что входит в цену": seed.included,
    "Полный паспорт": passportUrl(seed.productId),
    "Drive визуал (корень)": seed.driveUrls.join("\n"),
    "Мастер COGS": COGS_MASTER,
  };
}

function mergeFields(
  defaults: Record<FieldKey, string>,
  existing: Partial<Record<string, string>>,
  force: boolean,
): { values: Record<FieldKey, string>; preserved: string[]; filled: string[] } {
  const values = { ...defaults };
  const preserved: string[] = [];
  const filled: string[] = [];

  for (const key of FIELD_ORDER) {
    const prev = (existing[key] ?? "").trim();
    if (!prev) {
      filled.push(key);
      continue;
    }
    if (SYSTEM_FIELDS.has(key)) {
      // refresh system always
      filled.push(`${key}(system)`);
      continue;
    }
    if (ANALYST_FIELDS.has(key) && !force) {
      values[key] = prev;
      preserved.push(key);
    } else {
      filled.push(key);
    }
  }
  return { values, preserved, filled };
}

function buildRows(titleName: string, values: Record<FieldKey, string>): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [[`Подарок: ${titleName}`]];
  for (const key of FIELD_ORDER) {
    // Optional page rows: only when filled (personal magazine etc.)
    if (
      (key === "Себестоимость 4х страниц" || key === "Цена 4х страниц") &&
      !String(values[key] ?? "").trim()
    ) {
      continue;
    }
    if (key === "Полный паспорт") rows.push([]); // blank separator like etalon
    rows.push([key, values[key]]);
  }
  return rows;
}

function buildIndex(seeds: ProductSeed[], fieldMaps: Map<string, Record<FieldKey, string>>, updatedAt: string) {
  const rows: Array<Array<string | number>> = [
    ["00_INDEX — мини-паспорта"],
    ["Обновлено", updatedAt],
    [
      "Как пользоваться",
      "Каждый продукт = отдельный лист в формате 01_Оригинал. Цены/маржу/тексты правит аналитик руками — повторный sync их не затирает (кроме системных ссылок).",
    ],
    [],
    ["#", "Лист", "Тип Bitrix", "PRODUCT_ID", "Цена витрина", "COGS", "Валовая маржа", "Маржинальность", "Полный паспорт"],
  ];
  seeds.forEach((seed, i) => {
    const v = fieldMaps.get(seed.tabName)!;
    rows.push([
      i + 1,
      seed.tabName,
      v["Название типа в Bitrix"],
      v.PRODUCT_ID,
      v["Цена витрина"],
      v["Себестоимость COGS €"],
      v["Валовая маржа"],
      v.Маржинальность,
      v["Полный паспорт"],
    ]);
  });
  rows.push([], ["SKU_MAP", "технический мост Bitrix SKU → PRODUCT_ID (не затирать руками без нужды)"]);
  return rows;
}

async function main() {
  if (!readGoogleServiceAccount()) throw new Error("Google SA not configured");
  const force = process.argv.includes("--force");
  await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");

  const updatedAt = new Date().toISOString().slice(0, 10);
  const fieldMaps = new Map<string, Record<FieldKey, string>>();

  for (const seed of SEEDS) {
    await ensureSheetTab(SPREADSHEET_ID, seed.tabName);

    let existingFields: Partial<Record<string, string>> = {};
    let isEtalonFormat = false;
    try {
      const existingValues = await readSheetValues({
        spreadsheetId: SPREADSHEET_ID,
        range: quote(seed.tabName, "A1:B80"),
      });
      const parsed = parseExisting(existingValues);
      existingFields = parsed.fields;
      isEtalonFormat = parsed.isEtalonFormat;
    } catch {
      existingFields = {};
    }

    // Etalon sheet: never rewrite (analyst owns the template)
    if (seed.tabName === ETALON_TAB && !force) {
      const defaults = defaultsFor(seed);
      const merged = mergeFields(defaults, existingFields, false);
      fieldMaps.set(seed.tabName, merged.values);
      console.log(`${seed.tabName}: SKIP write (etalon). preserved=${merged.preserved.length}`);
      continue;
    }

    // Old bloated layout → full replace with defaults once.
    // New etalon layout → preserve non-empty analyst fields.
    const preserve = isEtalonFormat && !force;
    const defaults = defaultsFor(seed);
    const { values, preserved, filled } = mergeFields(defaults, existingFields, !preserve);
    fieldMaps.set(seed.tabName, values);

    const rows = buildRows(seed.titleName, values);
    await writeSheetValues({
      spreadsheetId: SPREADSHEET_ID,
      range: quote(seed.tabName, "A1"),
      clearRange: quote(seed.tabName, "A1:Z200"),
      rows,
      valueInputOption: "USER_ENTERED",
    });
    console.log(
      `${seed.tabName}: wrote | preserved=${preserved.length} [${preserved.join(", ")}] | set=${filled.length}`,
    );
  }

  await ensureSheetTab(SPREADSHEET_ID, "00_INDEX");
  await writeSheetValues({
    spreadsheetId: SPREADSHEET_ID,
    range: quote("00_INDEX", "A1"),
    clearRange: quote("00_INDEX", "A1:Z100"),
    rows: buildIndex(SEEDS, fieldMaps, updatedAt),
  });
  console.log("Wrote 00_INDEX");
  console.log(`\nOpen: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
  if (!force) console.log("Analyst fields preserved when non-empty. Use --force to overwrite them.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
