import { NextRequest, NextResponse } from "next/server";
import { loadCeoSnapshot } from "@/lib/analytics-os/load-ceo-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/ceo-snapshot?period=YYYY-MM&country=&managerId=&productId=
 * Auth: session required (middleware). Read-only — never triggers heavy sync.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const snapshot = await loadCeoSnapshot({
      period: searchParams.get("period"),
      country: searchParams.get("country"),
      managerId: searchParams.get("managerId"),
      productId: searchParams.get("productId")
    });
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить CEO snapshot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
