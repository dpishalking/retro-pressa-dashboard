import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";

export async function GET(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user: session });
}
