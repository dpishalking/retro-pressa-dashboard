import { NextResponse } from "next/server";
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
      manager?: string;
      spreadsheetId?: string;
      tabTitle?: string;
      successSource?: "bitrix" | "text";
      refreshBitrix?: boolean;
      syncLiveExport?: boolean;
      dryRun?: boolean;
      mode?: "full" | "backfill" | "incremental";
      dateFrom?: string;
      dateTo?: string;
    };

    const result = await syncManagerDialogsToSheet({
      periodKey: isPeriodKey(body.period) ? body.period : currentPeriodKey(),
      managerQuery: body.manager ?? "*",
      spreadsheetId: body.spreadsheetId,
      tabTitle: body.tabTitle,
      successSource: body.successSource ?? "text",
      refreshBitrix: body.refreshBitrix === true,
      syncLiveExport: body.syncLiveExport !== false,
      dryRun: body.dryRun === true,
      mode: body.mode ?? "incremental",
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${result.spreadsheetId}/edit`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выгрузить диалоги менеджеров в Google Sheets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
