import { NextResponse } from "next/server";
import { currentPeriodKey } from "@/lib/conversation-periods";
import { buildCompanySnapshot, getCompanySnapshot } from "@/lib/company-snapshot/build-snapshot";
import { computeTwin } from "@/lib/digital-twin/compute";
import { buildCanonicalFinancialReport } from "@/lib/financial-report/build";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") as PeriodKey | null) ?? currentPeriodKey();
    const refresh = searchParams.get("refresh") === "1";

    const payload = await getCompanySnapshot({ period, refresh, forceRebuild: refresh });
    const twin = computeTwin({ snapshot: payload.snapshot });
    const financial = await buildCanonicalFinancialReport({
      period,
      mode: "FACT"
    });

    return NextResponse.json({
      ok: true,
      builtAt: payload.builtAt,
      fromCache: payload.fromCache,
      dataMode: payload.snapshot.meta.dataMode,
      reconciliations: payload.snapshot.meta.reconciliations,
      sources: payload.snapshot.meta.sources,
      canonical: payload.snapshot.canonical,
      snapshot: payload.snapshot,
      previous: payload.previous,
      financial: {
        netProfit: financial.summary.netProfit,
        revenue: financial.summary.revenue,
        grossMargin: financial.pnl.grossMargin.value,
        dataQuality: financial.dataQuality,
        forecast30d: financial.forecast.points.find((p) => p.horizonDays === 30),
        mode: financial.planning.mode
      },
      twinSummary: {
        revenue: twin.financials.revenue,
        netProfit: twin.financials.netProfit,
        topRecommendation: twin.recommendations[0] ?? null,
        bottleneck: twin.constraints.find((c) => c.isBottleneck) ?? null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось собрать Company Snapshot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      period?: PeriodKey;
      refresh?: boolean;
    };

    const period = body.period ?? currentPeriodKey();
    const snapshot = await buildCompanySnapshot({ period, refresh: body.refresh === true });

    return NextResponse.json({
      ok: true,
      builtAt: snapshot.meta.builtAt,
      dataMode: snapshot.meta.dataMode,
      reconciliations: snapshot.meta.reconciliations,
      snapshot
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось пересобрать Company Snapshot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
