/**
 * Fill passport tabs for «Книга жизни» (interview book) inside
 * «Паспорта Retro Pressa» (13_Смыслы / 13_Экономика / 13_Производство / 13_Визуал).
 * Distinct from PRODUCT_LIFE_BOOK «Книга жизни в заголовках газет».
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/product-hub/create-life-story-passport.ts
 */

import {
  getGoogleAccessToken,
  readGoogleServiceAccount,
  writeSheetValues,
} from "../../src/lib/google/sheets-client";
import { BITRIX_GIFT_TYPES_SHEET_ID } from "./bitrix-aligned-catalog";
import { passportKvRows } from "./passport-field-labels";

const PRODUCT_ID = "PRODUCT_LIFE_STORY";
const BITRIX_NAME = "Книга жизни";
const SOURCE = "КП «История жизни» / бриф GPT-чата";
const TABS = ["13_Смыслы", "13_Экономика", "13_Производство", "13_Визуал"] as const;

function quote(title: string, a1: string) {
  return `'${title.replace(/'/g, "''")}'!${a1}`;
}

async function googleApi<T>(token: string, url: string, init?: RequestInit): Promise<T> {
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

async function ensureTabs(token: string, spreadsheetId: string) {
  const meta = await googleApi<{
    sheets?: Array<{ properties?: { title?: string } }>;
  }>(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(title)`);
  const existing = new Set((meta.sheets || []).map((s) => (s.properties?.title || "").trim()));
  const missing = TABS.filter((t) => !existing.has(t));
  if (!missing.length) return;
  await googleApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: missing.map((title) => ({
        addSheet: { properties: { title, gridProperties: { rowCount: 120, columnCount: 8 } } },
      })),
    }),
  });
}

function meaningsRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product_id", PRODUCT_ID, "passport-registry"],
    ["bitrix_name", BITRIX_NAME, "Bitrix gift type / passport"],
    ["short_name", "Книга жизни", SOURCE],
    ["mapping_note", "В КП названа «История жизни». В системе — «Книга жизни».", SOURCE],
    [
      "what_it_is",
      "Интервьюер общается с героем книги и раскрывает его жизненный путь. На основе интервью и собранных семейных материалов выстраивается история и готовится книга. Два формата КП: 50–70 страниц — компактная цельная история; 100–120 страниц — более подробная история с большим количеством глав и деталей.",
      SOURCE,
    ],
    [
      "for_whom",
      "Для детей, которые хотят подарить близкому книгу о нём; для человека и его семьи, которые хотят создать семейный артефакт.",
      SOURCE,
    ],
    [
      "key_idea",
      "Создать книгу о жизненном пути человека на основе его рассказа и семейных материалов.",
      SOURCE,
    ],
    [
      "how_it_works",
      "1. Личное интервью с героем (в обоих вариантах КП заложено 3 часа). 2. Сбор материалов. 3. Структура истории. 4. Подготовка книги. 5. Финальный макет. Порядок заявки, оплаты, согласования, печати и выдачи в брифе не зафиксирован.",
      SOURCE,
    ],
    [
      "benefits",
      "1. Книга создаётся на основе интервью с самим героем. 2. Используются собранные семейные материалы. 3. Можно выбрать компактную историю (50–70 стр.) или подробную (100–120 стр.). 4. Книга может быть подарком от детей близкому или семейным артефактом.",
      SOURCE,
    ],
    [
      "cost_from_sheet",
      "КП «История жизни»: 50–70 стр. — книга 800 € + интервью 120 € = 920 €; 100–120 стр. — книга 1 600 € + интервью 120 € = 1 720 €. Интервью: 3 часа × 40 €. Статус как общего витринного прайса не подтверждён.",
      SOURCE,
    ],
    [
      "what_we_sell",
      "Книга о человеке на основе интервью с героем и семейных материалов. В КП интервью считается отдельной строкой и входит в итог.",
      SOURCE,
    ],
    [
      "when_to_offer",
      "Когда хотят подарить близкому книгу о нём или создать семейный артефакт. 50–70 стр. — компактная цельная история; 100–120 стр. — подробная история с главами и деталями.",
      SOURCE,
    ],
    [
      "pitch_one_paragraph",
      "Книга создаётся на основе интервью с героем и собранных семейных материалов. В работу входят личное интервью, сбор материалов, структура истории, подготовка книги и финальный макет. В КП: 50–70 страниц за 920 € с интервью или 100–120 страниц за 1 720 € с интервью. Интервью в обоих случаях: 3 часа по 40 €, всего 120 €.",
      SOURCE,
    ],
    [
      "pitch_short",
      "Мы берём интервью у вашего близкого и на основе его рассказа и семейных материалов создаём книгу о нём.",
      SOURCE,
    ],
    [
      "role_in_line",
      "Отдельный продукт о человеке. 50–70 и 100–120 стр. — варианты одного продукта. Интервью — отдельно рассчитанная часть предложения, не самостоятельный товар (в брифе не сказано, что его можно купить отдельно).",
      SOURCE,
    ],
    [
      "compare_with",
      "Не «Книга жизни в заголовках газет» (газеты за каждый год жизни). Не глянцевый журнал о человеке с нуля. Не семейное издание про историю всей семьи: даже если дети называют книгу семейным артефактом, герой — один человек.",
      SOURCE,
    ],
    [
      "do_not_promise",
      "Не обещать срок, печать и доставку внутри сумм КП — не зафиксированы. Не обещать интервью отдельно от книги. Не обещать газеты по годам. Не продавать как семейное издание про всю семью. Цены — из персонального КП, не как утверждённая витрина.",
      SOURCE,
    ],
    ["sources", SOURCE, "create-life-story-passport"],
    ["synced_at", syncedAt, "script"],
  ]);
}

function economyRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product_id", PRODUCT_ID, "passport-registry", ""],
    ["bitrix_name", BITRIX_NAME, "passport", ""],
    [
      "definition",
      "Книга о человеке по интервью. Цены ниже — из персонального КП «История жизни», не общий витринный прайс.",
      SOURCE,
      "",
    ],
    ["retail_price", "920 / 1720 с интервью", SOURCE, "КП: 50–70 стр. 920 €; 100–120 стр. 1 720 €"],
    ["currency", "EUR", SOURCE, ""],
    ["cost_price", "", SOURCE, "COGS не зафиксирован"],
    ["cogs_total", "", SOURCE, ""],
    ["cogs_retail_model", "", SOURCE, ""],
    ["cogs_margin_pct", "", SOURCE, ""],
    ["cogs_line_1", "Формат 50–70 стр.: книга 800 € + интервью 120 € = 920 €", SOURCE, ""],
    ["cogs_line_2", "Формат 100–120 стр.: книга 1 600 € + интервью 120 € = 1 720 €", SOURCE, ""],
    ["cogs_line_3", "Интервью в обоих: 3 часа × 40 € = 120 €", SOURCE, ""],
    [
      "value_vs_price",
      "Показывать стоимость книги, стоимость интервью и итог отдельно, как в КП. Не подставлять цену книги в заголовках газет.",
      SOURCE,
      "Для ОП",
    ],
    ["rule", "Не копировать retail/COGS из «Книги жизни в заголовках газет». Печать в сумме КП не подтверждена.", SOURCE, ""],
    ["synced_at", syncedAt, "script", "UTC"],
  ]);
}

function productionRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product", BITRIX_NAME, SOURCE, "Интервью → книга"],
    [
      "process_start",
      "Уточнить: книга о человеке по интервью, не газеты по годам и не семейное издание про всю семью.",
      SOURCE,
      "",
    ],
    ["step_1", "Личное интервью с героем книги. В КП заложено 3 часа. Формат онлайн/очно и разбивка встреч не зафиксированы.", SOURCE, ""],
    ["step_2", "Сбор семейных материалов. Состав и количество в брифе не зафиксированы.", SOURCE, ""],
    ["step_3", "Структура истории.", SOURCE, ""],
    ["step_4", "Подготовка книги и финальный макет. Количество правок и печать в брифе не зафиксированы.", SOURCE, ""],
    [
      "status_note",
      "Срок изготовления, экземпляры, переплёт, бумага, доставка, оплата — не зафиксированы. Не обещать.",
      SOURCE,
      "",
    ],
    ["synced_at", syncedAt, "script", "UTC"],
  ]);
}

function visualRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product_id", PRODUCT_ID, "passport-registry"],
    [
      "note",
      "Ссылок на фото готовой книги, развороты, видео и отзывы именно этого продукта в брифе нет. Не показывать книгу в заголовках газет как пример этого продукта.",
      SOURCE,
    ],
    ["synced_at", syncedAt, "script"],
  ]);
}

function miniPassportRows() {
  const today = new Date().toISOString().slice(0, 10);
  return [
    ["Подарок: Книга жизни"],
    ["Обновлено", today],
    ["Категория", "Книга о человеке"],
    ["Название для ОП", "Книга жизни"],
    ["Название типа в Bitrix", "Книга жизни"],
    ["PRODUCT_ID", PRODUCT_ID],
    ["Статус", "active"],
    [
      "Что это",
      "Книга о человеке на основе интервью с героем и семейных материалов. Два объёма: 50–70 и 100–120 стр. Не газета по годам.",
    ],
    ["Цена витрина", "КП: 920 € / 1 720 € с интервью"],
    ["Валовая маржа", "TBD"],
    ["Маржинальность", "TBD"],
    ["Себестоимость COGS €", "TBD"],
    ["Срок готовности", "не обещать — срок в брифе не зафиксирован"],
    [
      "Что входит в цену",
      "личное интервью 3 ч, сбор материалов, структура истории, подготовка книги, финальный макет. Печать и доставка в сумме КП не подтверждены.",
    ],
    [],
    ["Полный паспорт", `https://docs.google.com/spreadsheets/d/${BITRIX_GIFT_TYPES_SHEET_ID}/edit#gid=1987762183`],
    ["Drive визуал (корень)", ""],
    ["Мастер COGS", "https://docs.google.com/spreadsheets/d/1qyINXMJVZoJiidEYXyoeRvjUIF9p8Te0sSkYlAKWdAU/edit"],
  ];
}

async function main() {
  const sa = readGoogleServiceAccount();
  if (!sa) throw new Error("Service account not configured");

  const spreadsheetId = process.env.LIFE_STORY_PASSPORT_SHEET_ID?.trim() || BITRIX_GIFT_TYPES_SHEET_ID;
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  await ensureTabs(token, spreadsheetId);

  const tabs: Array<[string, Array<Array<string | number>>]> = [
    ["13_Смыслы", meaningsRows()],
    ["13_Экономика", economyRows()],
    ["13_Производство", productionRows()],
    ["13_Визуал", visualRows()],
    ["13_Книга_жизни", miniPassportRows()],
  ];

  for (const [tab, rows] of tabs) {
    console.log(`→ writing ${tab} (${rows.length - 1} fields)`);
    await writeSheetValues({
      spreadsheetId,
      range: quote(tab, "A1"),
      clearRange: quote(tab, "A1:Z300"),
      rows,
    });
  }

  console.log(`\nOpen: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
