import crypto from "node:crypto";

import { googleSources, type GoogleSheetSource } from "@/config/google-sources";
import type { DailyMetrics } from "@/types/metrics";

export type TrafficRow = {
  date: string;
  source: string;
  channel: string;
  campaign: string;
  market: string;
  paidLeads: number;
  organicLeads: number;
  ql: number;
  spend: number;
  cpl: number;
  notes: string;
};

export type GoogleTrafficPayload = {
  rows: TrafficRow[];
  daily: DailyMetrics[];
  summary: {
    rowsLoaded: number;
    sourcesLoaded: string[];
    paidLeads: number;
    organicLeads: number;
    ql: number;
    spend: number;
    averageCpl: number;
    markets: string[];
    channels: string[];
  };
};

const headerAliases: Record<keyof TrafficRow, string[]> = {
  date: ["date", "дата", "day", "день", "месяц", "формулы!!!"],
  source: ["source", "источник"],
  channel: ["channel", "канал"],
  campaign: ["campaign", "кампания"],
  market: ["market", "рынок", "geo", "страна"],
  paidLeads: ["paidLeads", "paid_leads", "платные", "платные лиды", "лиды crm", "crm leads", "leads crm", "лиды"],
  organicLeads: ["organicLeads", "organic_leads", "органика", "органические лиды", "лиды crm", "лиды"],
  ql: ["ql", "qualifiedLeads", "qualified_leads", "квал лиды", "квал. лиды", "квалифицированные лиды"],
  spend: ["spend", "budget", "cost", "расход", "бюджет"],
  cpl: ["cpl", "цена лида", "стоимость лида"],
  notes: ["notes", "комментарий", "заметки"]
};

function csvUrlFromSheetUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.searchParams.get("output") === "csv" || url.pathname.includes("/export")) return rawUrl;

  const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!match) return rawUrl;

  const gid = url.searchParams.get("gid") ?? "0";
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
}

function serviceAccountCredentials() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  let privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim();

  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson);
    email = email || parsed.client_email;
    privateKey = privateKey || parsed.private_key;
  }

  privateKey = privateKey
    ?.replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "\n")
    .trim();

  if (!email || !privateKey) return null;
  if (!privateKey.includes("BEGIN PRIVATE KEY") || !privateKey.includes("END PRIVATE KEY")) {
    throw new Error("GOOGLE_PRIVATE_KEY must be the full private_key from the service account JSON, including BEGIN/END PRIVATE KEY.");
  }

  return { email, privateKey };
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function getGoogleAccessToken() {
  const credentials = serviceAccountCredentials();
  if (!credentials) throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are not configured");

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({
    iss: credentials.email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  });
  const unsignedToken = `${header}.${payload}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsignedToken).sign(credentials.privateKey).toString("base64url");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedToken}.${signature}`
    }),
    cache: "no-store"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Google auth failed: ${data.error_description || data.error || response.status}`);
  }
  if (!data.access_token) throw new Error("Google auth did not return an access token");

  return String(data.access_token);
}

async function googleGet<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Google Sheets request failed: ${data.error?.message || response.status}`);
  }

  return data as T;
}

async function sheetNameFromSource(source: GoogleSheetSource, accessToken: string) {
  const data = await googleGet<{ sheets?: Array<{ properties?: { sheetId?: number; title?: string } }> }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${source.spreadsheetId}?fields=sheets.properties(sheetId,title)`,
    accessToken
  );
  const title = source.sheetName ||
    data.sheets?.find((sheet) => String(sheet.properties?.sheetId) === source.gid)?.properties?.title ||
    data.sheets?.find((sheet) => sheet.properties?.title)?.properties?.title;

  if (!title) throw new Error("Google Sheet has no readable tabs");
  return title;
}

async function readPrivateSheetRows(source: GoogleSheetSource, accessToken: string) {
  const sheetName = await sheetNameFromSource(source, accessToken);
  const range = encodeURIComponent(`${sheetName}!A:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${source.spreadsheetId}/values/${range}?majorDimension=ROWS`;
  const data = await googleGet<{ values?: string[][] }>(url, accessToken);
  return data.values ?? [];
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalized(value: string) {
  return value.trim().toLowerCase();
}

function numberValue(value: string | undefined) {
  const cleaned = String(value ?? "")
    .replace(/\s/g, "")
    .replace("€", "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: string | undefined) {
  return String(value ?? "").trim();
}

function normalizeDateValue(value: string) {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dotted = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotted) {
    const year = dotted[3].length === 2 ? `20${dotted[3]}` : dotted[3];
    return `${year}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}`;
  }

  return trimmed;
}

function currentMonthPrefix(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function resolveHeaderIndexes(headers: string[]) {
  const lowerHeaders = headers.map(normalized);
  const indexes = {} as Record<keyof TrafficRow, number>;

  for (const key of Object.keys(headerAliases) as Array<keyof TrafficRow>) {
    indexes[key] = -1;
    for (const alias of headerAliases[key].map(normalized)) {
      const index = lowerHeaders.findIndex((header) => header === alias);
      if (index >= 0) {
        indexes[key] = index;
        break;
      }
    }
  }
  if (indexes.date < 0) indexes.date = 0;

  return indexes;
}

function get(row: string[], index: number) {
  return index >= 0 ? row[index] : "";
}

function toDaily(rows: TrafficRow[]) {
  const map = new Map<string, DailyMetrics>();

  for (const row of rows) {
    if (!row.date) continue;
    map.set(row.date, map.get(row.date) ?? {
      date: row.date,
      paidLeads: 0,
      organicLeads: 0,
      qualifiedLeads: 0,
      paidQualifiedLeads: 0,
      organicQualifiedLeads: 0,
      invoicesCount: 0,
      invoicesAmount: 0,
      salesCount: 0,
      revenue: 0,
      adSpend: 0,
      averagePaidCheck: 0,
      activeManagers: 0
    });

    const day = map.get(row.date)!;
    day.paidLeads += row.paidLeads;
    day.organicLeads += row.organicLeads;
    day.qualifiedLeads += row.ql;
    if (row.organicLeads > 0 && row.paidLeads === 0) day.organicQualifiedLeads += row.ql;
    else day.paidQualifiedLeads += row.ql;
    day.adSpend += row.spend;
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function rowsFromTable(parsed: string[][], source?: GoogleSheetSource) {
  const [headers, ...body] = parsed;
  if (!headers?.length) throw new Error("Google traffic sheet is empty");

  const indexes = resolveHeaderIndexes(headers);
  return body.map((row) => ({
    date: normalizeDateValue(textValue(get(row, indexes.date))),
    source: textValue(get(row, indexes.source)) || source?.title || "",
    channel: textValue(get(row, indexes.channel)),
    campaign: textValue(get(row, indexes.campaign)),
    market: textValue(get(row, indexes.market)),
    paidLeads: source?.leadKind === "organic" ? 0 : numberValue(get(row, indexes.paidLeads)),
    organicLeads: source?.leadKind === "organic"
      ? numberValue(get(row, indexes.organicLeads >= 0 ? indexes.organicLeads : indexes.paidLeads))
      : 0,
    ql: numberValue(get(row, indexes.ql)),
    spend: numberValue(get(row, indexes.spend)),
    cpl: numberValue(get(row, indexes.cpl)),
    notes: textValue(get(row, indexes.notes))
  })).filter((row) => row.date || row.paidLeads || row.organicLeads || row.spend);
}

async function readCsvRows() {
  const rawUrl = process.env.GOOGLE_TRAFFIC_CSV_URL;
  if (!rawUrl) throw new Error("GOOGLE_TRAFFIC_CSV_URL is not configured");

  const response = await fetch(csvUrlFromSheetUrl(rawUrl), { cache: "no-store" });
  const csv = await response.text();

  if (!response.ok) throw new Error(`Google Sheets request failed: ${response.status}`);
  if (/<!doctype html|<html/i.test(csv) && !csv.includes(",")) {
    throw new Error("Google Sheet did not return CSV. Use service account access or enable CSV publishing.");
  }

  return parseCsv(csv);
}

export async function syncGoogleTraffic(): Promise<GoogleTrafficPayload> {
  const facebookSources = googleSources.filter((item) => item.type === "facebookTraffic");
  const organicSources = googleSources.filter((item) => item.leadKind === "organic");
  const fallbackTrafficSources = googleSources.filter((item) => item.type === "traffic" && item.leadKind !== "organic");
  const trafficSources = facebookSources.length ? [...facebookSources, ...organicSources] : [...fallbackTrafficSources, ...organicSources];
  const canUsePrivateApi = Boolean(serviceAccountCredentials() && trafficSources.length);
  const loadedSources: string[] = [];
  const accessToken = canUsePrivateApi ? await getGoogleAccessToken() : "";
  const monthPrefix = currentMonthPrefix();
  const rows = (canUsePrivateApi
    ? (await Promise.all(trafficSources.map(async (source) => {
      const parsed = await readPrivateSheetRows(source, accessToken);
      loadedSources.push(source.title);
      return rowsFromTable(parsed, source);
    }))).flat()
    : rowsFromTable(await readCsvRows()))
    .filter((row) => row.date.startsWith(monthPrefix));

  const paidLeads = rows.reduce((sum, row) => sum + row.paidLeads, 0);
  const organicLeads = rows.reduce((sum, row) => sum + row.organicLeads, 0);
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);

  return {
    rows,
    daily: toDaily(rows),
    summary: {
      rowsLoaded: rows.length,
      sourcesLoaded: loadedSources,
      paidLeads,
      organicLeads,
      ql: rows.reduce((sum, row) => sum + row.ql, 0),
      spend,
      averageCpl: paidLeads > 0 ? spend / paidLeads : 0,
      markets: Array.from(new Set(rows.map((row) => row.market).filter(Boolean))),
      channels: Array.from(new Set(rows.map((row) => row.channel).filter(Boolean)))
    }
  };
}
