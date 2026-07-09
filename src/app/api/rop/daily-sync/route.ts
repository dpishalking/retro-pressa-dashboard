import { NextResponse } from "next/server";
import { syncBitrixOpenLinesViaCrm } from "@/lib/bitrix/openline-crm-connector";
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
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const exportDay = yesterday.toISOString().slice(0, 10);

    const [bitrix, google, conversations] = await Promise.all([
      syncBitrixMetrics({ refresh: body.refresh === true, period }),
      syncGoogleTraffic({ refresh: body.refresh === true, period }),
      syncBitrixOpenLinesViaCrm({
        period,
        dateFrom: exportDay,
        dateTo: exportDay,
        sessionLimit: body.dialogLimit ?? 250,
      }),
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
        dialogsLoaded: conversations.summary.totalDialogs,
        messagesLoaded: conversations.summary.totalMessages,
        messagesAdded: conversations.summary.messagesAdded,
        dialogsAdded: conversations.summary.dialogsAdded,
        sessionsImported: conversations.summary.sessionsImported,
        exportDay,
        qualityScore: conversations.dashboard.qualityScore,
        potentialLostRevenue: conversations.dashboard.potentialLostRevenue,
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
