import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { moderatePartner } from "@/lib/partners/admin";
import { requireAdminSession } from "@/lib/partners/access";
import { listPartners, toPublicPartner, updatePartner } from "@/lib/partners/store";
import type { PartnerStatus } from "@/types/partners";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireAdminSession(readSessionCookie(request.headers.get("cookie")));
    const partners = await listPartners();
    return NextResponse.json({
      partners: partners
        .map(toPublicPartner)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    requireAdminSession(readSessionCookie(request.headers.get("cookie")));
    const body = (await request.json().catch(() => ({}))) as {
      partnerId?: string;
      status?: PartnerStatus;
      commissionRate?: number;
      promoCode?: string;
    };

    if (!body.partnerId) {
      return NextResponse.json({ error: "Укажите partnerId" }, { status: 400 });
    }

    if (body.status) {
      const partner = await moderatePartner({
        partnerId: body.partnerId,
        status: body.status,
        commissionRate: body.commissionRate
      });
      return NextResponse.json({ partner: toPublicPartner(partner) });
    }

    const partner = await updatePartner(body.partnerId, {
      commissionRate: body.commissionRate,
      promoCode: body.promoCode
    });
    return NextResponse.json({ partner: toPublicPartner(partner) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить партнёра";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
