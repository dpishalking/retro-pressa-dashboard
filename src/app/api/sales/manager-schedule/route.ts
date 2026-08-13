import { NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/auth/access";
import { readSessionCookie } from "@/lib/auth/session";
import { loadManagerSchedule } from "@/lib/sales/load-manager-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function requireSales(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessRoute(session.accessLevel, "/sales")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const denied = requireSales(request);
  if (denied) return denied;

  try {
    const month = new URL(request.url).searchParams.get("month");
    const payload = await loadManagerSchedule(month);
    return NextResponse.json({ ok: true, ...payload }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить график менеджеров";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
