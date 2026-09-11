import { SHIFT_BOARD_SPREADSHEET_ID_DEFAULT, shiftBoardSpreadsheetUrl } from "@/config/shift-board";

/** Weekly ROP report — default workbook is the live shift board. */
export const ROP_WEEKLY_SPREADSHEET_ID_DEFAULT = SHIFT_BOARD_SPREADSHEET_ID_DEFAULT;
export const ROP_WEEKLY_TAB = "РОП · неделя";
export const ROP_WEEKLY_HISTORY_TAB = "РОП · недели";

export function getRopWeeklySpreadsheetId(): string {
  return process.env.ROP_WEEKLY_SPREADSHEET_ID?.trim() || ROP_WEEKLY_SPREADSHEET_ID_DEFAULT;
}

export function ropWeeklySpreadsheetUrl(): string {
  const id = getRopWeeklySpreadsheetId();
  if (id === SHIFT_BOARD_SPREADSHEET_ID_DEFAULT) return shiftBoardSpreadsheetUrl();
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}
