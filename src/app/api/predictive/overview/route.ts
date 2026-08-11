import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { parsePeriodParam } from "@/lib/financial-report/period";
import { loadPredictiveOverview } from "@/lib/predictive/load-overview";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.accessLevel !== "admin" && session.accessLevel !== "rop") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = parsePeriodParam(searchParams.get("period"));
    const overview = await loadPredictiveOverview(period, {
      marketingScope: searchParams.get("scope") ?? searchParams.get("marketingScope")
    });
    return NextResponse.json({ ok: true, ...overview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить предиктивные модели";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
