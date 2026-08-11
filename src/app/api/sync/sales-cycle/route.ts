import { NextResponse } from "next/server";
import { warmSalesCycleCaches } from "@/lib/analytics-os/sales-cycle";
import type { CohortGrain } from "@/lib/analytics-os/sales-cycle/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/sync/sales-cycle
 * Precompute cohort / sales-cycle payloads into data/sales-cycle-cache.
 * Auth: session or x-cron-secret.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      periods?: string[];
      grains?: CohortGrain[];
    };
    const grains = (body.grains || []).filter(
      (grain): grain is CohortGrain => grain === "day" || grain === "week" || grain === "month"
    );
    const result = await warmSalesCycleCaches({
      periods: body.periods,
      grains: grains.length ? grains : undefined
    });
    return NextResponse.json({
      ok: result.errors.length === 0,
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось прогреть sales-cycle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
