import { NextResponse } from "next/server";
import { parsePeriodParam } from "@/lib/financial-report/period";
import { readPlanDocument, writePlanDocument } from "@/lib/planning-layer/server";
import type { PlanDocument } from "@/lib/planning-layer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = parsePeriodParam(searchParams.get("period"));
    const plan = await readPlanDocument(period);
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить план";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PlanDocument;
    if (!body.period || !body.targets) {
      return NextResponse.json({ ok: false, error: "Некорректный план" }, { status: 400 });
    }

    const plan = await writePlanDocument(body);
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить план";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
