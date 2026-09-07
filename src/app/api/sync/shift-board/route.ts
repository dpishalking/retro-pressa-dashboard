import { NextResponse } from "next/server";
import { rejectUnlessCronOrStaff } from "@/lib/auth/cron-auth";
import { syncShiftBoard } from "@/lib/shift-board/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Sync shift board spreadsheet: one tab per manager on shift / taking leads today.
 */
export async function POST(request: Request) {
  const denied = rejectUnlessCronOrStaff(request);
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      spreadsheetId?: string;
      day?: string;
      dryRun?: boolean;
    };

    const result = await syncShiftBoard({
      spreadsheetId: body.spreadsheetId,
      day: body.day,
      dryRun: body.dryRun === true
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить табло смены";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
