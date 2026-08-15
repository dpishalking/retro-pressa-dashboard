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
  dashboard: "00_СВОДКА",
  marketingGeneral: "01_МАРКЕТИНГ_ОБЩЕЕ",
  marketingPaid: "02_МАРКЕТИНГ_ПЛАТНЫЙ",
  marketingOrganic: "03_МАРКЕТИНГ_ОРГАНИКА",
  salesGeneral: "04_ПРОДАЖИ",
  salesNadezhda: "05a_НАДЕЖДА",
  salesAnastasia: "05b_АНАСТАСИЯ",
  salesElena: "05c_ЕЛЕНА",
  salesManagers: "05_МЕНЕДЖЕРЫ",
  actions: "06_ДЕЙСТВИЯ",
  finance: "07_ФИНАНСЫ",
  motivation: "08_МОТИВАЦИЯ",
  metrics: "90_МЕТРИКИ",
  settings: "91_НАСТРОЙКИ",
  glossary: "92_ГЛОССАРИЙ",
  rawData: "99_СЫРЫЕ_ДАННЫЕ",
  owners: "93_ОТВЕТСТВЕННЫЕ",
  diagnostics: "94_ДИАГНОСТИКА"
} as const;

export type PmSheetKey = keyof typeof PM_SHEETS;

export const PM_DETAIL_SHEETS = [
  PM_SHEETS.marketingGeneral,
  PM_SHEETS.marketingPaid,
  PM_SHEETS.marketingOrganic,
  PM_SHEETS.salesGeneral,
  PM_SHEETS.finance
] as const;

/** Previous English tab titles → current Russian (one-time rename / migration). */
export const PM_SHEET_RENAME_FROM_EN: Record<string, string> = {
  "00_DASHBOARD": PM_SHEETS.dashboard,
  "01_MARKETING_GENERAL": PM_SHEETS.marketingGeneral,
  "02_MARKETING_PAID": PM_SHEETS.marketingPaid,
  "03_MARKETING_ORGANIC": PM_SHEETS.marketingOrganic,
  "04_SALES_GENERAL": PM_SHEETS.salesGeneral,
  "05_SALES_MANAGERS": PM_SHEETS.salesManagers,
  "06_ACTIONS": PM_SHEETS.actions,
  "07_FINANCE": PM_SHEETS.finance,
  "08_MOTIVATION": PM_SHEETS.motivation,
  "90_METRICS": PM_SHEETS.metrics,
  "91_SETTINGS": PM_SHEETS.settings,
  "92_GLOSSARY": PM_SHEETS.glossary,
  "93_OWNERS": PM_SHEETS.owners,
  "94_DIAGNOSTICS": PM_SHEETS.diagnostics,
  "99_RAW_DATA": PM_SHEETS.rawData
};
