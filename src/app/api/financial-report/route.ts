import { NextResponse } from "next/server";
import { buildCanonicalFinancialReport } from "@/lib/financial-report/build";
import { parsePeriodParam } from "@/lib/financial-report/period";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";

type PostBody = {
  period?: PeriodKey | string;
  refresh?: boolean;
  driverOverrides?: Partial<Record<string, number>>;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = parsePeriodParam(searchParams.get("period"));
    const refresh = searchParams.get("refresh") === "1";

    const report = await buildCanonicalFinancialReport({ period, refresh });
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось собрать Financial Report";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as PostBody;
    const period = parsePeriodParam(body.period ?? null);
    const report = await buildCanonicalFinancialReport({
      period,
      refresh: body.refresh === true,
      driverOverrides: body.driverOverrides
    });
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось собрать Financial Report";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
