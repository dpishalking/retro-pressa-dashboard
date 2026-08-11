import { NextRequest, NextResponse } from "next/server";
import { loadSalesCycle } from "@/lib/analytics-os/sales-cycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/sales-cycle?period=YYYY-MM&cohort_grain=day|week|month&managerId=&productId=&country=&source=
 * Auth: session required (middleware). Read-only — uses Bitrix JSON snapshots.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const payload = await loadSalesCycle({
      period: searchParams.get("period"),
      cohortGrain: searchParams.get("cohort_grain"),
      managerId: searchParams.get("managerId"),
      productId: searchParams.get("productId"),
      country: searchParams.get("country"),
      sourceId: searchParams.get("source") || searchParams.get("sourceId")
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить Sales Cycle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
