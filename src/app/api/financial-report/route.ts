import { NextResponse } from "next/server";
import { buildCanonicalFinancialReport } from "@/lib/financial-report/build";
import { parsePeriodParam } from "@/lib/financial-report/period";
import { parsePlanningMode } from "@/lib/planning-layer";
import type { ScenarioChange } from "@/lib/planning-layer";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";

type PostBody = {
  period?: PeriodKey | string;
  refresh?: boolean;
  mode?: string;
  overrides?: Partial<Record<string, number>>;
  changes?: ScenarioChange[];
  scenarioId?: string;
  includeDelta?: boolean;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = parsePeriodParam(searchParams.get("period"));
    const mode = parsePlanningMode(searchParams.get("mode"));
    const refresh = searchParams.get("refresh") === "1";
    const includeDelta = searchParams.get("includeDelta") === "1";
    const scenarioId = searchParams.get("scenarioId") ?? undefined;

    const report = await buildCanonicalFinancialReport({
      period,
      refresh,
      mode,
      scenarioId,
      includeDelta
    });
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
    const mode = parsePlanningMode(body.mode);

    if (mode !== "SCENARIO") {
      return NextResponse.json(
        { ok: false, error: "POST поддерживает только mode=SCENARIO" },
        { status: 400 }
      );
    }

    const report = await buildCanonicalFinancialReport({
      period,
      refresh: body.refresh === true,
      mode: "SCENARIO",
      overrides: body.overrides,
      changes: body.changes,
      scenarioId: body.scenarioId,
      includeDelta: body.includeDelta === true
    });
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось собрать Financial Report";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
