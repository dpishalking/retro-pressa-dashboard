import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/store";
import { ensureTrainerBotLink } from "@/lib/training/trainer-api";

export async function GET(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserById(session.id);
  if (!user?.active) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const link = await ensureTrainerBotLink({ id: user.id, name: user.name });
  if (!link) {
    return NextResponse.json({ error: "Trainer API unavailable" }, { status: 503 });
  }

  return NextResponse.json(link);
}
