import { NextResponse } from "next/server";
import { rejectUnlessCronOrStaff } from "@/lib/auth/cron-auth";
import { syncRopAlertsDaySummary } from "@/lib/rop-alerts/sync-day-summary";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rebuild ROP alerts workbook «Сводка дня» + detail tabs from live Bitrix.
 */
export async function POST(request: Request) {
  const denied = rejectUnlessCronOrStaff(request);
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      spreadsheetId?: string;
      dryRun?: boolean;
      includeDialogs?: boolean;
      dialogHistoryLimit?: number;
    };

    const result = await syncRopAlertsDaySummary({
      spreadsheetId: body.spreadsheetId,
      dryRun: body.dryRun === true,
      includeDialogs: body.includeDialogs !== false,
      dialogHistoryLimit: body.dialogHistoryLimit
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось обновить сводку дня из Bitrix";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
