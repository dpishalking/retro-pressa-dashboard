import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { syncOsOrdersToSheet } from "@/lib/os-sheets/orders-sync";
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
      refreshBitrix?: boolean;
      dryRun?: boolean;
    };

    const period = periods.includes(body.period as PeriodKey)
      ? body.period as PeriodKey
      : currentPeriodKey();

    const result = await syncOsOrdersToSheet({
      period,
      spreadsheetId: body.spreadsheetId,
      refreshBitrix: body.refreshBitrix === true,
      dryRun: body.dryRun === true
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось синхронизировать заказы в Google Sheets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
