import { NextResponse } from "next/server";
import { rejectUnlessCronOrStaff } from "@/lib/auth/cron-auth";
import { moscowDateIso, moscowIsoMonth } from "@/lib/moscow-time";
import { bootstrapPredictiveSheets } from "@/lib/predictive-sheets/bootstrap";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Refresh RP | Предиктивки (CEO plans + Bitrix + СВОД).
 * Cron: every 3 hours via GitHub Actions → Timeweb curl.
 * Formatting skipped by default (write quota); pass formatOnly for CF/layout.
 */
export async function POST(request: Request) {
  const denied = rejectUnlessCronOrStaff(request);
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      month?: string;
      asOf?: string;
      skipFormatting?: boolean;
      formatOnly?: boolean;
    };
    const month = body.month?.trim() || moscowIsoMonth();
    const asOfDate = body.asOf?.trim() || moscowDateIso();
    const formatOnly = body.formatOnly === true;
    const skipFormatting = formatOnly ? false : body.skipFormatting !== false;

    const result = await bootstrapPredictiveSheets({
      period: month,
      asOfDate,
      skipFormatting,
      formatOnly
    });

    return NextResponse.json({
      ok: true,
      timezone: "Europe/Moscow",
      month,
      asOf: asOfDate,
      skipFormatting,
      formatOnly,
      syncedAt: new Date().toISOString(),
      result
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось обновить RP | Предиктивки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
