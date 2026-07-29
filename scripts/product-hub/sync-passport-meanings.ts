/**
 * Fill passport «Смыслы» with FULL texts from:
 * 1) Meanings workbook «Продукты RetroPressa»
 * 2) Training biosystem (data/training/products.json) — full description / guide / objections
 * 3) Short CRM framing (compare / upsell role) where needed
 *
 * Does NOT invent product facts. Does NOT compress source paragraphs.
 *
 * Usage:
 *   npm run product-hub:sync-passport-meanings
 *   npx tsx --env-file=.env.local scripts/product-hub/sync-passport-meanings.ts --product=PRODUCT_LIFE_BOOK
 */

import fs from "node:fs";
import path from "node:path";
import {
  getGoogleAccessToken,
  readGoogleServiceAccount,
  writeSheetValues,
} from "../../src/lib/google/sheets-client";
import {
  findPassportByProductId,
  PASSPORT_REGISTRY,
  type PassportRegistryEntry,
} from "./passport-registry";
import { passportKvRows } from "./passport-field-labels";

const MEANINGS_SHEET_ID = "1hLYcO6_knzWrfz6RWuHkQPuJoRajiy1XM9Z1aqHcQ98";
const MEANINGS_SHEET_URL = `https://docs.google.com/spreadsheets/d/${MEANINGS_SHEET_ID}/edit`;
const TRAINING_PRODUCTS_PATH = path.join(process.cwd(), "data/training/products.json");

const FRAMEWORK_HEADERS = [
  "short_name",
  "what_it_is",
  "for_whom",
  "client_pain",
  "key_idea",
  "why_now",
  "how_it_works",
  "benefits",
  "cost_from_sheet",
] as const;

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
};

type SheetProduct = {
  tab: string;
  rowIndex: number;
  fields: Partial<Record<(typeof FRAMEWORK_HEADERS)[number], string>>;
  /** Extra narrative / secondary blocks found under the product. */
  extras: Array<{ label: string; text: string }>;
};

type ProductMeaningPlan = {
  productId: string;
  /** Match sheet product short name (substring, case-insensitive). */
  sheetNameIncludes?: string[];
  trainingId?: string;
  /** Extra static CRM rows (not invented product facts). */
  framing?: Array<[string, string, string]>;
};

const PLANS: ProductMeaningPlan[] = [
  {
    productId: "PRODUCT_ORIGINAL",
    sheetNameIncludes: ["газета из дня рождения", "издание из важной даты"],
    trainingId: "personal-newspaper",
    framing: [
      [
        "compare_with",
        "Оригинал = подлинник со склада (физический архивный экземпляр). Репродукция = новая печать по скану на современной бумаге. Поздравительная = скан архива + фото/текст клиента. Дигитал = файл без печати.",
        "Product Hub / CRM",
      ],
      [
        "bitrix_note",
        "В Bitrix gift type «Оригинал». В материалах клиента категория также «Оригинал» (бывш. «Газета/Журнал из даты»).",
        "CRM",
      ],
    ],
  },
  {
    productId: "PRODUCT_LIFE_BOOK",
    sheetNameIncludes: ["книга жизни"],
    trainingId: "personal-magazine",
    framing: [
      [
        "compare_with",
        "Книга жизни = хронология газет по годам жизни. Не путать с именным глянцевым журналом (тексты/фото с нуля) и с книгой воспоминаний (интервью/наследство). Не путать с семейным изданием (модель уточняется).",
        "Product Hub / CRM",
      ],
    ],
  },
  {
    productId: "PRODUCT_PERSONAL_NEWSPAPER",
    sheetNameIncludes: ["персонализированная газета", "газета о человеке", "party"],
    trainingId: "gift-edition",
    framing: [
      [
        "compare_with",
        "Перс. газета = создаётся с нуля про человека (Party Page). Не архив из даты. Поздравительная газета = ретро-скан + персонализация. Журнал = следующий уровень объёма/статуса.",
        "Product Hub / CRM",
      ],
      ["landing", "https://partypagee.com/new/ru", "Meanings sheet"],
    ],
  },
  {
    productId: "PRODUCT_PERSONAL_MAGAZINE",
    sheetNameIncludes: ["именной журнал", "глянцевый журнал", "персональный журнал"],
    trainingId: "gift-edition",
    framing: [
      [
        "compare_with",
        "Перс. журнал = глянец с нуля про человека (мин. 16 стр.). Не поздравительный журнал на скане архива. Не книга жизни из газетных лет. Газета Party Page = быстрый эффект первой полосы.",
        "Product Hub / CRM",
      ],
    ],
  },
  {
    productId: "PRODUCT_FAMILY_EDITION",
    sheetNameIncludes: ["книга воспоминаний"],
    framing: [
      [
        "mapping_note",
        "В книге смыслов ближайший полный блок — «Книга воспоминаний». Актуальная модель/тариф «Семейное издание» в Mint TBD (Анна). Не подменять автоматически книгу воспоминаний = семейное издание без решения продукта.",
        "Meanings + Mint",
      ],
      [
        "compare_with",
        "Семейное издание / книга воспоминаний — про наследие и семейную память. Книга жизни — хронология газет по годам. Перс. журнал — глянец про одного героя с редакцией.",
        "Product Hub",
      ],
    ],
  },
  {
    productId: "PRODUCT_CONGRATS_NEWSPAPER",
    trainingId: "retro-newspaper",
    framing: [
      [
        "product_focus",
        "Фокус паспорта: Поздравительная газета (ретро-база + персонализация). В training «retro-newspaper» описаны газета и журнал вместе — ниже полный текст; для журнала см. соседний паспорт.",
        "CRM",
      ],
      [
        "compare_with",
        "Поздравительная газета = скан архивного издания + фото/текст клиента. Не чистая репродукция. Не перс. газета с нуля (Party Page). Оживи/наклейка — апселлы.",
        "CRM",
      ],
    ],
  },
  {
    productId: "PRODUCT_CONGRATS_MAGAZINE",
    trainingId: "retro-newspaper",
    framing: [
      [
        "product_focus",
        "Фокус паспорта: Поздравительный журнал. Полный training-текст ниже общий для ретро-линейки; отличие от газеты — больше пространства под фото/текст на журнальной базе.",
        "CRM",
      ],
      [
        "compare_with",
        "Поздравительный журнал = архивный журнал + персональные страницы. Не именной глянец 240€/16 стр. с нуля. Не чистая репродукция.",
        "CRM",
      ],
    ],
  },
  {
    productId: "PRODUCT_REPRODUCTION",
    trainingId: "personal-newspaper",
    framing: [
      [
        "what_it_is",
        "Точная печатная копия оригинального газетного или журнального издания в натуральную величину на современной бумаге. Без вставки фото и текста клиента. Эмоция «газеты из того дня», когда физического оригинала на складе нет или клиенту достаточно копии.",
        "Mint + CRM",
      ],
      [
        "key_idea",
        "Сохранить машину времени без претензии на архивный подлинник: клиент всё равно дарит издание из нужной даты.",
        "CRM",
      ],
      [
        "how_it_works",
        "После оплаты: скан у Саши (Telegram RetroPress) → файл в Bitrix → макет Таня → печать Рига/Минск → отправка клиенту.",
        "Mint production",
      ],
      [
        "compare_with",
        "Не оригинал со склада. Не поздравительная (нет клиентского фото/текста внутри). Не дигитал (есть физическая печать). Для смыслов «даты» опирайся также на блок оригинала/газеты из дня рождения ниже в training.",
        "CRM",
      ],
      [
        "do_not_promise",
        "Не обещать, что это архивный оригинал. Не обещать персонализацию внутри репродукции.",
        "Ops rule",
      ],
      [
        "training_context_note",
        "Отдельной строки «Репродукция» в книге смыслов нет. Ниже — полный training по «газете из даты» как смысловой базе эмоции; сверху — отличие формата репродукции.",
        "sync note",
      ],
    ],
  },
  {
    productId: "PRODUCT_DIGITAL",
    framing: [
      [
        "what_it_is",
        "Электронная версия издания из даты: файл для просмотра/отправки без физической печати и логистики. Быстрый и дистанционный формат «машины времени».",
        "Mint + CRM",
      ],
      [
        "for_whom",
        "Когда нужен быстрый доступ, отправка за границу, нет времени/желания ждать печать, или как ступенька к физической версии.",
        "CRM",
      ],
      [
        "client_pain",
        "Хочет показать издание из даты сейчас, без доставки и ожидания типографии; или получатель далеко.",
        "CRM",
      ],
      [
        "key_idea",
        "Та же идея даты/истории, но без тактильного вау за столом.",
        "CRM",
      ],
      [
        "benefits",
        "Скорость; удобство email; ниже цена, чем печать; можно позже апселл в физическую репродукцию/оригинал.",
        "CRM",
      ],
      [
        "what_we_sell",
        "Доступ к «тому дню» без логистики. Честно: это не замена бумажного подарка за праздничным столом.",
        "CRM",
      ],
      [
        "compare_with",
        "Дигитал = файл. Репродукция/оригинал = физика. Не путать с PDF персональной газеты Party Page.",
        "CRM",
      ],
      [
        "sheet_note",
        "В книге смыслов отдельного полного блока на дигитал нет — заполняем по Mint/CRM.",
        "sync note",
      ],
    ],
  },
  {
    productId: "PRODUCT_ANIMATE",
    framing: [
      [
        "what_it_is",
        "Апселл «Оживи»: издание или фото «оживает» на телефоне (AR/видео-слой). Второй слой wow после основного продукта. По Mint видео-тост может храниться долго (до ~30 лет в сводке).",
        "Mint + CRM",
      ],
      [
        "role_in_line",
        "Не основной продукт. Задача: поднять эмоцию и средний чек после выбора газеты/журнала/поздравительной.",
        "Product Hub",
      ],
      [
        "for_whom",
        "Клиенты, которые уже берут печатный подарок и хотят «вау» для гостей: снять на телефон, переслать, сохранить видео-тост.",
        "CRM",
      ],
      [
        "client_pain",
        "Печатный подарок уже выбран, но хочется ещё один запоминающийся момент за столом / в сторис.",
        "CRM",
      ],
      [
        "key_idea",
        "Подарок заговаривает: гости взаимодействуют, эмоция уезжает в пересылки и память телефона.",
        "CRM",
      ],
      [
        "benefits",
        "Высокая эмоция на относительно низком чеке; вирусность среди гостей; усиливает любой печатный формат.",
        "CRM",
      ],
      [
        "when_to_offer",
        "После основного продукта: «за небольшую доплату издание оживёт на телефоне».",
        "Sales OS",
      ],
      [
        "compare_with",
        "Апселл к оригиналу/репродукции/поздравительным/персональным. Не самостоятельный «главный» подарок в большинстве сценариев.",
        "CRM",
      ],
      [
        "sheet_note",
        "В книге смыслов отдельной строки на Оживи нет — смысл держим как upsell-роль.",
        "sync note",
      ],
    ],
  },
  {
    productId: "PRODUCT_STICKER",
    framing: [
      [
        "what_it_is",
        "Праздничная наклейка к комплекту (выбор из дизайнов RU/LV). Микро-апселл упаковки/вручения без отдельного производства «под клиента».",
        "Mint + CRM",
      ],
      [
        "role_in_line",
        "Не основной продукт. Задача: завершённость комплекта + лёгкий подъём чека.",
        "Product Hub",
      ],
      [
        "for_whom",
        "Любой заказ печатного подарка, где важно красивое вручение.",
        "CRM",
      ],
      [
        "key_idea",
        "Мелочь, которая делает комплект «собранным» и праздничным.",
        "CRM",
      ],
      [
        "benefits",
        "Почти без сопротивления по цене; усиливает эмоцию упаковки; 8 дизайнов без ожидания.",
        "Mint + CRM",
      ],
      [
        "when_to_offer",
        "В конце оформления заказа — всегда как опция комплекта.",
        "Sales OS",
      ],
      [
        "sheet_note",
        "В книге смыслов отдельной строки на наклейку нет.",
        "sync note",
      ],
    ],
  },
];

function loadTraining(id: string): TrainingProduct | null {
  const raw = JSON.parse(fs.readFileSync(TRAINING_PRODUCTS_PATH, "utf8")) as {
    products?: TrainingProduct[];
  };
  return raw.products?.find((p) => p.id === id) ?? null;
}

function quote(title: string, a1: string) {
  return `'${title.replace(/'/g, "''")}'!${a1}`;
}

function norm(s: string) {
  return s.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trim();
}

function looksLikeFrameworkHeader(row: string[]): boolean {
  const joined = row.map((c) => norm(c).toLowerCase()).join(" | ");
  return (
    joined.includes("что это такое") &&
    joined.includes("для кого") &&
    (joined.includes("главные выгоды") || joined.includes("ключевая идея"))
  );
}

function looksLikeSecondaryHeader(row: string[]): boolean {
  const joined = row.map((c) => norm(c).toLowerCase()).join(" | ");
  return joined.includes("из чего состоит") || joined.includes("минимальный объём");
}

async function sheetsApi<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || `${res.status}`);
  return data;
}

async function loadSheetProducts(token: string): Promise<SheetProduct[]> {
  const meta = await sheetsApi<{
    sheets?: Array<{ properties?: { title?: string } }>;
  }>(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${MEANINGS_SHEET_ID}?fields=sheets.properties(title)`,
  );

  const products: SheetProduct[] = [];

  for (const sheet of meta.sheets || []) {
    const tab = sheet.properties?.title;
    if (!tab) continue;
    const range = encodeURIComponent(`'${tab.replace(/'/g, "''")}'!A1:Z120`);
    const vals = await sheetsApi<{ values?: string[][] }>(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${MEANINGS_SHEET_ID}/values/${range}`,
    );
    const rows = vals.values || [];

    for (let i = 0; i < rows.length; i++) {
      const row = (rows[i] || []).map((c) => norm(String(c ?? "")));
      if (!looksLikeFrameworkHeader(row)) continue;

      const data = (rows[i + 1] || []).map((c) => norm(String(c ?? "")));
      if (!data.some((c) => c.length > 40)) continue;

      // Header may be 8 or 9 cols; data aligned left.
      const fields: SheetProduct["fields"] = {};
      const offset = row[0]?.toLowerCase().includes("7й") || row[0]?.toLowerCase().includes("короткое") ? 0 : 0;
      // Standard: col0 name, col1 what, ... col7 benefits, col8 cost
      const mapped = [
        "short_name",
        "what_it_is",
        "for_whom",
        "client_pain",
        "key_idea",
        "why_now",
        "how_it_works",
        "benefits",
        "cost_from_sheet",
      ] as const;
      for (let c = 0; c < mapped.length; c++) {
        const v = data[c + offset];
        if (v) fields[mapped[c]] = v;
      }

      const extras: SheetProduct["extras"] = [];
      // Scan following rows until next framework header or empty stretch
      for (let j = i + 2; j < Math.min(rows.length, i + 12); j++) {
        const r = (rows[j] || []).map((c) => norm(String(c ?? "")));
        if (looksLikeFrameworkHeader(r)) break;
        if (looksLikeSecondaryHeader(r)) {
          const next = (rows[j + 1] || []).map((c) => norm(String(c ?? "")));
          const labels = [
            "composition",
            "volume_and_price",
            "what_we_sell_detail",
            "emotional_result_detail",
            "when_to_offer_detail",
          ];
          next.forEach((text, idx) => {
            if (text.length > 30) extras.push({ label: labels[idx] || `secondary_${idx + 1}`, text });
          });
          j += 1;
          continue;
        }

        const rich = r.filter((c) => c.length > 80);
        if (rich.length === 0) continue;

        // Multi-column pitch blocks
        if (rich.length >= 2) {
          rich.forEach((text, idx) => {
            const label =
              /как объяснять|одном абзаце/i.test(text)
                ? "pitch_one_paragraph"
                : /короткая формулировка|для менеджера/i.test(text)
                  ? "pitch_short"
                  : /мы продаём/i.test(text)
                    ? "what_we_sell"
                    : /чувствует|эмоциональн/i.test(text)
                      ? "emotional_result"
                      : /когда клиент говорит/i.test(text)
                        ? "when_to_offer"
                        : text.length > 500
                          ? `long_form_${extras.filter((e) => e.label.startsWith("long_form")).length + 1}`
                          : `extra_block_${extras.length + 1}`;
            // Prefer first cell as long form if huge
            if (idx === 0 && text.length > 400) {
              extras.push({
                label: extras.some((e) => e.label === "long_form_story")
                  ? `long_form_${extras.filter((e) => e.label.startsWith("long_form")).length + 1}`
                  : "long_form_story",
                text,
              });
            } else if (/как объяснять|одном абзаце/i.test(text) || label === "pitch_one_paragraph") {
              extras.push({ label: "pitch_one_paragraph", text: text.replace(/^Как объяснять клиенту в одном абзаце\s*/i, "").trim() });
            } else if (/короткая формулировка/i.test(text) || label === "pitch_short") {
              extras.push({ label: "pitch_short", text: text.replace(/^Короткая формулировка для менеджера\s*/i, "").trim() });
            } else if (/мы продаём/i.test(text)) {
              extras.push({ label: "what_we_sell", text });
            } else if (label === "emotional_result" || /чувствует:/i.test(text)) {
              extras.push({ label: "emotional_result", text });
            } else if (label === "when_to_offer" || /когда клиент говорит/i.test(text)) {
              extras.push({ label: "when_to_offer", text });
            } else if (text.length > 200) {
              extras.push({ label: `narrative_${extras.length + 1}`, text });
            }
          });
        } else if (rich.length === 1) {
          const text = rich[0];
          if (/мы продаём/i.test(text)) extras.push({ label: "what_we_sell", text });
          else if (text.length > 300) extras.push({ label: "long_form_story", text });
        }
      }

      products.push({ tab, rowIndex: i + 2, fields, extras });
      // Skip the data row in outer loop naturally
    }
  }

  return products;
}

function findSheetProduct(all: SheetProduct[], includes: string[]): SheetProduct | null {
  const needles = includes.map((s) => s.toLowerCase());
  for (const p of all) {
    const name = (p.fields.short_name || "").toLowerCase();
    if (needles.some((n) => name.includes(n))) return p;
  }
  return null;
}

function pushRow(
  rows: Array<[string, string, string]>,
  field: string,
  value: string | undefined,
  source: string,
) {
  const v = norm(value || "");
  if (!v) return;
  // Avoid duplicate field names: keep first full value, append suffix for later
  const existing = rows.filter((r) => r[0] === field || r[0].startsWith(`${field}__`));
  if (existing.length === 0) {
    rows.push([field, v, source]);
    return;
  }
  // Skip near-duplicates
  if (existing.some((r) => r[1] === v || (v.length > 80 && r[1].includes(v.slice(0, 80))))) return;
  rows.push([`${field}__${existing.length + 1}`, v, source]);
}

function buildRowsForPlan(plan: ProductMeaningPlan, sheetProducts: SheetProduct[]): Array<[string, string, string]> {
  const entry = findPassportByProductId(plan.productId);
  if (!entry) throw new Error(`Missing registry ${plan.productId}`);

  const rows: Array<[string, string, string]> = [
    ["product_id", plan.productId, "passport-registry"],
    ["bitrix_name", entry.bitrixName, "Bitrix gift type"],
  ];

  const sheet = plan.sheetNameIncludes ? findSheetProduct(sheetProducts, plan.sheetNameIncludes) : null;
  if (sheet) {
    pushRow(rows, "source_tab", sheet.tab, "Meanings workbook");
    pushRow(rows, "source_row", String(sheet.rowIndex), "Meanings workbook");
    pushRow(rows, "short_name", sheet.fields.short_name, "Meanings workbook");
    for (const key of FRAMEWORK_HEADERS) {
      if (key === "short_name") continue;
      pushRow(rows, key, sheet.fields[key], "Meanings workbook");
    }
    for (const extra of sheet.extras) {
      pushRow(rows, extra.label, extra.text, "Meanings workbook · narrative/secondary");
    }
  }

  for (const [field, value, source] of plan.framing || []) {
    pushRow(rows, field, value, source);
  }

  const training = plan.trainingId ? loadTraining(plan.trainingId) : null;
  if (training) {
    pushRow(rows, "training_product_id", training.id, "training products.json");
    pushRow(rows, "training_title", training.title, "training products.json");
    pushRow(rows, "training_short_description", training.shortDescription, "training products.json");
    pushRow(rows, "training_description", training.description, "training products.json");
    pushRow(rows, "training_target_audience", training.targetAudience, "training products.json");
    pushRow(rows, "training_client_problems", training.clientProblems, "training products.json");
    pushRow(rows, "training_emotions", training.emotions, "training products.json");
    pushRow(rows, "training_objections", training.objections, "training products.json");
    pushRow(rows, "training_presentation_guide", training.presentationGuide, "training products.json");

    // If sheet missing core fields, promote training into main fields
    if (!sheet?.fields.what_it_is && training.description) {
      pushRow(rows, "what_it_is", training.description, "training (fallback main)");
    }
    if (!sheet?.fields.for_whom && training.targetAudience) {
      pushRow(rows, "for_whom", training.targetAudience, "training (fallback main)");
    }
    if (!sheet?.fields.client_pain && training.clientProblems) {
      pushRow(rows, "client_pain", training.clientProblems, "training (fallback main)");
    }
    if (!sheet?.fields.benefits && training.emotions) {
      pushRow(rows, "benefits", training.emotions, "training (fallback main)");
    }
    if (!rows.some((r) => r[0] === "objections") && training.objections) {
      pushRow(rows, "objections", training.objections, "training products.json");
    }
    if (!rows.some((r) => r[0] === "how_it_works") && training.presentationGuide) {
      pushRow(rows, "how_it_works", training.presentationGuide, "training (fallback main)");
    }
  }

  pushRow(
    rows,
    "sources",
    `Full dump from meanings workbook + training biosystem (no compression). Sheet: ${MEANINGS_SHEET_URL}`,
    "sync-passport-meanings",
  );
  pushRow(rows, "synced_at", new Date().toISOString(), "script");

  return rows;
}

async function ensureSmyslyTab(token: string, spreadsheetId: string): Promise<string> {
  const meta = await sheetsApi<{
    sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
  }>(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
  );
  const existing = (meta.sheets || []).find((s) => (s.properties?.title || "").trim() === "Смыслы");
  if (existing?.properties?.title) return existing.properties.title;

  await sheetsApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: { title: "Смыслы", gridProperties: { rowCount: 200, columnCount: 6 } },
          },
        },
      ],
    }),
  });
  return "Смыслы";
}

async function syncOne(entry: PassportRegistryEntry, fieldRows: Array<[string, string, string]>) {
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  try {
    await sheetsApi(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${entry.spreadsheetId}?fields=properties.title`,
    );
  } catch (e) {
    console.error(`  SKIP ${entry.bitrixName}: ${e instanceof Error ? e.message : e}`);
    return false;
  }

  await ensureSmyslyTab(token, entry.spreadsheetId);
  const rows = passportKvRows(fieldRows);

  await writeSheetValues({
    spreadsheetId: entry.spreadsheetId,
    range: quote("Смыслы", "A1"),
    clearRange: quote("Смыслы", "A1:Z400"),
    rows,
  });

  const chars = fieldRows.reduce((a, [, v]) => a + v.length, 0);
  console.log(`  OK fields=${fieldRows.length} chars≈${chars}`);
  return true;
}

async function main() {
  const sa = readGoogleServiceAccount();
  if (!sa) throw new Error("Service account not configured");

  const productArg = process.argv.find((a) => a.startsWith("--product="))?.slice("--product=".length);
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  console.log("Loading meanings workbook…");
  const sheetProducts = await loadSheetProducts(token);
  console.log(
    `Parsed ${sheetProducts.length} sheet products:`,
    sheetProducts.map((p) => p.fields.short_name?.slice(0, 40)).join(" | "),
  );

  const plans = productArg ? PLANS.filter((p) => p.productId === productArg) : PLANS;
  let ok = 0;
  let skipped = 0;

  for (const plan of plans) {
    const entry = findPassportByProductId(plan.productId);
    if (!entry) {
      console.error(`Missing registry ${plan.productId}`);
      skipped += 1;
      continue;
    }
    console.log(`\n→ Смыслы FULL: ${entry.bitrixName}`);
    const fieldRows = buildRowsForPlan(plan, sheetProducts);
    if (await syncOne(entry, fieldRows)) ok += 1;
    else skipped += 1;
  }

  for (const entry of PASSPORT_REGISTRY) {
    if (!PLANS.some((p) => p.productId === entry.productId)) {
      console.warn(`No plan for ${entry.bitrixName}`);
    }
  }

  console.log(`\nDone. ok=${ok} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
