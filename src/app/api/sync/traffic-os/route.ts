import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { syncTrafficOs } from "@/lib/traffic-os/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.accessLevel !== "admin" && session.accessLevel !== "rop") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      periods?: string[];
      modules?: string[];
      dryRun?: boolean;
      spreadsheetId?: string;
    };

    const result = await syncTrafficOs({
      periods: body.periods,
      modules: body.modules,
      dryRun: body.dryRun === true,
      spreadsheetId: body.spreadsheetId
    });

    const status = result.status === "blocked" ? 403 : result.status === "failed" ? 500 : 200;
    return NextResponse.json(result, { status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось синхронизировать Traffic OS";
    const code = /already running/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}
