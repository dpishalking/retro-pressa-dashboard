/**
 * Push Product Hub bootstrap structure + seed into existing Google Spreadsheet.
 *
 * Modes:
 *   --mode=replace-empty   (default for empty book)
 *   --mode=upsert
 *   --mode=force-replace   (dangerous; must be explicit)
 *
 * Usage:
 *   npm run product-hub:push-to-sheets -- --mode=replace-empty
 */

import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import {
  getGoogleAccessToken,
  readGoogleServiceAccount,
  readSheetValues,
  batchUpdateSheetValues,
} from "../../src/lib/google/sheets-client";
import {
  DICTIONARIES,
  DICTIONARY_COLUMNS,
  EMPTY_DEFAULT_SHEETS,
  EXPECTED_PRODUCT_IDS,
  ID_FIELDS,
  SHEET_FIELDS,
  TARGET_SHEETS,
  type TargetSheet,
} from "./bootstrap-schema";
import { buildCatalogFromTraining, buildReadinessFormulas, type CatalogPayload } from "./seed-catalog";
import { buildBitrixAlignedCatalog, BITRIX_GIFT_TYPES_SHEET_ID, resolveBitrixTypesTabTitle } from "./bitrix-aligned-catalog";

type Mode = "replace-empty" | "upsert" | "force-replace";

const SPREADSHEET_ID =
  process.env.PRODUCT_HUB_SHEET_ID?.trim() ||
  process.env.GOOGLE_SHEET_ID?.trim() ||
  "1IzGys0W7bvsB31tANM-RGFlBcXvOm5dAkf890ygj2wA";

const ROOT = path.resolve(__dirname, "../..");
const XLSX_CANDIDATES = [
  path.join(ROOT, "data/source/Retro_Pressa_Product_Hub_v1.xlsx"),
  path.join(ROOT, "data/source/product-hub-bootstrap.xlsx"),
];

type SheetMeta = { sheetId: number; title: string };

function parseArgs(): { mode: Mode; source: "auto" | "bitrix" | "training" } {
  const raw = process.argv.find((a) => a.startsWith("--mode="))?.slice("--mode=".length) ?? "replace-empty";
  if (raw !== "replace-empty" && raw !== "upsert" && raw !== "force-replace") {
    throw new Error(`Unknown mode: ${raw}`);
  }
  const sourceRaw = process.argv.find((a) => a.startsWith("--source="))?.slice("--source=".length) ?? "auto";
  if (sourceRaw !== "auto" && sourceRaw !== "bitrix" && sourceRaw !== "training") {
    throw new Error(`Unknown source: ${sourceRaw}`);
  }
  return { mode: raw, source: sourceRaw };
}

function quoteRange(sheet: string, a1: string) {
  return `'${sheet.replace(/'/g, "''")}'!${a1}`;
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
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${url} → ${data.error?.message || res.status}`);
  }
  return data;
}

async function getMeta(token: string) {
  return sheetsApi<{
    properties?: { title?: string };
    sheets?: Array<{ properties?: { sheetId?: number; title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }>;
  }>(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=properties.title,sheets.properties(sheetId,title,gridProperties)`,
  );
}

async function batchUpdate(token: string, requests: unknown[]) {
  if (!requests.length) return;
  // Chunk to avoid huge payloads
  const chunkSize = 80;
  for (let i = 0; i < requests.length; i += chunkSize) {
    const chunk = requests.slice(i, i + chunkSize);
    await sheetsApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: chunk }),
    });
  }
}

function isSheetEffectivelyEmpty(values: string[][]): boolean {
  return !values.some((row) => row.some((c) => String(c ?? "").trim() !== ""));
}

async function saveBackup(token: string, meta: Awaited<ReturnType<typeof getMeta>>) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(ROOT, "data/product-hub-backups", stamp);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "spreadsheet-metadata.json"), JSON.stringify(meta, null, 2));

  for (const title of TARGET_SHEETS) {
    const exists = meta.sheets?.some((s) => s.properties?.title === title);
    if (!exists) {
      fs.writeFileSync(path.join(dir, `${title}.json`), JSON.stringify({ missing: true }, null, 2));
      continue;
    }
    try {
      const values = await readSheetValues({
        spreadsheetId: SPREADSHEET_ID,
        range: quoteRange(title, "A1:AZ500"),
      });
      fs.writeFileSync(path.join(dir, `${title}.json`), JSON.stringify({ values }, null, 2));
    } catch {
      fs.writeFileSync(path.join(dir, `${title}.json`), JSON.stringify({ error: "read_failed" }, null, 2));
    }
  }

  // also backup default sheet if present
  for (const s of meta.sheets ?? []) {
    const title = s.properties?.title;
    if (!title || TARGET_SHEETS.includes(title as TargetSheet)) continue;
    try {
      const values = await readSheetValues({
        spreadsheetId: SPREADSHEET_ID,
        range: quoteRange(title, "A1:AZ100"),
      });
      fs.writeFileSync(path.join(dir, `_other_${title}.json`), JSON.stringify({ values }, null, 2));
    } catch {
      /* ignore */
    }
  }

  return dir;
}

async function loadFromXlsx(filePath: string): Promise<CatalogPayload | null> {
  if (!fs.existsSync(filePath)) return null;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheets: CatalogPayload["sheets"] = {};
  for (const name of TARGET_SHEETS) {
    if (name === "08_READINESS") continue;
    const ws = wb.getWorksheet(name);
    if (!ws) continue;
    const matrix: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        while (vals.length < col - 1) vals.push("");
        const v = cell.value;
        if (v == null) vals.push("");
        else if (typeof v === "object" && "text" in v) vals.push(String((v as { text: string }).text));
        else if (typeof v === "object" && "result" in v) vals.push(String((v as { result: unknown }).result ?? ""));
        else vals.push(String(v));
      });
      matrix.push(vals);
    });
    if (!matrix.length) continue;
    const headers = matrix[0]!.map((h) => h.trim());
    const rows = matrix.slice(1).map((r) => {
      while (r.length < headers.length) r.push("");
      return r.slice(0, headers.length) as Array<string | number | null>;
    });
    sheets[name] = { headers, rows };
  }

  // Ensure dictionaries/products exist
  if (!sheets["01_PRODUCTS"]) return null;

  // Filter EXAMPLE rows if present
  for (const key of Object.keys(sheets)) {
    const idField = ID_FIELDS[key];
    if (!idField || !sheets[key]) continue;
    const idx = sheets[key]!.headers.indexOf(idField);
    if (idx < 0) continue;
    sheets[key]!.rows = sheets[key]!.rows.filter((r) => !String(r[idx] ?? "").startsWith("EXAMPLE_"));
  }

  const products = sheets["01_PRODUCTS"]?.rows.length ?? 0;
  return {
    sourceLabel: filePath,
    sheets: {
      ...sheets,
      "08_READINESS": {
        headers: [
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
        ],
        rows: (sheets["01_PRODUCTS"]?.rows ?? []).map((r) => [
          String(r[0] ?? ""),
          String(r[1] ?? ""),
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]),
      },
    },
    counts: {
      products,
      variants: sheets["02_VARIANTS"]?.rows.length ?? 0,
      prices: sheets["03_MARKET_PRICES"]?.rows.length ?? 0,
      productionRules: sheets["04_PRODUCTION_DELIVERY"]?.rows.length ?? 0,
      playbooks: sheets["05_SALES_PLAYBOOK"]?.rows.length ?? 0,
      assets: sheets["06_ASSETS"]?.rows.length ?? 0,
    },
  };
}

async function readBitrixGiftNames(token: string): Promise<string[]> {
  const tabTitle = await resolveBitrixTypesTabTitle(token);
  console.log("Bitrix types tab:", JSON.stringify(tabTitle));
  const values = await readSheetValues({
    spreadsheetId: BITRIX_GIFT_TYPES_SHEET_ID,
    range: `'${tabTitle.replace(/'/g, "''")}'!A1:B50`,
  });
  if (!values.length) return [];
  const headers = values[0]!.map((h) => String(h ?? "").trim().toLowerCase());
  const nameIdx = headers.findIndex((h) => h.includes("название") || h === "name");
  const col = nameIdx >= 0 ? nameIdx : 1;
  return values
    .slice(1)
    .map((r) => String(r[col] ?? "").trim())
    .filter(Boolean);
}

async function resolveCatalog(
  token: string,
  source: "auto" | "bitrix" | "training",
): Promise<CatalogPayload> {
  if (source === "bitrix" || source === "auto") {
    try {
      const names = await readBitrixGiftNames(token);
      if (names.length) {
        console.log("Bitrix gift types:", names.join(" | "));
        return buildBitrixAlignedCatalog(names);
      }
      if (source === "bitrix") throw new Error("Bitrix gift types sheet returned no names");
    } catch (err) {
      if (source === "bitrix") throw err;
      console.warn("Bitrix types unavailable, falling back:", err instanceof Error ? err.message : err);
    }
  }

  for (const candidate of XLSX_CANDIDATES) {
    const loaded = await loadFromXlsx(candidate);
    if (loaded && loaded.counts.products > 0) {
      const ids = new Set(
        (loaded.sheets["01_PRODUCTS"]?.rows ?? []).map((r) => String(r[0] ?? "")),
      );
      const hasExpected = EXPECTED_PRODUCT_IDS.every((id) => ids.has(id));
      if (hasExpected || (!ids.has("EXAMPLE_PRODUCT") && ids.size >= 4)) {
        return loaded;
      }
    }
  }
  return buildCatalogFromTraining();
}

function colLetter(indexZeroBased: number): string {
  let n = indexZeroBased + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function dictRange(key: keyof typeof DICTIONARIES): string {
  const idx = DICTIONARY_COLUMNS.indexOf(key);
  const letter = colLetter(idx);
  const count = DICTIONARIES[key].length;
  return `'07_DICTIONARIES'!$${letter}$2:$${letter}$${count + 1}`;
}

function buildFormattingRequests(sheetMap: Map<string, number>, catalog: CatalogPayload) {
  const requests: unknown[] = [];
  const headerBg = { red: 0.12, green: 0.306, blue: 0.475 };

  for (const title of TARGET_SHEETS) {
    const sheetId = sheetMap.get(title);
    if (sheetId == null) continue;
    const colCount = Math.max(catalog.sheets[title]?.headers.length ?? 10, 10);
    const rowCount = Math.max((catalog.sheets[title]?.rows.length ?? 0) + 50, 100);

    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1, rowCount, columnCount: Math.max(colCount, 12) },
        },
        fields: "gridProperties.frozenRowCount,gridProperties.rowCount,gridProperties.columnCount",
      },
    });

    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: headerBg,
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
            wrapStrategy: "WRAP",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)",
      },
    });

    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: 0,
          endColumnIndex: colCount,
        },
        cell: {
          userEnteredFormat: {
            wrapStrategy: "WRAP",
            verticalAlignment: "TOP",
          },
        },
        fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
      },
    });

    // Auto filter
    requests.push({
      setBasicFilter: {
        filter: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: Math.max((catalog.sheets[title]?.rows.length ?? 0) + 1, 2),
            startColumnIndex: 0,
            endColumnIndex: colCount,
          },
        },
      },
    });

    // Column widths
    for (let c = 0; c < colCount; c += 1) {
      const header = catalog.sheets[title]?.headers[c] ?? "";
      const width = Math.min(220, Math.max(100, header.length * 9 + 24));
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: "COLUMNS", startIndex: c, endIndex: c + 1 },
          properties: { pixelSize: width },
          fields: "pixelSize",
        },
      });
    }
  }

  // Data validations
  const validationSpecs: Array<{ sheet: string; field: string; enumKey: keyof typeof DICTIONARIES }> = [
    { sheet: "01_PRODUCTS", field: "category", enumKey: "category" },
    { sheet: "01_PRODUCTS", field: "status", enumKey: "product_status" },
    { sheet: "01_PRODUCTS", field: "physical_or_digital", enumKey: "product_type" },
    { sheet: "01_PRODUCTS", field: "default_country_code", enumKey: "country_code" },
    { sheet: "01_PRODUCTS", field: "default_currency", enumKey: "currency" },
    { sheet: "02_VARIANTS", field: "is_active", enumKey: "boolean" },
    { sheet: "03_MARKET_PRICES", field: "country_code", enumKey: "country_code" },
    { sheet: "03_MARKET_PRICES", field: "currency", enumKey: "currency" },
    { sheet: "03_MARKET_PRICES", field: "is_active", enumKey: "boolean" },
    { sheet: "04_PRODUCTION_DELIVERY", field: "country_code", enumKey: "country_code" },
    { sheet: "04_PRODUCTION_DELIVERY", field: "delivery_currency", enumKey: "currency" },
    { sheet: "04_PRODUCTION_DELIVERY", field: "tracking_available", enumKey: "boolean" },
    { sheet: "04_PRODUCTION_DELIVERY", field: "is_active", enumKey: "boolean" },
    { sheet: "05_SALES_PLAYBOOK", field: "is_active", enumKey: "boolean" },
    { sheet: "06_ASSETS", field: "asset_type", enumKey: "asset_type" },
    { sheet: "06_ASSETS", field: "country_code", enumKey: "country_code" },
    { sheet: "06_ASSETS", field: "status", enumKey: "asset_status" },
  ];

  for (const spec of validationSpecs) {
    const sheetId = sheetMap.get(spec.sheet);
    const fields = SHEET_FIELDS[spec.sheet];
    if (sheetId == null || !fields) continue;
    const col = fields.findIndex((f) => f.name === spec.field);
    if (col < 0) continue;
    requests.push({
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 501,
          startColumnIndex: col,
          endColumnIndex: col + 1,
        },
        rule: {
          condition: {
            type: "ONE_OF_RANGE",
            values: [{ userEnteredValue: `=${dictRange(spec.enumKey)}` }],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });
  }

  // Conditional formatting — keep to BASIC rules only (CUSTOM_FORMULA is locale-sensitive and brittle via API)
  const red = { red: 0.96, green: 0.8, blue: 0.8 };
  const yellow = { red: 1, green: 0.95, blue: 0.8 };

  const productsId = sheetMap.get("01_PRODUCTS");
  if (productsId != null) {
    for (const col of [0, 1, 4]) {
      requests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [{ sheetId: productsId, startRowIndex: 1, endRowIndex: 501, startColumnIndex: col, endColumnIndex: col + 1 }],
            booleanRule: {
              condition: { type: "BLANK" },
              format: { backgroundColor: red },
            },
          },
          index: 0,
        },
      });
    }
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: productsId, startRowIndex: 1, endRowIndex: 501, startColumnIndex: 4, endColumnIndex: 5 }],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "draft" }] },
            format: { backgroundColor: yellow },
          },
        },
        index: 0,
      },
    });
  }

  const pricesId = sheetMap.get("03_MARKET_PRICES");
  if (pricesId != null) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: pricesId, startRowIndex: 1, endRowIndex: 501, startColumnIndex: 5, endColumnIndex: 11 }],
          booleanRule: {
            condition: { type: "NUMBER_LESS", values: [{ userEnteredValue: "0" }] },
            format: { backgroundColor: red },
          },
        },
        index: 0,
      },
    });
  }

  const rulesId = sheetMap.get("04_PRODUCTION_DELIVERY");
  if (rulesId != null) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: rulesId, startRowIndex: 1, endRowIndex: 501, startColumnIndex: 4, endColumnIndex: 8 }],
          booleanRule: {
            condition: { type: "NUMBER_LESS", values: [{ userEnteredValue: "0" }] },
            format: { backgroundColor: red },
          },
        },
        index: 0,
      },
    });
  }

  const readinessId = sheetMap.get("08_READINESS");
  if (readinessId != null) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: readinessId, startRowIndex: 1, endRowIndex: 501, startColumnIndex: 9, endColumnIndex: 10 }],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Нужно заполнить" }] },
            format: { backgroundColor: red },
          },
        },
        index: 0,
      },
    });
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: readinessId, startRowIndex: 1, endRowIndex: 501, startColumnIndex: 9, endColumnIndex: 10 }],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "В работе" }] },
            format: { backgroundColor: yellow },
          },
        },
        index: 0,
      },
    });
  }

  return requests;
}

function upsertMerge(
  existing: string[][],
  headers: string[],
  incomingRows: Array<Array<string | number | null>>,
  idField: string,
): Array<Array<string | number | null>> {
  const idIdx = headers.indexOf(idField);
  if (idIdx < 0) return incomingRows;
  const map = new Map<string, Array<string | number | null>>();
  for (const row of existing.slice(1)) {
    const id = String(row[idIdx] ?? "").trim();
    if (!id) continue;
    const padded = [...row];
    while (padded.length < headers.length) padded.push("");
    map.set(id, padded.slice(0, headers.length));
  }
  for (const row of incomingRows) {
    const id = String(row[idIdx] ?? "").trim();
    if (!id) continue;
    map.set(id, row);
  }
  return [...map.values()];
}

async function main() {
  const { mode, source } = parseArgs();
  const sa = readGoogleServiceAccount();
  if (!sa) throw new Error("Service account not configured");

  const warnings: string[] = [];
  const errors: string[] = [];

  console.log("SA email:", sa.email);
  console.log("Spreadsheet ID:", SPREADSHEET_ID);
  console.log("Mode:", mode);
  console.log("Source:", source);

  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  let meta = await getMeta(token);
  console.log("Title:", meta.properties?.title);

  const backupDir = await saveBackup(token, meta);
  console.log("Backup:", backupDir);

  const catalog = await resolveCatalog(token, source);
  // Inject readiness formulas (rebuild to be safe)
  const productCount = catalog.sheets["01_PRODUCTS"]?.rows.length ?? 0;
  const formulaRows = buildReadinessFormulas(productCount);
  catalog.sheets["08_READINESS"] = {
    headers: catalog.sheets["08_READINESS"]!.headers,
    rows: (catalog.sheets["01_PRODUCTS"]?.rows ?? []).map((r, i) => {
      const f = formulaRows[i]!;
      return [String(r[0] ?? ""), String(r[1] ?? ""), f[2], f[3], f[4], f[5], f[6], f[7], f[8], f[9]];
    }),
  };

  console.log("Источник:", catalog.sourceLabel);
  console.log("Количество листов:", Object.keys(catalog.sheets).length);
  console.log("Количество продуктов:", catalog.counts.products);
  console.log("Количество вариантов:", catalog.counts.variants);
  console.log("Количество цен:", catalog.counts.prices);
  console.log("Количество production rules:", catalog.counts.productionRules);
  console.log("Количество playbooks:", catalog.counts.playbooks);
  console.log("Количество assets:", catalog.counts.assets);

  const existingTitles = new Map<string, number>();
  for (const s of meta.sheets ?? []) {
    if (s.properties?.title != null && s.properties.sheetId != null) {
      existingTitles.set(s.properties.title, s.properties.sheetId);
    }
  }

  // Mode gates
  if (mode === "replace-empty") {
    for (const title of TARGET_SHEETS) {
      if (!existingTitles.has(title)) continue;
      const values = await readSheetValues({
        spreadsheetId: SPREADSHEET_ID,
        range: quoteRange(title, "A1:AZ50"),
      });
      const hasData = values.length > 1 && values.slice(1).some((row) => row.some((c) => String(c ?? "").trim()));
      if (hasData) {
        throw new Error(
          `replace-empty aborted: sheet ${title} already has data. Use --mode=upsert or --mode=force-replace explicitly.`,
        );
      }
    }
  }

  if (mode === "force-replace") {
    console.warn("WARNING: force-replace will clear target Product Hub sheets.");
  }

  // Create missing sheets in order
  const createRequests: unknown[] = [];
  for (const title of TARGET_SHEETS) {
    if (!existingTitles.has(title)) {
      createRequests.push({ addSheet: { properties: { title, gridProperties: { rowCount: 200, columnCount: 26 } } } });
    }
  }
  if (createRequests.length) {
    await batchUpdate(token, createRequests);
    meta = await getMeta(token);
    existingTitles.clear();
    for (const s of meta.sheets ?? []) {
      if (s.properties?.title != null && s.properties.sheetId != null) {
        existingTitles.set(s.properties.title, s.properties.sheetId);
      }
    }
  }

  const createdSheets = TARGET_SHEETS.filter((t) => !meta.sheets?.some(() => false));
  void createdSheets;

  // Clear / write values
  const valueData: Array<{ range: string; values: Array<Array<string | number | boolean | null>> }> = [];

  for (const title of TARGET_SHEETS) {
    const payload = catalog.sheets[title];
    if (!payload) continue;
    let rows = payload.rows;

    if (mode === "upsert" && ID_FIELDS[title]) {
      const existing = await readSheetValues({
        spreadsheetId: SPREADSHEET_ID,
        range: quoteRange(title, "A1:AZ500"),
      });
      if (existing.length) {
        rows = upsertMerge(existing, payload.headers, rows, ID_FIELDS[title]!);
      }
    }

    if (mode === "force-replace" || mode === "replace-empty") {
      // clear wide range
      await sheetsApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(quoteRange(title, "A1:AZ500"))}:clear`, {
        method: "POST",
        body: "{}",
      });
    }

    const matrix: Array<Array<string | number | boolean | null>> = [payload.headers, ...rows];
    valueData.push({ range: quoteRange(title, "A1"), values: matrix });
  }

  // Write in batches
  const writeChunk = 3;
  for (let i = 0; i < valueData.length; i += writeChunk) {
    await batchUpdateSheetValues({
      spreadsheetId: SPREADSHEET_ID,
      data: valueData.slice(i, i + writeChunk),
      valueInputOption: "USER_ENTERED",
    });
  }

  // Formatting + validations
  try {
    await batchUpdate(token, buildFormattingRequests(existingTitles, catalog));
  } catch (err) {
    warnings.push(`Formatting/validation partial failure: ${err instanceof Error ? err.message : String(err)}`);
    console.warn(warnings[warnings.length - 1]);
  }

  // Delete empty default sheets
  const deleted: string[] = [];
  meta = await getMeta(token);
  for (const s of meta.sheets ?? []) {
    const title = s.properties?.title ?? "";
    const sheetId = s.properties?.sheetId;
    if (!EMPTY_DEFAULT_SHEETS.has(title) || sheetId == null) continue;
    const values = await readSheetValues({
      spreadsheetId: SPREADSHEET_ID,
      range: quoteRange(title, "A1:Z50"),
    });
    if (!isSheetEffectivelyEmpty(values)) {
      warnings.push(`Default sheet ${title} has data — not deleted`);
      continue;
    }
    // Must keep at least one sheet — only delete if target sheets exist
    const hasTargets = TARGET_SHEETS.every((t) => meta.sheets?.some((x) => x.properties?.title === t));
    if (!hasTargets) {
      warnings.push(`Skipped deleting ${title}: target sheets incomplete`);
      continue;
    }
    await batchUpdate(token, [{ deleteSheet: { sheetId } }]);
    deleted.push(title);
  }

  // Verify
  meta = await getMeta(token);
  const titles = (meta.sheets ?? []).map((s) => s.properties?.title ?? "");
  const missing = TARGET_SHEETS.filter((t) => !titles.includes(t));
  if (missing.length) errors.push(`Missing sheets: ${missing.join(", ")}`);

  const products = await readSheetValues({
    spreadsheetId: SPREADSHEET_ID,
    range: quoteRange("01_PRODUCTS", "A1:A50"),
  });
  const productIds = products.slice(1).map((r) => String(r[0] ?? "").trim()).filter(Boolean);
  const unique = new Set(productIds);
  if (unique.size !== productIds.length) errors.push("Duplicate product_id detected");
  if (productIds.length < 1) errors.push(`Expected products, got ${productIds.length}`);
  if (source === "bitrix" || catalog.sourceLabel.includes("Bitrix")) {
    const required = [
      "PRODUCT_REPRODUCTION",
      "PRODUCT_ORIGINAL",
      "PRODUCT_PERSONAL_MAGAZINE",
      "PRODUCT_PERSONAL_NEWSPAPER",
      "PRODUCT_DIGITAL_VERSION",
      "PRODUCT_CONGRATULATORY_MAGAZINE",
      "PRODUCT_CONGRATULATORY_NEWSPAPER",
      "PRODUCT_OZHIVI",
      "PRODUCT_LIFE_BOOK",
      "PRODUCT_STICKER",
      "PRODUCT_FAMILY_EDITION",
    ];
    for (const id of required) {
      if (!unique.has(id)) errors.push(`Missing Bitrix-aligned product: ${id}`);
    }
  } else {
    if (productIds.length < 8) errors.push(`Expected 8 products, got ${productIds.length}`);
    for (const id of EXPECTED_PRODUCT_IDS) {
      if (!unique.has(id)) warnings.push(`Expected product missing: ${id}`);
    }
  }

  const variants = await readSheetValues({ spreadsheetId: SPREADSHEET_ID, range: quoteRange("02_VARIANTS", "A1:B50") });
  const prices = await readSheetValues({ spreadsheetId: SPREADSHEET_ID, range: quoteRange("03_MARKET_PRICES", "A1:A5") });
  const rules = await readSheetValues({ spreadsheetId: SPREADSHEET_ID, range: quoteRange("04_PRODUCTION_DELIVERY", "A1:A50") });
  const playbooks = await readSheetValues({ spreadsheetId: SPREADSHEET_ID, range: quoteRange("05_SALES_PLAYBOOK", "A1:A50") });
  const assets = await readSheetValues({ spreadsheetId: SPREADSHEET_ID, range: quoteRange("06_ASSETS", "A1:A50") });
  const dicts = await readSheetValues({ spreadsheetId: SPREADSHEET_ID, range: quoteRange("07_DICTIONARIES", "A1:G20") });
  const readiness = await readSheetValues({ spreadsheetId: SPREADSHEET_ID, range: quoteRange("08_READINESS", "A1:J20") });

  if ((variants.length ?? 0) < 2) errors.push("02_VARIANTS has no data rows");
  if ((prices.length ?? 0) < 1) errors.push("03_MARKET_PRICES missing headers");
  if ((rules.length ?? 0) < 2) warnings.push("04_PRODUCTION_DELIVERY has no confirmed SLA numbers (stubs only)");
  if ((playbooks.length ?? 0) < 2) warnings.push("05_SALES_PLAYBOOK sparse");
  if ((assets.length ?? 0) < 2) warnings.push("06_ASSETS sparse");
  if ((dicts.length ?? 0) < 2) errors.push("07_DICTIONARIES empty");
  if ((readiness.length ?? 0) < 2) errors.push("08_READINESS empty");

  // Formula error scan on readiness
  const readinessFormulas = await sheetsApi<{
    valueRanges?: Array<{ values?: string[][] }>;
  }>(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?ranges=${encodeURIComponent(quoteRange("08_READINESS", "C2:J20"))}&valueRenderOption=FORMATTED_VALUE`,
  );
  const badTokens = ["#REF!", "#VALUE!", "#NAME?", "#DIV/0!", "#ERROR!", "#N/A"];
  for (const row of readinessFormulas.valueRanges?.[0]?.values ?? []) {
    for (const cell of row) {
      const s = String(cell ?? "");
      if (badTokens.some((t) => s.includes(t))) {
        errors.push(`Formula error in 08_READINESS: ${s}`);
      }
    }
  }

  const report = {
    spreadsheetId: SPREADSHEET_ID,
    url: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`,
    mode,
    writeAccess: "OK",
    source: catalog.sourceLabel,
    sheetsPresent: titles.filter((t) => TARGET_SHEETS.includes(t as TargetSheet)),
    deletedEmptySheets: deleted,
    products: productIds.length,
    variants: Math.max(0, variants.length - 1),
    prices: Math.max(0, prices.length - 1),
    productionRules: Math.max(0, rules.length - 1),
    playbooks: Math.max(0, playbooks.length - 1),
    assets: Math.max(0, assets.length - 1),
    errors,
    warnings,
    backup: backupDir,
    verify: errors.length ? "FAILED" : "PASSED",
  };

  console.log("\n=== REPORT ===");
  console.log(`Spreadsheet ID: ${report.spreadsheetId}`);
  console.log(`URL: ${report.url}`);
  console.log(`Режим: ${report.mode}`);
  console.log(`Права записи: ${report.writeAccess}`);
  console.log(`Источник данных: ${report.source}`);
  console.log(`Созданные листы: ${report.sheetsPresent.join(", ")}`);
  console.log(`Удалённые пустые листы: ${report.deletedEmptySheets.join(", ") || "—"}`);
  console.log(`Записано продуктов: ${report.products}`);
  console.log(`Записано вариантов: ${report.variants}`);
  console.log(`Записано цен: ${report.prices}`);
  console.log(`Записано production rules: ${report.productionRules}`);
  console.log(`Записано playbooks: ${report.playbooks}`);
  console.log(`Записано assets: ${report.assets}`);
  console.log(`Ошибки: ${errors.length ? errors.join(" | ") : "—"}`);
  console.log(`Предупреждения: ${warnings.length ? warnings.join(" | ") : "—"}`);
  console.log(`Backup: ${report.backup}`);
  console.log(`Проверка повторным чтением: ${report.verify}`);

  if (errors.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
