import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { rigaDateIso } from "@/lib/manager-cabinet/dates";
import { buildRopChatFeedbackReport } from "@/lib/rop-chat-feedback/build";
import { listRopChatFeedbackDays, readRopChatFeedback, writeRopChatFeedback } from "@/lib/rop-chat-feedback/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function requireRopSession(cookieHeader: string | null) {
  const session = readSessionCookie(cookieHeader);
  if (!session) {
    return { error: NextResponse.json({ error: "Нужна авторизация" }, { status: 401 }) };
  }
  if (session.accessLevel !== "admin" && session.accessLevel !== "rop") {
    return { error: NextResponse.json({ error: "Раздел только для РОП и админа" }, { status: 403 }) };
  }
  return { session };
}

function parseDay(value: string | null): string | null {
  if (!value) return rigaDateIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

/**
 * GET /api/conversations/manager-feedback?day=YYYY-MM-DD
 * Cached team chat feedback for ROP.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = requireRopSession(request.headers.get("cookie"));
    if (auth.error) return auth.error;

    const day = parseDay(request.nextUrl.searchParams.get("day"));
    if (!day) {
      return NextResponse.json({ error: "Нужна дата вида YYYY-MM-DD" }, { status: 400 });
    }

    const report = await readRopChatFeedback(day);
    const days = await listRopChatFeedbackDays(21);
    if (!report) {
      return NextResponse.json({
        ok: true,
        day,
        report: null,
        days,
        emptyHint: "ОС за этот день ещё нет. Нажмите «Собрать ОС» — разберём чаты менеджеров."
      });
    }

    return NextResponse.json({
      ok: true,
      day,
      report,
      days,
      emptyHint: null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить ОС по чатам";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/conversations/manager-feedback
 * body: { day?: "YYYY-MM-DD" }
 * Rebuild feedback from Bitrix open lines.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = requireRopSession(request.headers.get("cookie"));
    if (auth.error) return auth.error;

    const body = (await request.json().catch(() => ({}))) as { day?: string };
    const day = parseDay(body.day ?? request.nextUrl.searchParams.get("day"));
    if (!day) {
      return NextResponse.json({ error: "Нужна дата вида YYYY-MM-DD" }, { status: 400 });
    }

    const report = await buildRopChatFeedbackReport(day);
    await writeRopChatFeedback(report);
    const days = await listRopChatFeedbackDays(21);

    return NextResponse.json({
      ok: true,
      day,
      report,
      days,
      emptyHint: null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось собрать ОС по чатам";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
