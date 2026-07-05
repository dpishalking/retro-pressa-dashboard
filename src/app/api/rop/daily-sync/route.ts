import { NextResponse } from "next/server";
import { syncBitrixConversationHistory } from "@/lib/bitrix/conversation-connector";
import { syncBitrixMetrics } from "@/lib/bitrix/connector";
import { currentPeriodKey } from "@/lib/conversation-periods";
import { syncGoogleTraffic } from "@/lib/google/traffic-connector";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      refresh?: boolean;
      daysBack?: number;
      dialogLimit?: number;
      period?: PeriodKey;
      incremental?: boolean;
    };

    const period = body.period ?? currentPeriodKey();

    const [bitrix, google, conversations] = await Promise.all([
      syncBitrixMetrics({ refresh: body.refresh === true, period }),
      syncGoogleTraffic({ refresh: body.refresh === true, period }),
      syncBitrixConversationHistory({
        period,
        daysBack: body.daysBack ?? 1,
        dialogLimit: body.dialogLimit ?? 40,
        incremental: body.incremental !== false
      })
    ]);

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      period,
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
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить ежедневный sync";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
