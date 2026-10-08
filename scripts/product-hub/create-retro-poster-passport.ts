/**
 * Fill passport tabs for «Ретро-постер» inside
 * «Паспорта Retro Pressa» (17_Смыслы / 17_Экономика / 17_Производство / 17_Визуал).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/product-hub/create-retro-poster-passport.ts
 */

import {
  getGoogleAccessToken,
  readGoogleServiceAccount,
  writeSheetValues,
} from "../../src/lib/google/sheets-client";
import { BITRIX_GIFT_TYPES_SHEET_ID } from "./bitrix-aligned-catalog";
import { passportKvRows } from "./passport-field-labels";

const PRODUCT_ID = "PRODUCT_RETRO_POSTER";
const BITRIX_NAME = "Ретро-постер";
const SOURCE = "утверждённый бриф PDF retro-poster / пользователь";
const TABS = ["17_Смыслы", "17_Экономика", "17_Производство", "17_Визуал"] as const;
const MINI_TAB = "17_Ретро_постер";

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
  const missing = [...TABS, MINI_TAB].filter((t) => !existing.has(t));
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
    ["short_name", "Ретро-постер", SOURCE],
    [
      "mapping_note",
      "Bitrix ID / точное CRM-название — UNKNOWN. id retro-poster — slug карточки, не ID в CRM. Не путать с поздравительной газетой и с постером из оригинальной журнальной страницы.",
      SOURCE,
    ],
    [
      "what_it_is",
      "Ретро-постер — необычная альтернатива традиционной газете: персональный постер, созданный специально для именинника. Смысл одной фразой: «Ваша история — на одной странице». Идея та же, что у поздравительной газеты: фото человека, персональный текст и факты жизни. Формат другой: это не выпуск, который листают, а одна страница для стены.",
      SOURCE,
    ],
    [
      "for_whom",
      "Люди, которым нравится идея поздравительной газеты, но нужен подарок на стену. Именинник, юбиляр, дедушка, папа, мама — когда историю человека хотят повесить в рамке. Также тем, кто хочет сохранить файл в семейном архиве и напечатать его позже.",
      SOURCE,
    ],
    [
      "key_idea",
      "Ретро-постер — подарок, который рассказывает историю человека на одной странице.",
      SOURCE,
    ],
    [
      "how_it_works",
      "1. Клиент выбирает размер: 30 × 40 см или A3 (29,7 × 42 см). 2. Выбирает тип макета: передовица исторической газеты или полностью индивидуальный лист. 3. Собирает фото именинника, факты, события, поздравление. 4. Получает печатный постер высокого качества или электронный файл. Рамку в состав заказа автоматически не обещаем.",
      SOURCE,
    ],
    [
      "benefits",
      "1. История человека читается со стены, а не только из выпуска в руках. 2. Два размера: компактный 30 × 40 см и более выразительный A3. 3. Два типа макета: газетная передовица или полностью свой лист. 4. Можно заказать печать или только файл для архива и самостоятельной печати.",
      SOURCE,
    ],
    [
      "cost_from_sheet",
      "Цена печатного и электронного ретро-постера — UNKNOWN. Размеры в брифе: 30 × 40 см и A3 (29,7 × 42 см). Рамка не входит автоматически. Не копировать цены соседних продуктов.",
      SOURCE,
    ],
    [
      "what_we_sell",
      "Не «мы печатаем картинку». Продаваемый сценарий: персональная история человека на одном листе для стены. В основе — фото именинника, персональная статья, поздравление, факты и события жизни. Не поздравительная газета и не постер из оригинальной журнальной страницы.",
      SOURCE,
    ],
    [
      "when_to_offer",
      "Когда клиенту нужен подарок, который вешают, а не листают. Юбилей, день рождения. Когда газета «для рук» уже не нужна, а нужен один сильный лист. Когда клиент хочет печатный постер или файл.",
      SOURCE,
    ],
    [
      "pitch_one_paragraph",
      "Это альтернатива традиционной газете: история человека на одной странице, которую можно повесить на стену. В постер входят фото именинника, персональная статья, поздравление, факты и события жизни. Есть два размера: 30 × 40 см и A3. Макет может быть как передовица исторической газеты или полностью индивидуальный. Можно заказать печатный постер или электронный файл. Рамку в стоимость автоматически не включаем. Цену называть только после утверждённого прайса.",
      SOURCE,
    ],
    [
      "pitch_short",
      "Ваша история — на одной странице. Персональный постер про именинника: фото, статья, поздравление, факты жизни. 30 × 40 см или A3. Печать или файл. Цена — UNKNOWN.",
      SOURCE,
    ],
    [
      "role_in_line",
      "Один продукт с двумя размерами и двумя способами выдачи: печатный постер и электронный файл. Это не два самостоятельных продукта.",
      SOURCE,
    ],
    [
      "compare_with",
      "Не поздравительная газета: там выпуск, который листают. Не постер из оригинальной журнальной страницы: там подлинный архивный лист, а не персональный макет. Их цены, сроки, состав и рамка сюда не переносятся.",
      SOURCE,
    ],
    [
      "do_not_promise",
      "Не обещать конкретную цену, срок, бумагу, доставку. Не обещать, что рамка входит в заказ: на фото она показывает размещение на стене. Не копировать цену газеты или постера из журнальной страницы.",
      SOURCE,
    ],
    ["sources", SOURCE, "create-retro-poster-passport"],
    ["synced_at", syncedAt, "script"],
  ]);
}

function economyRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product_id", PRODUCT_ID, "passport-registry", ""],
    ["bitrix_name", BITRIX_NAME, "passport", "Bitrix enum ID — UNKNOWN"],
    ["definition", "Персональная история на одной странице для стены. Печатный постер или электронный файл. Цена — UNKNOWN.", SOURCE, ""],
    ["retail_price", "по запросу", SOURCE, "прайс не утверждён"],
    ["currency", "EUR", SOURCE, ""],
    ["cost_price", "", SOURCE, "COGS не зафиксирован"],
    ["cogs_total", "", SOURCE, ""],
    ["cogs_retail_model", "", SOURCE, ""],
    ["cogs_margin_pct", "", SOURCE, ""],
    ["cogs_line_1", "Печатный ретро-постер 30 × 40 см. Цена UNKNOWN", SOURCE, ""],
    ["cogs_line_2", "Печатный ретро-постер A3 (29,7 × 42 см). Цена UNKNOWN", SOURCE, ""],
    ["cogs_line_3", "Электронный ретро-постер: файл высокого качества. Цена UNKNOWN", SOURCE, ""],
    [
      "value_vs_price",
      "Не сравнивать с поздравительной газетой и с постером из оригинальной журнальной страницы. Конкретную сумму не придумывать.",
      SOURCE,
      "Для ОП",
    ],
    ["rule", "Не копировать цены соседних продуктов. Не называть цену, пока прайс не утверждён. Рамку в цену автоматически не включать.", SOURCE, ""],
    ["synced_at", syncedAt, "script", "UTC"],
  ]);
}

function productionRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product", BITRIX_NAME, SOURCE, "Макет → печать или файл. Рамка не обещана."],
    [
      "process_start",
      "Уточнить: персональный постер на стену, не поздравительная газета и не постер из оригинальной журнальной страницы.",
      SOURCE,
      "",
    ],
    [
      "step_1",
      "Выбрать размер: 30 × 40 см или A3 (29,7 × 42 см).",
      SOURCE,
      "",
    ],
    [
      "step_2",
      "Выбрать тип макета: передовица исторической газеты или полностью индивидуальный лист. Собрать фото, факты, поздравление.",
      SOURCE,
      "",
    ],
    [
      "step_3",
      "Выдать печатный постер высокого качества или электронный файл. Рамку в состав автоматически не включать.",
      SOURCE,
      "",
    ],
    [
      "status_note",
      "UNKNOWN: цена, срок, бумага, метод печати, доставка, входит ли рамка, число правок. Условия других продуктов не применять автоматически.",
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
      "Утверждённые примеры: «Семейная правда» (передовица исторической газеты) и «Газета жизни» (индивидуальный макет). Рамка на фото — пример размещения, не обещанный состав.",
      SOURCE,
    ],
    ["cover_url", "/training/retro-poster/gazeta-zhizni.jpg", SOURCE],
    ["synced_at", syncedAt, "script"],
  ]);
}

function miniPassportRows() {
  const today = new Date().toISOString().slice(0, 10);
  return [
    ["Подарок: Ретро-постер"],
    ["Обновлено", today],
    ["Категория", "Оформление стены"],
    ["Название для ОП", "Ретро-постер"],
    ["Название типа в Bitrix", BITRIX_NAME],
    ["PRODUCT_ID", PRODUCT_ID],
    ["Статус", "active"],
    [
      "Что это",
      "Персональная история на одной странице для стены. Идея как у поздравительной газеты, но это не выпуск, который листают. Не постер из оригинальной журнальной страницы. Цена — по запросу.",
    ],
    ["Цена витрина", "по запросу"],
    ["Валовая маржа", "TBD"],
    ["Маржинальность", "TBD"],
    ["Себестоимость COGS €", "TBD"],
    ["Срок готовности", "не обещать — срок в брифе не зафиксирован"],
    [
      "Что входит в цену",
      "Печатный постер 30 × 40 см или A3, либо электронный файл. Рамка на фото — пример размещения, в состав автоматически не входит. Бумага, доставка — UNKNOWN.",
    ],
    [],
    ["Полный паспорт", `https://docs.google.com/spreadsheets/d/${BITRIX_GIFT_TYPES_SHEET_ID}/edit`],
    ["Drive визуал (корень)", ""],
    ["Мастер COGS", "https://docs.google.com/spreadsheets/d/1qyINXMJVZoJiidEYXyoeRvjUIF9p8Te0sSkYlAKWdAU/edit"],
  ];
}

async function main() {
  const sa = readGoogleServiceAccount();
  if (!sa) throw new Error("Service account not configured");

  const spreadsheetId = process.env.RETRO_POSTER_PASSPORT_SHEET_ID?.trim() || BITRIX_GIFT_TYPES_SHEET_ID;
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  await ensureTabs(token, spreadsheetId);

  const tabs: Array<[string, Array<Array<string | number>>]> = [
    ["17_Смыслы", meaningsRows()],
    ["17_Экономика", economyRows()],
    ["17_Производство", productionRows()],
    ["17_Визуал", visualRows()],
    [MINI_TAB, miniPassportRows()],
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
