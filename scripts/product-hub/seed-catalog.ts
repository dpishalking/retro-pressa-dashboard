/**
 * Builds Product Hub starter rows from training catalog + structural drafts.
 * Does NOT invent market prices.
 */

import fs from "node:fs";
import path from "node:path";
import {
  ASSETS_FIELDS,
  DICTIONARIES,
  DICTIONARY_COLUMNS,
  EXPECTED_PRODUCT_IDS,
  MARKET_PRICES_FIELDS,
  PRODUCTION_DELIVERY_FIELDS,
  PRODUCTS_FIELDS,
  README_ROWS,
  SALES_PLAYBOOK_FIELDS,
  VARIANTS_FIELDS,
} from "./bootstrap-schema";

type TrainingProduct = {
  id: string;
  title: string;
  shortDescription?: string;
  description?: string;
  targetAudience?: string;
  clientProblems?: string;
  emotions?: string;
  objections?: string;
  presentationGuide?: string;
  coverImage?: string;
  materials?: Array<{ id: string; type: string; title: string; url?: string }>;
};

export type SheetPayload = {
  headers: string[];
  rows: Array<Array<string | number | null>>;
};

export type CatalogPayload = {
  sourceLabel: string;
  sheets: Record<string, SheetPayload>;
  counts: {
    products: number;
    variants: number;
    prices: number;
    productionRules: number;
    playbooks: number;
    assets: number;
  };
};

function headersOf(fields: { name: string }[]) {
  return fields.map((f) => f.name);
}

function rowFrom(fields: { name: string }[], data: Record<string, string | number | null | undefined>) {
  return fields.map((f) => {
    const v = data[f.name];
    if (v == null) return "";
    return v;
  });
}

function extractPitch(guide?: string): string {
  if (!guide) return "";
  const marker = "Короткая формулировка для менеджера:";
  const idx = guide.indexOf(marker);
  if (idx >= 0) return guide.slice(idx + marker.length).trim().slice(0, 800);
  return guide.slice(0, 500);
}

function mapAssetType(t: string): string {
  if (t === "image") return "photo";
  if (t === "video") return "video";
  if (t === "text") return "document";
  return "document";
}

function absoluteAssetUrl(url: string): string | null {
  if (!url) return null;
  // Only keep real absolute URLs — do not invent hosts for relative training paths.
  if (/^https?:\/\//i.test(url)) return url;
  return null;
}

function loadTraining(): TrainingProduct[] {
  const p = path.resolve(process.cwd(), "data/training/products.json");
  if (!fs.existsSync(p)) return [];
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as { products?: TrainingProduct[] };
  return raw.products ?? [];
}

/** Map Product Hub IDs → training ids where content exists. */
const TRAINING_MAP: Record<string, string | null> = {
  PRODUCT_DATE_NEWSPAPER: "personal-newspaper",
  PRODUCT_PERSONAL_MAGAZINE: "gift-edition",
  PRODUCT_PERSONAL_NEWSPAPER: null, // structural sibling; filled as draft
  PRODUCT_CONGRATULATORY_NEWSPAPER: "retro-newspaper",
  PRODUCT_LIFE_BOOK: "personal-magazine",
  PRODUCT_FAMILY_EDITION: null,
  PRODUCT_DIGITAL_VERSION: null,
  PRODUCT_PHOTO_ANIMATION: null,
};

const DRAFT_NAMES: Record<string, { name: string; short: string; category: string; type: string }> = {
  PRODUCT_PERSONAL_NEWSPAPER: {
    name: "Персональная газета (созданная с нуля)",
    short: "Персональная газета",
    category: "personal_print",
    type: "physical",
  },
  PRODUCT_FAMILY_EDITION: {
    name: "Семейное издание",
    short: "Family Edition",
    category: "family_edition",
    type: "physical",
  },
  PRODUCT_DIGITAL_VERSION: {
    name: "Цифровая версия",
    short: "Digital",
    category: "digital",
    type: "digital",
  },
  PRODUCT_PHOTO_ANIMATION: {
    name: "Фотоанимация",
    short: "Photo Animation",
    category: "animation",
    type: "digital",
  },
};

export function buildCatalogFromTraining(): CatalogPayload {
  const training = loadTraining();
  const byId = new Map(training.map((t) => [t.id, t]));

  const productRows: Array<Array<string | number | null>> = [];
  const variantRows: Array<Array<string | number | null>> = [];
  const priceRows: Array<Array<string | number | null>> = []; // intentionally empty — no invented prices
  const ruleRows: Array<Array<string | number | null>> = [];
  const playbookRows: Array<Array<string | number | null>> = [];
  const assetRows: Array<Array<string | number | null>> = [];

  for (const productId of EXPECTED_PRODUCT_IDS) {
    const trainingId = TRAINING_MAP[productId];
    const src = trainingId ? byId.get(trainingId) : undefined;

    if (src) {
      const hero = src.coverImage && /^https?:\/\//i.test(src.coverImage) ? src.coverImage : "";
      productRows.push(
        rowFrom(PRODUCTS_FIELDS, {
          product_id: productId,
          product_name: src.title,
          short_name: src.title.split("/")[0]?.trim() ?? src.title,
          category:
            productId === "PRODUCT_LIFE_BOOK"
              ? "life_book"
              : productId === "PRODUCT_PERSONAL_MAGAZINE"
                ? "gift"
                : "archive_print",
          status: "draft",
          physical_or_digital: "physical",
          short_description: src.shortDescription ?? "",
          full_description: src.description ?? "",
          owner: "product_team",
          primary_audience: "families",
          primary_occasion: "birthday",
          default_country_code: "LV",
          default_currency: "EUR",
          hero_image_url: hero,
          landing_url: "",
          manager_short_pitch: extractPitch(src.presentationGuide),
          internal_notes: `Seeded from training/${trainingId}. Prices not included — fill 03_MARKET_PRICES.`,
        }),
      );

      variantRows.push(
        rowFrom(VARIANTS_FIELDS, {
          variant_id: `VARIANT_${productId.replace(/^PRODUCT_/, "")}_DEFAULT`,
          product_id: productId,
          variant_name: "Default / уточнить формат",
          format: "",
          size: "",
          page_count: "",
          cover_type: "",
          paper_type: "",
          binding_type: "",
          production_type: "",
          is_active: "TRUE",
          variant_description: "Структурный вариант. Уточнить формат/страницы у производства.",
        }),
      );

      // Production rule stub: NO invented day numbers — leave blank numbers, is_active FALSE
      ruleRows.push(
        rowFrom(PRODUCTION_DELIVERY_FIELDS, {
          rule_id: `RULE_${productId.replace(/^PRODUCT_/, "")}_LV_TBD`,
          product_id: productId,
          variant_id: "",
          country_code: "LV",
          production_min_days: "",
          production_max_days: "",
          urgent_min_days: "",
          urgent_max_days: "",
          supplier: "",
          production_location: "",
          delivery_service: "",
          delivery_price: "",
          delivery_currency: "EUR",
          delivery_min_days: "",
          delivery_max_days: "",
          tracking_available: "",
          materials_required: "",
          production_requirements: "TBD — заполнить сроки у производства. Числа не выдуманы.",
          limitations: "",
          is_active: "FALSE",
        }),
      );

      playbookRows.push(
        rowFrom(SALES_PLAYBOOK_FIELDS, {
          playbook_id: `PLAYBOOK_${productId.replace(/^PRODUCT_/, "")}_BIRTHDAY`,
          product_id: productId,
          audience: "families",
          occasion: "birthday",
          client_situation: "",
          client_problem: src.clientProblems ?? "",
          desired_result: "",
          desired_emotion: "",
          main_offer: src.shortDescription ?? "",
          short_pitch: extractPitch(src.presentationGuide) || src.shortDescription || "",
          qualification_questions:
            "Кому выбираете подарок?\nПо какому поводу?\nКогда нужно вручить?\nВ какой стране находится получатель?",
          key_arguments: src.emotions ?? "",
          common_objections: src.objections ?? "",
          objection_responses: "",
          upsell_product_ids: "",
          alternative_product_ids: "",
          manager_notes: `From training/${trainingId}`,
          is_active: "TRUE",
        }),
      );

      const seenUrls = new Set<string>();
      for (const mat of src.materials ?? []) {
        const url = mat.url ? absoluteAssetUrl(mat.url) : null;
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);
        assetRows.push(
          rowFrom(ASSETS_FIELDS, {
            asset_id: `ASSET_${productId.replace(/^PRODUCT_/, "")}_${mat.id}`
              .toUpperCase()
              .replace(/[^A-Z0-9_]/g, "_")
              .slice(0, 80),
            product_id: productId,
            variant_id: "",
            asset_type: mapAssetType(mat.type),
            title: mat.title,
            url,
            preview_url: "",
            language: "ru",
            country_code: "",
            status: "active",
            internal_notes: `From training/${trainingId}`,
          }),
        );
        if (assetRows.filter((r) => r[1] === productId).length >= 3) break;
      }
    } else {
      const draft = DRAFT_NAMES[productId]!;
      productRows.push(
        rowFrom(PRODUCTS_FIELDS, {
          product_id: productId,
          product_name: draft.name,
          short_name: draft.short,
          category: draft.category,
          status: "draft",
          physical_or_digital: draft.type,
          short_description:
            "Карточка создана для заполнения командой. Описание, цены и сроки нужно внести вручную. Значения не выдуманы.",
          full_description: "",
          owner: "product_team",
          primary_audience: "",
          primary_occasion: "",
          default_country_code: "LV",
          default_currency: "EUR",
          hero_image_url: "",
          landing_url: "",
          manager_short_pitch: "",
          internal_notes: "Structural draft — fill from product owner.",
        }),
      );
      variantRows.push(
        rowFrom(VARIANTS_FIELDS, {
          variant_id: `VARIANT_${productId.replace(/^PRODUCT_/, "")}_DEFAULT`,
          product_id: productId,
          variant_name: "Default / TBD",
          format: "",
          size: "",
          page_count: "",
          cover_type: "",
          paper_type: "",
          binding_type: "",
          production_type: "",
          is_active: "FALSE",
          variant_description: "Структурный вариант без подтверждённых параметров.",
        }),
      );
    }
  }

  const dictMax = Math.max(...DICTIONARY_COLUMNS.map((k) => DICTIONARIES[k].length));
  const dictRows: Array<Array<string | number | null>> = [];
  for (let i = 0; i < dictMax; i += 1) {
    dictRows.push(DICTIONARY_COLUMNS.map((k) => DICTIONARIES[k][i] ?? ""));
  }

  const readinessHeaders = [
    "product_id",
    "Продукт",
    "База",
    "Варианты",
    "Цены",
    "Производство",
    "Продажи",
    "Материалы",
    "Общая готовность",
    "Статус",
  ];

  // Formulas filled after write with row numbers — placeholders here; push script rebuilds formulas.
  const readinessRows = productRows.map((r) => {
    const id = String(r[0] ?? "");
    const name = String(r[1] ?? "");
    return [id, name, "", "", "", "", "", "", "", ""];
  });

  return {
    sourceLabel: "training/products.json + structural drafts (no invented prices)",
    sheets: {
      "00_README": {
        headers: ["section", "content"],
        rows: README_ROWS.map(([a, b]) => [a, b]),
      },
      "01_PRODUCTS": { headers: headersOf(PRODUCTS_FIELDS), rows: productRows },
      "02_VARIANTS": { headers: headersOf(VARIANTS_FIELDS), rows: variantRows },
      "03_MARKET_PRICES": { headers: headersOf(MARKET_PRICES_FIELDS), rows: priceRows },
      "04_PRODUCTION_DELIVERY": {
        headers: headersOf(PRODUCTION_DELIVERY_FIELDS),
        rows: ruleRows,
      },
      "05_SALES_PLAYBOOK": { headers: headersOf(SALES_PLAYBOOK_FIELDS), rows: playbookRows },
      "06_ASSETS": { headers: headersOf(ASSETS_FIELDS), rows: assetRows },
      "07_DICTIONARIES": { headers: [...DICTIONARY_COLUMNS], rows: dictRows },
      "08_READINESS": { headers: readinessHeaders, rows: readinessRows },
    },
    counts: {
      products: productRows.length,
      variants: variantRows.length,
      prices: priceRows.length,
      productionRules: ruleRows.length,
      playbooks: playbookRows.length,
      assets: assetRows.length,
    },
  };
}

export function buildReadinessFormulas(productCount: number): Array<Array<string | number | null>> {
  // Semicolon separators: Google Sheets locale for this workbook is typically EU (LV/RU).
  const rows: Array<Array<string | number | null>> = [];
  for (let i = 0; i < productCount; i += 1) {
    const r = i + 2;
    const id = `A${r}`;
    rows.push([
      "",
      "",
      `=IFERROR(IF(AND(VLOOKUP(${id};'01_PRODUCTS'!A:G;1;FALSE)<>"";VLOOKUP(${id};'01_PRODUCTS'!A:G;2;FALSE)<>"";VLOOKUP(${id};'01_PRODUCTS'!A:G;4;FALSE)<>"";VLOOKUP(${id};'01_PRODUCTS'!A:G;5;FALSE)<>"";VLOOKUP(${id};'01_PRODUCTS'!A:G;6;FALSE)<>"";VLOOKUP(${id};'01_PRODUCTS'!A:G;7;FALSE)<>"");"OK";"Нет");"Нет")`,
      `=COUNTIF('02_VARIANTS'!B:B;${id})`,
      `=COUNTIF('03_MARKET_PRICES'!B:B;${id})`,
      `=COUNTIF('04_PRODUCTION_DELIVERY'!B:B;${id})`,
      `=COUNTIF('05_SALES_PLAYBOOK'!B:B;${id})`,
      `=COUNTIF('06_ASSETS'!B:B;${id})`,
      `=ROUND((IF(C${r}="OK";1;0)+IF(D${r}>0;1;0)+IF(E${r}>0;1;0)+IF(F${r}>0;1;0)+IF(G${r}>0;1;0)+IF(H${r}>0;1;0))/6;2)`,
      `=IF(AND(C${r}="OK";E${r}>0;F${r}>0);"Готов";IF(OR(C${r}="OK";D${r}>0;G${r}>0;H${r}>0);"В работе";"Нужно заполнить"))`,
    ]);
  }
  return rows;
}
