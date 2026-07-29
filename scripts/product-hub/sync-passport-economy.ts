/**
 * For all product passports:
 * 1) Rename «Стоимость» → «Экономика»
 * 2) Write Bitrix retail_price as ONE line when a catalog match exists (never invent)
 * 3) Leave empty cost fields for manual COGS / margin
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/product-hub/sync-passport-economy.ts
 *   npx tsx --env-file=.env.local scripts/product-hub/sync-passport-economy.ts --product=PRODUCT_LIFE_BOOK
 */

import {
  getGoogleAccessToken,
  readGoogleServiceAccount,
  writeSheetValues,
} from "../../src/lib/google/sheets-client";
import { bitrixListAll } from "../../src/lib/bitrix/rest-client";
import {
  findPassportByProductId,
  PASSPORT_REGISTRY,
  type PassportRegistryEntry,
} from "./passport-registry";

type BitrixProduct = {
  ID?: string;
  NAME?: string;
  PRICE?: string | number;
  CURRENCY_ID?: string;
  ACTIVE?: string;
};

type SheetMeta = {
  properties?: { title?: string };
  sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
  error?: { message?: string };
};

function parseArgs() {
  const product = process.argv.find((a) => a.startsWith("--product="))?.slice("--product=".length);
  return { product };
}

function money(v: string | number | undefined): string | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(n);
}

function normName(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

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

function findBitrixPrice(
  products: BitrixProduct[],
  entry: PassportRegistryEntry,
): { product: BitrixProduct; price: string; currency: string } | null {
  const names = [
    entry.economySource.bitrixProductName,
    ...(entry.economySource.bitrixProductNameFallbacks ?? []),
  ].filter(Boolean) as string[];
  if (!names.length) return null;

  for (const want of names) {
    const hit =
      products.find((p) => normName(p.NAME || "") === normName(want)) ||
      products.find((p) => normName(p.NAME || "") === normName(want.trim()));
    if (!hit) continue;
    const price = money(hit.PRICE);
    if (!price) continue;
    return {
      product: hit,
      price,
      currency: (hit.CURRENCY_ID || "EUR").toUpperCase(),
    };
  }
  return null;
}

function buildEconomyRows(
  entry: PassportRegistryEntry,
  match: { product: BitrixProduct; price: string; currency: string } | null,
): Array<Array<string | number>> {
  const syncedAt = new Date().toISOString();
  const rows: Array<Array<string | number>> = [
    ["Поле", "Значение", "Комментарий", "Источник"],
  ];

  if (match) {
    rows.push(
      [
        "retail_price",
        match.price,
        `Bitrix: «${match.product.NAME}»`,
        `crm.product#${match.product.ID}`,
      ],
      ["currency", match.currency, "Валюта каталога Bitrix", `crm.product#${match.product.ID}`],
      [
        "bitrix_product_id",
        String(match.product.ID || ""),
        "ID позиции в CRM Product Catalog",
        `crm.product#${match.product.ID}`,
      ],
    );
  } else {
    rows.push(
      [
        "retail_price",
        "",
        "В Bitrix нет однозначной цены для этого типа подарка — не выдумываем. Внести вручную после согласования.",
        "",
      ],
      ["currency", "EUR", "По умолчанию EUR (витрина / CRM)", ""],
    );
  }

  rows.push(
    ["cost_price", "", "Себестоимость (COGS) — заполняет финансы/производство", ""],
    ["packaging_cost", "", "Себестоимость упаковки, если отдельно", ""],
    ["delivery_cost", "", "Наша доля доставки / фулфилмента, если несём мы", ""],
    ["minimum_price", "", "Минимальная цена продажи — утверждает РОП/финансы", ""],
    ["partner_price", "", "Партнёрская цена — если есть сетка", ""],
    ["urgent_price", "", "Срочная надбавка — после согласования", ""],
    [
      "contribution_margin",
      "",
      "Считать вручную: retail_price − cost_price − packaging_cost − delivery_cost (и комиссии, если есть)",
      "",
    ],
    [
      "rule",
      "Розницу брать из Bitrix; себестоимость и маржу — только из факта, без выдуманных цифр.",
      entry.bitrixName,
      "",
    ],
    ["synced_at", syncedAt, "UTC timestamp выгрузки retail из Bitrix (если была)", "script"],
  );

  return rows;
}

async function ensureEconomyTab(
  token: string,
  spreadsheetId: string,
  desiredTitle: string,
): Promise<{ title: string; sheetId: number }> {
  const meta = await sheetsApi<SheetMeta>(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
  );

  const sheets = meta.sheets ?? [];
  const byTrim = new Map<string, { title: string; sheetId: number }>();
  for (const s of sheets) {
    const title = s.properties?.title;
    const sheetId = s.properties?.sheetId;
    if (title == null || sheetId == null) continue;
    byTrim.set(title.trim().toLowerCase(), { title, sheetId });
  }

  const economy = byTrim.get(desiredTitle.trim().toLowerCase());
  if (economy) {
    // Normalize trailing spaces etc.
    if (economy.title !== desiredTitle) {
      await sheetsApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({
          requests: [{ updateSheetProperties: { properties: { sheetId: economy.sheetId, title: desiredTitle }, fields: "title" } }],
        }),
      });
      return { title: desiredTitle, sheetId: economy.sheetId };
    }
    return economy;
  }

  const cost =
    byTrim.get("стоимость") ||
    [...byTrim.entries()].find(([k]) => k.includes("стоим") || k.includes("econom") || k.includes("экономи"))?.[1];

  if (cost) {
    await sheetsApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [{ updateSheetProperties: { properties: { sheetId: cost.sheetId, title: desiredTitle }, fields: "title" } }],
      }),
    });
    return { title: desiredTitle, sheetId: cost.sheetId };
  }

  // Create if missing
  await sheetsApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: { title: desiredTitle, gridProperties: { rowCount: 100, columnCount: 10 } },
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
  if (!created?.properties?.sheetId) throw new Error("Failed to create Экономика tab");
  return { title: desiredTitle, sheetId: created.properties.sheetId };
}

async function syncOne(entry: PassportRegistryEntry, products: BitrixProduct[]) {
  const sa = readGoogleServiceAccount();
  if (!sa) throw new Error("Service account not configured");

  console.log(`\n→ ${entry.bitrixName}`);
  console.log(`  sheet: ${entry.spreadsheetId}`);

  let token: string;
  try {
    token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
    await sheetsApi(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${entry.spreadsheetId}?fields=properties.title`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  SKIP (no access): ${msg}`);
    console.error(`  Share Editor with ${sa.email}`);
    return { ok: false as const, reason: "no_access" };
  }

  const tab = await ensureEconomyTab(token, entry.spreadsheetId, entry.economyTabName);
  console.log(`  tab: ${tab.title} (gid ${tab.sheetId})`);

  const match = findBitrixPrice(products, entry);
  if (match) {
    console.log(`  retail: ${match.price} ${match.currency} ← ${match.product.NAME} (#${match.product.ID})`);
  } else {
    console.log(`  retail: (empty — no Bitrix match / ambiguous)`);
  }

  const rows = buildEconomyRows(entry, match);
  await writeSheetValues({
    spreadsheetId: entry.spreadsheetId,
    range: quote(tab.title, "A1"),
    clearRange: quote(tab.title, "A1:Z200"),
    rows,
  });

  console.log(`  wrote ${rows.length} rows`);
  console.log(`  url: https://docs.google.com/spreadsheets/d/${entry.spreadsheetId}/edit#gid=${tab.sheetId}`);
  return { ok: true as const, hasPrice: Boolean(match) };
}

async function main() {
  const { product } = parseArgs();
  const targets = product
    ? ([findPassportByProductId(product)].filter(Boolean) as PassportRegistryEntry[])
    : [...PASSPORT_REGISTRY];
  if (!targets.length) throw new Error(`Unknown product: ${product}`);

  console.log("Loading Bitrix CRM products…");
  const products = await bitrixListAll<BitrixProduct>("crm.product.list", {
    filter: {},
    select: ["ID", "NAME", "PRICE", "CURRENCY_ID", "ACTIVE"],
    order: { ID: "ASC" },
  });
  console.log(`Bitrix products: ${products.length}`);

  let ok = 0;
  let skipped = 0;
  let withPrice = 0;
  for (const entry of targets) {
    const res = await syncOne(entry, products);
    if (res.ok) {
      ok += 1;
      if (res.hasPrice) withPrice += 1;
    } else skipped += 1;
  }

  console.log(`\nDone. ok=${ok} skipped=${skipped} with_bitrix_price=${withPrice}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
