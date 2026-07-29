/**
 * Sync knowledge-base / training visuals into a product passport «Визуал» tab.
 *
 * Usage:
 *   npm run product-hub:sync-passport-visuals -- --product=PRODUCT_LIFE_BOOK
 *   npm run product-hub:sync-passport-visuals -- --sheet=1q2WKgcCCVeomg7KhFWEr68re4ReE3xuak4LusmXyPSU
 */

import fs from "node:fs";
import path from "node:path";
import {
  batchUpdateSheetValues,
  getGoogleAccessToken,
  readGoogleServiceAccount,
  readSheetValues,
} from "../../src/lib/google/sheets-client";
import {
  findPassportByProductId,
  findPassportBySpreadsheetId,
  type PassportRegistryEntry,
  type PassportVisualSource,
  PASSPORT_REGISTRY,
} from "./passport-registry";
import { VISUAL_TABLE_HEADER, VISUAL_TABLE_WHY_ROW } from "./passport-field-labels";

type VisualRow = {
  sourceId: string;
  type: string;
  title: string;
  description: string;
  category: string;
  url: string;
  kbSource: string;
};

function parseArgs() {
  const product = process.argv.find((a) => a.startsWith("--product="))?.slice("--product=".length);
  const sheet = process.argv.find((a) => a.startsWith("--sheet="))?.slice("--sheet=".length);
  const all = process.argv.includes("--all");
  return { product, sheet, all };
}

function appBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return fromEnv || "https://rp-bi.site";
}

function toAbsoluteUrl(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${appBaseUrl()}${raw}`;
  return null;
}

function loadClientMaterials(): Array<{
  id: string;
  title: string;
  description?: string;
  category?: string;
  type: string;
  url: string;
}> {
  const p = path.join(process.cwd(), "data/training/client-materials.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as {
    materials?: Array<{
      id: string;
      title: string;
      description?: string;
      category?: string;
      type: string;
      url: string;
    }>;
  };
  return raw.materials ?? [];
}

function loadTrainingProduct(productId: string): {
  coverImage?: string;
  title: string;
  materials?: Array<{ id: string; type: string; title: string; url?: string; embedUrl?: string; content?: string }>;
} | null {
  const p = path.join(process.cwd(), "data/training/products.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as {
    products?: Array<{
      id: string;
      title: string;
      coverImage?: string;
      materials?: Array<{ id: string; type: string; title: string; url?: string; embedUrl?: string; content?: string }>;
    }>;
  };
  return raw.products?.find((x) => x.id === productId) ?? null;
}

/** Normalize URL for dedupe (same file / same YouTube id = one row). */
function urlDedupeKey(url: string): string {
  const raw = url.trim().replace(/\/$/, "").toLowerCase();
  const yt = raw.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-z0-9_-]+)/i,
  );
  if (yt?.[1]) return `yt:${yt[1].toLowerCase()}`;
  return raw;
}

function sourcePreference(sourceId: string): number {
  // Prefer client-facing materials over training copies of the same file.
  if (sourceId.startsWith("client-material:")) return 30;
  if (sourceId.startsWith("training-cover:")) return 20;
  if (sourceId.startsWith("training-material:")) return 10;
  return 0;
}

function titlePreference(title: string): number {
  const t = title.trim().toLowerCase();
  if (!t) return 0;
  if (t === "фото с сайта retro pressa") return 1;
  if (t === "отзыв клиента") return 2;
  if (t.startsWith("обложка:")) return 3;
  return 5;
}

function collectVisuals(source: PassportVisualSource): VisualRow[] {
  const candidates: VisualRow[] = [];

  const pushCandidate = (row: VisualRow) => {
    const url = toAbsoluteUrl(row.url);
    if (!url) return;
    candidates.push({ ...row, url });
  };

  // Client materials first in candidate list (stable preference on ties).
  const materials = loadClientMaterials();
  for (const mat of materials) {
    const catOk =
      source.clientMaterialCategories?.includes(mat.category || "") ||
      source.clientMaterialIds?.includes(mat.id) ||
      source.clientMaterialIdIncludes?.some((part) => mat.id.includes(part));
    if (!catOk) continue;
    if (mat.type !== "image" && mat.type !== "video") continue;
    pushCandidate({
      sourceId: `client-material:${mat.id}`,
      type: mat.type,
      title: mat.title,
      description: mat.description || "",
      category: mat.category || "",
      url: mat.url,
      kbSource: `training/client-materials.json#${mat.id}`,
    });
  }

  if (source.trainingProductId) {
    const product = loadTrainingProduct(source.trainingProductId);
    if (product?.coverImage) {
      pushCandidate({
        sourceId: `training-cover:${source.trainingProductId}`,
        type: "image",
        title: `Обложка: ${product.title}`,
        description: "Cover image из training/products.json",
        category: "training_cover",
        url: product.coverImage,
        kbSource: `training/products.json#${source.trainingProductId}`,
      });
    }
    for (const mat of product?.materials ?? []) {
      const url = mat.url || mat.embedUrl || "";
      if (!url) continue;
      if (mat.type !== "image" && mat.type !== "video") continue;
      pushCandidate({
        sourceId: `training-material:${mat.id}`,
        type: mat.type,
        title: mat.title,
        description: (mat.content || "").slice(0, 300),
        category: "training_material",
        url,
        kbSource: `training/products.json#${source.trainingProductId}/${mat.id}`,
      });
    }
  }

  // Keep one row per unique URL / YouTube id.
  const bestByUrl = new Map<string, VisualRow>();
  for (const row of candidates) {
    const key = urlDedupeKey(row.url);
    const prev = bestByUrl.get(key);
    if (!prev) {
      bestByUrl.set(key, row);
      continue;
    }
    const score =
      sourcePreference(row.sourceId) * 10 + titlePreference(row.title);
    const prevScore =
      sourcePreference(prev.sourceId) * 10 + titlePreference(prev.title);
    if (score > prevScore) bestByUrl.set(key, row);
  }

  return [...bestByUrl.values()];
}

async function resolveVisualTabTitle(token: string, spreadsheetId: string, preferred: string): Promise<string> {
  const meta = await (
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(title)`,
      { headers: { authorization: `Bearer ${token}` }, cache: "no-store" },
    )
  ).json();
  if (meta.error) throw new Error(meta.error.message || "metadata failed");
  const titles: string[] = (meta.sheets || []).map((s: { properties?: { title?: string } }) => s.properties?.title ?? "");
  const match =
    titles.find((t) => t.trim() === preferred.trim()) ||
    titles.find((t) => t.trim().toLowerCase().includes("визуал"));
  if (!match) throw new Error(`Tab «${preferred}» not found in ${spreadsheetId}`);
  return match;
}

function quote(title: string, a1: string) {
  return `'${title.replace(/'/g, "''")}'!${a1}`;
}

async function syncOne(entry: PassportRegistryEntry) {
  const sa = readGoogleServiceAccount();
  if (!sa) throw new Error("Service account not configured");

  const visuals = collectVisuals(entry.visualSource);
  console.log(`\n→ ${entry.bitrixName} (${entry.productId})`);
  console.log(`  sheet: ${entry.spreadsheetId}`);
  console.log(`  visuals found: ${visuals.length}`);

  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  let tabTitle: string;
  try {
    tabTitle = await resolveVisualTabTitle(token, entry.spreadsheetId, entry.visualTabName);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/permission|403/i.test(msg)) {
      console.error(`  NO ACCESS. Share Editor with ${sa.email}`);
      throw e;
    }
    throw e;
  }
  console.log(`  tab: ${JSON.stringify(tabTitle)}`);

  const syncedAt = new Date().toISOString();
  const header = [...VISUAL_TABLE_HEADER];
  const whyRow = [...VISUAL_TABLE_WHY_ROW];
  const note = [
    [
      "_META",
      "служебное",
      "Автовыгрузка из базы знаний / training",
      "Не редактируйте строки вручную — перезаписываются sync-скриптом. Добавляйте новые визуалы в data/training/client-materials.json (категория продукта) или training/products.json.",
      entry.bitrixName,
      "",
      "scripts/product-hub/sync-passport-visuals.ts",
      syncedAt,
    ],
  ];
  const body = visuals.map((v) => [
    v.sourceId,
    v.type,
    v.title,
    v.description,
    v.category,
    v.url,
    v.kbSource,
    syncedAt,
  ]);

  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${entry.spreadsheetId}/values/${encodeURIComponent(quote(tabTitle, "A1:Z500"))}:clear`;
  const clearRes = await fetch(clearUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: "{}",
  });
  if (!clearRes.ok) throw new Error(`clear failed: ${await clearRes.text()}`);

  await batchUpdateSheetValues({
    spreadsheetId: entry.spreadsheetId,
    data: [{ range: quote(tabTitle, "A1"), values: [header, whyRow, ...note, ...body] }],
    valueInputOption: "USER_ENTERED",
  });

  // Verify
  const back = await readSheetValues({
    spreadsheetId: entry.spreadsheetId,
    range: quote(tabTitle, "A1:H30"),
  });
  console.log(`  written rows (incl header/meta): ${back.length}`);
  console.log(`  url: https://docs.google.com/spreadsheets/d/${entry.spreadsheetId}/edit`);
}

async function main() {
  const { product, sheet, all } = parseArgs();
  let targets: PassportRegistryEntry[] = [];

  if (all) {
    targets = [...PASSPORT_REGISTRY];
  } else if (product) {
    const entry = findPassportByProductId(product);
    if (!entry) throw new Error(`Unknown product in registry: ${product}`);
    targets = [entry];
  } else if (sheet) {
    const entry = findPassportBySpreadsheetId(sheet);
    if (!entry) {
      // ad-hoc: life book sheet passed without registry — still allow if we can bind default life-book source
      throw new Error(
        `Spreadsheet not in passport-registry.ts. Add it there or use --product=PRODUCT_LIFE_BOOK`,
      );
    }
    targets = [entry];
  } else {
    // default: life book as requested
    const entry = findPassportByProductId("PRODUCT_LIFE_BOOK");
    if (!entry) throw new Error("PRODUCT_LIFE_BOOK missing from registry");
    targets = [entry];
  }

  let ok = 0;
  let failed = 0;
  for (const entry of targets) {
    try {
      await syncOne(entry);
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(`  FAILED ${entry.bitrixName}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`\nVisuals done. ok=${ok} failed=${failed}`);
  if (failed && !ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
