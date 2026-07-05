import { NextResponse } from "next/server";
import { ensureConversationArchives, listConversationSnapshotHistory } from "@/lib/conversation-snapshot-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    await ensureConversationArchives();
    const history = await listConversationSnapshotHistory(10);
    const archives = history.filter((item) => item.periodKey === "may-2026" || item.periodKey === "june-2026");

    return NextResponse.json({
      ok: true,
      archives: archives.map((item) => ({
        periodKey: item.periodKey,
        dialogs: item.dialogs,
        label: item.label
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось восстановить архивы переписок";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
