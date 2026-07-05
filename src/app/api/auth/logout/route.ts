import { NextResponse } from "next/server";
import { clearSessionCookie, readSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ ok: true });
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
