import { NextResponse } from "next/server";
import { rejectUnlessCronOrStaff } from "@/lib/auth/cron-auth";
import { syncRopWeeklyReport } from "@/lib/rop-weekly/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Weekly ROP report from Bitrix → sheet «РОП · неделя».
 */
export async function POST(request: Request) {
  const denied = rejectUnlessCronOrStaff(request);
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      spreadsheetId?: string;
      weekOf?: string;
      dryRun?: boolean;
    };

    const result = await syncRopWeeklyReport({
      spreadsheetId: body.spreadsheetId,
      weekOf: body.weekOf,
      dryRun: body.dryRun === true
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось обновить недельный отчёт РОП";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
