/** Live shift board — one Google tab per manager on shift / taking leads today. */
export const SHIFT_BOARD_SPREADSHEET_ID_DEFAULT = "1YpCkJZZDbe6evcqmeG9u1_HvG3YpZZyRxoAFNHwhBkY";

export const SHIFT_BOARD_CONTROL_TAB = "_пульт";

export function getShiftBoardSpreadsheetId(): string {
  return process.env.SHIFT_BOARD_SPREADSHEET_ID?.trim() || SHIFT_BOARD_SPREADSHEET_ID_DEFAULT;
}

export function shiftBoardSpreadsheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${getShiftBoardSpreadsheetId()}/edit`;
}
