import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { requirePartnerSession } from "@/lib/partners/access";
import { listPartnerMaterials } from "@/lib/partners/content";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requirePartnerSession(readSessionCookie(request.headers.get("cookie")));
    const materials = await listPartnerMaterials();
    return NextResponse.json({ materials });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    const status = message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
