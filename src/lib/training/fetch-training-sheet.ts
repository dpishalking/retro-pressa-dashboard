import crypto from "node:crypto";

import { TRAINING_SHEET_ID, parseTrainingSheetTabs } from "@/lib/training/google-sheet-catalog";

function serviceAccountCredentials() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  let privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim();

  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson) as { client_email?: string; private_key?: string };
    email = email || parsed.client_email;
    privateKey = privateKey || parsed.private_key;
  }

  privateKey = privateKey
    ?.replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "\n")
    .trim();

  if (!email || !privateKey) return null;

  return { email, privateKey };
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function getGoogleAccessToken() {
  const credentials = serviceAccountCredentials();
  if (!credentials) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are not configured");
  }

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
  const data = (await response.json()) as { access_token?: string; error?: string; error_description?: string };

  if (!response.ok) {
    throw new Error(`Google auth failed: ${data.error_description || data.error || response.status}`);
  }
  if (!data.access_token) throw new Error("Google auth did not return an access token");

  return data.access_token;
}

async function googleGet<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  const data = await response.json();

  if (!response.ok) {
    const message = (data as { error?: { message?: string } }).error?.message || response.status;
    throw new Error(`Google Sheets request failed: ${message}`);
  }

  return data as T;
}

export async function fetchTrainingSheetTabs() {
  const accessToken = await getGoogleAccessToken();
  const meta = await googleGet<{ sheets?: Array<{ properties?: { title?: string } }> }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${TRAINING_SHEET_ID}?fields=sheets.properties.title`,
    accessToken
  );

  const tabs: Record<string, string[][]> = {};

  for (const sheet of meta.sheets ?? []) {
    const title = sheet.properties?.title;
    if (!title) continue;

    const range = encodeURIComponent(`${title}!A:Z`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${TRAINING_SHEET_ID}/values/${range}?majorDimension=ROWS`;
    const data = await googleGet<{ values?: string[][] }>(url, accessToken);
    tabs[title] = data.values ?? [];
  }

  return tabs;
}

export async function fetchParsedTrainingSheetProducts() {
  const tabs = await fetchTrainingSheetTabs();
  return parseTrainingSheetTabs(tabs);
}
