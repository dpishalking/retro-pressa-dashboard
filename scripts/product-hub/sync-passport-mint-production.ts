/**
 * Fill passport «Экономика» + «Производство» from Mint doc
 * «ПРОИЗВОДСТВО И СТОИМОСТЬ» (meeting with Maria, 2026-07-29).
 *
 * Source: https://docs.google.com/document/d/1peZ4pbX8GzrSGiVjX3jIZ2mRnI7BzPmoBUD24pfzVWw/
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/product-hub/sync-passport-mint-production.ts
 *   npx tsx --env-file=.env.local scripts/product-hub/sync-passport-mint-production.ts --product=PRODUCT_LIFE_BOOK
 *
 * Policy: do not invent numbers. If Mint says price is unconfirmed — leave retail empty or mark TBD.
 */

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

const MINT_DOC_URL =
  "https://docs.google.com/document/d/1peZ4pbX8GzrSGiVjX3jIZ2mRnI7BzPmoBUD24pfzVWw/";
const MINT_MEETING_DATE = "2026-07-29";
const MINT_SOURCE = `Mint doc / диалог с Марией ${MINT_MEETING_DATE}`;

type MintPassportContent = {
  productId: string;
  shortDefinition: string;
  /** Client-facing retail from Mint summary, if confirmed enough to write. */
  retailPrice?: string;
  retailCurrency?: string;
  retailNote: string;
  /** Extra economy rows: [field, value, comment] */
  economyExtra?: Array<[string, string, string]>;
  productionSteps: string[];
  productionNotes?: string[];
  statusNote?: string;
};

/**
 * Content extracted from Mint mobilebasic export. Mapped 1:1 to Bitrix passports.
 * «Персонализированная газета» and «Семейное издание» share the same Mint block (product decision pending).
 */
const MINT_BY_PRODUCT: MintPassportContent[] = [
  {
    productId: "PRODUCT_REPRODUCTION",
    shortDefinition: "Точная печатная копия оригинального издания",
    retailPrice: "50",
    retailCurrency: "EUR",
    retailNote:
      "Стандартная цена основной линейки. Меньшие форматы могут быть дешевле — конкретные суммы из интернет-магазина.",
    productionSteps: [
      "После оплаты менеджер запрашивает скан репродукции в Telegram-группе «RetroPress», отмечая Сашу — архивариуса.",
      "Запрос делается по всем репродукциям газет и журналов: как в интернет-магазине, так и по региональным позициям, которых там нет.",
      "Саша присылает ссылку на Google Диск или готовый скан издания.",
      "Менеджер прикрепляет скан к сделке в Bitrix24 и отмечает Таню и Олю.",
      "Таня подготавливает макет / файл к печати и прикрепляет его к сделке.",
      "Если печать в Риге — Таня отмечает Галю; если в Минске — Катю.",
      "Галя или Катя печатает репродукцию и передаёт на отправку.",
    ],
  },
  {
    productId: "PRODUCT_ORIGINAL",
    shortDefinition: "Подлинный экземпляр из архива",
    retailPrice: "25–51",
    retailCurrency: "EUR",
    retailNote:
      "Диапазон зависит от вида и года издания. Узкопрофильные журналы обычно дешевле, известные широкопрофильные — дороже.",
    productionSteps: [
      "Менеджер проверяет наличие оригинала в интернет-магазине и оформляет заказ.",
      "После оплаты менеджер фиксирует оплату в Profit и Bitrix24.",
      "Склад автоматически видит, что заказ оплачен и его можно отправлять. Дополнительных действий менеджера по производству не требуется.",
      "Если клиент просит до отправки показать издание, менеджер запрашивает фотографии: по Рижскому офису — у Евгения в WhatsApp-группе «Архив Retro Pressa»; по Минскому офису — у Кати в Telegram-группе «Минск».",
      "В запросе на фотографии указываются дата, месяц, год и название издания.",
    ],
  },
  {
    productId: "PRODUCT_PERSONAL_MAGAZINE",
    shortDefinition: "Журнал, который создаётся с нуля под конкретного человека",
    retailPrice: "240",
    retailCurrency: "EUR",
    retailNote: "База: 240 € за 16 страниц. Каждые следующие 4 страницы — +60 €. Предоплата 50% = 120 €.",
    economyExtra: [
      ["page_base", "16", "Базовый объём страниц"],
      ["extra_4_pages_price", "60", "EUR за каждые +4 страницы"],
      ["prepayment_pct", "50", "Предоплата от базовой стоимости"],
      ["prepayment_amount_base", "120", "EUR при базе 240 €"],
      ["extra_copies_price", "", "В разговоре с Марией не указана — подтвердить отдельно"],
    ],
    productionSteps: [
      "Минимальный срок изготовления — 14 дней; рабочая рекомендация — брать заказ примерно за месяц до даты вручения.",
      "Клиент вносит предоплату 50% — 120 € при базовой стоимости журнала 240 €.",
      "Менеджер передаёт клиента редактору.",
      "Редактор вместе с клиентом определяет концепцию, рубрики и будущие статьи, затем составляет специальные анкеты.",
      "Клиент рассылает анкеты родственникам и другим участникам, собирает ответы и передаёт их редактору вместе с фотографиями.",
      "Редактор на основе анкет готовит статьи и формирует содержание журнала.",
      "Редактор и клиент согласуют макет, итоговое количество страниц и количество экземпляров.",
      "После согласования клиенту выставляется счёт на остаток.",
      "После полной оплаты журнал передаётся в типографию на печать.",
      "Готовый тираж клиент забирает в офисе или получает через курьерскую доставку.",
    ],
  },
  {
    productId: "PRODUCT_PERSONAL_NEWSPAPER",
    shortDefinition: "Позиция на этапе продуктового решения (вместе с семейным изданием)",
    retailNote:
      "Актуальная стоимость не утверждена. Ранее упоминались 33 € / 55 € за 4 и 8 стр., но сказано, что эти цены планируется убрать — не фиксируем как действующие.",
    statusNote: "Перед фиксацией в паспорте нужно решение Анны (название, модель, тариф).",
    productionSteps: [
      "На встрече обсуждался переход от отдельной персонализированной газеты к единому формату семейного издания.",
      "Предполагается, что клиент сможет сам выбрать название и тему выпуска: один человек, семья, друзья, дети или другой круг героев.",
      "Окончательное название продукта, структура производства и правила передачи заказа в работу на встрече не утверждены.",
      "Перед переносом как финальных правил требуется решение Анны.",
    ],
  },
  {
    productId: "PRODUCT_FAMILY_EDITION",
    shortDefinition: "Единый формат семейного издания (продуктовое решение, совместно с персонализированной газетой)",
    retailNote:
      "Актуальная стоимость не утверждена. Прежние 33 € / 55 € не фиксируем как действующие.",
    statusNote: "Требуется решение Анны перед финальной фиксацией.",
    productionSteps: [
      "Обсуждается переход к единому формату семейного издания вместо отдельной персонализированной газеты.",
      "Клиент выбирает название и тему выпуска (человек / семья / друзья / дети и т.п.).",
      "Структура производства и правила передачи заказа в работу не утверждены.",
      "Перед финальной фиксацией в паспорте — решение Анны.",
    ],
  },
  {
    productId: "PRODUCT_CONGRATS_MAGAZINE",
    shortDefinition: "Копия оригинального журнала с персонализированными страницами",
    retailPrice: "135",
    retailCurrency: "EUR",
    retailNote:
      "Цифра из сводки Mint. В детальном блоке транскрибации цена не называлась — сверить с Марией/Bitrix перед продажей как единственный прайс.",
    productionSteps: [
      "После оплаты менеджер запрашивает скан журнала у Саши в Telegram-группе «RetroPress».",
      "Саша присылает ссылку на Google Диск или готовый скан.",
      "Менеджер прикрепляет скан к сделке в Bitrix24, отмечает Таню и Олю, добавляет фотографии и поздравительный текст клиента.",
      "Таня вставляет персональные материалы и подготавливает макет изменённых страниц.",
      "Макет персонализированных страниц отправляется клиенту на согласование.",
      "Только после согласования Таня готовит финальный файл к печати и прикрепляет его к сделке.",
      "Журнал печатается в Риге или Минске — независимо от страны доставки.",
    ],
  },
  {
    productId: "PRODUCT_CONGRATS_NEWSPAPER",
    shortDefinition: "Копия оригинальной газеты с фотографией и поздравительным текстом",
    retailPrice: "72",
    retailCurrency: "EUR",
    retailNote:
      "Цифра из сводки Mint. В детальном блоке транскрибации цена не называлась — сверить перед продажей.",
    productionSteps: [
      "После оплаты менеджер запрашивает скан газеты у Саши в Telegram-группе «RetroPress».",
      "Саша присылает ссылку на Google Диск или готовый скан.",
      "Менеджер прикрепляет скан к сделке в Bitrix24, отмечает Таню и Олю, добавляет фотографии и поздравительный текст клиента.",
      "Таня вставляет персональные материалы и подготавливает макет изменённой страницы или страниц.",
      "Макет отправляется клиенту на согласование до печати.",
      "После согласования Таня готовит финальный печатный файл и прикрепляет его к сделке.",
      "Газета печатается в Риге или Минске — независимо от страны доставки.",
    ],
  },
  {
    productId: "PRODUCT_ANIMATE",
    shortDefinition: "Оживление фотографий или связка издания с видеопоздравлением",
    retailPrice: "от 2",
    retailCurrency: "EUR",
    retailNote:
      "В сводке: от 2 €. Отдельные цены за оживление фото и за связку с готовым видео в транскрибации не назывались.",
    productionSteps: [
      "После фиксации оплаты сделка попадает на этап «Оживление» в Bitrix24, и Мария берёт её в работу.",
      "Вариант 1: клиент передаёт фотографии; фотографии оживляются, после чего из них собирается ролик с музыкой.",
      "Вариант 2: клиент передаёт готовое видеопоздравление; Мария связывает его с конкретной страницей или статьёй издания через QR-код.",
      "Получатель сканирует QR-код в издании и открывает видеопоздравление на телефоне.",
      "Срок хранения видеопоздравления — 30 лет (по разговору).",
    ],
  },
  {
    productId: "PRODUCT_LIFE_BOOK",
    shortDefinition: "Книга из газетных передовиц на дату рождения человека по каждому году его жизни",
    retailPrice: "до 200",
    retailCurrency: "EUR",
    retailNote: "Точная тарифная сетка и факторы расчёта в разговоре не раскрыты.",
    economyExtra: [
      ["production_min_days", "14", "Минимум по Mint"],
      ["production_recommended_weeks", "3–4", "Особенно для региональных изданий"],
    ],
    productionSteps: [
      "Основа книги — первая полоса газеты на дату рождения: год рождения, затем та же дата каждого следующего года до текущего времени.",
      "Минимальный срок изготовления — 14 дней. На практике рекомендуется 3–4 недели, особенно для региональных изданий.",
      "Саша ищет передовицы за нужные даты и годы и собирает их в единый архив.",
      "На «Правде» / «Известиях» работа быстрее (электронные архивы); региональные газеты — дольше.",
      "Саша передаёт собранный архив Тане.",
      "Таня обрабатывает страницы, готовит их к печати и выполняет вёрстку книги.",
      "Готовый макет отправляется клиенту на согласование.",
      "После согласования книга передаётся в печать.",
    ],
  },
  {
    productId: "PRODUCT_STICKER",
    shortDefinition: "Готовая дополнительная позиция к основному подарку",
    retailPrice: "3.5",
    retailCurrency: "EUR",
    retailNote:
      "В сводке Mint: 3,5 €. В детальном блоке написано «350» без валюты — трактуем как 3,50 € (сверить с Марией).",
    productionSteps: [
      "Наклейки в наличии в офисе; обычно предлагаются как доп. продажа к основному заказу.",
      "Доступно 8 готовых вариантов на русском и латышском.",
      "Все варианты сфотографированы; менеджер показывает клиенту и помогает выбрать дизайн.",
      "Выбранная наклейка добавляется в счёт отдельной позицией и выдаётся с заказом либо продаётся отдельно в офисе.",
      "Индивидуальный производственный процесс наклейки на встрече не описывался.",
    ],
  },
  {
    productId: "PRODUCT_DIGITAL",
    shortDefinition: "Электронная репродукция без физической печати",
    retailPrice: "17",
    retailCurrency: "EUR",
    retailNote: "Цена за электронную версию без печати.",
    productionSteps: [
      "Процесс начинается как у репродукции: после оплаты менеджер запрашивает скан у Саши.",
      "Скан прикрепляется к сделке в Bitrix24, отмечаются Таня и Оля.",
      "Таня подготавливает итоговый цифровой макет и прикрепляет файл к сделке.",
      "Рижский и Минский офисы не печатают продукт.",
      "Менеджер берёт готовый файл из сделки и отправляет клиенту по электронной почте.",
    ],
  },
];

function quote(title: string, a1: string) {
  return `'${title.replace(/'/g, "''")}'!${a1}`;
}

type SheetMeta = {
  sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
  error?: { message?: string };
};

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

async function ensureTab(
  token: string,
  spreadsheetId: string,
  desiredTitle: string,
  aliases: string[],
): Promise<{ title: string; sheetId: number }> {
  const meta = await sheetsApi<SheetMeta>(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
  );
  const byTrim = new Map<string, { title: string; sheetId: number }>();
  for (const s of meta.sheets ?? []) {
    const title = s.properties?.title;
    const sheetId = s.properties?.sheetId;
    if (title == null || sheetId == null) continue;
    byTrim.set(title.trim().toLowerCase(), { title, sheetId });
  }

  const hit =
    byTrim.get(desiredTitle.trim().toLowerCase()) ||
    aliases.map((a) => byTrim.get(a.trim().toLowerCase())).find(Boolean);

  if (hit) {
    if (hit.title !== desiredTitle) {
      await sheetsApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: { sheetId: hit.sheetId, title: desiredTitle },
                fields: "title",
              },
            },
          ],
        }),
      });
    }
    return { title: desiredTitle, sheetId: hit.sheetId };
  }

  await sheetsApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: { title: desiredTitle, gridProperties: { rowCount: 120, columnCount: 8 } },
          },
        },
      ],
    }),
  });
  const meta2 = await sheetsApi<SheetMeta>(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
  );
  const created = (meta2.sheets || []).find((s) => (s.properties?.title || "").trim() === desiredTitle);
  if (!created?.properties?.sheetId) throw new Error(`Failed to create tab ${desiredTitle}`);
  return { title: desiredTitle, sheetId: created.properties.sheetId };
}

function buildEconomyRows(mint: MintPassportContent, entry: PassportRegistryEntry): Array<Array<string | number>> {
  const syncedAt = new Date().toISOString();
  const raw: Array<[string, string | number, string, string?]> = [
    ["definition", mint.shortDefinition, MINT_SOURCE, entry.bitrixName],
  ];

  if (mint.retailPrice) {
    raw.push(
      ["retail_price", mint.retailPrice, MINT_SOURCE, mint.retailNote],
      ["currency", mint.retailCurrency || "EUR", MINT_SOURCE, "Валюта из сводки Mint (если указана)"],
    );
  } else {
    raw.push(
      ["retail_price", "", MINT_SOURCE, mint.retailNote],
      ["currency", "EUR", MINT_SOURCE, "По умолчанию; retail не утверждён в Mint"],
    );
  }

  for (const [field, value, comment] of mint.economyExtra ?? []) {
    raw.push([field, value, MINT_SOURCE, comment]);
  }

  if (mint.statusNote) {
    raw.push(["status_note", mint.statusNote, MINT_SOURCE, "Блокер перед финальной фиксацией"]);
  }

  raw.push(
    ["cost_price", "", "", "Себестоимость (COGS) в документе Mint не раскрыта — не выдумываем"],
    ["packaging_cost", "", "", "Заполнить при наличии факта"],
    ["delivery_cost", "", "", "Заполнить при наличии факта"],
    ["minimum_price", "", "", "Утверждает РОП/финансы"],
    ["partner_price", "", "", "Если есть партнёрская сетка"],
    ["urgent_price", "", "", "Если есть срочная надбавка"],
    [
      "rule",
      "Стоимость в Mint = клиентский прайс / диапазон из разговора с Марией, не себестоимость. COGS вносить отдельно.",
      MINT_SOURCE,
      entry.bitrixName,
    ],
    ["mint_doc_url", MINT_DOC_URL, MINT_SOURCE, "Исходный документ"],
    ["synced_at", syncedAt, "script", "UTC"],
  );

  return passportKvRows(raw);
}

function buildProductionRows(mint: MintPassportContent, entry: PassportRegistryEntry): Array<Array<string | number>> {
  const syncedAt = new Date().toISOString();
  const raw: Array<[string, string | number, string, string?]> = [
    ["product", entry.bitrixName, MINT_SOURCE, mint.shortDefinition],
    [
      "process_start",
      "После оформления заказа и оплаты, если в продукте не указано иначе",
      MINT_SOURCE,
      "",
    ],
  ];

  mint.productionSteps.forEach((step, i) => {
    raw.push([`step_${i + 1}`, step, MINT_SOURCE, `Шаг ${i + 1}`]);
  });

  for (const note of mint.productionNotes ?? []) {
    raw.push(["note", note, MINT_SOURCE, ""]);
  }
  if (mint.statusNote) {
    raw.push(["status_note", mint.statusNote, MINT_SOURCE, ""]);
  }

  raw.push(
    ["mint_doc_url", MINT_DOC_URL, MINT_SOURCE, ""],
    ["synced_at", syncedAt, "script", "UTC"],
  );

  return passportKvRows(raw);
}

async function syncOne(entry: PassportRegistryEntry, mint: MintPassportContent) {
  const sa = readGoogleServiceAccount();
  if (!sa) throw new Error("Service account not configured");

  console.log(`\n→ ${entry.bitrixName}`);
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");

  try {
    await sheetsApi(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${entry.spreadsheetId}?fields=properties.title`,
    );
  } catch (e) {
    console.error(`  SKIP: ${e instanceof Error ? e.message : e}`);
    console.error(`  Share Editor with ${sa.email}`);
    return false;
  }

  const economyTab = await ensureTab(token, entry.spreadsheetId, entry.economyTabName || "Экономика", [
    "Экономика",
    "Стоимость",
  ]);
  const productionTab = await ensureTab(token, entry.spreadsheetId, "Производство", ["Производство"]);

  const economyRows = buildEconomyRows(mint, entry);
  const productionRows = buildProductionRows(mint, entry);

  await writeSheetValues({
    spreadsheetId: entry.spreadsheetId,
    range: quote(economyTab.title, "A1"),
    clearRange: quote(economyTab.title, "A1:Z200"),
    rows: economyRows,
  });
  await writeSheetValues({
    spreadsheetId: entry.spreadsheetId,
    range: quote(productionTab.title, "A1"),
    clearRange: quote(productionTab.title, "A1:Z200"),
    rows: productionRows,
  });

  console.log(
    `  economy: retail=${mint.retailPrice ?? "(TBD)"} | production steps=${mint.productionSteps.length}`,
  );
  console.log(`  url: https://docs.google.com/spreadsheets/d/${entry.spreadsheetId}/edit`);
  return true;
}

async function main() {
  const productArg = process.argv.find((a) => a.startsWith("--product="))?.slice("--product=".length);
  const targets = productArg
    ? MINT_BY_PRODUCT.filter((m) => m.productId === productArg)
    : MINT_BY_PRODUCT;

  if (!targets.length) throw new Error(`No Mint content for ${productArg}`);

  let ok = 0;
  let skipped = 0;
  for (const mint of targets) {
    const entry = findPassportByProductId(mint.productId);
    if (!entry) {
      console.error(`Missing registry entry: ${mint.productId}`);
      skipped += 1;
      continue;
    }
    const success = await syncOne(entry, mint);
    if (success) ok += 1;
    else skipped += 1;
  }

  console.log(`\nDone. ok=${ok} skipped=${skipped} registry_products=${PASSPORT_REGISTRY.length}`);
  console.log("Mint open questions still pending (from doc footer):");
  console.log("- personal newspaper / family edition name+tariff (Anna)");
  console.log("- sticker currency confirmation");
  console.log("- congrats magazine/newspaper + Оживи prices confirmation");
  console.log("- extra copies pricing for personalized magazine");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
