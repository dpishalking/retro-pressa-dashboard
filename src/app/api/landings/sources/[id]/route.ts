import { NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/auth/access";
import { readSessionCookie } from "@/lib/auth/session";
import { removeContractorBook } from "@/lib/landings/contractor-books-store";

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

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = requireMarketing(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const result = await removeContractorBook(id);
  if (result === "missing") {
    return NextResponse.json({ ok: false, error: "Таблица не найдена" }, { status: 404 });
  }
  if (result === "seeded") {
    return NextResponse.json({ ok: false, error: "Базовые таблицы подрядчиков нельзя отключить" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
