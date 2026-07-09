import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PeriodKey } from "@/types/metrics";

export type ManagerDialogsSheetState = {
  version: 1;
  periodKey: PeriodKey;
  spreadsheetId: string;
  tabTitle: string;
  exportedDialogIds: string[];
  lastExportedDay: string | null;
  updatedAt: string;
};

const stateDir = path.join(process.cwd(), "data", "manager-dialogs-sheet-state");

function stateFilePath(periodKey: PeriodKey) {
  return path.join(stateDir, `${periodKey}.json`);
}

async function ensureStateDir() {
  await mkdir(stateDir, { recursive: true });
}

function isValidState(parsed: Partial<ManagerDialogsSheetState>): parsed is ManagerDialogsSheetState {
  return parsed?.version === 1
    && typeof parsed.periodKey === "string"
    && typeof parsed.spreadsheetId === "string"
    && typeof parsed.tabTitle === "string"
    && Array.isArray(parsed.exportedDialogIds)
    && typeof parsed.updatedAt === "string";
}

export async function readManagerDialogsSheetState(periodKey: PeriodKey): Promise<ManagerDialogsSheetState | null> {
  try {
    const raw = await readFile(stateFilePath(periodKey), "utf8");
    const parsed = JSON.parse(raw) as Partial<ManagerDialogsSheetState>;
    return isValidState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeManagerDialogsSheetState(state: ManagerDialogsSheetState) {
  await ensureStateDir();
  await writeFile(stateFilePath(state.periodKey), JSON.stringify(state, null, 2), "utf8");
}

export function markDialogsExported(
  state: ManagerDialogsSheetState,
  dialogIds: string[],
  exportedDay: string | null,
): ManagerDialogsSheetState {
  const exportedDialogIds = [...new Set([...state.exportedDialogIds, ...dialogIds])].sort();
  return {
    ...state,
    exportedDialogIds,
    lastExportedDay: exportedDay ?? state.lastExportedDay,
    updatedAt: new Date().toISOString(),
  };
}

export function createManagerDialogsSheetState(input: {
  periodKey: PeriodKey;
  spreadsheetId: string;
  tabTitle: string;
}): ManagerDialogsSheetState {
  return {
    version: 1,
    periodKey: input.periodKey,
    spreadsheetId: input.spreadsheetId,
    tabTitle: input.tabTitle,
    exportedDialogIds: [],
    lastExportedDay: null,
    updatedAt: new Date().toISOString(),
  };
}
