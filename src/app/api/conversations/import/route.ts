import { NextResponse } from "next/server";
import { importAndAnalyzeConversations } from "@/lib/conversation-intelligence";

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
    const result = importAndAnalyzeConversations(files);

    return NextResponse.json({
      ...result,
      summary: {
        filesLoaded: uploads.length,
        messagesLoaded: result.messages.length,
        dialogsLoaded: result.dialogs.length
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось импортировать переписки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
