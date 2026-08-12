import { NextRequest, NextResponse } from "next/server";
import { getCachedCeoSnapshot } from "@/lib/analytics-os/ceo-snapshot-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/ceo-snapshot?period=YYYY-MM&country=&managerId=&productId=
 * Auth: session required (middleware). Read-only — never triggers heavy sync.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const snapshot = await getCachedCeoSnapshot({
      period: searchParams.get("period"),
      country: searchParams.get("country"),
      managerId: searchParams.get("managerId"),
      productId: searchParams.get("productId")
    });
    return NextResponse.json(snapshot, {
      headers: { "cache-control": "private, max-age=60, stale-while-revalidate=240" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить CEO snapshot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
