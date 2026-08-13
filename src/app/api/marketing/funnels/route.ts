import { NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/auth/access";
import { readSessionCookie } from "@/lib/auth/session";
import { createFunnel, listFunnels } from "@/lib/marketing/funnel-store";

export const dynamic = "force-dynamic";

function requireMarketing(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessRoute(session.accessLevel, "/marketing")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const denied = requireMarketing(request);
  if (denied) return denied;
  const funnels = await listFunnels();
  return NextResponse.json({ ok: true, funnels }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = requireMarketing(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as { title?: string; description?: string; stage?: string };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ ok: false, error: "Укажите название воронки" }, { status: 400 });
    }
    const funnel = await createFunnel({
      title,
      description: typeof body.description === "string" ? body.description : "",
      stage: typeof body.stage === "string" ? body.stage : "Воронка"
    });
    return NextResponse.json({ ok: true, funnel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать воронку";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
