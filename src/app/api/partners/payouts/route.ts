import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { requirePartnerSession } from "@/lib/partners/access";
import { findPartnerByUserId, listPayoutsForPartner } from "@/lib/partners/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = requirePartnerSession(readSessionCookie(request.headers.get("cookie")));
    let partner = await findPartnerByUserId(session.id);
    if (!partner && session.accessLevel === "admin") {
      const { listPartners } = await import("@/lib/partners/store");
      partner = (await listPartners()).find((item) => item.status === "active") ?? null;
    }
    if (!partner) return NextResponse.json({ error: "Профиль партнёра не найден" }, { status: 404 });
    const payouts = await listPayoutsForPartner(partner.id);
    return NextResponse.json({ payouts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    const status = message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
