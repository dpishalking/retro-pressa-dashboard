import { NextResponse } from "next/server";
import { syncBitrixConversationHistory } from "@/lib/bitrix/conversation-connector";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      period?: PeriodKey;
      daysBack?: number;
      dialogLimit?: number;
    };

    const payload = await syncBitrixConversationHistory({
      period: body.period,
      daysBack: body.daysBack,
      dialogLimit: body.dialogLimit
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить переписки из Bitrix";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
