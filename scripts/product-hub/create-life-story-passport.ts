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

const LIFE_BOOK_PASSPORT_ID = "1q2WKgcCCVeomg7KhFWEr68re4ReE3xuak4LusmXyPSU";
const LIFE_BOOK_PASSPORT_TITLE = 'Паспорт продукта "Книга жизни в заголовках газет"';
const PRODUCT_ID = "PRODUCT_LIFE_STORY";
const BITRIX_NAME = "Книга жизни";
const SOURCE = "Product Hub / CRM framing · отделение от книги в заголовках газет";
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
    [
      "what_it_is",
      "Книга о человеке по интервью. Интервьюер берёт интервью у героя или у близких, затем из этого материала делается книга. Это не газета по годам жизни.",
      SOURCE,
    ],
    [
      "for_whom",
      "Семья, дети, внуки, юбиляр, человек, чью историю важно записать, пока её рассказывают.",
      SOURCE,
    ],
    [
      "client_pain",
      "Истории живут только в разговорах и могут исчезнуть. Клиент хочет книгу о конкретном человеке, а не архив газет и не семейный журнал про всех сразу.",
      SOURCE,
    ],
    [
      "key_idea",
      "Сохранить голос и жизнь человека его словами: интервью → книга. Не архивные заголовки и не глянец «под журнал».",
      SOURCE,
    ],
    [
      "why_now",
      "Пока человек может рассказывать. Юбилей, семейный повод, когда важно записать историю, а не купить газеты той эпохи.",
      SOURCE,
    ],
    [
      "how_it_works",
      "Интервьюер берёт интервью. Из разговора собирается текст и делается книга о человеке. Печать и объём — по брифу, без обещания газет по годам.",
      SOURCE,
    ],
    [
      "benefits",
      "1. Человек узнаёт себя в тексте. 2. Семья получает голос, а не только факты эпохи. 3. Книгу потом перечитывают. 4. Это «мою жизнь записали», а не «мне подарили старые газеты».",
      SOURCE,
    ],
    ["cost_from_sheet", "по запросу", SOURCE],
    [
      "what_we_sell",
      "Книга жизни — книга о человеке. Интервьюер записывает историю, из интервью делается книга. Для отдела продаж важно не путать с «Книгой жизни в заголовках газет»: там внутри газеты за каждый год жизни.",
      SOURCE,
    ],
    [
      "emotional_result",
      "Получатель и семья слышат живой рассказ. Книга хранит голос человека, а не хронику газетных заголовков.",
      SOURCE,
    ],
    [
      "when_to_offer",
      "Когда клиент говорит: «хотим записать его историю», «нужна книга о папе/маме», «чтобы остался его голос», «не газеты, а про него».",
      SOURCE,
    ],
    [
      "pitch_one_paragraph",
      "Мы берём интервью и собираем книгу о человеке — его жизнь его словами. Это не архивные заголовки и не журнал, который пишется «под глянец» без разговора с героем.",
      SOURCE,
    ],
    [
      "pitch_short",
      "Книга жизни = интервью → книга о человеке. Книга жизни в заголовках газет = газеты по годам жизни.",
      SOURCE,
    ],
    [
      "client_questions",
      "1. Чью жизнь записываем? 2. Кто будет на интервью — сам герой или близкие? 3. Что важнее: его рассказ или газеты той эпохи? 4. Для кого книга после печати?",
      SOURCE,
    ],
    [
      "role_in_line",
      "Отдельный продукт о человеке. Рядом, но не вместо: книга в заголовках газет (архив по годам), семейное издание (история семьи), глянцевый журнал о человеке.",
      SOURCE,
    ],
    [
      "compare_with",
      "Книга жизни = книга о человеке по интервью. Не «Книга жизни в заголовках газет» (газеты год за годом). Не семейное издание (история семьи). Не глянцевый журнал о человеке.",
      SOURCE,
    ],
    [
      "do_not_promise",
      "Не обещать газеты по годам жизни и не продавать этот продукт как архивную книгу в заголовках. Цену и срок не выдумывать — индивидуально.",
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
    ["definition", "Книга о человеке по интервью. Цену и COGS не выдумывать.", SOURCE, ""],
    ["retail_price", "по запросу", SOURCE, "Нет утверждённой витрины"],
    ["currency", "EUR", SOURCE, ""],
    ["cost_price", "", SOURCE, "COGS не утверждён"],
    ["cogs_total", "", SOURCE, ""],
    ["cogs_retail_model", "", SOURCE, ""],
    ["cogs_margin_pct", "", SOURCE, ""],
    [
      "value_vs_price",
      "Продаём запись жизни человека, не архив газет. Цену согласовывать с РОП, не подставлять цену книги в заголовках.",
      SOURCE,
      "Для ОП",
    ],
    ["rule", "Не копировать retail/COGS из «Книги жизни в заголовках газет».", SOURCE, ""],
    ["synced_at", syncedAt, "script", "UTC"],
  ]);
}

function productionRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product", BITRIX_NAME, SOURCE, "Интервью → книга"],
    [
      "process_start",
      "Уточнить, что клиент хочет книгу о человеке по интервью, а не газеты по годам жизни.",
      SOURCE,
      "",
    ],
    ["step_1", "Кто герой и кто будет на интервью — сам человек или близкие.", SOURCE, ""],
    ["step_2", "Интервьюер проводит интервью и фиксирует рассказ.", SOURCE, ""],
    ["step_3", "Из интервью собирается текст и делается книга.", SOURCE, ""],
    ["step_4", "Согласование макета / объёма с клиентом. Печать — по брифу.", SOURCE, ""],
    [
      "status_note",
      "Срок и состав работ индивидуальны. Не обещать SLA книги в заголовках газет.",
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
      "Собственного визуала пока нет: временно можно показывать обложку книги в заголовках, но в разговоре с клиентом нельзя смешивать продукты.",
      SOURCE,
    ],
    ["synced_at", syncedAt, "script"],
  ]);
}

async function main() {
  const sa = readGoogleServiceAccount();
  if (!sa) throw new Error("Service account not configured");

  const spreadsheetId = process.env.LIFE_STORY_PASSPORT_SHEET_ID?.trim() || BITRIX_GIFT_TYPES_SHEET_ID;
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive");

  try {
    await googleApi(token, `https://www.googleapis.com/drive/v3/files/${LIFE_BOOK_PASSPORT_ID}?supportsAllDrives=true`, {
      method: "PATCH",
      body: JSON.stringify({ name: LIFE_BOOK_PASSPORT_TITLE }),
    });
    console.log(`Renamed headlines passport: ${LIFE_BOOK_PASSPORT_TITLE}`);
  } catch (e) {
    console.warn(`Headlines rename skipped: ${e instanceof Error ? e.message : e}`);
  }

  await ensureTabs(token, spreadsheetId);

  const tabs: Array<[string, Array<Array<string | number>>]> = [
    ["13_Смыслы", meaningsRows()],
    ["13_Экономика", economyRows()],
    ["13_Производство", productionRows()],
    ["13_Визуал", visualRows()],
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
