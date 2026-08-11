import { NextResponse } from "next/server";
import { rejectUnlessCronOrStaff } from "@/lib/auth/cron-auth";
import {
  syncMarketingPlanning,
  type MarketingPlanningModule
} from "@/lib/marketing-planning/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const denied = rejectUnlessCronOrStaff(request);
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      periods?: string[];
      modules?: MarketingPlanningModule[];
      dryRun?: boolean;
      spreadsheetId?: string;
    };

    const result = await syncMarketingPlanning({
      periods: body.periods,
      modules: body.modules,
      dryRun: body.dryRun === true,
      spreadsheetId: body.spreadsheetId
    });

    const status = result.status === "blocked" ? 403 : result.status === "failed" ? 500 : 200;
    return NextResponse.json(result, { status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось синхронизировать Marketing Planning";
    const code = /already running/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}
