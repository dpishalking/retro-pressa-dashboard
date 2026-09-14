import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { listShiftFeedbackDays, readShiftFeedback } from "@/lib/shift-feedback/store";
import { syncShiftFeedback } from "@/lib/shift-feedback/sync";
import { moscowDateIso } from "@/lib/shift-feedback/time";

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
  if (!value) return moscowDateIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireRopSession(request.headers.get("cookie"));
    if (auth.error) return auth.error;

    const day = parseDay(request.nextUrl.searchParams.get("day"));
    if (!day) {
      return NextResponse.json({ error: "Нужна дата вида YYYY-MM-DD" }, { status: 400 });
    }

    const report = await readShiftFeedback(day);
    const days = await listShiftFeedbackDays(21);
    if (!report) {
      return NextResponse.json({
        ok: true,
        day,
        report: null,
        days,
        emptyHint: "Среза за этот день ещё нет. Нажмите «Обновить из Bitrix» — соберём смену из графика и чатов."
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
    const message = error instanceof Error ? error.message : "Не удалось загрузить срез смены";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRopSession(request.headers.get("cookie"));
    if (auth.error) return auth.error;

    const body = (await request.json().catch(() => ({}))) as { day?: string };
    const day = parseDay(body.day ?? request.nextUrl.searchParams.get("day"));
    if (!day) {
      return NextResponse.json({ error: "Нужна дата вида YYYY-MM-DD" }, { status: 400 });
    }

    const { report, days } = await syncShiftFeedback(day);
    return NextResponse.json({
      ok: true,
      day,
      report,
      days,
      emptyHint: null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось собрать срез смены";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
