import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PeriodKey } from "@/types/metrics";

const exportDir = path.join(process.cwd(), "data", "conversation-exports");

const periodSlug: Record<PeriodKey, string> = {
  "may-2026": "2026-05",
  "june-2026": "2026-06",
  "july-2026": "2026-07"
};

function extensionOf(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return [".csv", ".json", ".txt", ".pdf"].includes(extension) ? extension : ".txt";
}

export async function saveConversationExportFile(input: {
  periodKey: PeriodKey;
  originalFilename: string;
  content: Buffer;
}) {
  await mkdir(exportDir, { recursive: true });
  const extension = extensionOf(input.originalFilename);
  const target = path.join(exportDir, `retro-pressa-conversations-${periodSlug[input.periodKey]}${extension}`);
  await writeFile(target, input.content);
  return target;
}
