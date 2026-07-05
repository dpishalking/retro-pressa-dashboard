import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { NextResponse } from "next/server";
import { importAndAnalyzeConversationsWithDiagnostics } from "@/lib/conversation-intelligence";

export const dynamic = "force-dynamic";

const allowedExportRoot = "/Users/danielpishchalkin/Documents/pressa/gift-ai/backend/data/exports/";
const exportFiles = {
  may: `${allowedExportRoot}retro-pressa-conversations-2026-05.json`,
  mayCsv: `${allowedExportRoot}retro-pressa-conversations-2026-05.csv`,
  june: `${allowedExportRoot}retro-pressa-conversations-2026-06.json`
} as const;

function selectedExportPaths(body: { key?: string; path?: string }) {
  if (body.path) return [body.path];
  if (body.key === "may") return [exportFiles.may];
  if (body.key === "may-csv") return [exportFiles.mayCsv];
  if (body.key === "may-june") return [exportFiles.may, exportFiles.june];
  return [exportFiles.june];
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { key?: string; path?: string };
    const exportPaths = selectedExportPaths(body);

    if (exportPaths.some((path) => !path.startsWith(allowedExportRoot) || !/\.(csv|json)$/.test(path))) {
      return NextResponse.json({ error: "Можно загружать только CSV/JSON-экспорты из папки gift-ai/backend/data/exports." }, { status: 400 });
    }

    const files = await Promise.all(exportPaths.map(async (exportPath) => ({
      filename: basename(exportPath),
      mimeType: exportPath.endsWith(".csv") ? "text/csv" : "application/json",
      content: await readFile(exportPath),
      defaultChannel: "gift-ai"
    })));
    const result = importAndAnalyzeConversationsWithDiagnostics(files);

    if (!result.messages.length) {
      return NextResponse.json({
        error: "Не удалось извлечь сообщения из локального экспорта.",
        diagnostics: result.diagnostics
      }, { status: 422 });
    }

    return NextResponse.json({
      dashboard: result.dashboard,
      diagnostics: result.diagnostics,
      sourcePaths: exportPaths,
      summary: {
        filesLoaded: exportPaths.length,
        messagesLoaded: result.messages.length,
        dialogsLoaded: result.dialogs.length,
        filesParsed: result.diagnostics.filter((item) => item.status === "ok").length,
        filesFailed: result.diagnostics.filter((item) => item.status === "error").length
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось импортировать локальный экспорт";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
