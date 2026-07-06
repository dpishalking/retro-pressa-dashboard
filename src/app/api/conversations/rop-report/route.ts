import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { parseConversationFile } from "@/lib/conversation-intelligence";
import { readLivePeriodStore } from "@/lib/conversation-live-store";
import { buildConversationRopReport } from "@/lib/conversation-rop-report";
import type { ConversationMessage, PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const periodExportNames: Record<PeriodKey, string[]> = {
  "may-2026": [
    "retro-pressa-conversations-2026-05.json",
    "retro-pressa-conversations-2026-05.csv"
  ],
  "june-2026": [
    "retro-pressa-conversations-2026-06.json",
    "retro-pressa-conversations-2026-06.csv"
  ],
  "july-2026": [
    "retro-pressa-conversations-2026-07.json",
    "retro-pressa-conversations-2026-07.csv"
  ]
};

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readExportMessages(periodKey: PeriodKey): Promise<{ messages: ConversationMessage[]; source: string } | null> {
  const exportDir = path.join(process.cwd(), "data", "conversation-exports");
  for (const filename of periodExportNames[periodKey]) {
    const filePath = path.join(exportDir, filename);
    if (!(await fileExists(filePath))) continue;
    const messages = parseConversationFile({
      filename,
      content: await readFile(filePath),
      defaultChannel: "gift-ai"
    });
    return { messages, source: filename };
  }
  return null;
}

function isPeriodKey(value: string | null): value is PeriodKey {
  return value === "may-2026" || value === "june-2026" || value === "july-2026";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get("period");

    if (!isPeriodKey(period)) {
      return NextResponse.json({ error: "Нужно передать period: may-2026, june-2026 или july-2026." }, { status: 400 });
    }

    const exportData = await readExportMessages(period);
    const liveData = period === "july-2026" ? await readLivePeriodStore(period) : null;
    const messages = exportData?.messages ?? liveData?.messages ?? [];

    if (!messages.length) {
      return NextResponse.json({
        error: "Для этого периода нет сохранённых сырых переписок. Загрузите CSV/JSON архива месяца или обновите текущий месяц из Bitrix.",
        period
      }, { status: 404 });
    }

    return NextResponse.json({
      source: exportData?.source ?? "bitrix-live-store",
      report: buildConversationRopReport({ periodKey: period, messages })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось построить ROP-отчёт по перепискам";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
