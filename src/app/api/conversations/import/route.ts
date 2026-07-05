import { NextResponse } from "next/server";
import { importAndAnalyzeConversationsWithDiagnostics, tryParseConversationSnapshotFile } from "@/lib/conversation-intelligence";
import { inferPeriodKeyFromLabel } from "@/lib/conversation-periods";
import { writeConversationSnapshot, writePeriodArchiveSnapshot } from "@/lib/conversation-snapshot-store";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => null) as null | {
        source?: "manual" | "gift-ai" | "bitrix";
        label?: string;
        importedAt?: string;
        importedDay?: string;
        periodKey?: PeriodKey | null;
        dashboard?: ReturnType<typeof importAndAnalyzeConversationsWithDiagnostics>["dashboard"];
        diagnostics?: ReturnType<typeof importAndAnalyzeConversationsWithDiagnostics>["diagnostics"];
        summary?: {
          filesLoaded: number;
          messagesLoaded: number;
          dialogsLoaded: number;
          filesParsed?: number;
          filesFailed?: number;
        };
      };

      if (!body?.dashboard || !body?.summary || !Array.isArray(body.diagnostics)) {
        return NextResponse.json({ error: "JSON-импорт требует dashboard, diagnostics и summary." }, { status: 400 });
      }

      const importedAt = body.importedAt ?? new Date().toISOString();
      const importedDay = body.importedDay ?? importedAt.slice(0, 10);

      const snapshot = {
        version: 1 as const,
        source: body.source ?? "manual",
        importedAt,
        importedDay,
        periodKey: body.periodKey ?? null,
        label: body.label ?? "Импорт переписок",
        dashboard: body.dashboard,
        diagnostics: body.diagnostics,
        summary: body.summary
      };

      if (body.periodKey && body.source !== "bitrix") {
        await writePeriodArchiveSnapshot(body.periodKey, snapshot);
      } else {
        await writeConversationSnapshot(snapshot);
      }

      return NextResponse.json({
        dashboard: body.dashboard,
        diagnostics: body.diagnostics,
        summary: body.summary
      });
    }

    const formData = await request.formData();
    const uploads = formData.getAll("files").filter((item): item is File => item instanceof File);
    const source = String(formData.get("source") ?? "manual") as "manual" | "gift-ai" | "bitrix";
    const periodRaw = String(formData.get("periodKey") ?? "");
    const periodKey = (["may-2026", "june-2026", "july-2026"] as const).includes(periodRaw as PeriodKey)
      ? periodRaw as PeriodKey
      : null;
    const label = String(formData.get("label") ?? "").trim();

    if (!uploads.length) {
      return NextResponse.json({ error: "Добавьте хотя бы один файл в поле files." }, { status: 400 });
    }

    const files = await Promise.all(uploads.map(async (file) => ({
      filename: file.name,
      mimeType: file.type,
      content: await file.arrayBuffer(),
      defaultChannel: String(formData.get("channel") ?? (source === "gift-ai" ? "gift-ai" : "manual"))
    })));

    const snapshotUpload = files
      .map((file) => ({ file, snapshot: tryParseConversationSnapshotFile(file) }))
      .find((item) => item.snapshot)?.snapshot;

    if (snapshotUpload) {
      const importedAt = snapshotUpload.importedAt ?? new Date().toISOString();
      const resolvedPeriod = periodKey
        ?? snapshotUpload.periodKey
        ?? inferPeriodKeyFromLabel(label)
        ?? inferPeriodKeyFromLabel(uploads.map((file) => file.name).join(" "));
      const snapshot = {
        version: 1 as const,
        source: snapshotUpload.source ?? (source === "gift-ai" ? "gift-ai" as const : "manual" as const),
        importedAt,
        importedDay: snapshotUpload.importedDay ?? importedAt.slice(0, 10),
        periodKey: resolvedPeriod,
        label: label || snapshotUpload.label || `Архив: ${uploads.map((file) => file.name).join(", ")}`,
        dashboard: snapshotUpload.dashboard,
        diagnostics: snapshotUpload.diagnostics,
        summary: snapshotUpload.summary
      };

      if (resolvedPeriod) {
        await writePeriodArchiveSnapshot(resolvedPeriod, snapshot);
      } else {
        await writeConversationSnapshot(snapshot);
      }

      return NextResponse.json({
        dashboard: snapshot.dashboard,
        diagnostics: snapshot.diagnostics,
        summary: snapshot.summary
      });
    }

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
    const defaultLabel = source === "gift-ai"
      ? `gift-ai: ${uploads.map((file) => file.name).join(", ")}`
      : "Ручной импорт переписок";

    const snapshot = {
      version: 1 as const,
      source: source === "gift-ai" ? "gift-ai" as const : "manual" as const,
      importedAt,
      importedDay: importedAt.slice(0, 10),
      periodKey,
      label: label || defaultLabel,
      dashboard: result.dashboard,
      diagnostics: result.diagnostics,
      summary
    };

    if (periodKey) {
      await writePeriodArchiveSnapshot(periodKey, snapshot);
    } else {
      await writeConversationSnapshot(snapshot);
    }

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
