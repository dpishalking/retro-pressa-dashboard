import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { syncOsTrafficToSheet } from "@/lib/os-sheets/traffic-sync";
import { currentPeriodKey } from "@/lib/conversation-periods";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const periods: PeriodKey[] = ["may-2026", "june-2026", "july-2026"];

export async function POST(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.accessLevel !== "admin" && session.accessLevel !== "rop") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({})) as {
      period?: string;
      spreadsheetId?: string;
      refreshGoogle?: boolean;
      dryRun?: boolean;
    };

    const period = periods.includes(body.period as PeriodKey)
      ? body.period as PeriodKey
      : currentPeriodKey();

    const result = await syncOsTrafficToSheet({
      period,
      spreadsheetId: body.spreadsheetId,
      refreshGoogle: body.refreshGoogle === true,
      dryRun: body.dryRun === true
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось синхронизировать трафик в Google Sheets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
