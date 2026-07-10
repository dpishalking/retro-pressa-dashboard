import { NextResponse } from "next/server";
import { syncGa4Traffic } from "@/lib/google/ga4-connector";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const periods: PeriodKey[] = ["may-2026", "june-2026", "july-2026"];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { period?: string; refresh?: boolean };
    const period = periods.includes(body.period as PeriodKey) ? body.period as PeriodKey : "july-2026";
    const payload = await syncGa4Traffic({ period, refresh: body.refresh === true });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown GA4 sync error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
