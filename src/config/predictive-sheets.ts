/**
 * Predictive Sheets workbook — tab names & env.
 * Target: RP | Предиктивки
 */

export const PREDICTIVE_SHEETS_SPREADSHEET_ID_DEFAULT =
  "1lRavoP8F93k0Q2abz2Kgv_RdPJ0ywlu5iRGPtXoFqmg";

export function getPredictiveSheetsSpreadsheetId(): string {
  return (
    process.env.PREDICTIVE_SHEETS_SPREADSHEET_ID?.trim() || PREDICTIVE_SHEETS_SPREADSHEET_ID_DEFAULT
  );
}

export const PM_SHEETS = {
  dashboard: "00_DASHBOARD",
  marketingGeneral: "01_MARKETING_GENERAL",
  marketingPaid: "02_MARKETING_PAID",
  marketingOrganic: "03_MARKETING_ORGANIC",
  salesGeneral: "04_SALES_GENERAL",
  salesNadezhda: "05a_НАДЕЖДА",
  salesAnastasia: "05b_АНАСТАСИЯ",
  salesElena: "05c_ЕЛЕНА",
  salesManagers: "05_SALES_MANAGERS",
  actions: "06_ACTIONS",
  metrics: "90_METRICS",
  settings: "91_SETTINGS",
  glossary: "92_GLOSSARY",
  rawData: "99_RAW_DATA",
  owners: "93_OWNERS",
  diagnostics: "94_DIAGNOSTICS"
} as const;

export type PmSheetKey = keyof typeof PM_SHEETS;

export const PM_DETAIL_SHEETS = [
  PM_SHEETS.marketingGeneral,
  PM_SHEETS.marketingPaid,
  PM_SHEETS.marketingOrganic,
  PM_SHEETS.salesGeneral
] as const;
