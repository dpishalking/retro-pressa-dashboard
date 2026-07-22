import { getGoogleAccessToken, readGoogleServiceAccount } from "@/lib/google/sheets-client";
import { getSalesOsSpreadsheetId } from "@/config/sales-os";

export type SalesOsAccessResult =
  | {
      ok: true;
      spreadsheetId: string;
      title: string;
      tabs: string[];
      serviceAccountEmail: string;
    }
  | {
      ok: false;
      spreadsheetId: string;
      serviceAccountEmail: string | null;
      httpStatus?: number;
      error: string;
      instruction: string[];
    };

export function salesOsShareInstruction(email: string): string[] {
  return [
    "Откройте книгу Retro Pressa — Sales OS:",
    "https://docs.google.com/spreadsheets/d/1Zj_jLoJzJx0zuzJK0ZJIFKaS5TTQR_WyctAevB1ARwY/edit",
    "Нажмите «Настройки доступа» (Share).",
    `Добавьте ${email} с правом «Редактор» (Editor).`,
    "Не создавайте новую Google Sheets-книгу — Spreadsheet ID уже утверждён.",
    "После выдачи доступа повторите sync."
  ];
}

export async function checkSalesOsAccess(
  spreadsheetId = getSalesOsSpreadsheetId()
): Promise<SalesOsAccessResult> {
  const sa = readGoogleServiceAccount();
  if (!sa) {
    return {
      ok: false,
      spreadsheetId,
      serviceAccountEmail: null,
      error: "Google service account is not configured",
      instruction: [
        "Заполните GOOGLE_SERVICE_ACCOUNT_EMAIL и GOOGLE_PRIVATE_KEY (или GOOGLE_SERVICE_ACCOUNT_JSON) в .env.local",
        ...salesOsShareInstruction("codex-pressa@secure-petal-446209-b8.iam.gserviceaccount.com")
      ]
    };
  }

  try {
    const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(title,sheetId)`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    const body = await response.json() as {
      error?: { message?: string };
      properties?: { title?: string };
      sheets?: Array<{ properties?: { title?: string } }>;
    };
    if (!response.ok) {
      return {
        ok: false,
        spreadsheetId,
        serviceAccountEmail: sa.email,
        httpStatus: response.status,
        error: body.error?.message || `HTTP ${response.status}`,
        instruction: salesOsShareInstruction(sa.email)
      };
    }
    return {
      ok: true,
      spreadsheetId,
      title: body.properties?.title || "",
      tabs: (body.sheets || []).map((sheet) => String(sheet.properties?.title || "")).filter(Boolean),
      serviceAccountEmail: sa.email
    };
  } catch (error) {
    return {
      ok: false,
      spreadsheetId,
      serviceAccountEmail: sa.email,
      error: error instanceof Error ? error.message : String(error),
      instruction: salesOsShareInstruction(sa.email)
    };
  }
}
