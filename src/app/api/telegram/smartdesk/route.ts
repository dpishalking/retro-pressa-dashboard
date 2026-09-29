import { NextResponse } from "next/server";
import { handleSmartdeskTelegramUpdate } from "@/lib/smartdesk/telegram-report";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const update = await request.json().catch(() => null);
  try {
    await handleSmartdeskTelegramUpdate(update);
  } catch (error) {
    console.error("SmartDesk telegram update failed:", error instanceof Error ? error.message : error);
  }
  return NextResponse.json({ ok: true });
}
