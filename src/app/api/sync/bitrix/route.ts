import { NextResponse } from "next/server";
import { syncBitrixMetrics } from "@/lib/bitrix/connector";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";

const periods: PeriodKey[] = ["may-2026", "june-2026", "july-2026"];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { period?: string; country?: string; manager?: string; product?: string; refresh?: boolean };
    const period = periods.includes(body.period as PeriodKey) ? body.period as PeriodKey : "july-2026";
    const country = body.country && body.country !== "all" ? body.country : undefined;
    const manager = body.manager && body.manager !== "all" ? body.manager : undefined;
    const product = body.product && body.product !== "all" ? body.product : undefined;
    const payload = await syncBitrixMetrics({ period, country, manager, product, refresh: body.refresh === true });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Bitrix sync error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
