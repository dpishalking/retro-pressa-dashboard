import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { loadArchitectureDepth } from "@/lib/architecture-depth/load";
import {
  generateArchitectureHypotheses,
  readArchitectureHypotheses,
  setArchitectureHypothesisStatus,
  type HypothesisStatus
} from "@/lib/architecture-depth/hypotheses";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) return NextResponse.json({ error: "Нужна сессия" }, { status: 401 });
  if (session.accessLevel !== "admin" && session.accessLevel !== "rop") {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  try {
    const [report, hypotheses] = await Promise.all([
      loadArchitectureDepth(),
      readArchitectureHypotheses()
    ]);
    return NextResponse.json({ ok: true, report, hypotheses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить глубину лендинга";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({})) as { action?: string; id?: string; status?: HypothesisStatus };
    if (body.action === "status") {
      if (!body.id || !body.status) {
        return NextResponse.json({ error: "Нужны id и статус гипотезы" }, { status: 400 });
      }
      const hypotheses = await setArchitectureHypothesisStatus(body.id, body.status);
      return NextResponse.json({ ok: true, hypotheses });
    }

    const report = await loadArchitectureDepth();
    const hypotheses = await generateArchitectureHypotheses(report);
    return NextResponse.json({ ok: true, report, hypotheses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось собрать гипотезы";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
