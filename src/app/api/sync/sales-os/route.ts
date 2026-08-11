import { NextResponse } from "next/server";
import { rejectUnlessCronOrStaff } from "@/lib/auth/cron-auth";
import { syncSalesOsModel } from "@/lib/sales-os/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

export async function POST(request: Request) {
  const denied = rejectUnlessCronOrStaff(request);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({})) as {
      periods?: string[];
      dryRun?: boolean;
      spreadsheetId?: string;
      sourceSpreadsheetId?: string;
    };

    const result = await syncSalesOsModel({
      periods: body.periods,
      dryRun: body.dryRun === true,
      spreadsheetId: body.spreadsheetId,
      sourceSpreadsheetId: body.sourceSpreadsheetId
    });

    const status = result.status === "blocked" ? 403 : result.status === "failed" ? 500 : 200;
    return NextResponse.json(result, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось синхронизировать Sales OS";
    const code = /already running/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}
