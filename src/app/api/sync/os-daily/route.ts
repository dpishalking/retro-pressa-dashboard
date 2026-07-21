import { NextResponse } from "next/server";
import { moscowPeriodKey, moscowYesterdayIso } from "@/lib/moscow-time";
import { syncOsOrdersToSheet } from "@/lib/os-sheets/orders-sync";
import { syncOsTrafficToSheet } from "@/lib/os-sheets/traffic-sync";
import { syncOsFinanceToSheet } from "@/lib/os-sheets/finance-sync";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const periods: PeriodKey[] = ["may-2026", "june-2026", "july-2026"];

/**
 * Morning OS sheet refresh (Orders + Traffic + Органика + Finance).
 * Intended for cron at 12:00 Europe/Moscow with x-cron-secret header.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      period?: string;
      refresh?: boolean;
    };

    const targetDay = moscowYesterdayIso();
    const period = periods.includes(body.period as PeriodKey)
      ? body.period as PeriodKey
      : moscowPeriodKey();
    const refresh = body.refresh !== false;

    const [orders, traffic] = await Promise.all([
      syncOsOrdersToSheet({ period, refreshBitrix: refresh }),
      syncOsTrafficToSheet({ period, refreshGoogle: refresh })
    ]);

    const finance = await syncOsFinanceToSheet({ period });

    return NextResponse.json({
      ok: true,
      timezone: "Europe/Moscow",
      targetDay,
      period,
      syncedAt: new Date().toISOString(),
      orders,
      traffic,
      finance
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить ежедневный OS sync";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
