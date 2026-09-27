import { NextResponse } from "next/server";
import { rejectUnlessCronOrStaff } from "@/lib/auth/cron-auth";
import { runLandingLeadAlerts } from "@/lib/landing-lead-alerts/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Poll Bitrix and send new leads from watched landings to Telegram. */
export async function POST(request: Request) {
  const denied = rejectUnlessCronOrStaff(request);
  if (denied) return denied;

  try {
    const result = await runLandingLeadAlerts();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось проверить лиды лендингов";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
