/**
 * Fill passport for «Поздравительная песня»:
 *   Смыслы / Экономика / Производство
 *
 * Sheet: https://docs.google.com/spreadsheets/d/1E__1xcrf4I2OPmXaIPDGdrpTK3bC1ezEl76zebpofmU/
 * COGS from margin model screenshot (Закупка песни €1, retail €20, margin 95%).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/product-hub/fill-congratulatory-song-passport.ts
 */

import {
  getGoogleAccessToken,
  readGoogleServiceAccount,
  writeSheetValues,
} from "../../src/lib/google/sheets-client";
import { passportKvRows } from "./passport-field-labels";

const SPREADSHEET_ID = "1E__1xcrf4I2OPmXaIPDGdrpTK3bC1ezEl76zebpofmU";
const PRODUCT_ID = "PRODUCT_CONGRATS_SONG";
const BITRIX_NAME = "Поздравительная песня";
const COGS_URL = "https://docs.google.com/spreadsheets/d/1qyINXMJVZoJiidEYXyoeRvjUIF9p8Te0sSkYlAKWdAU/edit";
const SOURCE_COGS = "Модель маржинальности · блок «Поздравительная песня»";
const SOURCE_MEANINGS = "Бриф смыслов · Поздравительная песня (on-demand)";
const SOURCE_CRM = "Product Hub / CRM framing";

function quote(title: string, a1: string) {
  return `'${title.replace(/'/g, "''")}'!${a1}`;
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

async function ensureTabs(token: string, titles: string[]) {
  const meta = await sheetsApi<{
    sheets?: Array<{ properties?: { title?: string; sheetId?: number }; merges?: Array<Record<string, number>> }>;
  }>(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets(properties(sheetId,title),merges)`,
  );
  const existing = new Set((meta.sheets || []).map((s) => (s.properties?.title || "").trim()));
  const missing = titles.filter((t) => !existing.has(t));
  if (missing.length) {
    await sheetsApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: missing.map((title) => ({
          addSheet: {
            properties: { title, gridProperties: { rowCount: 120, columnCount: 8 } },
          },
        })),
      }),
    });
  }

  const meta2 = await sheetsApi<{
    sheets?: Array<{ properties?: { title?: string; sheetId?: number }; merges?: Array<Record<string, number>> }>;
  }>(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets(properties(sheetId,title),merges)`,
  );
  const requests: unknown[] = [];
  for (const s of meta2.sheets || []) {
    const title = (s.properties?.title || "").trim();
    if (!titles.includes(title)) continue;
    const sheetId = s.properties?.sheetId;
    if (sheetId == null) continue;
    for (const m of s.merges || []) {
      requests.push({ unmergeCells: { range: { sheetId, ...m } } });
    }
  }
  if (requests.length) {
    await sheetsApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests }),
    });
    console.log(`Unmerged ${requests.length} range(s) on target tabs`);
  }
}

function meaningsRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product_id", PRODUCT_ID, "passport-registry"],
    ["bitrix_name", BITRIX_NAME, "Bitrix gift type / passport"],
    ["short_name", "Поздравительная песня / Песня на заказ", SOURCE_MEANINGS],
    [
      "what_it_is",
      "Это персональная песня, созданная специально для конкретного человека и важного события. В тексте можно рассказать о получателе, вспомнить общие моменты, выразить благодарность, любовь, уважение и пожелания. Клиент выбирает жанр и мужской или женский вокал, а мы превращаем его мысли в готовую композицию.",
      SOURCE_MEANINGS,
    ],
    [
      "for_whom",
      "Для тех, кто хочет поздравить близкого человека необычно и эмоционально: маму, папу, дедушку, бабушку, супруга, ребёнка, друга, коллегу, руководителя или другого важного человека. Подходит для дня рождения, юбилея, свадьбы, годовщины, рождения ребёнка, профессионального праздника и других значимых событий.",
      SOURCE_MEANINGS,
    ],
    [
      "client_pain",
      "Клиент хочет сказать человеку что-то важное, но не знает, как красиво сформулировать свои чувства. Обычные поздравления, открытки и сообщения кажутся слишком стандартными. Нужен подарок, который удивит получателя, прозвучит лично и создаст сильный эмоциональный момент.",
      SOURCE_MEANINGS,
    ],
    [
      "key_idea",
      "Превратить личное поздравление в настоящую песню. Всё, что клиент хочет сказать близкому человеку, становится музыкальной историей, которую можно включить на празднике, отправить лично или сохранить на память.",
      SOURCE_MEANINGS,
    ],
    [
      "why_now",
      "Приближается важная дата, а подходящего подарка или дополнения к основному подарку ещё нет. Клиенту хочется не просто поздравить человека, а вызвать эмоцию и сделать момент запоминающимся. Песня помогает выразить то, что бывает сложно сказать обычными словами.",
      SOURCE_MEANINGS,
    ],
    [
      "how_it_works",
      "Сначала менеджер отправляет клиенту пример готовой песни. Если формат понравился, нужно уточнить: 1) Какой повод для песни? 2) Какой нужен жанр? 3) Мужской или женский вокал? 4) О чём должна быть песня и что клиент хочет сказать получателю? После получения ответов менеджер передаёт информацию Марии, которая оформляет заказ на создание песни.",
      SOURCE_MEANINGS,
    ],
    [
      "benefits",
      "1. Песня создаётся специально для конкретного человека. 2. В неё можно включить личные истории, имена, воспоминания и пожелания. 3. Клиенту не нужно самостоятельно писать текст песни. 4. Можно выбрать жанр и тип вокала. 5. Песню можно включить во время поздравления и получить сильную реакцию получателя. 6. Её можно отправить человеку, сохранить и переслушивать после праздника. 7. Подходит как самостоятельный подарок или эмоциональное дополнение к книге, журналу, газете и другому подарку Retro Pressa.",
      SOURCE_MEANINGS,
    ],
    ["cost_from_sheet", "20 €", SOURCE_MEANINGS],
    [
      "genres",
      "Поп, рэп, диско 90-х, рок, шансон, классика, клубный, инди, народная, акустика или собственный вариант клиента.",
      SOURCE_MEANINGS,
    ],
    [
      "what_we_sell",
      "Поздравительная песня — это личное обращение, которое человек слышит в музыкальной форме. Клиент рассказывает, кого он хочет поздравить, по какому поводу и что хочет сказать этому человеку. Это могут быть слова благодарности, признание в любви, пожелания, важные воспоминания, смешные семейные истории или описание жизненного пути получателя. Главный смысл продукта — помочь клиенту выразить чувства, которые сложно передать обычным сообщением или стандартным поздравлением. Для отдела продаж важно продавать не просто «песню на заказ», а сам момент поздравления: человек слышит своё имя, узнаёт в тексте события из собственной жизни, понимает, что песня создана именно для него, и получает личное музыкальное послание от близких.",
      SOURCE_MEANINGS,
    ],
    [
      "emotional_result",
      "Получатель слышит в песне своё имя, узнаёт личные истории, важные события и слова близких. Он чувствует, что поздравление создано именно для него, а не выбрано из готовых вариантов. Песня может стать главным эмоциональным моментом праздника: её включают при гостях, снимают реакцию на видео, переслушивают и сохраняют на память.",
      SOURCE_MEANINGS,
    ],
    [
      "when_to_offer",
      "Когда клиент говорит: «хочу необычно поздравить», «не умею красиво выразить свои чувства», «хочется довести до слёз», «нужно поздравление от всей семьи или коллектива», «у человека всё есть», «хочу дополнить основной подарок», «мы будем поздравлять дистанционно», «нужно что-то, что можно включить на празднике». Особенно хорошо подходит для дня рождения, юбилея, свадьбы, годовщины, рождения ребёнка, выпускного, выхода на пенсию и семейных праздников.",
      SOURCE_MEANINGS,
    ],
    [
      "pitch_one_paragraph",
      "Это персональная песня, созданная специально для вашего близкого человека. Вы рассказываете нам, кого хотите поздравить, выбираете жанр и мужской или женский вокал, а также передаёте всё, что хотите сказать получателю. На основании этой информации создаётся готовая песня с личной историей, пожеланиями и важными деталями, которую можно включить на празднике или отправить человеку лично.",
      SOURCE_MEANINGS,
    ],
    [
      "pitch_short",
      "Поздравительная песня — это ваши личные слова, превращённые в музыку. Вы рассказываете нам о человеке и о том, что хотите ему сказать, выбираете жанр и вокал, а мы создаём персональную песню. Её можно включить во время поздравления, отправить близкому человеку или дополнить ею основной подарок.",
      SOURCE_MEANINGS,
    ],
    [
      "client_questions",
      "1. Какой повод для песни? 2. Для кого создаётся песня? 3. Как зовут получателя? 4. Какой жанр выбрать? 5. Нужен мужской или женский вокал? 6. Что вы хотите сказать человеку? 7. Какие события, воспоминания, качества или личные детали важно добавить? 8. От чьего имени будет песня?",
      SOURCE_MEANINGS,
    ],
    [
      "role_in_line",
      "Самостоятельный подарок или эмоциональное дополнение к книге, журналу, газете и другому продукту Retro Pressa. Высокая маржа, цифровая выдача.",
      SOURCE_MEANINGS,
    ],
    [
      "compare_with",
      "Не Оживи (оживление издания/фото). Не наклейка. Не печатный продукт. Песня = личное музыкальное послание; продаём момент поздравления, а не «трек за 20 €».",
      SOURCE_MEANINGS,
    ],
    ["sources", `Бриф смыслов песни на заказ. Economy: ${COGS_URL}`, "fill-congratulatory-song-passport"],
    ["synced_at", syncedAt, "script"],
  ]);
}

function economyRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product_id", PRODUCT_ID, "passport-registry", ""],
    ["bitrix_name", BITRIX_NAME, "passport", ""],
    ["definition", "Персональная песня для конкретного человека и важного события", SOURCE_MEANINGS, ""],
    ["retail_price", 20, SOURCE_MEANINGS, "Стоимость из брифа смыслов / модели"],
    ["currency", "EUR", SOURCE_COGS, ""],
    ["cogs_section", "СЕБЕСТОИМОСТЬ", SOURCE_COGS, "Из блока «Поздравительная песня»"],
    ["cogs_source_title", "Поздравительная песня", SOURCE_COGS, ""],
    ["cost_price", 1, SOURCE_COGS, "COGS итого"],
    ["cogs_total", 1, SOURCE_COGS, ""],
    ["cogs_retail_model", 20, SOURCE_COGS, ""],
    ["cogs_margin_pct", 95, SOURCE_COGS, "Маржа из модели"],
    ["cogs_line_1", "Закупка песни: 1 €", SOURCE_COGS, "Единственная статья в модели"],
    [
      "value_vs_price",
      "Клиент платит 20 € за личное музыкальное послание, а не за «трек». Продавать момент: имя, истории, эмоция на празднике. COGS ~1 € → маржа ~95%.",
      SOURCE_MEANINGS,
      "Для ОП",
    ],
    [
      "client_benefits",
      "1. Специально для человека. 2. Личные истории и имена. 3. Не нужно писать текст самому. 4. Жанр и вокал на выбор. 5. Сильная реакция при вручении. 6. Можно сохранить и переслушивать. 7. Самостоятельно или как дополнение к печати Retro Pressa.",
      SOURCE_MEANINGS,
      "",
    ],
    ["packaging_cost", "", "", "В модели не выделено"],
    ["delivery_cost", "", "", "Цифровая выдача — уточнить, если есть отдельная стоимость"],
    ["minimum_price", "", "", "Утверждает РОП/финансы при необходимости"],
    ["rule", "Retail и COGS брать из модели маржинальности; не путать с Mint-печатью. При смене подрядчика пересчитать cost_price.", SOURCE_COGS, ""],
    ["cogs_source_url", COGS_URL, SOURCE_COGS, "После добавления в мастер-вкладку"],
    ["synced_at", syncedAt, "script", "UTC"],
  ]);
}

function productionRows() {
  const syncedAt = new Date().toISOString();
  return passportKvRows([
    ["product", BITRIX_NAME, SOURCE_MEANINGS, "Песня на заказ"],
    [
      "process_start",
      "После интереса клиента: сначала показать пример, затем собрать вводные и передать Марии на заказ.",
      SOURCE_MEANINGS,
      "",
    ],
    [
      "step_1",
      "Менеджер отправляет клиенту пример готовой песни.",
      SOURCE_MEANINGS,
      "",
    ],
    [
      "step_2",
      "Если формат понравился — уточняет: повод; жанр; мужской/женский вокал; о чём песня и что сказать получателю. Дополнительно по брифу: для кого, имя получателя, события/детали, от чьего имени песня.",
      SOURCE_MEANINGS,
      "",
    ],
    [
      "step_3",
      "Менеджер передаёт ответы Марии; Мария оформляет заказ на создание песни (закупка ≈ 1 € в модели).",
      SOURCE_MEANINGS,
      "",
    ],
    [
      "step_4",
      "Получение готовой композиции (файл/ссылка). Проверка: имя, повод, личные детали, качество звука.",
      SOURCE_MEANINGS,
      "",
    ],
    [
      "step_5",
      "Выдача клиенту для вручения: включить на празднике, отправить лично или дополнить основной подарок Retro Pressa. Сохранить файл в сделке Bitrix.",
      SOURCE_MEANINGS,
      "",
    ],
    [
      "note",
      "Жанры: поп, рэп, диско 90-х, рок, шансон, классика, клубный, инди, народная, акустика или свой вариант клиента.",
      SOURCE_MEANINGS,
      "",
    ],
    [
      "status_note",
      "Типовой срок изготовления и канал выдачи файла — сверить с Марией/подрядчиком перед жёстким обещанием клиенту.",
      SOURCE_MEANINGS,
      "",
    ],
    ["synced_at", syncedAt, "script", "UTC"],
  ]);
}

async function main() {
  const sa = readGoogleServiceAccount();
  if (!sa) throw new Error("Service account not configured");

  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");

  try {
    await sheetsApi(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=properties.title`,
    );
  } catch (e) {
    console.error(`NO ACCESS to passport. Share Editor with: ${sa.email}`);
    console.error(`Sheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  }

  await ensureTabs(token, ["Смыслы", "Экономика", "Производство"]);

  const tabs: Array<[string, Array<Array<string | number>>]> = [
    ["Смыслы", meaningsRows()],
    ["Экономика", economyRows()],
    ["Производство", productionRows()],
  ];

  for (const [tab, rows] of tabs) {
    console.log(`→ writing ${tab} (${rows.length - 1} fields)`);
    await writeSheetValues({
      spreadsheetId: SPREADSHEET_ID,
      range: quote(tab, "A1"),
      clearRange: quote(tab, "A1:Z300"),
      rows,
    });
  }

  console.log(`\nDone: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
