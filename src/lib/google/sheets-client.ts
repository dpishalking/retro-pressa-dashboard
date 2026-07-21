import crypto from "node:crypto";

export type GoogleServiceAccount = {
  email: string;
  privateKey: string;
};

export function readGoogleServiceAccount(): GoogleServiceAccount | null {
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

export async function getGoogleAccessToken(scope: string): Promise<string> {
  const credentials = readGoogleServiceAccount();
  if (!credentials) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({
    iss: credentials.email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const unsignedToken = `${header}.${payload}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsignedToken)
    .sign(credentials.privateKey)
    .toString("base64url");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedToken}.${signature}`,
    }),
    cache: "no-store",
  });
  const data = (await response.json()) as { access_token?: string; error?: string; error_description?: string };

  if (!response.ok) {
    throw new Error(`Google auth failed: ${data.error_description || data.error || response.status}`);
  }
  if (!data.access_token) throw new Error("Google auth did not return an access token");

  return data.access_token;
}

export async function readSheetValues(input: {
  spreadsheetId: string;
  range: string;
  gid?: string;
}): Promise<string[][]> {
  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets.readonly");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(input.range)}`;
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = (await response.json()) as { values?: string[][]; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(`Google Sheets read failed: ${data.error?.message || response.status}`);
  }
  return data.values ?? [];
}

export async function writeSheetValues(input: {
  spreadsheetId: string;
  range: string;
  rows: Array<Array<string | number | boolean | null>>;
  clearRange?: string;
  valueInputOption?: "RAW" | "USER_ENTERED";
}) {
  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");

  if (input.clearRange) {
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(input.clearRange)}:clear`;
    const clearRes = await fetch(clearUrl, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!clearRes.ok) {
      const body = await clearRes.text();
      throw new Error(`Google Sheets clear failed: ${clearRes.status} ${body.slice(0, 200)}`);
    }
  }

  const valueInputOption = input.valueInputOption ?? "RAW";
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(input.range)}?valueInputOption=${valueInputOption}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ values: input.rows }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = (data as { error?: { message?: string } }).error?.message || response.status;
    throw new Error(`Google Sheets write failed: ${message}`);
  }

  return data;
}

export async function getSheetIdByTitle(spreadsheetId: string, title: string): Promise<number | null> {
  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets.readonly");
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
    { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  const data = (await response.json()) as {
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(`Google Sheets metadata failed: ${data.error?.message || response.status}`);
  }
  const match = data.sheets?.find((sheet) => sheet.properties?.title === title);
  return match?.properties?.sheetId ?? null;
}

export async function formatSheetNumberColumns(input: {
  spreadsheetId: string;
  sheetId: number;
  columnIndexes: number[];
  pattern?: string;
}) {
  if (!input.columnIndexes.length) return;

  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  const pattern = input.pattern ?? "0.##";
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      requests: input.columnIndexes.map((columnIndex) => ({
        repeatCell: {
          range: {
            sheetId: input.sheetId,
            startRowIndex: 1,
            startColumnIndex: columnIndex,
            endColumnIndex: columnIndex + 1,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: "NUMBER", pattern },
            },
          },
          fields: "userEnteredFormat.numberFormat",
        },
      })),
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    const message = (data as { error?: { message?: string } }).error?.message || response.status;
    throw new Error(`Google Sheets number format failed: ${message}`);
  }
}

export async function listSheetTitles(spreadsheetId: string): Promise<string[]> {
  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets.readonly");
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  const data = (await response.json()) as { sheets?: Array<{ properties?: { title?: string } }> };
  if (!response.ok) {
    throw new Error(`Google Sheets metadata failed: ${response.status}`);
  }
  return (data.sheets ?? [])
    .map((sheet) => sheet.properties?.title)
    .filter((title): title is string => Boolean(title));
}

export async function ensureSheetTab(spreadsheetId: string, title: string): Promise<void> {
  const titles = await listSheetTitles(spreadsheetId);
  if (titles.includes(title)) return;

  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title } } }],
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    const message = (data as { error?: { message?: string } }).error?.message || response.status;
    throw new Error(`Google Sheets add tab failed: ${message}`);
  }
}

export async function getFirstSheetTitle(spreadsheetId: string): Promise<string> {
  const titles = await listSheetTitles(spreadsheetId);
  const title = titles[0];
  if (!title) throw new Error("Spreadsheet has no sheets");
  return title;
}

function quoteSheetTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

export async function writeSheetTab(input: {
  spreadsheetId: string;
  tabTitle: string;
  rows: string[][];
  clearRange?: string;
}) {
  await ensureSheetTab(input.spreadsheetId, input.tabTitle);
  const tabPrefix = quoteSheetTab(input.tabTitle);
  await writeSheetValues({
    spreadsheetId: input.spreadsheetId,
    range: `${tabPrefix}!A1`,
    clearRange: input.clearRange ?? `${tabPrefix}!A:K`,
    rows: input.rows,
  });
}

export async function appendSheetRows(input: {
  spreadsheetId: string;
  tabTitle: string;
  rows: string[][];
}) {
  if (!input.rows.length) return { appended: 0, startRow: 1 };

  await ensureSheetTab(input.spreadsheetId, input.tabTitle);
  const tabPrefix = quoteSheetTab(input.tabTitle);
  const existing = await readSheetValues({
    spreadsheetId: input.spreadsheetId,
    range: `${tabPrefix}!A:A`,
  });
  const startRow = Math.max(1, existing.length + 1);

  await writeSheetValues({
    spreadsheetId: input.spreadsheetId,
    range: `${tabPrefix}!A${startRow}`,
    rows: input.rows,
  });

  return { appended: input.rows.length, startRow };
}

export async function readSheetDialogIds(input: {
  spreadsheetId: string;
  tabTitle: string;
  headerLabel?: string;
}) {
  const tabPrefix = quoteSheetTab(input.tabTitle);
  const headerLabel = input.headerLabel ?? "ID диалога";
  const values = await readSheetValues({
    spreadsheetId: input.spreadsheetId,
    range: `${tabPrefix}!A:A`,
  });

  const headerIndex = values.findIndex((row) => row[0] === headerLabel);
  const startIndex = headerIndex >= 0 ? headerIndex + 1 : 1;
  return values
    .slice(startIndex)
    .map((row) => row[0]?.trim())
    .filter((value): value is string => Boolean(value));
}
