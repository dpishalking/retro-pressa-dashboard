/**
 * Fill Product Passport workbook tabs for «Репродукция».
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/product-hub/fill-reproduction-passport.ts
 *   npx tsx --env-file=.env.local scripts/product-hub/fill-reproduction-passport.ts --sheet=SPREADSHEET_ID
 */

import {
  getGoogleAccessToken,
  readGoogleServiceAccount,
  batchUpdateSheetValues,
} from "../../src/lib/google/sheets-client";
import {
  buildReproductionPassportSheets,
  PASSPORT_TABS,
  REPRODUCTION_PASSPORT_SHEET_CANDIDATES,
} from "./passports/reproduction-passport-content";

function parseSheetId(): string {
  const fromArg = process.argv.find((a) => a.startsWith("--sheet="))?.slice("--sheet=".length);
  if (fromArg) return fromArg.trim();
  if (REPRODUCTION_PASSPORT_SHEET_CANDIDATES[0]) return REPRODUCTION_PASSPORT_SHEET_CANDIDATES[0]!;
  throw new Error("Pass --sheet=SPREADSHEET_ID or set REPRODUCTION_PASSPORT_SHEET_ID");
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
  const data = (await res.json()) as T & { error?: { message?: string; status?: string } };
  if (!res.ok) {
    const err = new Error(data.error?.message || `${res.status}`) as Error & { status?: string };
    err.status = data.error?.status;
    throw err;
  }
  return data;
}

function quote(title: string, a1: string) {
  return `'${title.replace(/'/g, "''")}'!${a1}`;
}

async function main() {
  const spreadsheetId = parseSheetId();
  const sa = readGoogleServiceAccount();
  if (!sa) throw new Error("Service account not configured");
  console.log("SA:", sa.email);
  console.log("Target spreadsheet:", spreadsheetId);

  let token: string;
  try {
    token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  } catch (e) {
    throw e;
  }

  let meta: {
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
  };
  try {
    meta = await sheetsApi(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title)`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("\nНет доступа к таблице паспорта.");
    console.error(msg);
    console.error("\nОткройте Google Sheets → Настройки доступа");
    console.error(`→ Добавьте: ${sa.email}`);
    console.error("→ Роль: Редактор");
    console.error(`→ Таблица: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
    process.exit(3);
  }

  console.log("Title:", meta.properties?.title);
  const existing = new Map(
    (meta.sheets ?? [])
      .filter((s) => s.properties?.title != null && s.properties.sheetId != null)
      .map((s) => [s.properties!.title!.trim(), s.properties!.sheetId!] as const),
  );
  // Also map raw titles (with spaces)
  const rawByTrim = new Map<string, { title: string; sheetId: number }>();
  for (const s of meta.sheets ?? []) {
    const t = s.properties?.title;
    const id = s.properties?.sheetId;
    if (t == null || id == null) continue;
    rawByTrim.set(t.trim(), { title: t, sheetId: id });
  }

  const create: unknown[] = [];
  for (const tab of PASSPORT_TABS) {
    if (!rawByTrim.has(tab)) {
      create.push({ addSheet: { properties: { title: tab, gridProperties: { rowCount: 100, columnCount: 10 } } } });
    }
  }
  if (create.length) {
    await sheetsApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: create }),
    });
    meta = await sheetsApi(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title)`,
    );
    rawByTrim.clear();
    for (const s of meta.sheets ?? []) {
      const t = s.properties?.title;
      const id = s.properties?.sheetId;
      if (t == null || id == null) continue;
      rawByTrim.set(t.trim(), { title: t, sheetId: id });
    }
  }

  const content = buildReproductionPassportSheets();
  const data: Array<{ range: string; values: Array<Array<string | number | boolean | null>> }> = [];

  for (const tab of PASSPORT_TABS) {
    const resolved = rawByTrim.get(tab);
    if (!resolved) throw new Error(`Tab not found after create: ${tab}`);
    // clear
    await sheetsApi(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(quote(resolved.title, "A1:Z200"))}:clear`,
      { method: "POST", body: "{}" },
    );
    data.push({ range: quote(resolved.title, "A1"), values: content[tab] });
  }

  await batchUpdateSheetValues({
    spreadsheetId,
    data,
    valueInputOption: "USER_ENTERED",
  });

  // Light formatting: freeze + header
  const formatReqs: unknown[] = [];
  for (const tab of PASSPORT_TABS) {
    const resolved = rawByTrim.get(tab)!;
    formatReqs.push({
      updateSheetProperties: {
        properties: { sheetId: resolved.sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    });
    formatReqs.push({
      repeatCell: {
        range: {
          sheetId: resolved.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 4,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.12, green: 0.3, blue: 0.47 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy)",
      },
    });
    formatReqs.push({
      repeatCell: {
        range: {
          sheetId: resolved.sheetId,
          startRowIndex: 1,
          endRowIndex: 80,
          startColumnIndex: 0,
          endColumnIndex: 4,
        },
        cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
        fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
      },
    });
  }
  await sheetsApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: formatReqs }),
  });

  console.log("\nFilled tabs:");
  for (const tab of PASSPORT_TABS) {
    console.log(`- ${tab}: ${content[tab].length - 1} data rows`);
  }
  console.log(`\nURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
