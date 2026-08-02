import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { MotivationAccessError, requireMotivationSession } from "@/lib/motivation/access";
import { getMotivationPagePayload } from "@/lib/motivation/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = requireMotivationSession(readSessionCookie(request.headers.get("cookie")));
    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get("periodId");
    const viewAsManagerId = searchParams.get("viewAsManagerId");

    const payload = await getMotivationPagePayload({
      session,
      periodId,
      viewAsManagerId
    });

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MotivationAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Не удалось загрузить мотивацию";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
