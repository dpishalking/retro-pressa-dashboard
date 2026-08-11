import { NextResponse } from "next/server";
import { parsePeriodParam, periodToIsoMonth } from "@/lib/financial-report/period";
import { loadLandingEfficiency } from "@/lib/landings/load-landing-efficiency";
import { readSessionCookie } from "@/lib/auth/session";
import { ALX_ACTIVE_LANDINGS } from "@/config/alx-landings";

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
    const landingId = searchParams.get("id")?.trim() || "";
    const period = parsePeriodParam(searchParams.get("period"));
    const isoMonth = periodToIsoMonth(period);

    if (!landingId) {
      return NextResponse.json({
        ok: true,
        period,
        isoMonth,
        landings: ALX_ACTIVE_LANDINGS.map((l) => ({
          id: l.id,
          title: l.title,
          url: l.url,
          tag: l.tag,
          href: `/marketing/landings/${l.id}`
        }))
      });
    }

    const model = await loadLandingEfficiency({ landingId, isoMonth });
    return NextResponse.json({ ok: true, period, ...model });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить эффективность лендинга";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
