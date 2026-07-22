import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import {
  SALES_FOUNDATION_SYNC_ORDER,
  type SalesFoundationModule
} from "@/config/sales-foundation";
import { syncBitrixSalesFoundation } from "@/lib/bitrix/sales-foundation/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const allowedModules = new Set<SalesFoundationModule>([...SALES_FOUNDATION_SYNC_ORDER, "all"]);

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
      periods?: string[];
      modules?: string[];
      dryRun?: boolean;
      spreadsheetId?: string;
      maxDialogSessions?: number;
    };

    const modules = (body.modules?.length ? body.modules : ["all"])
      .map((value) => value.trim())
      .filter((value): value is SalesFoundationModule => allowedModules.has(value as SalesFoundationModule));

    if (!modules.length) {
      return NextResponse.json({ error: "No valid modules provided" }, { status: 400 });
    }

    const result = await syncBitrixSalesFoundation({
      periods: body.periods,
      modules,
      dryRun: body.dryRun === true,
      spreadsheetId: body.spreadsheetId,
      maxDialogSessions: body.maxDialogSessions
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить Bitrix Sales Foundation sync";
    const status = /already running/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
