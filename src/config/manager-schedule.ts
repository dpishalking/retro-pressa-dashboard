/** Workbook «График» — manager shifts by month tab. Env overrides fallback. */
export const MANAGER_SCHEDULE_SPREADSHEET_ID_DEFAULT = "17cJjvI3H0VNuODKvAvrCt2-GHMIP_2TigiaaIYd424w";

export function getManagerScheduleSpreadsheetId(): string {
  return process.env.MANAGER_SCHEDULE_SPREADSHEET_ID?.trim() || MANAGER_SCHEDULE_SPREADSHEET_ID_DEFAULT;
}

export function managerScheduleSpreadsheetUrl(gid?: number | null): string {
  const id = getManagerScheduleSpreadsheetId();
  const base = `https://docs.google.com/spreadsheets/d/${id}/edit`;
  return gid == null || gid < 0 ? base : `${base}?gid=${gid}#gid=${gid}`;
}
