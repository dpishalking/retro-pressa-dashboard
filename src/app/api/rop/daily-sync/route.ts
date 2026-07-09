import { NextResponse } from "next/server";
import { syncBitrixConversationHistory } from "@/lib/bitrix/conversation-connector";
import { syncBitrixMetrics } from "@/lib/bitrix/connector";
import { buildCompanySnapshot } from "@/lib/company-snapshot/build-snapshot";
import { writeCompanySnapshot } from "@/lib/company-snapshot/snapshot-store";
import { syncLiveStoreToExportFile } from "@/lib/conversation-live-export";
import { currentPeriodKey } from "@/lib/conversation-periods";
import { syncManagerDialogsToSheet } from "@/lib/manager-dialogs-sheet-sync";
import { syncGoogleTraffic } from "@/lib/google/traffic-connector";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      refresh?: boolean;
      daysBack?: number;
      dialogLimit?: number;
      period?: PeriodKey;
      incremental?: boolean;
      exportToSheet?: boolean;
      manager?: string;
      spreadsheetId?: string;
      tabTitle?: string;
      sheetMode?: "full" | "backfill" | "incremental";
    };

    const period = body.period ?? currentPeriodKey();

    const [bitrix, google, conversations] = await Promise.all([
      syncBitrixMetrics({ refresh: body.refresh === true, period }),
      syncGoogleTraffic({ refresh: body.refresh === true, period }),
      syncBitrixConversationHistory({
        period,
        daysBack: body.daysBack ?? 3,
        dialogLimit: body.dialogLimit ?? 250,
        maxDialogLimit: 250,
        incremental: body.incremental !== false
      })
    ]);

    const liveExport = await syncLiveStoreToExportFile(period);

    let sheetExport: Awaited<ReturnType<typeof syncManagerDialogsToSheet>> | null = null;
    if (body.exportToSheet !== false) {
      sheetExport = await syncManagerDialogsToSheet({
        periodKey: period,
        managerQuery: body.manager ?? "*",
        spreadsheetId: body.spreadsheetId,
        tabTitle: body.tabTitle,
        successSource: "text",
        refreshBitrix: false,
        syncLiveExport: false,
        mode: body.sheetMode ?? "incremental",
      });
    }

    const companySnapshot = await buildCompanySnapshot({ period, refresh: false });
    await writeCompanySnapshot(companySnapshot);

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      period,
      companySnapshot: {
        builtAt: companySnapshot.meta.builtAt,
        dataMode: companySnapshot.meta.dataMode,
        reconciliations: companySnapshot.meta.reconciliations.length,
        revenue: companySnapshot.canonical.revenue,
        paidLeads: companySnapshot.canonical.paidLeads
      },
      bitrix: {
        revenue: bitrix.monthly.revenue,
        salesCount: bitrix.monthly.salesCount,
        dealsLoaded: bitrix.summary.dealsLoaded
      },
      google: {
        rowsLoaded: google.summary.rowsLoaded,
        spend: google.summary.spend,
        ql: google.summary.ql
      },
      conversations: {
        dialogsLoaded: conversations.summary.totalDialogs ?? conversations.summary.dialogsLoaded,
        messagesLoaded: conversations.summary.totalMessages ?? conversations.summary.messagesLoaded,
        messagesAdded: conversations.summary.messagesAdded ?? 0,
        dialogsAdded: conversations.summary.dialogsAdded ?? 0,
        qualityScore: conversations.dashboard.qualityScore,
        potentialLostRevenue: conversations.dashboard.potentialLostRevenue,
        incremental: conversations.summary.incremental === true
      },
      liveExport,
      sheetExport: sheetExport ? {
        uploaded: sheetExport.uploaded,
        mode: sheetExport.mode,
        totalDialogs: sheetExport.totalDialogs,
        exportedDialogs: sheetExport.exportedDialogs,
        skippedDialogs: sheetExport.skippedDialogs,
        spreadsheetId: sheetExport.spreadsheetId,
        tabTitle: sheetExport.tabTitle,
        dateFrom: sheetExport.dateFrom,
        dateTo: sheetExport.dateTo,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetExport.spreadsheetId}/edit`
      } : null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить ежедневный sync";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
