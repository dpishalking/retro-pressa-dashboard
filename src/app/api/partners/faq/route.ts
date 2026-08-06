import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { requirePartnerSession } from "@/lib/partners/access";
import { listPartnerFaq } from "@/lib/partners/content";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requirePartnerSession(readSessionCookie(request.headers.get("cookie")));
    const faq = await listPartnerFaq();
    return NextResponse.json({ faq });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    const status = message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
