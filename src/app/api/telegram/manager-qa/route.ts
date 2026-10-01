import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handleManagerQaUpdate, managerQaBotToken, managerQaWebhookSecret, type TelegramUpdate } from "@/lib/manager-qa/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function secretsMatch(expected: string, provided: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const expected = managerQaWebhookSecret();
  const provided = request.headers.get("x-telegram-bot-api-secret-token")?.trim() || "";
  if (!secretsMatch(expected, provided)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!managerQaBotToken()) {
    return NextResponse.json({ error: "Bot token is not configured" }, { status: 503 });
  }

  const update = await request.json().catch(() => null) as TelegramUpdate | null;
  if (!update || typeof update.update_id !== "number") {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleManagerQaUpdate(update);
  } catch (error) {
    console.error("Manager QA update failed:", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({ ok: true });
}
