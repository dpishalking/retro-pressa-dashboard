import { NextResponse } from "next/server";
import { importAndAnalyzeConversationsWithDiagnostics } from "@/lib/conversation-intelligence";
import { writeConversationSnapshot } from "@/lib/conversation-snapshot-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploads = formData.getAll("files").filter((item): item is File => item instanceof File);

    if (!uploads.length) {
      return NextResponse.json({ error: "Добавьте хотя бы один файл в поле files." }, { status: 400 });
    }

    const files = await Promise.all(uploads.map(async (file) => ({
      filename: file.name,
      mimeType: file.type,
      content: await file.arrayBuffer(),
      defaultChannel: String(formData.get("channel") ?? "manual")
    })));
    const result = importAndAnalyzeConversationsWithDiagnostics(files);

    if (!result.messages.length) {
      return NextResponse.json({
        error: "Не удалось извлечь сообщения из загруженных файлов.",
        diagnostics: result.diagnostics
      }, { status: 422 });
    }

    const importedAt = new Date().toISOString();
    const summary = {
      filesLoaded: uploads.length,
      messagesLoaded: result.messages.length,
      dialogsLoaded: result.dialogs.length,
      filesParsed: result.diagnostics.filter((item) => item.status === "ok").length,
      filesFailed: result.diagnostics.filter((item) => item.status === "error").length
    };

    await writeConversationSnapshot({
      version: 1,
      source: "manual",
      importedAt,
      importedDay: importedAt.slice(0, 10),
      label: "Ручной импорт переписок",
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
    const message = error instanceof Error ? error.message : "Не удалось импортировать переписки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
