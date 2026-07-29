/**
 * Append «cost–benefit» block into each passport «Экономика» tab.
 *
 * Source block in meanings workbook «Продукты RetroPressa»:
 *   columns «Главные выгоды для клиента» + «СТОИМОСТЬ»
 *   (+ «Минимальный объём / цена» where present, e.g. glossy magazine)
 *
 * Sheet: https://docs.google.com/spreadsheets/d/1hLYcO6_knzWrfz6RWuHkQPuJoRajiy1XM9Z1aqHcQ98/
 *
 * Usage:
 *   npm run product-hub:sync-passport-cost-benefit
 */

import {
  getGoogleAccessToken,
  readGoogleServiceAccount,
  readSheetValues,
  writeSheetValues,
} from "../../src/lib/google/sheets-client";
import {
  findPassportByProductId,
  PASSPORT_REGISTRY,
  type PassportRegistryEntry,
} from "./passport-registry";
import { PASSPORT_KV_HEADER, passportKvRow } from "./passport-field-labels";

const MEANINGS_SHEET_ID = "1hLYcO6_knzWrfz6RWuHkQPuJoRajiy1XM9Z1aqHcQ98";
const MEANINGS_URL = `https://docs.google.com/spreadsheets/d/${MEANINGS_SHEET_ID}/edit`;
const SOURCE = "Meanings workbook · блок выгоды + стоимость";

type CostBenefit = {
  productId: string;
  clientBenefits: string;
  /** Price / tariff text from the СТОИМОСТЬ or «объём / цена» cell (may be empty in sheet). */
  costFromSheet: string;
  /** How to sell value vs price (manager note). */
  valueVsPrice: string;
};

/**
 * Cost–benefit extracted from meanings workbook (+ Mint anchors where sheet СТОИМОСТЬ empty).
 */
const COST_BENEFIT_BY_PRODUCT: CostBenefit[] = [
  {
    productId: "PRODUCT_ORIGINAL",
    clientBenefits:
      "1. Удивление — не массовая вещь, а реальное издание из прошлого. 2. Сильный момент поздравления за столом. 3. Семейные разговоры и воспоминания. 4. Подходит человеку, которому сложно что-то выбрать. 5. Можно красиво упаковать (конверт, папка, тубус). 6. Сохраняется как семейный артефакт.",
    costFromSheet:
      "В колонке СТОИМОСТЬ книги смыслов пусто. Якорь из Mint: 25–51 € в зависимости от вида и года издания.",
    valueVsPrice:
      "Клиент платит за подлинный фрагмент времени и эмоцию за столом, а не за «бумагу». Сравнивать с банальным сувениром той же суммы — выгода в редкости и разговоре.",
  },
  {
    productId: "PRODUCT_REPRODUCTION",
    clientBenefits:
      "Та же эмоция «газеты из того дня», когда оригинала нет; тактильный подарок; можно дарить за столом; доступны региональные издания через архив.",
    costFromSheet:
      "В книге смыслов отдельного блока на репродукцию нет. Якорь Mint: 50 € стандарт; меньшие форматы могут быть дешевле (витрина).",
    valueVsPrice:
      "Цена близка к витринной репродукции (~45–50 €). Выгода: сохранить машину времени без ожидания подлинника со склада.",
  },
  {
    productId: "PRODUCT_LIFE_BOOK",
    clientBenefits:
      "1. Сильный вау-эффект. 2. Подарок выглядит редким и продуманным. 3. Воспоминания и разговоры за столом. 4. Жизнь как история, не просто «вещь». 5. Подходит «сложным» получателям. 6. Семейная ценность на годы.",
    costFromSheet:
      "Колонка СТОИМОСТЬ в книге смыслов пуста. Якорь Mint: до 200 €; точная сетка не раскрыта.",
    valueVsPrice:
      "Чек выше разовой газеты, потому что это масштаб всей жизни. Продавать уважение к пути и уникальность под юбилей — не «стопку газет».",
  },
  {
    productId: "PRODUCT_PERSONAL_NEWSPAPER",
    clientBenefits:
      "Первая полоса с фото и заголовком; статья о герое; разделы, истории, поздравления, факты; шаблоны под повод; дизайн в газетном стиле; быстрый вау; PDF или печать.",
    costFromSheet:
      "Колонка СТОИМОСТЬ пуста. Модель/тариф семейного формата — TBD (Mint/Анна). Исторические 33/55 € за 4/8 стр. не фиксировать как действующие.",
    valueVsPrice:
      "Клиент платит за то, что человек становится героем выпуска. Сравнивать не с «печатью А3», а с эмоцией «это про меня» на празднике.",
  },
  {
    productId: "PRODUCT_PERSONAL_MAGAZINE",
    clientBenefits:
      "Готовое печатное издание под ключ: не нужно самому писать статьи, верстать и собирать структуру. Команда ведёт материалы до готового подарка. Статус «целый номер про меня».",
    costFromSheet:
      "Из блока «Минимальный объём / цена» книги смыслов: минимум 16 страниц; 15 € за страницу; в стоимость входят тексты, редактура, корректура, обработка фото, вёрстка, правки, типография, доставка до двери. Срок от ~10 рабочих дней. Сверка с Mint: 240 € / 16 стр. (= 15×16), +60 € / 4 стр.",
    valueVsPrice:
      "Формула ценности: 15 €/стр. × объём. За чек клиент получает полноценный глянец и работу редакции — не «макет в Canva». При апгрейде страниц явно называть +60 € / 4 стр.",
  },
  {
    productId: "PRODUCT_FAMILY_EDITION",
    clientBenefits:
      "Память не в телефоне, а в издании; семейное наследие; ощущение «моя/наша история важна»; фото получают смысл; всплывают нерассказанные истории; подарок с глубиной.",
    costFromSheet:
      "Колонка СТОИМОСТЬ пуста. Актуальный тариф семейного издания не утверждён (Mint).",
    valueVsPrice:
      "Пока тариф TBD — продавать смысл наследия, не цену. После решения Анны вписать якорь и пересчитать value vs price.",
  },
  {
    productId: "PRODUCT_CONGRATS_NEWSPAPER",
    clientBenefits:
      "Двойной вау: ретро из даты + личное фото/текст; сильнее «голой» архивной газеты; гости вовлекаются.",
    costFromSheet:
      "В книге смыслов нет отдельной строки. Сводка Mint: 72 € (в деталях транскрибации цена не называлась — сверить).",
    valueVsPrice:
      "Надбавка к чистой репродукции окупается персонализацией. Апселл: Оживи + наклейка усиливают эмоцию и чек.",
  },
  {
    productId: "PRODUCT_CONGRATS_MAGAZINE",
    clientBenefits:
      "Ретро-база журнала + персональные страницы; больше пространства под фото/текст, чем в газете.",
    costFromSheet:
      "Сводка Mint: 135 € (детали транскрибации — сверить). Не путать с именным глянцем 240 € / 16 стр.",
    valueVsPrice:
      "Дешевле полного журнала с нуля, но личнее чистой репродукции. Объяснять разницу форматов до цены.",
  },
  {
    productId: "PRODUCT_DIGITAL",
    clientBenefits:
      "Быстрый доступ к изданию из даты без логистики печати; удобно на email / за границу.",
    costFromSheet: "Mint: 17 € за электронную версию без печати.",
    valueVsPrice:
      "Ниже физической репродукции: честно говорить, что нет тактильного вау за столом. Хорош как быстрый/дистанционный вариант или ступенька к печати.",
  },
  {
    productId: "PRODUCT_ANIMATE",
    clientBenefits:
      "Второй слой wow: издание «оживает» на телефоне; гости снимают и пересылают; видео-тост хранится долго (до 30 лет по Mint).",
    costFromSheet:
      "Сводка Mint: от 2 €. Отдельные тарифы вариантов (оживление фото / QR+видео) не зафиксированы.",
    valueVsPrice:
      "Апселл с высокой эмоцией на низком относительно основного чеке. Предлагать после основного продукта: «за небольшую доплату подарок заговорит».",
  },
  {
    productId: "PRODUCT_STICKER",
    clientBenefits:
      "Завершённость комплекта; праздничная деталь вручения; выбор из 8 дизайнов RU/LV без ожидания производства.",
    costFromSheet: "Mint: 3,5 € (сверить валюту). Bitrix: 3.5 EUR.",
    valueVsPrice:
      "Микро-апселл: почти без сопротивления, поднимает средний чек и эмоцию упаковки. Всегда предлагать в конце оформления.",
  },
];

function quote(title: string, a1: string) {
  return `'${title.replace(/'/g, "''")}'!${a1}`;
}

function cbRows(cb: CostBenefit): Array<Array<string | number>> {
  const syncedAt = new Date().toISOString();
  return [
    passportKvRow("cost_benefit_section", "COST–BENEFIT", SOURCE, "Старт блока выгоды ↔ цена"),
    passportKvRow("client_benefits", cb.clientBenefits, SOURCE, "Колонка «Главные выгоды для клиента»"),
    passportKvRow(
      "cost_anchor",
      cb.costFromSheet,
      SOURCE,
      "Колонка «СТОИМОСТЬ» / «Минимальный объём / цена» + якоря Mint",
    ),
    passportKvRow("value_vs_price", cb.valueVsPrice, SOURCE, "Для ОП: как говорить о чеке"),
    passportKvRow("cost_benefit_source_url", MEANINGS_URL, SOURCE, "Продукты RetroPressa"),
    passportKvRow("cost_benefit_synced_at", syncedAt, "script", "UTC"),
  ];
}

function isCostBenefitCode(field: string) {
  return (
    field.startsWith("cost_benefit") ||
    field === "client_benefits" ||
    field === "cost_anchor" ||
    field === "value_vs_price"
  );
}

/** Normalize legacy 4-col economy rows → labeled 6-col. */
function normalizeEconomyDataRow(row: string[]): Array<string | number> | null {
  const code = String(row[0] || "").trim();
  if (!code || code === "Код" || code === "Поле") return null;
  if (isCostBenefitCode(code)) return null;

  // Already labeled: Код | Название | Зачем | Содержание | Примечание | Источник
  if (row.length >= 6) {
    return [0, 1, 2, 3, 4, 5].map((i) => row[i] ?? "");
  }

  // Legacy: Поле | Значение | Комментарий | Источник
  return passportKvRow(code, row[1] ?? "", String(row[3] ?? ""), String(row[2] ?? ""));
}

async function syncOne(entry: PassportRegistryEntry, cb: CostBenefit) {
  const sa = readGoogleServiceAccount();
  if (!sa) throw new Error("Service account not configured");
  console.log(`\n→ Экономика + cost–benefit: ${entry.bitrixName}`);

  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${entry.spreadsheetId}?fields=properties.title`,
      { headers: { authorization: `Bearer ${token}` }, cache: "no-store" },
    ).then(async (r) => {
      if (!r.ok) throw new Error((await r.json()).error?.message || String(r.status));
    });
  } catch (e) {
    console.error(`  SKIP: ${e instanceof Error ? e.message : e}`);
    return false;
  }

  const tab = entry.economyTabName || "Экономика";
  const existing = await readSheetValues({
    spreadsheetId: entry.spreadsheetId,
    range: quote(tab, "A1:F200"),
  });

  const kept: Array<Array<string | number>> = [];
  for (const row of existing.slice(1)) {
    const normalized = normalizeEconomyDataRow((row || []).map((c) => String(c ?? "")));
    if (normalized) kept.push(normalized);
  }

  const rows: Array<Array<string | number>> = [
    [...PASSPORT_KV_HEADER],
    ...kept,
    ...cbRows(cb),
  ];

  await writeSheetValues({
    spreadsheetId: entry.spreadsheetId,
    range: quote(tab, "A1"),
    clearRange: quote(tab, "A1:Z300"),
    rows,
  });

  console.log(`  appended cost–benefit (${cb.clientBenefits.slice(0, 60)}…)`);
  return true;
}

async function main() {
  const productArg = process.argv.find((a) => a.startsWith("--product="))?.slice("--product=".length);
  const list = productArg
    ? COST_BENEFIT_BY_PRODUCT.filter((c) => c.productId === productArg)
    : COST_BENEFIT_BY_PRODUCT;

  let ok = 0;
  let skipped = 0;
  for (const cb of list) {
    const entry = findPassportByProductId(cb.productId);
    if (!entry) {
      console.error(`Missing registry ${cb.productId}`);
      skipped += 1;
      continue;
    }
    if (await syncOne(entry, cb)) ok += 1;
    else skipped += 1;
  }

  // Ensure all registry products covered
  for (const entry of PASSPORT_REGISTRY) {
    if (!COST_BENEFIT_BY_PRODUCT.some((c) => c.productId === entry.productId)) {
      console.warn(`No cost–benefit mapping for ${entry.bitrixName}`);
    }
  }

  console.log(`\nDone. ok=${ok} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
