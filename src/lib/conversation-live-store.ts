import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildConversationDashboard, summarizeDialogs } from "@/lib/conversation-intelligence";
import { livePeriodFilename } from "@/lib/conversation-periods";
import type { ConversationDashboardMetrics, ConversationMessage, PeriodKey } from "@/types/metrics";

export type ConversationLiveStore = {
  version: 1;
  periodKey: PeriodKey;
  source: "bitrix";
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string;
  syncRuns: number;
  syncedDays: string[];
  messages: ConversationMessage[];
  dashboard: ConversationDashboardMetrics;
  summary: {
    messagesLoaded: number;
    dialogsLoaded: number;
    lastBatchMessages: number;
    lastBatchDialogs: number;
  };
};

const snapshotDir = path.join(process.cwd(), "data", "conversation-snapshots");

function liveStorePath(periodKey: PeriodKey) {
  return path.join(snapshotDir, livePeriodFilename(periodKey));
}

async function ensureSnapshotDir() {
  await mkdir(snapshotDir, { recursive: true });
}

export function conversationMessageKey(message: ConversationMessage) {
  return [
    message.dialogId,
    message.date ?? "",
    message.sender,
    message.senderRole,
    message.text
  ].join("|");
}

export function mergeConversationMessages(existing: ConversationMessage[], incoming: ConversationMessage[]) {
  const seen = new Set(existing.map(conversationMessageKey));
  const merged = [...existing];

  for (const message of incoming) {
    const key = conversationMessageKey(message);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(message);
  }

  return merged;
}

function isValidLiveStore(parsed: Partial<ConversationLiveStore>): parsed is ConversationLiveStore {
  return parsed?.version === 1
    && typeof parsed.periodKey === "string"
    && Array.isArray(parsed.messages)
    && Boolean(parsed.dashboard)
    && Boolean(parsed.summary);
}

export async function readLivePeriodStore(periodKey: PeriodKey): Promise<ConversationLiveStore | null> {
  try {
    const raw = await readFile(liveStorePath(periodKey), "utf8");
    const parsed = JSON.parse(raw) as Partial<ConversationLiveStore>;
    return isValidLiveStore(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function appendToLivePeriodStore(input: {
  periodKey: PeriodKey;
  incomingMessages: ConversationMessage[];
  importedAt?: string;
}) {
  await ensureSnapshotDir();
  const importedAt = input.importedAt ?? new Date().toISOString();
  const importedDay = importedAt.slice(0, 10);
  const existing = await readLivePeriodStore(input.periodKey);
  const previousMessages = existing?.messages ?? [];
  const mergedMessages = mergeConversationMessages(previousMessages, input.incomingMessages);
  const previousDialogs = existing?.summary.dialogsLoaded ?? 0;
  const dialogs = summarizeDialogs(mergedMessages);
  const dashboard = buildConversationDashboard(dialogs);
  const lastBatchDialogs = Math.max(0, dialogs.length - previousDialogs);
  const lastBatchMessages = Math.max(0, mergedMessages.length - previousMessages.length);

  const store: ConversationLiveStore = {
    version: 1,
    periodKey: input.periodKey,
    source: "bitrix",
    createdAt: existing?.createdAt ?? importedAt,
    updatedAt: importedAt,
    lastSyncedAt: importedAt,
    syncRuns: (existing?.syncRuns ?? 0) + 1,
    syncedDays: [...new Set([...(existing?.syncedDays ?? []), importedDay])].sort(),
    messages: mergedMessages,
    dashboard,
    summary: {
      messagesLoaded: mergedMessages.length,
      dialogsLoaded: dialogs.length,
      lastBatchMessages,
      lastBatchDialogs
    }
  };

  await writeFile(liveStorePath(input.periodKey), JSON.stringify(store, null, 2), "utf8");
  return store;
}
