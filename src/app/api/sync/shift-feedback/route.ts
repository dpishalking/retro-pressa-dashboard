import { NextResponse } from "next/server";
import { rejectUnlessCronOrStaff } from "@/lib/auth/cron-auth";
import { syncShiftFeedback } from "@/lib/shift-feedback/sync";
import { moscowDateIso } from "@/lib/shift-feedback/time";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Evening cut of on-shift managers. Cron: 20:05 Europe/Moscow. */
export async function POST(request: Request) {
  const denied = rejectUnlessCronOrStaff(request);
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as { day?: string };
    const day = body.day && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : moscowDateIso();
    const { report, days } = await syncShiftFeedback(day);
    return NextResponse.json({
      ok: true,
      day: report.day,
      liveCut: report.liveCut,
      managers: report.managers.length,
      days
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить срез смены";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
