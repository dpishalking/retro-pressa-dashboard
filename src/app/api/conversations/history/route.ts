import { NextResponse } from "next/server";
import { listConversationSnapshotHistory, readLatestConversationSnapshot } from "@/lib/conversation-snapshot-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(60, Number(url.searchParams.get("limit") ?? 14) || 14));
    const latest = await readLatestConversationSnapshot();
    const history = await listConversationSnapshotHistory(limit);

    return NextResponse.json({
      latest,
      history
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось прочитать историю переписок";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
