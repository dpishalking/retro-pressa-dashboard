import { NextResponse } from "next/server";
import { syncBitrixMetrics } from "@/lib/bitrix/connector";
import { syncGa4Traffic } from "@/lib/google/ga4-connector";
import { syncGoogleTraffic } from "@/lib/google/traffic-connector";
import { buildUtmAudit } from "@/lib/utm-attribution";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";

const periods: PeriodKey[] = ["may-2026", "june-2026", "july-2026"];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { period?: string; refresh?: boolean };
    const period = periods.includes(body.period as PeriodKey) ? body.period as PeriodKey : "july-2026";
    const refresh = body.refresh === true;

    if (refresh) {
      await Promise.all([
        syncGa4Traffic({ period, refresh: true }),
        syncGoogleTraffic({ period, refresh: true }),
        syncBitrixMetrics({ period, refresh: true })
      ]);
    }

    const audit = await buildUtmAudit(period);
    return NextResponse.json(audit);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UTM audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
