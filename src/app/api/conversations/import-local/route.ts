import { NextResponse } from "next/server";
import { saveConversationExportFile } from "@/lib/conversation-export-store";
import { importAndAnalyzeConversationsWithDiagnostics } from "@/lib/conversation-intelligence";
import { inferPeriodKeyFromLabel } from "@/lib/conversation-periods";
import { writePeriodArchiveSnapshot } from "@/lib/conversation-snapshot-store";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({
        error: "Локальный путь к архивам отключён. Нажми «Загрузить май + июнь» и выбери файлы через браузер."
      }, { status: 400 });
    }

    const formData = await request.formData();
    const uploads = formData.getAll("files").filter((item): item is File => item instanceof File);
    const periodRaw = String(formData.get("periodKey") ?? "");
    const periodKey = (["may-2026", "june-2026", "july-2026"] as const).includes(periodRaw as PeriodKey)
      ? periodRaw as PeriodKey
      : null;

    if (!uploads.length) {
      return NextResponse.json({
        error: "Добавь хотя бы один архивный файл в поле files."
      }, { status: 400 });
    }

    const fileBuffers = await Promise.all(uploads.map(async (file) => ({
      file,
      buffer: Buffer.from(await file.arrayBuffer())
    })));
    const files = fileBuffers.map(({ file, buffer }) => ({
      filename: file.name,
      mimeType: file.type,
      content: buffer,
      defaultChannel: String(formData.get("channel") ?? "gift-ai")
    }));
    const result = importAndAnalyzeConversationsWithDiagnostics(files);

    if (!result.messages.length) {
      return NextResponse.json({
        error: "Не удалось извлечь сообщения из загруженных файлов.",
        diagnostics: result.diagnostics
      }, { status: 422 });
    }

    const importedAt = new Date().toISOString();
    const label = `gift-ai: ${uploads.map((file) => file.name).join(", ")}`;
    const resolvedPeriod = periodKey
      ?? inferPeriodKeyFromLabel(label)
      ?? inferPeriodKeyFromLabel(uploads[0]?.name ?? "");

    if (!resolvedPeriod) {
      return NextResponse.json({ error: "Не удалось определить месяц архива. Укажи periodKey или загрузи файл с «май»/«июнь» в названии." }, { status: 400 });
    }

    const summary = {
      filesLoaded: uploads.length,
      messagesLoaded: result.messages.length,
      dialogsLoaded: result.dialogs.length,
      filesParsed: result.diagnostics.filter((item) => item.status === "ok").length,
      filesFailed: result.diagnostics.filter((item) => item.status === "error").length
    };

    await Promise.all(fileBuffers.map(({ file, buffer }) => saveConversationExportFile({
      periodKey: resolvedPeriod,
      originalFilename: file.name,
      content: buffer
    })));

    await writePeriodArchiveSnapshot(resolvedPeriod, {
      version: 1,
      source: "gift-ai",
      importedAt,
      importedDay: importedAt.slice(0, 10),
      periodKey: resolvedPeriod,
      label,
      dashboard: result.dashboard,
      diagnostics: result.diagnostics,
      summary
    });

    return NextResponse.json({
      dashboard: result.dashboard,
      diagnostics: result.diagnostics,
      summary
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось импортировать локальный экспорт";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
