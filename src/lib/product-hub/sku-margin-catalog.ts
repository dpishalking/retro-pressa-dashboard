/**
 * Product Hub margin catalog from Bitrix gift-types workbook:
 * https://docs.google.com/spreadsheets/d/1NsVbsv2YZbehiYTtSP1Waf0gYf1nCnocszonQyppKAE
 * Tabs: 00_INDEX (gid=1186454014) + SKU_MAP.
 */

import { readSheetValues } from "@/lib/google/sheets-client";
import type { BitrixSnapshotDeal, BitrixSnapshotProductRow } from "@/lib/bitrix/snapshot-store";

export const PRODUCT_HUB_SPREADSHEET_ID_DEFAULT = "1NsVbsv2YZbehiYTtSP1Waf0gYf1nCnocszonQyppKAE";
export const PRODUCT_HUB_INDEX_TAB = "00_INDEX";
export const PRODUCT_HUB_SKU_MAP_TAB = "SKU_MAP";

export function getProductHubSpreadsheetId(): string {
  return (
    process.env.BITRIX_GIFT_TYPES_SHEET_ID?.trim() ||
    process.env.PRODUCT_HUB_SPREADSHEET_ID?.trim() ||
    PRODUCT_HUB_SPREADSHEET_ID_DEFAULT
  );
}

export type SkuCogsEntry = {
  bitrixProductId: string | null;
  productId: string | null;
  giftType: string | null;
  name: string;
  cogsEur: number | null;
  retailModelEur: number | null;
  source: "sku_map" | "index";
};

export type ProductHubMarginCatalog = {
  spreadsheetId: string;
  loadedAt: string;
  byBitrixId: Map<string, SkuCogsEntry>;
  byProductId: Map<string, SkuCogsEntry>;
  byGiftType: Map<string, SkuCogsEntry>;
  indexRows: number;
  skuRows: number;
};

export type DealMarginBreakdown = {
  dealId: string;
  revenue: number;
  cogs: number | null;
  grossProfit: number | null;
  marginRate: number | null;
  mappedLines: number;
  totalLines: number;
  coverage: "full" | "partial" | "none";
};

export type MarginAggregate = {
  /** All paid revenue in the filtered set. */
  revenue: number;
  /** Revenue of deals that received at least one COGS mapping. */
  mappedRevenue: number;
  cogs: number | null;
  /** Gross profit on mapped deals only (mappedRevenue − cogs). */
  grossProfit: number | null;
  marginRate: number | null;
  dealsTotal: number;
  dealsWithProducts: number;
  dealsFullyMapped: number;
  dealsPartiallyMapped: number;
  lineCoverage: number;
  source: string;
};

function normalizeKey(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[«»"']/g, "")
    .trim();
}

export function parseMoneyCell(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text || /^tbd$/i.test(text) || text.startsWith("#")) return null;
  // Prefer first number in ranges like "15–51 €" / "от 135 €" / "0,005"
  const match = text.replace(/\u00a0/g, " ").match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const n = Number(match[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function headerIndex(header: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  header.forEach((cell, index) => {
    out[normalizeKey(cell)] = index;
  });
  return out;
}

function col(row: string[], idx: Record<string, number>, ...names: string[]): string {
  for (const name of names) {
    const i = idx[normalizeKey(name)];
    if (i != null && row[i] != null && String(row[i]).trim()) return String(row[i]).trim();
  }
  return "";
}

export function parseSkuMapRows(values: string[][]): SkuCogsEntry[] {
  if (!values.length) return [];
  const idx = headerIndex(values[0] || []);
  const out: SkuCogsEntry[] = [];
  for (const row of values.slice(1)) {
    const bitrixProductId = col(row, idx, "bitrix_product_id");
    const cogsEur = parseMoneyCell(col(row, idx, "cogs_eur"));
    const productId = col(row, idx, "product_id") || null;
    const giftType = col(row, idx, "bitrix_gift_type") || null;
    const name = col(row, idx, "bitrix_product_name") || giftType || productId || bitrixProductId;
    if (!bitrixProductId && !productId && !giftType) continue;
    out.push({
      bitrixProductId: bitrixProductId || null,
      productId,
      giftType,
      name,
      cogsEur,
      retailModelEur: parseMoneyCell(col(row, idx, "retail_model_eur", "bitrix_price")),
      source: "sku_map"
    });
  }
  return out;
}

/** Parse mini-passport index table starting at header row with PRODUCT_ID. */
export function parseIndexRows(values: string[][]): SkuCogsEntry[] {
  let headerRow = -1;
  for (let r = 0; r < values.length; r += 1) {
    const joined = values[r].map((c) => normalizeKey(String(c || ""))).join("|");
    if (joined.includes("product_id") || joined.includes("тип bitrix")) {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) return [];
  const idx = headerIndex(values[headerRow] || []);
  const out: SkuCogsEntry[] = [];
  for (const row of values.slice(headerRow + 1)) {
    const productId = col(row, idx, "PRODUCT_ID", "product_id");
    const giftType = col(row, idx, "Тип Bitrix", "bitrix_gift_type");
    if (!productId && !giftType) continue;
    out.push({
      bitrixProductId: null,
      productId: productId || null,
      giftType: giftType || null,
      name: giftType || productId,
      cogsEur: parseMoneyCell(col(row, idx, "COGS", "cogs")),
      retailModelEur: parseMoneyCell(col(row, idx, "Цена витрина", "retail")),
      source: "index"
    });
  }
  return out;
}

export function buildMarginCatalog(input: {
  spreadsheetId: string;
  skuMap: string[][];
  index: string[][];
  loadedAt?: string;
}): ProductHubMarginCatalog {
  const byBitrixId = new Map<string, SkuCogsEntry>();
  const byProductId = new Map<string, SkuCogsEntry>();
  const byGiftType = new Map<string, SkuCogsEntry>();

  const skuEntries = parseSkuMapRows(input.skuMap);
  const indexEntries = parseIndexRows(input.index);

  for (const entry of indexEntries) {
    if (entry.productId) byProductId.set(entry.productId, entry);
    if (entry.giftType) byGiftType.set(normalizeKey(entry.giftType), entry);
  }
  for (const entry of skuEntries) {
    if (entry.bitrixProductId) byBitrixId.set(entry.bitrixProductId, entry);
    if (entry.productId && entry.cogsEur != null) byProductId.set(entry.productId, entry);
    if (entry.giftType && entry.cogsEur != null) byGiftType.set(normalizeKey(entry.giftType), entry);
  }

  return {
    spreadsheetId: input.spreadsheetId,
    loadedAt: input.loadedAt || new Date().toISOString(),
    byBitrixId,
    byProductId,
    byGiftType,
    indexRows: indexEntries.length,
    skuRows: skuEntries.length
  };
}

function inferProductIdFromName(name: string): string | null {
  const n = normalizeKey(name);
  if (!n) return null;
  if (n.includes("песн") || n.includes("song")) return "PRODUCT_CONGRATS_SONG";
  if (n.includes("наклей") || n.includes("sticker")) return "PRODUCT_STICKER";
  if (n.includes("оживи") || n.includes("animat")) return "PRODUCT_ANIMATE";
  if (n.includes("книг") || n.includes("life book")) return "PRODUCT_LIFE_BOOK";
  if (n.includes("семейн") || n.includes("family")) return "PRODUCT_FAMILY_EDITION";
  if (n.includes("дигитал") || n.includes("digital")) return "PRODUCT_DIGITAL";
  if (n.includes("персонализ") && n.includes("журнал")) return "PRODUCT_PERSONAL_MAGAZINE";
  if (n.includes("персонализ") && (n.includes("газет") || n.includes("avīz") || n.includes("aviz"))) {
    return "PRODUCT_PERSONAL_NEWSPAPER";
  }
  if ((n.includes("поздр") || n.includes("apsveikuma") || n.includes("congrat")) && n.includes("журнал")) {
    return "PRODUCT_CONGRATS_MAGAZINE";
  }
  if (
    (n.includes("поздр") || n.includes("apsveikuma") || n.includes("congrat")) &&
    (n.includes("газет") || n.includes("avīz") || n.includes("aviz") || n.includes("newspaper"))
  ) {
    return "PRODUCT_CONGRATS_NEWSPAPER";
  }
  if (n.includes("репродук") || n.includes("reproduk") || n.includes("reproduction")) return "PRODUCT_REPRODUCTION";
  if (n.includes("оригинал") || n.includes("original")) return "PRODUCT_ORIGINAL";
  return null;
}

export function resolveLineCogs(
  line: BitrixSnapshotProductRow,
  catalog: ProductHubMarginCatalog
): { cogsUnit: number | null; entry: SkuCogsEntry | null } {
  const byId = line.productId ? catalog.byBitrixId.get(line.productId) : null;
  if (byId?.cogsEur != null) return { cogsUnit: byId.cogsEur, entry: byId };

  const inferredId = inferProductIdFromName(line.productName);
  if (inferredId) {
    const byProduct = catalog.byProductId.get(inferredId);
    if (byProduct?.cogsEur != null) return { cogsUnit: byProduct.cogsEur, entry: byProduct };
  }

  const byNameGift = catalog.byGiftType.get(normalizeKey(line.productName));
  if (byNameGift?.cogsEur != null) return { cogsUnit: byNameGift.cogsEur, entry: byNameGift };

  return { cogsUnit: null, entry: byId || null };
}

/** Product cash for margin: opportunity minus delivery UF when present. */
export function dealProductRevenue(deal: BitrixSnapshotDeal): number {
  const opportunity = Number(deal.opportunity) || 0;
  const delivery = deal.deliveryPrice == null ? 0 : Number(deal.deliveryPrice) || 0;
  return Math.max(0, opportunity - delivery);
}

export function computeDealMargin(deal: BitrixSnapshotDeal, catalog: ProductHubMarginCatalog): DealMarginBreakdown {
  const revenue = dealProductRevenue(deal);
  const lines = deal.products || [];
  if (!lines.length) {
    return {
      dealId: deal.id,
      revenue,
      cogs: null,
      grossProfit: null,
      marginRate: null,
      mappedLines: 0,
      totalLines: 0,
      coverage: "none"
    };
  }

  let cogs = 0;
  let mappedLines = 0;
  for (const line of lines) {
    const qty = Number(line.quantity) > 0 ? Number(line.quantity) : 1;
    const { cogsUnit } = resolveLineCogs(line, catalog);
    if (cogsUnit == null) continue;
    cogs += cogsUnit * qty;
    mappedLines += 1;
  }

  if (mappedLines === 0) {
    return {
      dealId: deal.id,
      revenue,
      cogs: null,
      grossProfit: null,
      marginRate: null,
      mappedLines: 0,
      totalLines: lines.length,
      coverage: "none"
    };
  }

  const coverage = mappedLines === lines.length ? "full" : "partial";
  const grossProfit = revenue - cogs;
  return {
    dealId: deal.id,
    revenue,
    cogs,
    grossProfit,
    marginRate: revenue > 0 ? grossProfit / revenue : null,
    mappedLines,
    totalLines: lines.length,
    coverage
  };
}

export function aggregateMargins(paidDeals: BitrixSnapshotDeal[], catalog: ProductHubMarginCatalog): MarginAggregate {
  let revenue = 0;
  let mappedRevenue = 0;
  let cogs = 0;
  let cogsDeals = 0;
  let dealsWithProducts = 0;
  let dealsFullyMapped = 0;
  let dealsPartiallyMapped = 0;
  let mappedLines = 0;
  let totalLines = 0;

  for (const deal of paidDeals) {
    revenue += dealProductRevenue(deal);
    const row = computeDealMargin(deal, catalog);
    totalLines += row.totalLines;
    mappedLines += row.mappedLines;
    if (row.totalLines > 0) dealsWithProducts += 1;
    if (row.coverage === "full") dealsFullyMapped += 1;
    if (row.coverage === "partial") dealsPartiallyMapped += 1;
    if (row.cogs != null) {
      cogs += row.cogs;
      mappedRevenue += row.revenue;
      cogsDeals += 1;
    }
  }

  const hasCogs = cogsDeals > 0;
  const grossProfit = hasCogs ? mappedRevenue - cogs : null;
  return {
    revenue,
    mappedRevenue,
    cogs: hasCogs ? cogs : null,
    grossProfit,
    marginRate: hasCogs && mappedRevenue > 0 ? (mappedRevenue - cogs) / mappedRevenue : null,
    dealsTotal: paidDeals.length,
    dealsWithProducts,
    dealsFullyMapped,
    dealsPartiallyMapped,
    lineCoverage: totalLines > 0 ? mappedLines / totalLines : 0,
    source: `Product Hub SKU_MAP + 00_INDEX (${catalog.spreadsheetId.slice(0, 8)}…)`
  };
}

export function aggregateProductMargins(
  paidDeals: BitrixSnapshotDeal[],
  catalog: ProductHubMarginCatalog
): Map<string, { cogs: number; revenue: number; orders: number; mapped: boolean }> {
  const out = new Map<string, { cogs: number; revenue: number; orders: number; mapped: boolean }>();
  for (const deal of paidDeals) {
    const lines = deal.products || [];
    if (!lines.length) continue;
    const primary = lines.find((p) => p.productId || p.productName) || lines[0];
    const key = primary.productId || primary.productName || "unknown";
    const row = out.get(key) || { cogs: 0, revenue: 0, orders: 0, mapped: false };
    row.orders += 1;
    row.revenue += dealProductRevenue(deal);
    const margin = computeDealMargin(deal, catalog);
    if (margin.cogs != null) {
      row.cogs += margin.cogs;
      row.mapped = true;
    }
    out.set(key, row);
  }
  return out;
}

let cachedCatalog: { key: string; at: number; value: ProductHubMarginCatalog } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function loadProductHubMarginCatalog(options?: {
  spreadsheetId?: string;
  forceRefresh?: boolean;
}): Promise<ProductHubMarginCatalog> {
  const spreadsheetId = options?.spreadsheetId || getProductHubSpreadsheetId();
  const now = Date.now();
  if (!options?.forceRefresh && cachedCatalog && cachedCatalog.key === spreadsheetId && now - cachedCatalog.at < CACHE_MS) {
    return cachedCatalog.value;
  }

  const quote = (t: string) => `'${t.replace(/'/g, "''")}'`;
  const [skuMap, index] = await Promise.all([
    readSheetValues({ spreadsheetId, range: `${quote(PRODUCT_HUB_SKU_MAP_TAB)}!A1:P500` }),
    readSheetValues({ spreadsheetId, range: `${quote(PRODUCT_HUB_INDEX_TAB)}!A1:J80` })
  ]);

  const value = buildMarginCatalog({
    spreadsheetId,
    skuMap,
    index,
    loadedAt: new Date().toISOString()
  });
  cachedCatalog = { key: spreadsheetId, at: now, value };
  return value;
}
