import { NextRequest, NextResponse } from "next/server";
import { parseAnalyticsPeriod } from "@/lib/analytics-os/period";
import { loadSalesCycle } from "@/lib/analytics-os/sales-cycle";
import { readSalesCycleCache, type SalesCycleCacheKey } from "@/lib/analytics-os/sales-cycle/cache-store";
import type { CohortGrain } from "@/lib/analytics-os/sales-cycle/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const WORKER_TIMEOUT_MS = 55_000;

function parseGrain(value: string | null | undefined): CohortGrain {
  if (value === "week" || value === "month" || value === "day") return value;
  return "month";
}

function cacheKeyFromRequest(request: NextRequest): SalesCycleCacheKey {
  const { searchParams } = request.nextUrl;
  return {
    period: parseAnalyticsPeriod(searchParams.get("period")),
    cohortGrain: parseGrain(searchParams.get("cohort_grain")),
    managerId: searchParams.get("managerId"),
    productId: searchParams.get("productId"),
    country: searchParams.get("country"),
    sourceId: searchParams.get("source") || searchParams.get("sourceId")
  };
}

function workerUrlFor(request: NextRequest): URL {
  const workerUrl = new URL(request.url);
  workerUrl.protocol = "http:";
  workerUrl.hostname = "127.0.0.1";
  workerUrl.port = "4175";
  return workerUrl;
}

async function proxyToWorker(request: NextRequest, timeoutMs: number): Promise<NextResponse> {
  const workerUrl = workerUrlFor(request);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(workerUrl, {
      headers: { cookie: request.headers.get("cookie") || "" },
      cache: "no-store",
      signal: controller.signal
    });
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
        "cache-control": "private, max-age=60, stale-while-revalidate=300"
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

function kickWorkerRefresh(request: NextRequest) {
  const workerUrl = workerUrlFor(request);
  workerUrl.searchParams.set("refresh", "1");
  void fetch(workerUrl, {
    headers: { cookie: request.headers.get("cookie") || "" },
    cache: "no-store"
  }).catch(() => {
    // Best-effort: UI already has stale cache.
  });
}

/**
 * GET /api/analytics/sales-cycle?period=YYYY-MM&cohort_grain=day|week|month&managerId=&productId=&country=&source=
 * Auth: session required (middleware). Serves sales-cycle-cache first, then worker.
 * Production web never computes locally — a cache miss / worker failure returns 503/504.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const forceRefresh = searchParams.get("refresh") === "1";
  const isWorker = process.env.RPBI_PROCESS_ROLE === "worker";

  if (!isWorker && !forceRefresh) {
    const cached = await readSalesCycleCache(cacheKeyFromRequest(request), { allowStale: true });
    if (cached) {
      if (cached.stale) kickWorkerRefresh(request);
      return NextResponse.json(cached.payload, {
        headers: { "cache-control": "private, max-age=60, stale-while-revalidate=300" }
      });
    }
  }

  if (!isWorker) {
    try {
      return await proxyToWorker(request, WORKER_TIMEOUT_MS);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      const stale = await readSalesCycleCache(cacheKeyFromRequest(request), { allowStale: true });
      if (stale) {
        return NextResponse.json(stale.payload, {
          headers: { "cache-control": "private, max-age=30" }
        });
      }
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          {
            error: timedOut
              ? "Расчёт цикла сделки не успел за 55с. Выберите зерно «месяц» и нажмите «Повторить»."
              : "Расчёт цикла сделки недоступен. Выберите зерно «месяц» или подождите фоновый прогрев."
          },
          { status: timedOut ? 504 : 503 }
        );
      }
    }
  }

  try {
    const payload = await loadSalesCycle({
      period: searchParams.get("period"),
      cohortGrain: searchParams.get("cohort_grain"),
      managerId: searchParams.get("managerId"),
      productId: searchParams.get("productId"),
      country: searchParams.get("country"),
      sourceId: searchParams.get("source") || searchParams.get("sourceId"),
      forceRefresh
    });
    return NextResponse.json(payload, {
      headers: { "cache-control": "private, max-age=60, stale-while-revalidate=300" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить Sales Cycle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
