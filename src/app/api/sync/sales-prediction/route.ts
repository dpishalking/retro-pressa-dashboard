import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { syncSalesPrediction } from "@/lib/sales-os/sync-prediction";

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
      period?: string;
      scope?: Array<"department" | "manager">;
      modules?: Array<
        "plans" | "fact" | "model" | "drivers" | "quality" | "view" | "recon" | "export" | "all"
      >;
      dryRun?: boolean;
      spreadsheetId?: string;
    };

    const result = await syncSalesPrediction({
      period: body.period,
      scope: body.scope,
      modules: body.modules,
      dryRun: body.dryRun === true,
      spreadsheetId: body.spreadsheetId
    });

    const status = result.status === "blocked" ? 403 : result.status === "failed" ? 500 : 200;
    return NextResponse.json(result, { status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось синхронизировать Sales Prediction";
    const code = /already running/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}
