import { NextResponse } from "next/server";
import {
  handleManagerQuestionsTelegramUpdate,
  readTelegramWebhookSecret,
  type TelegramUpdate
} from "@/lib/training/telegram-manager-questions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function POST(request: Request) {
  const expectedSecret = readTelegramWebhookSecret();
  if (expectedSecret) {
    const provided = request.headers.get("x-telegram-bot-api-secret-token")?.trim();
    if (!provided || provided !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const update = (await request.json().catch(() => ({}))) as TelegramUpdate;
    await handleManagerQuestionsTelegramUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Manager questions telegram webhook error:", error);
    // Telegram retries on non-2xx; acknowledge anyway after logging.
    return NextResponse.json({ ok: true });
  }
}
