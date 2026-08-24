import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { ManagerCabinetAccessError, requireManagerCabinetSession } from "@/lib/manager-cabinet/access";
import { loadManagerCabinet } from "@/lib/manager-cabinet/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/me/cabinet?period=YYYY-MM&window=month|h1|h2&managerId=
 * mop: own Bitrix stats only. admin|rop may pick managerId (auth user or Bitrix id).
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireManagerCabinetSession(readSessionCookie(request.headers.get("cookie")));
    const params = request.nextUrl.searchParams;
    const payload = await loadManagerCabinet({
      session,
      period: params.get("period"),
      window: params.get("window"),
      managerId: params.get("managerId")
    });
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ManagerCabinetAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Не удалось загрузить кабинет менеджера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
