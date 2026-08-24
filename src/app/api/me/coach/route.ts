import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { ManagerCabinetAccessError, requireManagerCabinetSession } from "@/lib/manager-cabinet/access";
import { loadYesterdayCoach } from "@/lib/manager-cabinet/coach";
import { firstNameFrom } from "@/lib/manager-cabinet/dates";
import { resolveCabinetSessionTarget } from "@/lib/manager-cabinet/service";
import type { ManagerCoachPayload } from "@/lib/manager-cabinet/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/me/coach?managerId=
 * Yesterday chat review in plain language. mop: own Bitrix only.
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireManagerCabinetSession(readSessionCookie(request.headers.get("cookie")));
    const { target } = await resolveCabinetSessionTarget({
      session,
      managerId: request.nextUrl.searchParams.get("managerId")
    });
    const firstName = firstNameFrom(target.managerName || target.authName || session.name);
    if (!target.bitrixUserId || !target.managerName) {
      const payload: ManagerCoachPayload = {
        ok: true,
        managerName: target.managerName,
        firstName,
        review: {
          day: "",
          dialogs: 0,
          headline: null,
          good: [],
          better: [],
          tryToday: null,
          emptyHint: "Сначала привяжи кабинет к менеджеру Bitrix — тогда появится разбор вчерашних чатов."
        }
      };
      return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
    }

    const review = await loadYesterdayCoach({
      bitrixUserId: target.bitrixUserId,
      managerName: target.managerName
    });
    const payload: ManagerCoachPayload = {
      ok: true,
      managerName: target.managerName,
      firstName,
      review
    };
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ManagerCabinetAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Не удалось разобрать вчерашние чаты";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
