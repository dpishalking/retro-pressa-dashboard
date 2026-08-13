import { NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/auth/access";
import { readSessionCookie } from "@/lib/auth/session";
import { deleteFunnel, getFunnel, saveFunnel } from "@/lib/marketing/funnel-store";
import type { FunnelBoard } from "@/lib/marketing/funnel-types";

export const dynamic = "force-dynamic";

function requireMarketing(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessRoute(session.accessLevel, "/marketing")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const denied = requireMarketing(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const funnel = await getFunnel(id);
  if (!funnel) return NextResponse.json({ ok: false, error: "Воронка не найдена" }, { status: 404 });
  return NextResponse.json({ ok: true, funnel }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, ctx: Ctx) {
  const denied = requireMarketing(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    const body = (await request.json()) as Partial<FunnelBoard>;
    const funnel = await saveFunnel(id, body);
    if (!funnel) return NextResponse.json({ ok: false, error: "Воронка не найдена" }, { status: 404 });
    return NextResponse.json({ ok: true, funnel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить воронку";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = requireMarketing(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const result = await deleteFunnel(id);
  if (result === "missing") return NextResponse.json({ ok: false, error: "Воронка не найдена" }, { status: 404 });
  if (result === "seeded") {
    return NextResponse.json({ ok: false, error: "Базовые воронки нельзя удалить" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
