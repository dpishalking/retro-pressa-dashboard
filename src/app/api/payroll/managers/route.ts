import { NextRequest, NextResponse } from "next/server";
import { getCachedCeoSnapshot } from "@/lib/analytics-os/ceo-snapshot-cache";
import { readSessionCookie } from "@/lib/auth/session";
import { PayrollAccessError, requirePayrollSession } from "@/lib/payroll/access";
import type { PayrollManagerFact } from "@/lib/payroll/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payroll/managers?period=YYYY-MM
 * Auth: admin|rop. Read-only facts from CEO snapshot — no heavy sync.
 */
export async function GET(request: NextRequest) {
  try {
    requirePayrollSession(readSessionCookie(request.headers.get("cookie")));
    const period = request.nextUrl.searchParams.get("period");
    const snapshot = await getCachedCeoSnapshot({ period });
    const managers: PayrollManagerFact[] = (snapshot.managers || []).map((row) => ({
      id: row.managerId,
      name: row.managerName,
      revenueEur: row.revenue,
      leads: row.leads,
      paidOrders: row.paidOrders,
      paymentCrPct: row.conversionRate,
      avgCheckEur: row.aov
    }));

    return NextResponse.json(
      {
        ok: true as const,
        period: snapshot.period,
        availablePeriods: snapshot.availablePeriods,
        managers
      },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=240" } }
    );
  } catch (error) {
    if (error instanceof PayrollAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Не удалось загрузить менеджеров";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
