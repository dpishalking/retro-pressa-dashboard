import { NextResponse } from "next/server";
import { rejectUnlessCronOrStaff } from "@/lib/auth/cron-auth";
import { moscowIsoMonth } from "@/lib/moscow-time";
import { syncMonthlyPlanFacts } from "@/lib/sales-os/sync-monthly-plan-facts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/sync/monthly-plan-facts
 * Write Fact column in RP | Finance → «План/факт» (ОБЩИЕ / Facebook / Яндекс / Органика).
 * Plan cells are never touched. Auth: cron secret or admin/rop.
 */
export async function POST(request: Request) {
  const denied = rejectUnlessCronOrStaff(request);
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      month?: string;
      dryRun?: boolean;
    };
    const month = body.month?.trim() || moscowIsoMonth();
    const result = await syncMonthlyPlanFacts({
      month,
      dryRun: body.dryRun === true
    });
    return NextResponse.json({
      ...result,
      timezone: "Europe/Riga",
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить факт в «План/факт»";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
