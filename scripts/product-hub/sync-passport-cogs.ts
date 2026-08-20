/**
 * COGS master (editable) → passport «Экономика».
 *
 * Source workbook: RP | Управление
 *   https://docs.google.com/spreadsheets/d/1qyINXMJVZoJiidEYXyoeRvjUIF9p8Te0sSkYlAKWdAU/
 *
 * - Tab «Себестоимость по продуктам» — редактируемый источник правды (сводка + статьи).
 * - Seed from «Маржинальность» on first create / --seed.
 * - Sync totals + line items into each product passport Экономика.
 *
 * Usage:
 *   npm run product-hub:sync-passport-cogs
 *   npm run product-hub:sync-passport-cogs -- --seed
 *   npm run product-hub:sync-passport-cogs -- --seed-only
 *   npm run product-hub:sync-passport-cogs -- --product=PRODUCT_LIFE_BOOK
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

const COGS_SHEET_ID = "1qyINXMJVZoJiidEYXyoeRvjUIF9p8Te0sSkYlAKWdAU";
const COGS_SHEET_URL = `https://docs.google.com/spreadsheets/d/${COGS_SHEET_ID}/edit`;
const MASTER_TAB = "Себестоимость по продуктам";
const SOURCE_TAB = "Маржинальность";
const SOURCE = `RP | Управление · ${SOURCE_TAB}`;

type CostLine = { article: string; amountEur: number; note?: string };

type ProductCogs = {
  productId: string;
  bitrixName: string;
  sourceTitle: string;
  retailPrice: number | null;
  cogsTotal: number | null;
  marginPct: number | null;
  lines: CostLine[];
  notes: string[];
};

/** Seed snapshot from «Маржинальность» (gid=0), 2026-07-29 read. */
const SEED: ProductCogs[] = [
  {
    productId: "PRODUCT_ORIGINAL",
    bitrixName: "Оригинал",
    sourceTitle: "Оригинальная газета / журнал",
    retailPrice: 40,
    cogsTotal: 8,
    marginPct: 80,
    lines: [
      { article: "Закупка газеты", amountEur: 5 },
      { article: "Уп. конверт", amountEur: 2 },
      { article: "Транс. конверт", amountEur: 1 },
      { article: "Стоимость счета", amountEur: 10, note: "В исходнике отдельно от COGS €8 — не суммировать в COGS без решения финансов" },
    ],
    notes: [
      "В исходнике retail «Стоимость» = €40 (модельная), Mint даёт диапазон 25–51 €.",
      "COGS в таблице = €8 (сумма закупка+конверты). «Стоимость счета» €10 — отдельная строка.",
    ],
  },
  {
    productId: "PRODUCT_PERSONAL_MAGAZINE",
    bitrixName: "Персонализированный журнал",
    sourceTitle: "Персонализированный журнал",
    retailPrice: 240,
    cogsTotal: 33,
    marginPct: 86.25,
    lines: [
      { article: "Макетировщик/стр", amountEur: 5, note: "В модели маржинальности в COGS входит €5 (не 5×16). Тариф/стр уточнять отдельно." },
      { article: "Печать", amountEur: 25 },
      { article: "Уп. конверт", amountEur: 2 },
      { article: "Транс. конверт", amountEur: 1 },
    ],
    notes: ["База 16 стр. / retail 240 € совпадает с Mint."],
  },
  {
    productId: "PRODUCT_CONGRATS_NEWSPAPER",
    bitrixName: "Поздравительная газета",
    sourceTitle: "Поздравительная газета",
    retailPrice: 67,
    cogsTotal: 24,
    marginPct: 64.18,
    lines: [
      { article: "Закупка газеты", amountEur: 8 },
      { article: "Оплата макетировщику", amountEur: 10 },
      { article: "Печать", amountEur: 3 },
      { article: "Уп. конверт", amountEur: 2 },
      { article: "Транс. конверт", amountEur: 1 },
    ],
    notes: ["Mint сводка retail ~72 € — сверить с моделью €67."],
  },
  {
    productId: "PRODUCT_REPRODUCTION",
    bitrixName: "Репродукция",
    sourceTitle: "Репродукция",
    retailPrice: 45,
    cogsTotal: 19,
    marginPct: 57.78,
    lines: [
      { article: "Закупка газеты", amountEur: 8 },
      { article: "Оплата макетировщику", amountEur: 5 },
      { article: "Печать", amountEur: 3 },
      { article: "Уп. конверт", amountEur: 2 },
      { article: "Транс. конверт", amountEur: 1 },
    ],
    notes: ["Газетная репродукция. Для журнальной см. блок «Репродукция журнала» → паспорт поздравительного журнала."],
  },
  {
    productId: "PRODUCT_CONGRATS_MAGAZINE",
    bitrixName: "Поздравительный журнал",
    sourceTitle: "Репродукция журнала",
    retailPrice: 135,
    cogsTotal: 56,
    marginPct: 58.52,
    lines: [
      { article: "Закупка газеты", amountEur: 8 },
      { article: "Оплата макетировщику", amountEur: 25 },
      { article: "Печать", amountEur: 20 },
      { article: "Уп. конверт", amountEur: 2 },
      { article: "Транс. конверт", amountEur: 1 },
    ],
    notes: [
      "В исходнике блок назван «Репродукция журнала», retail 135 € = якорь поздравительного журнала (Mint).",
      "Если появится отдельная «чистая» репродукция журнала — развести в две строки product_id.",
    ],
  },
  {
    productId: "PRODUCT_PERSONAL_NEWSPAPER",
    bitrixName: "Персонализированная газета",
    sourceTitle: "Персонализированная газета",
    retailPrice: 55,
    cogsTotal: 14,
    marginPct: 74.55,
    lines: [
      { article: "Макетировщик/стр", amountEur: 10, note: "Как в модели: в COGS входит 10 €" },
      { article: "Печать", amountEur: 1 },
      { article: "Уп. конверт", amountEur: 2 },
      { article: "Транс. конверт", amountEur: 1 },
    ],
    notes: ["Модель retail 55 € (часто 4/8 стр.). Актуальный тариф семейного формата — TBD Mint/Анна."],
  },
  {
    productId: "PRODUCT_ANIMATE",
    bitrixName: "Оживи",
    sourceTitle: "Оживи (факт ops)",
    retailPrice: 4,
    cogsTotal: 0.005,
    marginPct: 99.88,
    lines: [{ article: "Себестоимость 1 шт", amountEur: 0.005, note: "0,5 евроцента за одну" }],
    notes: [
      "Факт: продаём 4 € / штука. COGS 0,5 евроцента (€0,005) за одну.",
      "Старая модель «Оживи Ролик» (retail 30 / COGS 10,5) больше не использовать как актуальный якорь.",
    ],
  },
  {
    productId: "PRODUCT_LIFE_BOOK",
    bitrixName: "Книга жизни",
    sourceTitle: "Книга в заголовках газет",
    retailPrice: 240,
    cogsTotal: 73,
    marginPct: 69.58,
    lines: [
      { article: "Макетировщик/стр", amountEur: 40, note: "В модели в COGS входит 40 €" },
      { article: "Печать", amountEur: 30 },
      { article: "Уп. конверт", amountEur: 2 },
      { article: "Транс. конверт", amountEur: 1 },
    ],
    notes: [
      "С 2026-08-20 retail 240 € (Рига: новая технология печати и переплёта — качество выше, цена выше).",
      "Себестоимость печати/переплёта могла вырасти — уточнить (не выдумывать); маржа посчитана по прежнему COGS 73 €.",
    ],
  },
  {
    productId: "PRODUCT_CONGRATS_SONG",
    bitrixName: "Поздравительная песня",
    sourceTitle: "Поздравительная песня",
    retailPrice: 20,
    cogsTotal: 1,
    marginPct: 95,
    lines: [{ article: "Закупка песни", amountEur: 1 }],
    notes: ["Из блока маржинальности: COGS €1, retail €20, маржа 95%."],
  },
  {
    productId: "PRODUCT_DIGITAL",
    bitrixName: "Дигитальная версия",
    sourceTitle: "",
    retailPrice: null,
    cogsTotal: null,
    marginPct: null,
    lines: [],
    notes: ["В «Маржинальность» блока нет — заполнить вручную в этой вкладке."],
  },
  {
    productId: "PRODUCT_STICKER",
    bitrixName: "Наклейка",
    sourceTitle: "Наклейка (факт ops)",
    retailPrice: 3.5,
    cogsTotal: 0.2,
    marginPct: 94.29,
    lines: [{ article: "Себестоимость 1 шт", amountEur: 0.2, note: "20 евроцентов" }],
    notes: ["Факт: COGS 20 евроцентов (€0,20). Retail якорь Bitrix 3,5 €."],
  },
  {
    productId: "PRODUCT_FAMILY_EDITION",
    bitrixName: "Семейное издание",
    sourceTitle: "",
    retailPrice: null,
    cogsTotal: null,
    marginPct: null,
    lines: [],
    notes: ["В «Маржинальность» блока нет; тариф TBD (Mint/Анна)."],
  },
];

function quote(title: string, a1: string) {
  return `'${title.replace(/'/g, "''")}'!${a1}`;
}

function parseMoney(raw: string): number | null {
  const t = String(raw || "")
    .replace(/\u00a0/g, " ")
    .replace(/€/g, "")
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

async function ensureMasterTab(token: string): Promise<{ title: string; sheetId: number; created: boolean }> {
  const meta = await sheetsApi<{
    sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
  }>(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${COGS_SHEET_ID}?fields=sheets.properties(sheetId,title)`,
  );
  const existing = (meta.sheets || []).find((s) => (s.properties?.title || "").trim() === MASTER_TAB);
  if (existing?.properties?.sheetId != null) {
    return { title: MASTER_TAB, sheetId: existing.properties.sheetId, created: false };
  }

  await sheetsApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${COGS_SHEET_ID}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: MASTER_TAB,
              index: 0,
              gridProperties: { rowCount: 200, columnCount: 12 },
            },
          },
        },
      ],
    }),
  });

  const meta2 = await sheetsApi<{
    sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
  }>(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${COGS_SHEET_ID}?fields=sheets.properties(sheetId,title)`,
  );
  const created = (meta2.sheets || []).find((s) => (s.properties?.title || "").trim() === MASTER_TAB);
  if (!created?.properties?.sheetId) throw new Error(`Failed to create ${MASTER_TAB}`);
  return { title: MASTER_TAB, sheetId: created.properties.sheetId, created: true };
}

function buildMasterRows(products: ProductCogs[]): Array<Array<string | number>> {
  const syncedAt = new Date().toISOString();
  const rows: Array<Array<string | number>> = [
    [
      "КАК ПОЛЬЗОВАТЬСЯ",
      "Редактируйте колонки Retail / COGS / Маржа и строки «статья». Не трогайте product_id. После правок: npm run product-hub:sync-passport-cogs",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    [
      "Источник сырых блоков",
      `${COGS_SHEET_URL}#gid=0`,
      `вкладка «${SOURCE_TAB}»`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    [],
    [
      "СВОДКА (смотреть регулярно)",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    [
      "product_id",
      "Продукт (Bitrix)",
      "Название в Маржинальности",
      "Retail €",
      "COGS €",
      "Маржа %",
      "Сумма статей €",
      "Расхождение статей vs COGS",
      "Примечание",
      "Источник",
      "Обновлено",
    ],
  ];

  for (const p of products) {
    const linesSum = p.lines
      .filter((l) => !/стоимость счета/i.test(l.article))
      .reduce((a, l) => a + l.amountEur, 0);
    const delta =
      p.cogsTotal == null ? "" : Math.round((linesSum - p.cogsTotal) * 100) / 100;
    rows.push([
      p.productId,
      p.bitrixName,
      p.sourceTitle || "—",
      p.retailPrice ?? "",
      p.cogsTotal ?? "",
      p.marginPct ?? "",
      Math.round(linesSum * 100) / 100,
      delta === "" ? "" : delta,
      p.notes.join(" "),
      SOURCE,
      syncedAt,
    ]);
  }

  rows.push([]);
  rows.push([
    "СТАТЬИ ЗАТРАТ (редактировать суммы)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  rows.push([
    "product_id",
    "Продукт (Bitrix)",
    "Статья затрат",
    "Сумма €",
    "Примечание к статье",
    "Источник",
    "Обновлено",
    "",
    "",
    "",
    "",
  ]);

  for (const p of products) {
    if (!p.lines.length) {
      rows.push([
        p.productId,
        p.bitrixName,
        "(нет статей — добавьте строку с тем же product_id)",
        "",
        p.notes[0] || "",
        SOURCE,
        syncedAt,
        "",
        "",
        "",
        "",
      ]);
      continue;
    }
    for (const line of p.lines) {
      rows.push([
        p.productId,
        p.bitrixName,
        line.article,
        line.amountEur,
        line.note || "",
        SOURCE,
        syncedAt,
        "",
        "",
        "",
        "",
      ]);
    }
  }

  return rows;
}

function readMasterFromSheet(values: string[][]): ProductCogs[] {
  const byId = new Map<string, ProductCogs>();

  // Find summary header
  let summaryHeader = -1;
  let linesHeader = -1;
  for (let i = 0; i < values.length; i++) {
    const a = String(values[i]?.[0] || "");
    const b = String(values[i]?.[1] || "");
    if (a === "product_id" && b.startsWith("Продукт") && String(values[i]?.[3] || "").includes("Retail")) {
      summaryHeader = i;
    }
    if (a === "product_id" && b.startsWith("Продукт") && String(values[i]?.[2] || "").includes("Статья")) {
      linesHeader = i;
    }
  }

  if (summaryHeader >= 0) {
    for (let i = summaryHeader + 1; i < values.length; i++) {
      const row = values[i] || [];
      const id = String(row[0] || "").trim();
      if (!id) {
        if (String(row[0] || "").includes("СТАТЬИ") || i > summaryHeader + 20) break;
        continue;
      }
      if (!id.startsWith("PRODUCT_")) continue;
      byId.set(id, {
        productId: id,
        bitrixName: String(row[1] || ""),
        sourceTitle: String(row[2] || ""),
        retailPrice: parseMoney(String(row[3] || "")),
        cogsTotal: parseMoney(String(row[4] || "")),
        marginPct: parseMoney(String(row[5] || "")),
        lines: [],
        notes: String(row[8] || "") ? [String(row[8])] : [],
      });
    }
  }

  if (linesHeader >= 0) {
    for (let i = linesHeader + 1; i < values.length; i++) {
      const row = values[i] || [];
      const id = String(row[0] || "").trim();
      if (!id.startsWith("PRODUCT_")) continue;
      const article = String(row[2] || "").trim();
      if (!article || article.startsWith("(нет статей")) continue;
      const amount = parseMoney(String(row[3] || ""));
      if (amount == null) continue;
      const note = String(row[4] || "").trim();
      let p = byId.get(id);
      if (!p) {
        p = {
          productId: id,
          bitrixName: String(row[1] || ""),
          sourceTitle: "",
          retailPrice: null,
          cogsTotal: null,
          marginPct: null,
          lines: [],
          notes: [],
        };
        byId.set(id, p);
      }
      p.lines.push({ article, amountEur: amount, note: note || undefined });
    }
  }

  // Preserve registry order
  const ordered: ProductCogs[] = [];
  for (const entry of PASSPORT_REGISTRY) {
    const hit = byId.get(entry.productId);
    if (hit) {
      if (!hit.bitrixName) hit.bitrixName = entry.bitrixName;
      ordered.push(hit);
      byId.delete(entry.productId);
    }
  }
  for (const rest of byId.values()) ordered.push(rest);
  return ordered;
}

function isCogsCode(code: string) {
  return (
    code === "cost_price" ||
    code === "cogs_total" ||
    code === "cogs_margin_pct" ||
    code === "cogs_retail_model" ||
    code === "cogs_source_title" ||
    code === "cogs_source_url" ||
    code === "cogs_section" ||
    code === "cogs_synced_at" ||
    code === "cogs_note" ||
    code.startsWith("cogs_line_") ||
    code.startsWith("cogs_note_")
  );
}

function cogsPassportRows(p: ProductCogs): Array<Array<string | number>> {
  const syncedAt = new Date().toISOString();
  const rows: Array<Array<string | number>> = [
    passportKvRow("cogs_section", "СЕБЕСТОИМОСТЬ", SOURCE, "Блок из RP | Управление — можно править в мастер-вкладке"),
    passportKvRow("cogs_source_title", p.sourceTitle || "—", SOURCE, "Как блок назван в «Маржинальность»"),
    passportKvRow(
      "cost_price",
      p.cogsTotal ?? "",
      SOURCE,
      p.cogsTotal == null ? "Нет данных — заполните мастер-вкладку" : "Итоговый COGS модели",
    ),
    passportKvRow("cogs_total", p.cogsTotal ?? "", SOURCE, "Дубль cost_price для явного имени"),
    passportKvRow("cogs_retail_model", p.retailPrice ?? "", SOURCE, "Retail из модели маржинальности (не всегда = Mint/Bitrix)"),
    passportKvRow("cogs_margin_pct", p.marginPct ?? "", SOURCE, "Маржа из модели"),
  ];

  p.lines.forEach((line, idx) => {
    rows.push(
      passportKvRow(
        `cogs_line_${idx + 1}`,
        `${line.article}: ${line.amountEur} €`,
        SOURCE,
        line.note || "",
      ),
    );
  });

  p.notes.forEach((note, idx) => {
    rows.push(passportKvRow(idx === 0 ? "cogs_note" : `cogs_note_${idx + 1}`, note, SOURCE, ""));
  });

  rows.push(passportKvRow("cogs_source_url", COGS_SHEET_URL, SOURCE, `Мастер: вкладка «${MASTER_TAB}»`));
  rows.push(passportKvRow("cogs_synced_at", syncedAt, "script", "UTC"));
  return rows;
}

async function syncPassport(entry: PassportRegistryEntry, p: ProductCogs) {
  const tab = entry.economyTabName || "Экономика";
  const existing = await readSheetValues({
    spreadsheetId: entry.spreadsheetId,
    range: quote(tab, "A1:F250"),
  });

  const kept: Array<Array<string | number>> = [];
  for (const row of existing.slice(1)) {
    const code = String(row[0] || "").trim();
    if (!code || code === "Код" || code === "Поле") continue;
    if (isCogsCode(code)) continue;
    if (row.length >= 6) {
      kept.push([0, 1, 2, 3, 4, 5].map((i) => row[i] ?? ""));
    } else {
      kept.push(passportKvRow(code, row[1] ?? "", String(row[3] ?? row[5] ?? ""), String(row[2] ?? row[4] ?? "")));
    }
  }

  // Replace empty legacy cost_price already removed; insert COGS block after retail-ish fields if possible
  const rows: Array<Array<string | number>> = [[...PASSPORT_KV_HEADER], ...kept, ...cogsPassportRows(p)];

  await writeSheetValues({
    spreadsheetId: entry.spreadsheetId,
    range: quote(tab, "A1"),
    clearRange: quote(tab, "A1:Z400"),
    rows,
  });
}

async function main() {
  const sa = readGoogleServiceAccount();
  if (!sa) throw new Error("Service account not configured");

  const seed = process.argv.includes("--seed") || process.argv.includes("--seed-only");
  const seedOnly = process.argv.includes("--seed-only");
  const productArg = process.argv.find((a) => a.startsWith("--product="))?.slice("--product=".length);

  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  const tab = await ensureMasterTab(token);
  console.log(`Master tab «${tab.title}» ${tab.created ? "CREATED" : "exists"}`);

  let products: ProductCogs[] = SEED;

  if (!tab.created && !seed) {
    const values = await readSheetValues({
      spreadsheetId: COGS_SHEET_ID,
      range: quote(MASTER_TAB, "A1:K200"),
    });
    const parsed = readMasterFromSheet(values);
    if (parsed.length) {
      products = parsed;
      console.log(`Read ${parsed.length} products from editable master tab`);
    } else {
      console.log("Master empty/unreadable — falling back to seed snapshot");
    }
  }

  if (tab.created || seed) {
    console.log("Writing editable master from seed (Маржинальность snapshot)…");
    await writeSheetValues({
      spreadsheetId: COGS_SHEET_ID,
      range: quote(MASTER_TAB, "A1"),
      clearRange: quote(MASTER_TAB, "A1:Z300"),
      rows: buildMasterRows(SEED),
    });
    products = SEED;
    console.log(`Master URL: ${COGS_SHEET_URL}`);
  }

  if (seedOnly) {
    console.log("seed-only: skip passports");
    return;
  }

  const list = productArg ? products.filter((p) => p.productId === productArg) : products;
  let ok = 0;
  let skipped = 0;

  for (const p of list) {
    const entry = findPassportByProductId(p.productId);
    if (!entry) {
      console.warn(`No passport for ${p.productId}`);
      skipped += 1;
      continue;
    }
    console.log(`\n→ COGS → Экономика: ${entry.bitrixName} (COGS=${p.cogsTotal ?? "—"})`);
    try {
      await syncPassport(entry, p);
      console.log("  OK");
      ok += 1;
    } catch (e) {
      console.error(`  FAIL: ${e instanceof Error ? e.message : e}`);
      skipped += 1;
    }
    await sleep(2500);
  }

  console.log(`\nDone. ok=${ok} skipped=${skipped}`);
  console.log(`Edit regularly: ${COGS_SHEET_URL} → «${MASTER_TAB}»`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
