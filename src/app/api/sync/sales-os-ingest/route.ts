import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { runSalesOsDualRun } from "@/lib/os-sheets/sales-os-dual-run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.accessLevel !== "admin" && session.accessLevel !== "rop") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({})) as {
      periods?: string[];
      dryRun?: boolean;
      runReconciliation?: boolean;
      rebuildSalesOs?: boolean;
    };

    const result = await runSalesOsDualRun({
      periods: body.periods,
      dryRun: body.dryRun === true,
      runReconciliation: body.runReconciliation !== false,
      rebuildSalesOs: body.rebuildSalesOs === true
    });

    return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Sales OS ingest failed"
    }, { status: 500 });
  }
}
