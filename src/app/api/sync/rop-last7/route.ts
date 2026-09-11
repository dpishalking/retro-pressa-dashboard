import { NextResponse } from "next/server";
import { rejectUnlessCronOrStaff } from "@/lib/auth/cron-auth";
import { syncRopLast7DaysReport } from "@/lib/rop-weekly/last-7-days";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const denied = rejectUnlessCronOrStaff(request);
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      spreadsheetId?: string;
      endDay?: string;
      dryRun?: boolean;
    };
    const result = await syncRopLast7DaysReport({
      spreadsheetId: body.spreadsheetId,
      endDay: body.endDay,
      dryRun: body.dryRun === true
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось собрать отчёт за 7 дней";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
