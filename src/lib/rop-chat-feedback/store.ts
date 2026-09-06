import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RopChatFeedbackReport } from "@/lib/rop-chat-feedback/types";

const cacheDir = path.join(process.cwd(), ".cache", "rop-chat-feedback");

function filePath(day: string) {
  return path.join(cacheDir, `${day}.json`);
}

export async function readRopChatFeedback(day: string): Promise<RopChatFeedbackReport | null> {
  try {
    const parsed = JSON.parse(await readFile(filePath(day), "utf8")) as RopChatFeedbackReport;
    if (parsed?.day === day && Array.isArray(parsed.managers)) return parsed;
  } catch {
    /* miss */
  }
  return null;
}

export async function writeRopChatFeedback(report: RopChatFeedbackReport): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(filePath(report.day), JSON.stringify(report, null, 2), "utf8");
}

export async function listRopChatFeedbackDays(limit = 14): Promise<string[]> {
  try {
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(cacheDir);
    return files
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
      .map((name) => name.replace(/\.json$/, ""))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, limit);
  } catch {
    return [];
  }
}
