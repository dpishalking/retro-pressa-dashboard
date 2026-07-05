import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { NextResponse } from "next/server";
import { analyzeConversationsWithGemini } from "@/lib/gemini-conversation-analyzer";
import { parseConversationFile } from "@/lib/conversation-intelligence";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const allowedExportRoot = resolve(process.cwd(), "data/conversation-exports");
const exportFiles = {
  may: resolve(allowedExportRoot, "retro-pressa-conversations-2026-05.json"),
  june: resolve(allowedExportRoot, "retro-pressa-conversations-2026-06.json")
} as const;

function selectedExportPaths(key?: string) {
  if (key === "may") return [exportFiles.may];
  if (key === "june") return [exportFiles.june];
  return [exportFiles.may, exportFiles.june];
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { key?: string; limit?: number; batchSize?: number; model?: string };
    const exportPaths = selectedExportPaths(body.key);
    const files = await Promise.all(exportPaths.map(async (exportPath) => ({
      filename: basename(exportPath),
      content: await readFile(exportPath),
      defaultChannel: "gift-ai"
    })));
    const messages = files.flatMap(parseConversationFile);
    const summary = await analyzeConversationsWithGemini(messages, {
      limit: body.limit,
      batchSize: body.batchSize,
      model: body.model
    });

    return NextResponse.json({
      summary,
      sourcePaths: exportPaths
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось проанализировать переписки через Gemini";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
