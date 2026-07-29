/**
 * Bitrix gift-type aligned Product Hub catalog.
 * Source of names: spreadsheet «Продукты Retro Pressa» / tab «Паспорта продуктов».
 * Enrichment: training + CRM modules. No invented prices.
 */

import fs from "node:fs";
import path from "node:path";
import {
  ASSETS_FIELDS,
  DICTIONARIES,
  DICTIONARY_COLUMNS,
  MARKET_PRICES_FIELDS,
  PRODUCTION_DELIVERY_FIELDS,
  PRODUCTS_FIELDS,
  README_ROWS,
  SALES_PLAYBOOK_FIELDS,
  VARIANTS_FIELDS,
} from "./bootstrap-schema";
import { buildReadinessFormulas, type CatalogPayload } from "./seed-catalog";

export const BITRIX_GIFT_TYPES_SHEET_ID =
  process.env.BITRIX_GIFT_TYPES_SHEET_ID?.trim() || "1NsVbsv2YZbehiYTtSP1Waf0gYf1nCnocszonQyppKAE";

export const BITRIX_GIFT_TYPES_TAB = "Паспорта продуктов"; // actual title may have trailing space — resolved dynamically

export async function resolveBitrixTypesTabTitle(token: string): Promise<string> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${BITRIX_GIFT_TYPES_SHEET_ID}?fields=sheets.properties(title)`,
    { headers: { authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  const data = (await res.json()) as {
    sheets?: Array<{ properties?: { title?: string } }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(data.error?.message || `meta ${res.status}`);
  const titles = (data.sheets ?? []).map((s) => s.properties?.title ?? "");
  const match =
    titles.find((t) => t.trim() === BITRIX_GIFT_TYPES_TAB) ||
    titles.find((t) => t.trim().toLowerCase().includes("паспорт")) ||
    titles[0];
  if (!match) throw new Error("Bitrix gift types workbook has no sheets");
  return match;
}

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

type GiftDef = {
  bitrixName: string;
  productId: string;
  category: string;
  physicalOrDigital: "physical" | "digital" | "physical_and_digital";
  trainingId?: string;
  /** Extra production-focused notes from CRM (no invented day counts unless stated). */
  production?: {
    materialsRequired?: string;
    requirements?: string;
    limitations?: string;
    location?: string;
    supplier?: string;
    minDays?: number | "";
    maxDays?: number | "";
    urgentMin?: number | "";
    urgentMax?: number | "";
    isActive?: "TRUE" | "FALSE";
  };
  fallbackShort?: string;
  fallbackFull?: string;
  fallbackPitch?: string;
  variantName?: string;
  format?: string;
};

/** Order matches Bitrix sheet; Репродукция first for production priority. */
export const BITRIX_GIFTS: GiftDef[] = [
  {
    bitrixName: "Репродукция",
    productId: "PRODUCT_REPRODUCTION",
    category: "archive_print",
    physicalOrDigital: "physical",
    trainingId: "personal-newspaper",
    variantName: "Репродукция в натуральную величину",
    format: "newspaper_or_magazine_copy",
    fallbackShort:
      "Репродукция — копия оригинала, напечатанная в натуральную величину. Когда оригинала на складе уже нет, клиенту предлагают репродукцию того же издания за нужную дату.",
    fallbackFull:
      "Репродукция — печатная копия архивного издания в натуральную величину.\n\nВ интернет-магазине на карточке издания розовая строка «Оригинал» означает физический экземпляр на складе. Если доступны электронная версия / репродукция / поздравительная — оригинал уже продан, остаются другие форматы.\n\nРегиональные репродукции (город/страна рождения) часто нет на сайте: запрос уходит в Telegram-группу «Репродукции» (Александр/Саша) с датой и регионом. После выбора издания и оплаты Саша передаёт скан для макетировщиков — его нужно прикрепить к сделке.\n\nПосле оплаты сделку переводят на этап «Репродукция» и добавляют дизайнера.",
    fallbackPitch:
      "Репродукция — это точная печатная копия газеты или журнала из нужной даты в натуральную величину. Если оригинала уже нет, мы можем сделать репродукцию и сохранить эмоцию «газеты из того дня».",
    production: {
      materialsRequired:
        "Дата издания\nЯзык/регион\nНазвание выбранной газеты/журнала\nПосле оплаты: скан от архива (Саша) для макетировщиков",
      requirements:
        "1) Проверить наличие на retropressa.com по дате и языку.\n2) Отличить Оригинал (розовая строка) от репродукции/электронной версии.\n3) Региональные запросы → Telegram «Репродукции».\n4) Счёт: позиция «Репродукция газеты региональной» / репродукция; в названии — издание + дата.\n5) После оплаты → этап «Репродукция» + дизайнер; скан прикрепить к сделке.",
      limitations:
        "Не путать с Оригиналом (физический архивный экземпляр).\nНе путать с Поздравительной (туда вставляют фото/текст клиента).\nРегиональные позиции часто отсутствуют в интернет-магазине.",
      location: "Print / prepress (после скана архива)",
      supplier: "Архив Retro Pressa / группа «Репродукции»",
      minDays: "",
      maxDays: "",
      isActive: "FALSE",
    },
  },
  {
    bitrixName: "Оригинал",
    productId: "PRODUCT_ORIGINAL",
    category: "archive_print",
    physicalOrDigital: "physical",
    trainingId: "personal-newspaper",
    variantName: "Оригинальное издание со склада",
    format: "archive_original",
    fallbackShort:
      "Оригинал — реальное газетное или журнальное издание из архива, физически лежащее на складе (розовая строка «Оригинал» в магазине).",
    fallbackPitch:
      "Оригинал — настоящая газета или журнал из нужной даты со склада. Это не копия, а физический фрагмент прошлого.",
    production: {
      materialsRequired: "Дата\nЯзык издания\nВыбранное название издания из подборки",
      requirements:
        "Проверка наличия на retropressa.com.\nФото/вопросы по оригиналу — WhatsApp-группа «Архив» (Женя).\nОтгрузка физического экземпляра со склада.",
      limitations: "Оригинал один; если продан — предлагать репродукцию / электронную / поздравительную.",
      location: "Склад архива",
      supplier: "Архив Retro Pressa",
      minDays: "",
      maxDays: "",
      isActive: "FALSE",
    },
  },
  {
    bitrixName: "Персонализированный журнал",
    productId: "PRODUCT_PERSONAL_MAGAZINE",
    category: "gift",
    physicalOrDigital: "physical",
    trainingId: "gift-edition",
    variantName: "Глянцевый персональный журнал от 16 стр.",
    format: "glossy_magazine",
    fallbackShort:
      "Глянцевый персональный журнал — издание о конкретном человеке, семье или компании, созданное полностью с нуля. Без архивных данных: рубрики, статьи и фото собираются под героя. Минимум 16 страниц; объём может быть больше. Продаём премиальный статус и ощущение «обо мне вышел целый журнал».",
    fallbackFull:
      "Глянцевый персональный журнал создаётся полностью с нуля. В нём нет архивных данных — только материал про конкретного человека, семью или компанию.\n\nНазвание может быть известным (Караван, Жизель) или придуманным заказчиком. Минимальный заказ — 16 страниц; максимум не ограничен (100–150 уже похоже на книгу).\n\nКлиент отвечает на вопросы анкеты/платформы, присылает фото с подписями. Мы разрабатываем рубрики, формируем статьи, макетируем и отдаём в печать только после согласования.\n\nДля ОП: это премиальный формат с большим объёмом и статусным эффектом. Не путать с поздравительным журналом на базе скана архива и с Party Page (быстрая газета).",
    fallbackPitch:
      "Персональный журнал — глянцевое издание о человеке от 16 страниц, созданное с нуля без архива. Герой получает свой номер, а не копию старой газеты.",
    production: {
      materialsRequired: "Ответы на бриф/вопросы\nФото героя с подписями\nПовод и тон подачи\nЖелаемое название журнала (если есть)",
      requirements:
        "Создание издания с нуля (не архив). Минимум 16 страниц. Печать после согласования макета с заказчиком. Уточнить обложку и бумагу у производства.",
      limitations:
        "Не путать с поздравительным журналом на базе скана архива.\nНе путать с персонализированной газетой Party Page (быстрый газетный формат).",
      minDays: "",
      maxDays: "",
      isActive: "FALSE",
    },
  },
  {
    bitrixName: "Персонализированная газета",
    productId: "PRODUCT_PERSONAL_NEWSPAPER",
    category: "gift",
    physicalOrDigital: "physical",
    trainingId: "gift-edition",
    variantName: "Party Page / персональная газета с нуля",
    format: "party_page_newspaper",
    fallbackShort:
      "Персонализированная газета Party Page — газета формата А4 (лист А3, сложенный пополам), созданная с нуля под конкретного человека или повод. Не на основе архива. Главное преимущество — скорость: макет за 1–2 дня. Продаём яркий быстрый формат «обо мне написали газету».",
    fallbackFull:
      "Персонализированная газета Party Page создаётся с нуля — не на основе архивной газеты или журнала. Формат А4 (лист А3, сложенный пополам), под конкретного человека, событие, компанию или повод.\n\nСоздаётся через анкету или платформы: клиент отвечает на вопросы по разделам выбранного шаблона. Шаблоны тематические: мужская/женская правда, семейная газета, свадьба, гендер-пати, выпускной, пенсия, юбилеи и др.\n\nГлавное преимущество — скорость: за 1–2 дня можно подготовить макет, распечатать в центре печати и уже вечером подарить. Объём: 4 страницы — минимум, 8 — лучше, 16 — интереснее листать.\n\nДля ОП: быстрый и доступный формат персонализации. Не путать с глянцевым персональным журналом (премиум, от 16 стр.) и с поздравительной газетой на базе скана архива.",
    fallbackPitch:
      "Party Page — персональная газета с нуля за 1–2 дня. Без архива, про вашего героя, быстро и ярко.",
    production: {
      materialsRequired: "Ответы на вопросы по шаблону\nФото\nИмя героя / повод\nВыбранный шаблон",
      requirements:
        "По training: Party Page — персональная газета с нуля примерно за 1–2 дня (уточнять загрузку производства). Печать можно в любом центре печати.",
      limitations:
        "Без архивной базы — контент создаётся про человека.\nНе путать с персонализированным журналом и с поздравительной газетой (скан архива + фото/текст).",
      minDays: 1,
      maxDays: 2,
      isActive: "TRUE",
    },
  },
  {
    bitrixName: "Дигитальная версия",
    productId: "PRODUCT_DIGITAL_VERSION",
    category: "digital",
    physicalOrDigital: "digital",
    fallbackShort:
      "Дигитальная (электронная) версия издания — цифровой формат, когда физический оригинал недоступен или клиенту нужен файл.",
    fallbackPitch:
      "Дигитальная версия — электронный формат издания из нужной даты. Удобно, когда оригинал уже продан или нужна быстрая доставка без печати.",
    production: {
      materialsRequired: "Дата\nНазвание издания\nEmail получателя",
      requirements: "Выдача цифрового файла / ссылки. Без физической печати и доставки.",
      limitations: "Не заменяет тактильный эффект оригинала/репродукции.",
      minDays: "",
      maxDays: "",
      isActive: "FALSE",
    },
  },
  {
    bitrixName: "Поздравительный журнал",
    productId: "PRODUCT_CONGRATULATORY_MAGAZINE",
    category: "archive_print",
    physicalOrDigital: "physical",
    trainingId: "retro-newspaper",
    variantName: "Поздравительный журнал на базе скана",
    format: "congratulatory_magazine",
    fallbackShort:
      "Поздравительный журнал — ретро-журнал за месяц и год рождения (или другую дату) со вставленными фото и поздравительным текстом. Основа — скан оригинального журнала; всё остальное сохраняется как в оригинале.",
    fallbackFull:
      "Поздравительный журнал строится на скане оригинального журнала (например, «Наука и жизнь»), вышедшего в нужный месяц и год.\n\nКлиент присылает до 7 фото и поздравительный текст. Мы вставляем их в копию скана; остальная информация журнала остаётся как в оригинале.\n\nТот же принцип, что у поздравительной газеты, но носитель — журнал. Вау-эффект: ностальгия по эпохе + личное открытие на внутренней странице.\n\nНе путать с персонализированным журналом с нуля (без архива) и с поздравительной газетой.",
    fallbackPitch:
      "Поздравительный журнал — скан ретро-журнала за нужную дату с вашими фото и текстом внутри. Всё остальное как в оригинале.",
    production: {
      materialsRequired:
        "Дата / месяц-год\nВыбранный журнал\nДо 7 фото\nПоздравительный текст с заголовком\nСтраница размещения (лучше не первая)",
      requirements:
        "Скан оригинального журнала + вставка фото/текста; остальное как в оригинале. Печать копии.",
      limitations:
        "Это копия с персонализацией, не правка физического оригинала со склада.\nНе путать с персонализированным журналом с нуля.",
      minDays: "",
      maxDays: "",
      isActive: "FALSE",
    },
  },
  {
    bitrixName: "Поздравительная газета",
    productId: "PRODUCT_CONGRATULATORY_NEWSPAPER",
    category: "archive_print",
    physicalOrDigital: "physical",
    trainingId: "retro-newspaper",
    variantName: "Поздравительная газета на базе скана",
    format: "congratulatory_newspaper",
    fallbackShort:
      "Поздравительная газета — ретро-газета за нужную дату со вставленными фото и поздравлением. Основа — точный скан оригинала; новости и вёрстка эпохи сохраняются, внутри — личное открытие.",
    fallbackFull:
      "Поздравительная газета — персональный подарок на основе ретро-издания.\n\nКлиент выбирает газету за нужную дату (Правда, Известия, Труд, Советский спорт, региональное и др.). Мы берём точный скан оригинала и вставляем до 7 фотографий и поздравительный текст. Вся остальная информация сохраняется как в оригинале.\n\nСмысл: человек читает газету из своего дня — и неожиданно находит себя на странице. Поздравление лучше размещать не на первой полосе, а на 2–3 или последней.\n\nНе путать с Оригиналом/Репродукцией без персонализации и с Party Page (газета с нуля без архива).",
    fallbackPitch:
      "Поздравительная газета — ретро-издание из даты рождения с вашими фото и текстом внутри. Остальное как в оригинале; вау — когда человек вдруг находит себя на странице.",
    production: {
      materialsRequired: "Дата\nВыбранная газета\nДо 7 фото\nПоздравительный текст\nЖелаемая страница вставки",
      requirements:
        "Скан оригинала + вставка до 7 фото и текста. Печать копии. После оплаты — этап поздравительной газеты + дизайнер.",
      limitations: "Не вставляем фото в физический оригинал архива.\nНе путать с персонализированной газетой Party Page.",
      minDays: "",
      maxDays: "",
      isActive: "FALSE",
    },
  },
  {
    bitrixName: "Оживи",
    productId: "PRODUCT_OZHIVI",
    category: "animation",
    physicalOrDigital: "digital",
    fallbackShort:
      "Оживи — цифровое оживление фотографии / анимация для усиления эмоции подарка (доп. продукт к печатным изданиям).",
    fallbackPitch:
      "Оживи — анимация фото, которая дополняет печатный подарок и усиливает вау-эффект при вручении.",
    production: {
      materialsRequired: "Исходное фото хорошего качества\nПожелания по стилю анимации",
      requirements: "Цифровое производство анимации. Уточнить формат выдачи (файл/ссылка) у команды Оживи.",
      limitations: "Контент и SLA уточняются у владельца продукта — в training пока нет полного паспорта.",
      minDays: "",
      maxDays: "",
      isActive: "FALSE",
    },
  },
  {
    bitrixName: "Книга жизни",
    productId: "PRODUCT_LIFE_BOOK",
    category: "life_book",
    physicalOrDigital: "physical",
    trainingId: "personal-magazine",
    variantName: "Книга жизни в заголовках газет",
    format: "life_book",
    production: {
      materialsRequired: "Дата рождения / годы жизни\nПол и интересы героя (для подбора изданий)\nПовод (юбилей и т.п.)",
      requirements:
        "Сбор газет/заголовков по годам жизни, макет книги, печать. После оплаты — этап книги + дизайнер.",
      limitations: "Объём зависит от числа лет; нужна проверка наличия газет по годам.",
      minDays: "",
      maxDays: "",
      isActive: "FALSE",
    },
  },
  {
    bitrixName: "Наклейка",
    productId: "PRODUCT_STICKER",
    category: "gift",
    physicalOrDigital: "physical",
    fallbackShort: "Наклейка — дополнительный подарочный/производственный SKU в линейке Bitrix. Паспорт нужно дозаполнить владельцем продукта.",
    fallbackPitch: "Наклейка — доп. элемент комплектации/подарка. Детали производства и цены уточняются.",
    production: {
      materialsRequired: "Макет / текст наклейки (если персональная)",
      requirements: "Уточнить размер, тираж и материал у производства.",
      limitations: "В текущих training-материалах полного описания нет — каркас для заполнения.",
      minDays: "",
      maxDays: "",
      isActive: "FALSE",
    },
  },
  {
    bitrixName: "Семейное издание",
    productId: "PRODUCT_FAMILY_EDITION",
    category: "family_edition",
    physicalOrDigital: "physical",
    fallbackShort: "Семейное издание — продукт линейки Bitrix для семейной истории. Паспорт дозаполняется командой.",
    fallbackPitch: "Семейное издание — подарок про историю семьи. Детали формата и производства уточняются.",
    production: {
      materialsRequired: "Семейные фото\nИстории / даты\nСостав семьи",
      requirements: "Уточнить формат (книга/журнал) и процесс у производства.",
      limitations: "Полного training-паспорта пока нет.",
      minDays: "",
      maxDays: "",
      isActive: "FALSE",
    },
  },
];

function headersOf(fields: { name: string }[]) {
  return fields.map((f) => f.name);
}

function rowFrom(fields: { name: string }[], data: Record<string, string | number | null | undefined>) {
  return fields.map((f) => (data[f.name] == null ? "" : data[f.name]!));
}

function extractPitch(guide?: string): string {
  if (!guide) return "";
  const marker = "Короткая формулировка для менеджера:";
  const idx = guide.indexOf(marker);
  if (idx >= 0) return guide.slice(idx + marker.length).trim().slice(0, 900);
  return guide.slice(0, 600);
}

function mapAssetType(t: string): string {
  if (t === "image") return "photo";
  if (t === "video") return "video";
  return "document";
}

function absoluteUrl(url: string): string | null {
  if (/^https?:\/\//i.test(url)) return url;
  return null;
}

function loadTraining(): Map<string, TrainingProduct> {
  const p = path.resolve(process.cwd(), "data/training/products.json");
  if (!fs.existsSync(p)) return new Map();
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as { products?: TrainingProduct[] };
  return new Map((raw.products ?? []).map((t) => [t.id, t]));
}

export function buildBitrixAlignedCatalog(bitrixNamesFromSheet: string[]): CatalogPayload {
  const training = loadTraining();
  const nameSet = new Set(bitrixNamesFromSheet.map((n) => n.trim()));

  // Keep Bitrix order from sheet if provided, else default BITRIX_GIFTS order
  const ordered: GiftDef[] = [];
  if (bitrixNamesFromSheet.length) {
    for (const name of bitrixNamesFromSheet) {
      const def = BITRIX_GIFTS.find((g) => g.bitrixName === name.trim());
      if (def) ordered.push(def);
      else {
        // Unknown Bitrix name → structural draft
        const slug = name
          .trim()
          .toUpperCase()
          .replace(/[^A-ZА-Я0-9]+/gi, "_")
          .replace(/^_|_$/g, "");
        ordered.push({
          bitrixName: name.trim(),
          productId: `PRODUCT_${slug}`.replace(/[^A-Z0-9_]/g, "_").slice(0, 60),
          category: "gift",
          physicalOrDigital: "physical",
          fallbackShort: `Тип подарка Bitrix «${name.trim()}». Паспорт создан автоматически — нужна ручная дозаполнение.`,
          fallbackPitch: "",
          production: { requirements: "TBD", isActive: "FALSE", minDays: "", maxDays: "" },
        });
      }
    }
    // Append any known gifts missing from sheet (shouldn't happen)
    for (const g of BITRIX_GIFTS) {
      if (!nameSet.has(g.bitrixName) && !ordered.find((o) => o.productId === g.productId)) ordered.push(g);
    }
  } else {
    ordered.push(...BITRIX_GIFTS);
  }

  const productRows: Array<Array<string | number | null>> = [];
  const variantRows: Array<Array<string | number | null>> = [];
  const priceRows: Array<Array<string | number | null>> = [];
  const ruleRows: Array<Array<string | number | null>> = [];
  const playbookRows: Array<Array<string | number | null>> = [];
  const assetRows: Array<Array<string | number | null>> = [];

  const readmeExtra: Array<[string, string]> = [
    [
      "Bitrix sync",
      `Имена продуктов синхронизированы с книгой типов подарков Bitrix (${BITRIX_GIFT_TYPES_SHEET_ID}). product_name = каноническое имя Bitrix.`,
    ],
    ["Приоритет", "Первым заполняется и обслуживается производство по «Репродукция»."],
    ["Цены", "В 03_MARKET_PRICES цены не выдуманы — заполнять вручную из актуальных прайсов."],
  ];

  for (const gift of ordered) {
    const src = gift.trainingId ? training.get(gift.trainingId) : undefined;
    // Prefer explicit Bitrix-split copy when provided (training modules sometimes bundle 2 products).
    const short = gift.fallbackShort || src?.shortDescription || "";
    const full = gift.fallbackFull || src?.description || "";
    const pitch = gift.fallbackPitch || extractPitch(src?.presentationGuide) || short;
    const hero =
      src?.coverImage && absoluteUrl(src.coverImage) ? src.coverImage : "";

    productRows.push(
      rowFrom(PRODUCTS_FIELDS, {
        product_id: gift.productId,
        product_name: gift.bitrixName,
        short_name: gift.bitrixName,
        category: gift.category,
        status: "draft",
        physical_or_digital: gift.physicalOrDigital,
        short_description: short,
        full_description: full,
        owner: "product_team",
        primary_audience: src?.targetAudience ? "families" : "",
        primary_occasion: "birthday",
        default_country_code: "LV",
        default_currency: "EUR",
        hero_image_url: hero,
        landing_url: gift.bitrixName === "Оригинал" || gift.bitrixName === "Репродукция" ? "https://retropressa.com" : "",
        manager_short_pitch: pitch,
        internal_notes: `bitrix_gift_type=${gift.bitrixName}; source=Bitrix types sheet ${BITRIX_GIFT_TYPES_SHEET_ID}; training=${gift.trainingId || "none"}`,
      }),
    );

    variantRows.push(
      rowFrom(VARIANTS_FIELDS, {
        variant_id: `VARIANT_${gift.productId.replace(/^PRODUCT_/, "")}_DEFAULT`,
        product_id: gift.productId,
        variant_name: gift.variantName || "Default / TBD",
        format: gift.format || "",
        size: "",
        page_count: "",
        cover_type: "",
        paper_type: "",
        binding_type: "",
        production_type: gift.physicalOrDigital === "digital" ? "digital" : "print",
        is_active: gift.production?.isActive === "TRUE" ? "TRUE" : "TRUE",
        variant_description: `Вариант для Bitrix-типа «${gift.bitrixName}». Параметры уточнять у производства.`,
      }),
    );

    const prod = gift.production;
    if (prod) {
      ruleRows.push(
        rowFrom(PRODUCTION_DELIVERY_FIELDS, {
          rule_id: `RULE_${gift.productId.replace(/^PRODUCT_/, "")}_LV`,
          product_id: gift.productId,
          variant_id: "",
          country_code: "LV",
          production_min_days: prod.minDays ?? "",
          production_max_days: prod.maxDays ?? "",
          urgent_min_days: prod.urgentMin ?? "",
          urgent_max_days: prod.urgentMax ?? "",
          supplier: prod.supplier || "",
          production_location: prod.location || "",
          delivery_service: gift.physicalOrDigital === "digital" ? "email_link" : "",
          delivery_price: "",
          delivery_currency: "EUR",
          delivery_min_days: "",
          delivery_max_days: "",
          tracking_available: gift.physicalOrDigital === "digital" ? "FALSE" : "",
          materials_required: prod.materialsRequired || "",
          production_requirements: prod.requirements || "",
          limitations: prod.limitations || "",
          is_active: prod.isActive || "FALSE",
        }),
      );
    }

    playbookRows.push(
      rowFrom(SALES_PLAYBOOK_FIELDS, {
        playbook_id: `PLAYBOOK_${gift.productId.replace(/^PRODUCT_/, "")}_DEFAULT`,
        product_id: gift.productId,
        audience: "families",
        occasion: "birthday",
        client_situation: "",
        client_problem: src?.clientProblems || "",
        desired_result: "",
        desired_emotion: "",
        main_offer: short,
        short_pitch: pitch,
        qualification_questions:
          "Кому выбираете подарок?\nПо какому поводу?\nКакая дата важна?\nНужен оригинал, репродукция или персонализация?\nВ какой стране получатель?",
        key_arguments: src?.emotions || "",
        common_objections: src?.objections || "",
        objection_responses:
          gift.bitrixName === "Репродукция"
            ? "Оригинал — физический экземпляр со склада; репродукция — печатная копия в натуральную величину, когда оригинала уже нет.\nРегиональные издания ищем через группу «Репродукции»."
            : "",
        upsell_product_ids:
          gift.bitrixName === "Оригинал"
            ? "PRODUCT_REPRODUCTION, PRODUCT_DIGITAL_VERSION, PRODUCT_OZHIVI"
            : gift.bitrixName === "Репродукция"
              ? "PRODUCT_CONGRATULATORY_NEWSPAPER, PRODUCT_OZHIVI, PRODUCT_DIGITAL_VERSION"
              : "",
        alternative_product_ids:
          gift.bitrixName === "Оригинал"
            ? "PRODUCT_REPRODUCTION"
            : gift.bitrixName === "Репродукция"
              ? "PRODUCT_ORIGINAL, PRODUCT_CONGRATULATORY_NEWSPAPER"
              : "",
        manager_notes: `Bitrix type: ${gift.bitrixName}`,
        is_active: "TRUE",
      }),
    );

    if (src?.materials) {
      const seen = new Set<string>();
      for (const mat of src.materials) {
        const url = mat.url ? absoluteUrl(mat.url) : null;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        assetRows.push(
          rowFrom(ASSETS_FIELDS, {
            asset_id: `ASSET_${gift.productId.replace(/^PRODUCT_/, "")}_${mat.id}`
              .toUpperCase()
              .replace(/[^A-Z0-9_]/g, "_")
              .slice(0, 80),
            product_id: gift.productId,
            variant_id: "",
            asset_type: mapAssetType(mat.type),
            title: mat.title,
            url,
            preview_url: "",
            language: "ru",
            country_code: "",
            status: "active",
            internal_notes: `training/${gift.trainingId}`,
          }),
        );
        if ([...seen].length >= 4) break;
      }
    }

    // Archive video for reproduction/original
    if (gift.bitrixName === "Репродукция" || gift.bitrixName === "Оригинал") {
      assetRows.push(
        rowFrom(ASSETS_FIELDS, {
          asset_id: `ASSET_${gift.productId.replace(/^PRODUCT_/, "")}_ARCHIVE_VIDEO`,
          product_id: gift.productId,
          variant_id: "",
          asset_type: "video",
          title: "Работа с архивом Retro Pressa",
          url: "https://www.youtube.com/embed/n0lGMdbFsYk",
          preview_url: "",
          language: "ru",
          country_code: "",
          status: "active",
          internal_notes: "crm-modules retro-archive",
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

  const formulaRows = buildReadinessFormulas(productRows.length);
  const readinessRows = productRows.map((r, i) => {
    const f = formulaRows[i]!;
    return [String(r[0] ?? ""), String(r[1] ?? ""), f[2], f[3], f[4], f[5], f[6], f[7], f[8], f[9]];
  });

  return {
    sourceLabel: `Bitrix gift types (${BITRIX_GIFT_TYPES_SHEET_ID}) + training/CRM enrichment`,
    sheets: {
      "00_README": {
        headers: ["section", "content"],
        rows: [...README_ROWS, ...readmeExtra].map(([a, b]) => [a, b]),
      },
      "01_PRODUCTS": { headers: headersOf(PRODUCTS_FIELDS), rows: productRows },
      "02_VARIANTS": { headers: headersOf(VARIANTS_FIELDS), rows: variantRows },
      "03_MARKET_PRICES": { headers: headersOf(MARKET_PRICES_FIELDS), rows: priceRows },
      "04_PRODUCTION_DELIVERY": { headers: headersOf(PRODUCTION_DELIVERY_FIELDS), rows: ruleRows },
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
