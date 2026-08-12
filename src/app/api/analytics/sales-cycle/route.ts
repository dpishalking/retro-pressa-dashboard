import { NextRequest, NextResponse } from "next/server";
import { loadSalesCycle } from "@/lib/analytics-os/sales-cycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/analytics/sales-cycle?period=YYYY-MM&cohort_grain=day|week|month&managerId=&productId=&country=&source=
 * Auth: session required (middleware). Prefers data/sales-cycle-cache, else Bitrix snapshots.
 */
export async function GET(request: NextRequest) {
  if (process.env.RPBI_PROCESS_ROLE !== "worker") {
    const workerUrl = new URL(request.url);
    workerUrl.protocol = "http:";
    workerUrl.hostname = "127.0.0.1";
    workerUrl.port = "4175";
    const response = await fetch(workerUrl, {
      headers: {
        cookie: request.headers.get("cookie") || ""
      },
      cache: "no-store"
    });
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
        "cache-control": "private, max-age=60"
      }
    });
  }

  try {
    const { searchParams } = request.nextUrl;
    const payload = await loadSalesCycle({
      period: searchParams.get("period"),
      cohortGrain: searchParams.get("cohort_grain"),
      managerId: searchParams.get("managerId"),
      productId: searchParams.get("productId"),
      country: searchParams.get("country"),
      sourceId: searchParams.get("source") || searchParams.get("sourceId"),
      forceRefresh: searchParams.get("refresh") === "1"
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить Sales Cycle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
