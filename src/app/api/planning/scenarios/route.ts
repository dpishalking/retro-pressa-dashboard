import { NextResponse } from "next/server";
import { readScenarioLibrary, upsertScenario } from "@/lib/planning-layer/server";
import type { SavedScenario } from "@/lib/planning-layer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const library = await readScenarioLibrary();
    return NextResponse.json({ ok: true, ...library });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить сценарии";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SavedScenario;
    if (!body.id || !body.name || !Array.isArray(body.changes)) {
      return NextResponse.json({ ok: false, error: "Некорректный сценарий" }, { status: 400 });
    }

    const library = await upsertScenario({
      ...body,
      createdAt: body.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ ok: true, ...library });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить сценарий";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
