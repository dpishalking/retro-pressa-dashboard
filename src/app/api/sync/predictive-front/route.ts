import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { moscowPeriodKey } from "@/lib/moscow-time";
import { refreshPredictiveSalesFrontFromWorkbook } from "@/lib/sales-os/sync-predictive";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isoMonthFromPeriodKey(period: PeriodKey): string {
  if (period === "may-2026") return "2026-05";
  if (period === "june-2026") return "2026-06";
  return "2026-07";
}

/**
 * Light refresh of «Предиктивка продажи» (Sales OS Daily Fact + СВОД leads).
 * Intended for hourly cron; noon Moscow close also runs via os-daily.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SYNC_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  const provided = request.headers.get("x-cron-secret")?.trim();
  const isCron = Boolean(cronSecret && provided && provided === cronSecret);

  if (!isCron) {
    const session = readSessionCookie(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.accessLevel !== "admin" && session.accessLevel !== "rop") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      month?: string;
      period?: PeriodKey;
      dryRun?: boolean;
    };
    const month =
      body.month?.trim() ||
      (body.period ? isoMonthFromPeriodKey(body.period) : null) ||
      isoMonthFromPeriodKey(moscowPeriodKey());

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
