import { NextResponse } from "next/server";
import { rejectUnlessCronOrStaff } from "@/lib/auth/cron-auth";
import { moscowIsoMonth, periodKeyToIsoMonth } from "@/lib/moscow-time";
import { refreshPredictiveSalesFrontFromWorkbook } from "@/lib/sales-os/sync-predictive";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Light refresh of «Предиктивка продажи» (Sales OS Daily Fact + СВОД leads).
 * Intended for hourly cron; noon Moscow close also runs via os-daily.
 */
export async function POST(request: Request) {
  const denied = rejectUnlessCronOrStaff(request);
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      month?: string;
      period?: PeriodKey;
      dryRun?: boolean;
    };
    const month =
      body.month?.trim() ||
      (body.period ? periodKeyToIsoMonth(body.period) : null) ||
      moscowIsoMonth();

    const result = await refreshPredictiveSalesFrontFromWorkbook({
      month,
      dryRun: body.dryRun === true
    });

    return NextResponse.json({
      ok: true,
      timezone: "Europe/Moscow",
      month,
      syncedAt: new Date().toISOString(),
      result
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось обновить предиктивку продаж";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
