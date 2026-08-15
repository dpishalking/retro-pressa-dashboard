import { NextRequest, NextResponse } from "next/server";
import { loadSliceExplorer } from "@/lib/analytics-os/slices/load-slices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/analytics/slices
 * Auth: session required (middleware). Aggregates existing SalesCycleFact — no new warehouse.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const report = await loadSliceExplorer({
      period: searchParams.get("period"),
      grain: searchParams.get("grain") || searchParams.get("cohort_grain"),
      dimension: searchParams.get("dim"),
      metric: searchParams.get("metric"),
      selectedKey: searchParams.get("selected"),
      country: searchParams.get("country"),
      managerId: searchParams.get("managerId"),
      productId: searchParams.get("productId"),
      sourceId: searchParams.get("source") || searchParams.get("sourceId"),
      channel: searchParams.get("channel"),
      traffic: searchParams.get("traffic"),
      gift: searchParams.get("gift"),
      customer: searchParams.get("customer"),
      timeKey: searchParams.get("timeKey"),
      cohortKey: searchParams.get("cohortKey")
    });
    return NextResponse.json(report, {
      headers: { "cache-control": "private, max-age=30, stale-while-revalidate=120" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить срезы";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
