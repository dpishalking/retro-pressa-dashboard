import { NextResponse } from "next/server";
import { syncBitrixOpenLinesViaCrm } from "@/lib/bitrix/openline-crm-connector";
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
      startOffset?: number;
      dialogLimit?: number;
      spreadsheetId?: string;
      tabTitle?: string;
      dryRun?: boolean;
      skipSheet?: boolean;
    };

    const periodKey = isPeriodKey(body.period) ? body.period : currentPeriodKey();
    const dateFrom = body.dateFrom ?? "2026-07-01";
    const dateTo = body.dateTo ?? "2026-07-08";

    const conversations = await syncBitrixOpenLinesViaCrm({
      period: periodKey,
      dateFrom,
      dateTo,
      sessionLimit: body.dialogLimit ?? 300,
      startOffset: body.startOffset ?? 0,
    });

    const liveExport = await syncLiveStoreToExportFile(periodKey);
    const sheetExport = body.skipSheet === true
      ? null
      : await syncManagerDialogsToSheet({
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
        activitiesScanned: conversations.summary.activitiesScanned,
        sessionsImported: conversations.summary.sessionsImported,
        messagesAdded: conversations.summary.messagesAdded,
        dialogsAdded: conversations.summary.dialogsAdded,
        totalDialogs: conversations.summary.totalDialogs,
        totalMessages: conversations.summary.totalMessages,
        nextOffset: conversations.summary.nextOffset,
        hasMore: conversations.summary.hasMore,
      },
      liveExport,
      sheetExport,
      sheetUrl: sheetExport
        ? `https://docs.google.com/spreadsheets/d/${sheetExport.spreadsheetId}/edit`
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить backfill диалогов";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
