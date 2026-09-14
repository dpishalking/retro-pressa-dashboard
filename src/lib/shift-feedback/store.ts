import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ShiftFeedbackReport } from "@/lib/shift-feedback/types";

function storeDir() {
  return path.join(process.cwd(), "data", "shift-feedback");
}

function filePath(day: string) {
  return path.join(storeDir(), `${day}.json`);
}

export async function readShiftFeedback(day: string): Promise<ShiftFeedbackReport | null> {
  try {
    const parsed = JSON.parse(await readFile(filePath(day), "utf8")) as ShiftFeedbackReport;
    if (parsed?.day === day && Array.isArray(parsed.managers)) return parsed;
  } catch {
    /* miss */
  }
  return null;
}

export async function writeShiftFeedback(report: ShiftFeedbackReport): Promise<void> {
  await mkdir(storeDir(), { recursive: true });
  await writeFile(filePath(report.day), JSON.stringify(report, null, 2), "utf8");
}

export async function listShiftFeedbackDays(limit = 21): Promise<string[]> {
  try {
    const files = await readdir(storeDir());
    return files
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
      .map((name) => name.replace(/\.json$/, ""))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, limit);
  } catch {
    return [];
  }
}
