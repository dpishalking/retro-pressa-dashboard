/**
 * Snapshot passport «Смыслы» + «Экономика» into dashboard JSON for /products tab.
 *
 * Usage:
 *   npm run product-hub:sync-passport-dashboard
 */

import fs from "node:fs";
import path from "node:path";
import { getGoogleAccessToken, readGoogleServiceAccount } from "../../src/lib/google/sheets-client";
import { PASSPORT_REGISTRY } from "./passport-registry";

const OUT_DIR = path.join(process.cwd(), "data/product-passports");
const OUT_FILE = path.join(OUT_DIR, "dashboard.json");

const MEANING_FIELDS = [
  "what_it_is",
  "for_whom",
  "client_pain",
  "key_idea",
  "why_now",
  "how_it_works",
  "benefits",
  "when_to_offer",
  "pitch_short",
  "pitch_one_paragraph",
  "role_in_line",
  "compare_with",
  "genres",
  "client_questions",
] as const;

const ECONOMY_FIELDS = [
  "retail_price",
  "currency",
  "cost_price",
  "cogs_total",
  "cogs_margin_pct",
  "cogs_retail_model",
] as const;

function quote(title: string, a1: string) {
  return `'${title.replace(/'/g, "''")}'!${a1}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseFieldMap(rows: string[][]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows.slice(1)) {
    const code = String(row[0] || "").trim();
    if (!code || code === "Код" || code === "Поле") continue;
    // Labeled format: code | label | why | content
    // Legacy: code | value
    const content =
      row.length >= 4 && String(row[2] || "").length > 15
        ? String(row[3] ?? "")
        : String(row[1] ?? "");
    if (!map[code] && content.trim()) map[code] = content.trim();
  }
  return map;
}

async function readTab(token: string, spreadsheetId: string, tab: string): Promise<string[][]> {
  const range = encodeURIComponent(quote(tab, "A1:F120"));
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers: { authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  const data = (await res.json()) as { values?: string[][]; error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || String(res.status));
  return data.values || [];
}

async function main() {
  const sa = readGoogleServiceAccount();
  if (!sa) throw new Error("Service account not configured");

  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  const products: Array<Record<string, unknown>> = [];

  for (const entry of PASSPORT_REGISTRY) {
    console.log(`→ ${entry.bitrixName}`);
    try {
      const meanings = parseFieldMap(await readTab(token, entry.spreadsheetId, "Смыслы"));
      await sleep(400);
      const economy = parseFieldMap(
        await readTab(token, entry.spreadsheetId, entry.economyTabName || "Экономика"),
      );

      const pick = (map: Record<string, string>, keys: readonly string[]) => {
        const out: Record<string, string> = {};
        for (const k of keys) {
          if (map[k]) out[k] = map[k];
        }
        return out;
      };

      products.push({
        productId: entry.productId,
        bitrixName: entry.bitrixName,
        spreadsheetId: entry.spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${entry.spreadsheetId}/edit`,
        meanings: pick(meanings, MEANING_FIELDS),
        economy: pick(economy, ECONOMY_FIELDS),
      });
      console.log("  OK");
    } catch (e) {
      console.error(`  FAIL: ${e instanceof Error ? e.message : e}`);
      products.push({
        productId: entry.productId,
        bitrixName: entry.bitrixName,
        spreadsheetId: entry.spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${entry.spreadsheetId}/edit`,
        meanings: {},
        economy: {},
        error: e instanceof Error ? e.message : String(e),
      });
    }
    await sleep(800);
  }

  const payload = {
    syncedAt: new Date().toISOString(),
    source: "product-hub passports (Смыслы + Экономика)",
    productCount: products.length,
    products,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), "utf8");
  console.log(`\nWrote ${OUT_FILE} (${products.length} products)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
