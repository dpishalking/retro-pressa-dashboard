/**
 * Fill passport tabs for «Первое письмо» inside
 * «Паспорта Retro Pressa» (16_Смыслы / 16_Экономика / 16_Производство / 16_Визуал).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/product-hub/create-pervoe-pismo-passport.ts
 */

import {
  getGoogleAccessToken,
  readGoogleServiceAccount,
  writeSheetValues,
} from "../../src/lib/google/sheets-client";
import { BITRIX_GIFT_TYPES_SHEET_ID } from "./bitrix-aligned-catalog";
import { passportKvRows } from "./passport-field-labels";

const PRODUCT_ID = "PRODUCT_PERVOE_PISMO";
const BITRIX_NAME = "Первое письмо";
const SOURCE = "утверждённый бриф GPT-чата / первое письмо";
const TABS = ["16_Смыслы", "16_Экономика", "16_Производство", "16_Визуал"] as const;
const MINI_TAB = "16_Первое_письмо";

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
    ["short_name", "Первое письмо", SOURCE],
    [
      "mapping_note",
      "Bitrix ID / точное CRM-название — UNKNOWN. id pervoe-pismo — slug карточки, не ID в CRM. Алиасы: «Открытка младенца»; «персональный анонс о рождении малыша»; baby announcement / birth announcement — описание категории, не отдельный продукт. Не путать с поздравительной газетой, оригиналом газеты дня рождения, персональным журналом, «Книгой жизни», семейным изданием и семейной колодой карт.",
      SOURCE,
    ],
    [
      "what_it_is",
      "«Первое письмо» — сервис автоматической печати и почтовой рассылки персональных открыток о рождении малыша для близких и родных. Концепция строится вокруг физического письма, которое приходит получателю по почте. Основная версия текста написана от первого лица — как будто новорождённый сам сообщает родственнику о своём появлении. На лицевой стороне предусмотрено первое фото малыша, элегантный дизайн или авторская иллюстрация. На обороте могут располагаться персональный текст, имя ребёнка, дата и время рождения, рост и вес. QR-код в концепции может вести на закрытый видеоальбом, запись первого звука или wishlist; точный технический формат, ограничения, срок ссылки и вхождение во все пакеты — UNKNOWN.",
      SOURCE,
    ],
    [
      "for_whom",
      "Родители новорождённого, которым нужно сообщить близким и родным о рождении малыша. В документе прямо названы бабушки, дедушки, крестные и близкие друзья. Покупатель — родитель или будущий родитель. Особенно понятно будущим родителям, которые хотят подготовить всё заранее, и семьям, у которых родственники в другом городе или стране.",
      SOURCE,
    ],
    [
      "key_idea",
      "«Первое письмо» — сервис, который позволяет родителям заранее подготовить красивое объявление о рождении ребёнка, а после родов добавить фото и данные малыша, после чего персональные физические письма могут быть напечатаны и отправлены близким без необходимости родителям самостоятельно заниматься макетами, конвертами и почтой.",
      SOURCE,
    ],
    [
      "how_it_works",
      "1. До родов родители выбирают дизайн открытки и загружают список адресов получателей. 2. После рождения со смартфона добавляют первое фото ребёнка и фактические данные: дату, время, имя, рост и вес. 3. Digital / DIY — цифровой макет для самостоятельной печати или цифровой отправки. Print Pack — напечатанные открытки и конверты доставляются родителям, подписание и вручение остаются за ними. Full Service / All-inclusive — печать, персональный текст для каждого адресата, сборка, марки и почтовая рассылка сервисом.",
      SOURCE,
    ],
    [
      "benefits",
      "1. Существенную часть работы можно подготовить до родов. 2. После рождения добавляются только фото и фактические данные. 3. Full Service снимает печать, персонализацию, сборку, марки и отправку. 4. Письмо может быть обращено к конкретному человеку. 5. Физический конверт имеет отдельный смысл для родственников на расстоянии. 6. Можно выбрать степень самостоятельности: Digital / DIY, Print Pack или Full Service.",
      SOURCE,
    ],
    [
      "cost_from_sheet",
      "Цены Digital / DIY, Print Pack и Full Service — UNKNOWN. Количество открыток в базовой цене, доп. адресат, правки, QR, видеоальбом, доставка и сроки — UNKNOWN. Не копировать цены соседних продуктов.",
      SOURCE,
    ],
    [
      "what_we_sell",
      "Не «мы делаем открытки». Физическая открытка — носитель. Продаваемый сценарий: родители красиво сообщают семейную новость нескольким близким и снимают с себя организацию печати и отправки в первые дни после рождения. Не поздравительная газета, не газета за день рождения ребёнка, не фотокнига, не «Книга жизни», не обычная картинка для мессенджера и не просто печать стандартных открыток. Газета дня рождения — возможный up-sell, не часть базового состава.",
      SOURCE,
    ],
    [
      "when_to_offer",
      "Когда будущие родители хотят подготовить объявление заранее; когда родственники далеко; когда клиент ценит физические семейные вещи; когда хочет делегировать печать и почту. Продавать до события, а не только после него.",
      SOURCE,
    ],
    [
      "pitch_one_paragraph",
      "Это не просто открытка с фотографией. Ещё до рождения можно подготовить дизайн и список близких. Когда малыш родится, добавляете реальные данные и первое фото. Дальше формат зависит от пакета: только макет, напечатанный комплект домой или печать, сборка и отправка адресатам. Цену называть только после утверждённого прайса.",
      SOURCE,
    ],
    [
      "pitch_short",
      "Вы готовите дизайн и адресатов заранее. После рождения добавляете фото и данные малыша. Full Service печатает, персонализирует, собирает и отправляет письма близким. Цена — UNKNOWN.",
      SOURCE,
    ],
    [
      "role_in_line",
      "Один продукт с тремя пакетами исполнения: Digital / DIY, Print Pack и Full Service / All-inclusive. Это не три самостоятельных продукта.",
      SOURCE,
    ],
    [
      "compare_with",
      "Не персональная поздравительная газета. Не оригинал газеты дня рождения. Не персональный журнал. Не «Книга жизни». Не семейное издание. Не семейная колода карт. Их цены, сроки, состав и условия сюда не переносятся.",
      SOURCE,
    ],
    [
      "do_not_promise",
      "Не обещать конкретную цену, срок печати и доставки, доставку в любую страну, QR, видеоальбом, wishlist, хлопковую бумагу, золотое тиснение, сургуч, газетную полосу или набор для бабушки и дедушки как базовый состав. Не обещать доставку к конкретной дате без подтверждённой услуги. Не обещать регламент хранения фото, число дизайнов, правок, экземпляров или получателей. Не переносить сроки и тарифы доставки других продуктов Retro Pressa.",
      SOURCE,
    ],
    ["sources", SOURCE, "create-pervoe-pismo-passport"],
    ["synced_at", syncedAt, "script"],
  ]);
}

function economyRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product_id", PRODUCT_ID, "passport-registry", ""],
    ["bitrix_name", BITRIX_NAME, "passport", "Bitrix enum ID — UNKNOWN"],
    ["definition", "Персональный анонс о рождении малыша. Пакеты Digital / DIY, Print Pack, Full Service. Цены — UNKNOWN.", SOURCE, ""],
    ["retail_price", "по запросу", SOURCE, "прайс пакетов не утверждён"],
    ["currency", "EUR", SOURCE, ""],
    ["cost_price", "", SOURCE, "COGS не зафиксирован"],
    ["cogs_total", "", SOURCE, ""],
    ["cogs_retail_model", "", SOURCE, ""],
    ["cogs_margin_pct", "", SOURCE, ""],
    ["cogs_line_1", "Digital / DIY: цифровой макет. Цена UNKNOWN", SOURCE, ""],
    ["cogs_line_2", "Print Pack: печатные открытки и конверты родителям. Цена UNKNOWN", SOURCE, ""],
    ["cogs_line_3", "Full Service: печать, персональный текст, сборка, марки, рассылка. Цена UNKNOWN", SOURCE, ""],
    [
      "value_vs_price",
      "Не сравнивать с обычной открыткой. Во Full Service ценность — персонализация, подготовка, печать, конверты, марки, сборка и отправка. Конкретную сумму не придумывать.",
      SOURCE,
      "Для ОП",
    ],
    ["rule", "Не копировать цены соседних продуктов. Не называть цену пакета, пока прайс не утверждён.", SOURCE, ""],
    ["synced_at", syncedAt, "script", "UTC"],
  ]);
}

function productionRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product", BITRIX_NAME, SOURCE, "До родов: дизайн и адреса. После: фото и данные. Затем пакет."],
    [
      "process_start",
      "Уточнить: персональный анонс о рождении, не поздравительная газета и не газета из даты рождения ребёнка.",
      SOURCE,
      "",
    ],
    [
      "step_1",
      "До родов: выбрать дизайн и подготовить список адресов получателей.",
      SOURCE,
      "",
    ],
    [
      "step_2",
      "После рождения: добавить первое фото и фактические данные малыша (дата, время, имя, рост, вес).",
      SOURCE,
      "",
    ],
    [
      "step_3",
      "По пакету: Digital / DIY — макет; Print Pack — печать и доставка комплекта родителям; Full Service — печать, персональные тексты, сборка, марки и отправка адресатам.",
      SOURCE,
      "",
    ],
    [
      "status_note",
      "UNKNOWN: формат и размер открытки, бумага, метод печати, страны, почтовый оператор, стоимость и сроки доставки, трекинг, число экземпляров, правки, QR, хранение фото, SLA. Условия других продуктов не применять автоматически. Премиум (хлопок, фольга, сургуч) не обещать как базу.",
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
      "Утверждённые фотографии продукта для менеджеров — UNKNOWN. На карточке — типографический макет без выдуманных фото младенца.",
      SOURCE,
    ],
    ["cover_url", "/training/pervoe-pismo/cover.jpg", SOURCE],
    ["synced_at", syncedAt, "script"],
  ]);
}

function miniPassportRows() {
  const today = new Date().toISOString().slice(0, 10);
  return [
    ["Подарок: Первое письмо"],
    ["Обновлено", today],
    ["Категория", "Рождение ребёнка"],
    ["Название для ОП", "Первое письмо"],
    ["Название типа в Bitrix", BITRIX_NAME],
    ["PRODUCT_ID", PRODUCT_ID],
    ["Статус", "active"],
    [
      "Что это",
      "Персональный анонс о рождении малыша: Digital / DIY, Print Pack или Full Service. Не поздравительная газета и не газета из даты. Цена — по запросу.",
    ],
    ["Цена витрина", "по запросу"],
    ["Валовая маржа", "TBD"],
    ["Маржинальность", "TBD"],
    ["Себестоимость COGS €", "TBD"],
    ["Срок готовности", "не обещать — срок в брифе не зафиксирован"],
    [
      "Что входит в цену",
      "Зависит от пакета. Digital — макет. Print Pack — печатные открытки и конверты родителям. Full Service — печать, персональный текст, сборка, марки, рассылка. Точный состав и тираж — UNKNOWN.",
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

  const spreadsheetId = process.env.PERVOE_PISMO_PASSPORT_SHEET_ID?.trim() || BITRIX_GIFT_TYPES_SHEET_ID;
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  await ensureTabs(token, spreadsheetId);

  const tabs: Array<[string, Array<Array<string | number>>]> = [
    ["16_Смыслы", meaningsRows()],
    ["16_Экономика", economyRows()],
    ["16_Производство", productionRows()],
    ["16_Визуал", visualRows()],
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
