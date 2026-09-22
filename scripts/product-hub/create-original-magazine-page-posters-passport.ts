/**
 * Fill passport tabs for magazine-page posters inside
 * «Паспорта Retro Pressa» (15_Смыслы / 15_Экономика / 15_Производство / 15_Визуал).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/product-hub/create-original-magazine-page-posters-passport.ts
 */

import {
  getGoogleAccessToken,
  readGoogleServiceAccount,
  writeSheetValues,
} from "../../src/lib/google/sheets-client";
import { BITRIX_GIFT_TYPES_SHEET_ID } from "./bitrix-aligned-catalog";
import { passportKvRows } from "./passport-field-labels";

const PRODUCT_ID = "PRODUCT_ORIGINAL_MAGAZINE_PAGE_POSTERS";
const BITRIX_NAME = "Постер из оригинальной журнальной страницы";
const SOURCE = "утверждённый бриф GPT-чата / постеры из оригинальных журнальных страниц";
const TABS = ["15_Смыслы", "15_Экономика", "15_Производство", "15_Визуал"] as const;
const MINI_TAB = "15_Постеры";

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
    ["short_name", "Постер из оригинальной журнальной страницы", SOURCE],
    [
      "mapping_note",
      "Bitrix ID / точное CRM-название — UNKNOWN. id original-magazine-page-posters — slug карточки, не ID в CRM. Не путать с оригинальным журналом целиком, оригинальной газетой, поздравительной газетой, персональным журналом и современным репринтом обложки.",
      SOURCE,
    ],
    [
      "what_it_is",
      "Постер создаётся из подлинного листа старого журнала. Лист всегда оригинальный. На примерах — рекламные страницы, иллюстрации и обложки. Оформлен в паспарту и рамку. Если перед менеджером обложка — «оригинальная обложка», если внутренняя страница — «оригинальная страница». Не журнал целиком, не напечатанная копия, не персональный журнал и не картина по заказу.",
      SOURCE,
    ],
    [
      "for_whom",
      "Украшение дома; люди из маркетинга и креативных студий; те, кто хочет удивить гостей необычной картиной. Можно как подарок, если сюжет связан с профессией, интересами или важным временем получателя. Не обещать страницу любой даты или темы до проверки наличия.",
      SOURCE,
    ],
    [
      "key_idea",
      "Настоящую страницу журнала своего времени оформляют в паспарту и рамку, чтобы повесить дома, в студии или подарить человеку, которому близок её сюжет.",
      SOURCE,
    ],
    [
      "how_it_works",
      "Используется оригинальный журнальный лист; он оформляется в паспарту и рамку. Рабочий порядок продажи: где будет висеть / кому подарят; интересный сюжет; доступные экземпляры; фото именно предлагаемых листов и состояние; цена выбранного варианта; оформление и доставка после проверки. Это инструкция продаж, не утверждение технологии. UNKNOWN: кто и как извлекает лист, как крепится, какие операции обязательны до отправки.",
      SOURCE,
    ],
    [
      "benefits",
      "1. Лист подлинный, не новая печать. 2. Готовая комплектация: лист, паспарту и рамка входят в цену от 20 €. 3. Можно подобрать сюжет под стену, студию или человека. 4. Продаётся конкретный доступный экземпляр.",
      SOURCE,
    ],
    [
      "cost_from_sheet",
      "Один постер — от 20 € (не фиксированные 20 € за любой лист). Входят оригинальный журнальный лист, паспарту и рамка. UNKNOWN: какие листы стоят 20 €; цена каждого другого листа; доплата за цвет/нестандарт; входит ли подбор по запросу; входит ли доставка.",
      SOURCE,
    ],
    [
      "what_we_sell",
      "Конкретный оригинальный лист в паспарту и рамке. Не весь журнал, не репринт, не персональный журнал.",
      SOURCE,
    ],
    [
      "when_to_offer",
      "Когда нужна вещь на стену; оформление студии; необычная картина для гостей; подарок со связью сюжета с человеком. Сначала место или человек, потом доступные листы.",
      SOURCE,
    ],
    [
      "pitch_one_paragraph",
      "Это готовый постер с оригинальной страницей в паспарту и рамке, от 20 €. Лист всегда оригинальный: изображение не печатается заново. Покажу доступные сюжеты, состояние конкретного листа и цену выбранного экземпляра.",
      SOURCE,
    ],
    [
      "pitch_short",
      "Это настоящий лист старого журнала — не новая печать старой картинки. Мы оформляем его в паспарту и рамку. Готовый постер стоит от 20 €.",
      SOURCE,
    ],
    [
      "role_in_line",
      "Один продукт. Внутри него могут быть страницы и обложки разных изданий; конкретный лист обозначать точно. Не оригинал журнала целиком и не репродукция.",
      SOURCE,
    ],
    [
      "compare_with",
      "Не оригинальный журнал целиком. Не оригинальная газета. Не поздравительная газета. Не персональный журнал. Не современный репринт старой обложки.",
      SOURCE,
    ],
    [
      "do_not_promise",
      "Не называть лист единственным в мире. Не обещать точную дату, автора, редкость или коллекционную стоимость без проверки листа. Не обещать идеальное состояние, любой цвет паспарту, защиту от UV, музейное оформление, сохранность на десятилетия, получение к дате без подтверждения. Не говорить, что за 20 € доступна любая страница с фото. Не применять условия доставки газет и журналов автоматически.",
      SOURCE,
    ],
    ["sources", SOURCE, "create-original-magazine-page-posters-passport"],
    ["synced_at", syncedAt, "script"],
  ]);
}

function economyRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product_id", PRODUCT_ID, "passport-registry", ""],
    ["bitrix_name", BITRIX_NAME, "passport", "Bitrix enum ID — UNKNOWN"],
    ["definition", "Постер из оригинального журнального листа в паспарту и рамке. Цена витрины — от 20 €.", SOURCE, ""],
    ["retail_price", "от 20", SOURCE, "не фиксированные 20 € за любой лист"],
    ["currency", "EUR", SOURCE, ""],
    ["cost_price", "", SOURCE, "COGS не зафиксирован"],
    ["cogs_total", "", SOURCE, ""],
    ["cogs_retail_model", "", SOURCE, ""],
    ["cogs_margin_pct", "", SOURCE, ""],
    ["cogs_line_1", "База от 20 €: оригинальный журнальный лист, паспарту, рамка", SOURCE, ""],
    ["cogs_line_2", "Цена конкретного листа — UNKNOWN, показывать только после проверки", SOURCE, ""],
    ["cogs_line_3", "Доставка — UNKNOWN, не входит автоматически", SOURCE, ""],
    [
      "value_vs_price",
      "Не сравнивать с распечаткой картинки. От 20 € — подлинный лист плюс готовое оформление. Не обещать, что любой показанный на фото лист стоит 20 €.",
      SOURCE,
      "Для ОП",
    ],
    ["rule", "Всегда «от 20 €». Не копировать цены оригинала журнала, газеты или репродукции.", SOURCE, ""],
    ["synced_at", syncedAt, "script", "UTC"],
  ]);
}

function productionRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product", BITRIX_NAME, SOURCE, "Оригинальный лист → паспарту → рамка"],
    [
      "process_start",
      "Уточнить: постер из конкретного оригинального листа, не журнал целиком и не репринт.",
      SOURCE,
      "",
    ],
    [
      "step_1",
      "Выяснить, где будет висеть или кому подарят; интересный сюжет; проверить доступные экземпляры.",
      SOURCE,
      "",
    ],
    [
      "step_2",
      "Показать фото предлагаемых листов и состояние. Назвать цену выбранного варианта. Если обложка — называть обложкой, если страница — страницей.",
      SOURCE,
      "",
    ],
    [
      "step_3",
      "Согласовать оформление и доставку после проверки условий. Современная печать изображения не требуется.",
      SOURCE,
      "",
    ],
    [
      "status_note",
      "UNKNOWN: извлечение листа, крепление, обязательные операции до отправки, материал и размеры рамки, стекло, размеры постера, сроки, упаковка, доставка. Условия газет/журналов не применять автоматически.",
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
      "Временная обложка — визуальный концепт постера в паспарту и рамке. Утверждённые фото конкретных доступных позиций и их цены — UNKNOWN. Примеры в брифе (реклама хлопьев, Atpūta, Огонёк и др.) не подтверждают наличие и цену 20 €.",
      SOURCE,
    ],
    ["cover_url", "/training/original-magazine-page-posters/cover.jpg", SOURCE],
    ["synced_at", syncedAt, "script"],
  ]);
}

function miniPassportRows() {
  const today = new Date().toISOString().slice(0, 10);
  return [
    ["Подарок: Постер из оригинальной журнальной страницы"],
    ["Обновлено", today],
    ["Категория", "Оформление стены"],
    ["Название для ОП", "Постер из оригинальной журнальной страницы"],
    ["Название типа в Bitrix", BITRIX_NAME],
    ["PRODUCT_ID", PRODUCT_ID],
    ["Статус", "active"],
    [
      "Что это",
      "Подлинный журнальный лист в паспарту и рамке. Не журнал целиком и не репринт. Цена от 20 €.",
    ],
    ["Цена витрина", "от 20 €"],
    ["Валовая маржа", "TBD"],
    ["Маржинальность", "TBD"],
    ["Себестоимость COGS €", "TBD"],
    ["Срок готовности", "не обещать — срок в брифе не зафиксирован"],
    [
      "Что входит в цену",
      "оригинальный журнальный лист, паспарту, рамка. Доставка и точная цена каждого листа — UNKNOWN.",
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

  const spreadsheetId =
    process.env.ORIGINAL_MAGAZINE_PAGE_POSTERS_PASSPORT_SHEET_ID?.trim() || BITRIX_GIFT_TYPES_SHEET_ID;
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  await ensureTabs(token, spreadsheetId);

  const tabs: Array<[string, Array<Array<string | number>>]> = [
    ["15_Смыслы", meaningsRows()],
    ["15_Экономика", economyRows()],
    ["15_Производство", productionRows()],
    ["15_Визуал", visualRows()],
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
