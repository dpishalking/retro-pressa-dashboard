import { NextResponse } from "next/server";
import { syncBitrixConversationHistory } from "@/lib/bitrix/conversation-connector";
import { syncLiveStoreToExportFile } from "@/lib/conversation-live-export";
import { syncManagerDialogsToSheet } from "@/lib/manager-dialogs-sheet-sync";
import { currentPeriodKey } from "@/lib/conversation-periods";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isPeriodKey(value: unknown): value is PeriodKey {
  return value === "may-2026" || value === "june-2026" || value === "july-2026";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      period?: PeriodKey;
      dateFrom?: string;
      dateTo?: string;
      daysBack?: number;
      dialogLimit?: number;
      spreadsheetId?: string;
      tabTitle?: string;
      dryRun?: boolean;
    };

    const periodKey = isPeriodKey(body.period) ? body.period : currentPeriodKey();
    const dateFrom = body.dateFrom ?? "2026-07-01";
    const dateTo = body.dateTo ?? "2026-07-08";

    const conversations = await syncBitrixConversationHistory({
      period: periodKey,
      incremental: true,
      daysBack: body.daysBack ?? 10,
      maxDaysBack: 10,
      dialogLimit: body.dialogLimit ?? 300,
      maxDialogLimit: 300,
    });

    const liveExport = await syncLiveStoreToExportFile(periodKey);
    const sheetExport = await syncManagerDialogsToSheet({
      periodKey,
      managerQuery: "*",
      spreadsheetId: body.spreadsheetId,
      tabTitle: body.tabTitle,
      successSource: "text",
      syncLiveExport: false,
      dryRun: body.dryRun === true,
      mode: "backfill",
      dateFrom,
      dateTo,
    });

    return NextResponse.json({
      ok: true,
      periodKey,
      dateFrom,
      dateTo,
      conversations: {
        messagesAdded: conversations.summary.messagesAdded ?? 0,
        dialogsAdded: conversations.summary.dialogsAdded ?? 0,
        totalDialogs: conversations.summary.totalDialogs ?? conversations.summary.dialogsLoaded,
        totalMessages: conversations.summary.totalMessages ?? conversations.summary.messagesLoaded,
      },
      liveExport,
      sheetExport,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetExport.spreadsheetId}/edit`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить backfill диалогов";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
