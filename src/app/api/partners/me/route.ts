import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { requirePartnerSession } from "@/lib/partners/access";
import {
  findPartnerByUserId,
  listPayoutsForPartner,
  listSalesForPartner,
  toPublicPartner,
  updatePartner
} from "@/lib/partners/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = requirePartnerSession(readSessionCookie(request.headers.get("cookie")));
    let partner = await findPartnerByUserId(session.id);
    if (!partner && session.accessLevel === "admin") {
      const { listPartners } = await import("@/lib/partners/store");
      partner = (await listPartners()).find((item) => item.status === "active") ?? null;
    }

    if (!partner) {
      return NextResponse.json({ error: "Профиль партнёра не найден" }, { status: 404 });
    }

    const sales = await listSalesForPartner(partner.id);
    const payouts = await listPayoutsForPartner(partner.id);
    const conversion = partner.clicks > 0 ? partner.leads / partner.clicks : 0;

    return NextResponse.json({
      partner: toPublicPartner(partner),
      recentSales: sales.slice(0, 8),
      recentPayouts: payouts.slice(0, 5),
      conversion
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message === "Forbidden" ? "Нет доступа" : message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = requirePartnerSession(readSessionCookie(request.headers.get("cookie")));
    if (session.accessLevel !== "partner") {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const partner = await findPartnerByUserId(session.id);
    if (!partner) {
      return NextResponse.json({ error: "Профиль партнёра не найден" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      phone?: string;
      country?: string;
      payoutMethod?: string;
      payoutDetails?: string;
    };

    const updated = await updatePartner(partner.id, {
      name: body.name,
      phone: body.phone,
      country: body.country,
      payoutMethod: body.payoutMethod,
      payoutDetails: body.payoutDetails
    });

    return NextResponse.json({ partner: toPublicPartner(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить профиль";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
