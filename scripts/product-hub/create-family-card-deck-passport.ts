/**
 * Fill passport tabs for «Семейная колода карт» inside
 * «Паспорта Retro Pressa» (14_Смыслы / 14_Экономика / 14_Производство / 14_Визуал).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/product-hub/create-family-card-deck-passport.ts
 */

import {
  getGoogleAccessToken,
  readGoogleServiceAccount,
  writeSheetValues,
} from "../../src/lib/google/sheets-client";
import { BITRIX_GIFT_TYPES_SHEET_ID } from "./bitrix-aligned-catalog";
import { passportKvRows } from "./passport-field-labels";

const PRODUCT_ID = "PRODUCT_FAMILY_CARD_DECK";
const BITRIX_NAME = "Семейная колода карт";
const SOURCE = "утверждённый бриф GPT-чата / семейная колода карт";
const TABS = ["14_Смыслы", "14_Экономика", "14_Производство", "14_Визуал"] as const;

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
  const missing = [...TABS, "14_Семейная_колода"].filter((t) => !existing.has(t));
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
    ["short_name", "Семейная колода карт", SOURCE],
    [
      "mapping_note",
      "Bitrix ID / точное CRM-название — UNKNOWN. В системе продукт называется «Семейная колода карт». Не путать с семейным изданием.",
      SOURCE,
    ],
    [
      "what_it_is",
      "Семейная колода карт — персональный продукт Retro Pressa из 54 карт, посвящённых истории конкретной семьи. На картах могут быть не только родственники: человек, питомец, событие, поездка, место, дом, семейная фраза, внутренний мем, традиция, значимая вещь, семейный символ, воспоминание. Клиенту не нужно самостоятельно придумывать содержание всех 54 карт: сначала работает профессиональный интервьюер.",
      SOURCE,
    ],
    [
      "for_whom",
      "Клиент, который хочет сохранить не только историю одного человека, а историю всей семьи. Подарок всей семье, родителям, бабушкам и дедушкам, супругам, большой семье, семье в разных странах; юбилей, годовщина, Новый год, семейная встреча, день рождения или реликвия без повода.",
      SOURCE,
    ],
    [
      "key_idea",
      "Семейная история, собранная через интервью и превращённая в 54 карты о людях, событиях, питомцах, местах, традициях, фразах и других вещах, которые делают конкретную семью именно этой семьёй.",
      SOURCE,
    ],
    [
      "how_it_works",
      "1. Интервью с профессиональным интервьюером Retro Pressa (тот же тип специалиста, что и для «Книги жизни»). Одно интервью входит в стоимость, обычно от 1 часа, записывается на аудио. 2. История семьи разбивается на сюжеты. 3. Клиент получает доступ в Профиту и к каждому сюжету добавляет фотографии и финальную подпись (финальные подписи пишет клиент; утверждённый тип загрузки — изображения). 4. Редактор собирает целостную структуру колоды. 5. Масти, номиналы и рубашка персонализируются и согласуются с клиентом. 6. Дизайн, согласование, до 3 раундов правок. 7. Печать одной колоды из 54 карт классического формата игральных карт.",
      SOURCE,
    ],
    [
      "benefits",
      "1. Не нужно придумывать 54 карты самостоятельно. 2. В от 100 € входят интервью, интервьюер, редактор, дизайн, печать и 1 экземпляр. 3. Карты могут быть не только про людей. 4. Один герой может появляться на нескольких картах. 5. Дополнительное интервью 40 €, дополнительная колода 50 €. 6. Доставка по всему миру считается отдельно.",
      SOURCE,
    ],
    [
      "cost_from_sheet",
      "Семейная колода карт — от 100 € (не фиксированные 100 €). Входят: 1 интервью, интервьюер, редактор, дизайн, печать, 1 колода из 54 карт, согласование, до 3 раундов правок. Доп. интервью +40 €. Доп. колода +50 €. Доставка отдельно. Подарочный футляр — UNKNOWN.",
      SOURCE,
    ],
    [
      "what_we_sell",
      "Не обычную фотоколоду и не автоматический конструктор. Семейная история через интервью, разобранная на 54 самостоятельные карты. Не «Книга жизни», не семейное издание, не фотокнига.",
      SOURCE,
    ],
    [
      "when_to_offer",
      "Когда человек говорит: хочу подарок всей семье; у родителей всё есть; хочу что-то про нашу семью; много семейных историй; сохранить для детей; собрать родителей, детей, бабушек, дедушек и животных; фотографии лежат в телефоне; куча внутренних шуток; не хочу очередную фотокнигу.",
      SOURCE,
    ],
    [
      "pitch_one_paragraph",
      "Стоимость семейной колоды начинается от 100 €. В неё уже входит часовое интервью с профессиональным интервьюером, работа редактора, дизайн, печать и один экземпляр колоды из 54 карт. Если для истории семьи понадобится дополнительное интервью, оно стоит 40 €, дополнительный экземпляр готовой колоды — 50 €. Доставка рассчитывается отдельно в зависимости от страны.",
      SOURCE,
    ],
    [
      "pitch_short",
      "Мы не просим вас самим придумывать 54 карты. Сначала интервьюер находит семейные сюжеты, затем вы добавляете к ним фотографии и подписи в Профите, а мы собираем персональную колоду из 54 карт. От 100 €.",
      SOURCE,
    ],
    [
      "role_in_line",
      "Один продукт. Герой — вся семья как отдельный мир. Не биография одного человека («Книга жизни») и не длинные статьи/развороты (семейное издание).",
      SOURCE,
    ],
    [
      "compare_with",
      "Не обычная колода с 54 фотографиями. Не фотокнига. Не семейный журнал / семейное издание. Не «Книга жизни» по интервью об одном человеке. Не «Книга жизни в заголовках газет». Не автоматический конструктор «загрузил фотографии — получил готовый подарок».",
      SOURCE,
    ],
    [
      "do_not_promise",
      "Не говорить, что продукт стоит ровно 100 € — только от 100 €. Не обещать конкретную дату готовности только из «от недели». Не обещать, что доставка входит в 100 € или конкретную стоимость доставки без страны. Не обещать материал, плотность, ламинацию, упаковку, подарочный футляр в базе. Не обещать, что одного интервью всегда достаточно. Не переносить условия других продуктов. Не говорить, что клиент должен сам придумать 54 карты или что колода создаётся полностью автоматически. Содержание чувствительных тем согласует клиент, универсального запрета нет.",
      SOURCE,
    ],
    ["sources", SOURCE, "create-family-card-deck-passport"],
    ["synced_at", syncedAt, "script"],
  ]);
}

function economyRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product_id", PRODUCT_ID, "passport-registry", ""],
    ["bitrix_name", BITRIX_NAME, "passport", "Bitrix enum ID — UNKNOWN"],
    [
      "definition",
      "Семейная колода карт. Цена витрины — от 100 €, не фиксированные 100 €.",
      SOURCE,
      "",
    ],
    ["retail_price", "от 100", SOURCE, "не фиксированные 100 €"],
    ["currency", "EUR", SOURCE, ""],
    ["cost_price", "", SOURCE, "COGS не зафиксирован"],
    ["cogs_total", "", SOURCE, ""],
    ["cogs_retail_model", "", SOURCE, ""],
    ["cogs_margin_pct", "", SOURCE, ""],
    ["cogs_line_1", "База от 100 €: 1 интервью, интервьюер, редактор, дизайн, печать, 1 колода из 54 карт, согласование, до 3 раундов правок", SOURCE, ""],
    ["cogs_line_2", "Дополнительное интервью +40 €", SOURCE, ""],
    ["cogs_line_3", "Дополнительная колода +50 €", SOURCE, ""],
    ["cogs_line_4", "Доставка отдельно, зависит от страны и типа доставки", SOURCE, ""],
    ["cogs_line_5", "Подарочный футляр: может быть разработан, стоимость UNKNOWN", SOURCE, ""],
    [
      "value_vs_price",
      "Не сравнивать с магазинной колодой. От 100 € — интервью, редактор, дизайн, персонализация, согласование, правки и печать одного экземпляра. Доставка не входит.",
      SOURCE,
      "Для ОП",
    ],
    [
      "rule",
      "Всегда «от 100 €». Не обещать доставку, футляр, срочность и COGS. Срочное производство возможно, цена и условия UNKNOWN.",
      SOURCE,
      "",
    ],
    ["synced_at", syncedAt, "script", "UTC"],
  ]);
}

function productionRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product", BITRIX_NAME, SOURCE, "Интервью → Профита → редакция → дизайн → печать 54 карт"],
    [
      "process_start",
      "Уточнить: история всей семьи в 54 картах, не биография одного человека и не семейное издание со статьями.",
      SOURCE,
      "",
    ],
    [
      "step_1",
      "Интервью. Одно входит в базу, обычно от 1 часа, аудиозапись. Интервьюер Retro Pressa (тот же тип, что для «Книги жизни»). Срок переноса в Профиту — UNKNOWN.",
      SOURCE,
      "",
    ],
    [
      "step_2",
      "Формирование сюжетов. Если после первого интервью сильных сюжетов меньше 54, ищут вместе с клиентом. Доп. интервью +40 €.",
      SOURCE,
      "",
    ],
    [
      "step_3",
      "Профита: клиент добавляет изображения и финальные подписи к найденным сюжетам. Другие типы файлов — UNKNOWN. Доступ нескольким родственникам — UNKNOWN. Ссылка входа — UNKNOWN. Доступ после заказа / архив vs рабочий сервис — UNKNOWN.",
      SOURCE,
      "",
    ],
    [
      "step_4",
      "Редактор собирает структуру колоды. Один человек/питомец/место/событие может быть на нескольких картах. Масти, номиналы и рубашка персонализируются и согласуются.",
      SOURCE,
      "",
    ],
    [
      "step_5",
      "Дизайн, согласование перед печатью, до 3 раундов правок. Печать 1 колоды из 54 карт классического формата. Точный размер мм, материал, плотность, покрытие, упаковка — UNKNOWN.",
      SOURCE,
      "",
    ],
    [
      "status_note",
      "Срок производства от 1 недели. Срочное возможно, цена/условия UNKNOWN. Не обещать дату вручения без проверки объёма, числа интервью, скорости материалов, правок и страны доставки. Доставка по миру, не в базе 100 €.",
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
      "Временная обложка — визуальный концепт колоды (не фото реальной напечатанной колоды). Галерея реальной колоды, видео продукта и утверждённый пример 54 готовых карт отсутствуют.",
      SOURCE,
    ],
    ["cover_url", "/training/family-card-deck/cover.png", SOURCE],
    ["synced_at", syncedAt, "script"],
  ]);
}

function miniPassportRows() {
  const today = new Date().toISOString().slice(0, 10);
  return [
    ["Подарок: Семейная колода карт"],
    ["Обновлено", today],
    ["Категория", "Семейная память"],
    ["Название для ОП", "Семейная колода карт"],
    ["Название типа в Bitrix", BITRIX_NAME],
    ["PRODUCT_ID", PRODUCT_ID],
    ["Статус", "active"],
    [
      "Что это",
      "54 карты истории семьи: интервью, Профита, редактор, дизайн, печать одного экземпляра. Не семейное издание и не «Книга жизни».",
    ],
    ["Цена витрина", "от 100 €"],
    ["Валовая маржа", "TBD"],
    ["Маржинальность", "TBD"],
    ["Себестоимость COGS €", "TBD"],
    ["Срок готовности", "от 1 недели"],
    [
      "Что входит в цену",
      "1 интервью, интервьюер, редактор, дизайн, печать, 1 колода из 54 карт, согласование, до 3 раундов правок. Доставка отдельно. Доп. интервью +40 €, доп. колода +50 €.",
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

  const spreadsheetId = process.env.FAMILY_CARD_DECK_PASSPORT_SHEET_ID?.trim() || BITRIX_GIFT_TYPES_SHEET_ID;
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  await ensureTabs(token, spreadsheetId);

  const tabs: Array<[string, Array<Array<string | number>>]> = [
    ["14_Смыслы", meaningsRows()],
    ["14_Экономика", economyRows()],
    ["14_Производство", productionRows()],
    ["14_Визуал", visualRows()],
    ["14_Семейная_колода", miniPassportRows()],
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
