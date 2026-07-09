import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { summarizeDialogs } from "@/lib/conversation-intelligence";
import { readLivePeriodStore } from "@/lib/conversation-live-store";
import type { ConversationMessage, PeriodKey } from "@/types/metrics";

const exportDir = path.join(process.cwd(), "data", "conversation-exports");

const periodSlug: Record<PeriodKey, string> = {
  "may-2026": "2026-05",
  "june-2026": "2026-06",
  "july-2026": "2026-07",
};

type GiftAiDialog = {
  dialog_id: string;
  lead_id: string;
  deal_id: string;
  contact_id: string;
  manager: string;
  source: string;
  country: string;
  stage: string;
  outcome: string;
  amount: string;
  messages: Array<{
    message_id: string;
    date: string;
    sender: string;
    sender_role: string;
    text: string;
  }>;
};

function senderRoleLabel(role: ConversationMessage["senderRole"]) {
  if (role === "manager") return "manager";
  if (role === "client") return "client";
  return "system";
}

function senderDisplayName(message: ConversationMessage) {
  if (message.senderRole === "manager") return message.sender || "Менеджер";
  if (message.senderRole === "client") return message.sender || "Клиент";
  return message.sender || "Система";
}

export function conversationMessagesToGiftAiDialogs(messages: ConversationMessage[]): GiftAiDialog[] {
  const grouped = new Map<string, ConversationMessage[]>();
  for (const message of messages) {
    grouped.set(message.dialogId, [...(grouped.get(message.dialogId) ?? []), message]);
  }

  return [...grouped.entries()].map(([dialogId, dialogMessages]) => {
    const sorted = [...dialogMessages].sort((left, right) => String(left.date ?? "").localeCompare(String(right.date ?? "")));
    const summary = summarizeDialogs(sorted).find((item) => item.dialogId === dialogId);
    const managerName = sorted.find((message) => message.manager)?.manager
      ?? sorted.find((message) => message.senderRole === "manager")?.sender
      ?? "";

    return {
      dialog_id: dialogId,
      lead_id: "",
      deal_id: "",
      contact_id: "",
      manager: managerName,
      source: sorted[0]?.channel ?? "bitrix",
      country: "",
      stage: summary?.stages.at(-1) ?? "",
      outcome: summary?.outcome ?? "unknown",
      amount: summary?.orderAmount ? String(summary.orderAmount) : "",
      messages: sorted.map((message, index) => ({
        message_id: `${dialogId}_${index + 1}`,
        date: message.date ?? "",
        sender: senderDisplayName(message),
        sender_role: senderRoleLabel(message.senderRole),
        text: message.text,
      })),
    };
  });
}

export async function syncLiveStoreToExportFile(periodKey: PeriodKey) {
  const liveStore = await readLivePeriodStore(periodKey);
  if (!liveStore?.messages.length) {
    return {
      written: false,
      path: null as string | null,
      dialogs: 0,
      messages: 0,
    };
  }

  const dialogs = conversationMessagesToGiftAiDialogs(liveStore.messages);
  await mkdir(exportDir, { recursive: true });
  const target = path.join(exportDir, `retro-pressa-conversations-${periodSlug[periodKey]}.json`);
  await writeFile(target, JSON.stringify(dialogs, null, 2), "utf8");

  return {
    written: true,
    path: target,
    dialogs: dialogs.length,
    messages: liveStore.messages.length,
  };
}
