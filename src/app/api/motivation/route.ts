import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { MotivationAccessError, requireMotivationSession } from "@/lib/motivation/access";
import { getMotivationBoard } from "@/lib/motivation/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireMotivationSession(readSessionCookie(request.headers.get("cookie")));
    const payload = await getMotivationBoard();
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MotivationAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Не удалось загрузить мотивацию";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
