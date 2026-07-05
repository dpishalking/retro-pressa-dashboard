import { buildConversationDashboard, classifyMessage, summarizeDialogs } from "@/lib/conversation-intelligence";
import { writeConversationSnapshot } from "@/lib/conversation-snapshot-store";
import type { ConversationDashboardMetrics, ConversationImportFileDiagnostic, ConversationMessage, DialogueOutcome, DialogueStage, PeriodKey } from "@/types/metrics";

type BitrixResponse<T> = {
  result?: T;
  error?: string;
  error_description?: string;
};

type BitrixRecentItem = {
  id: string | number;
  chat_id: number;
  type?: string;
  title?: string;
  date_update?: string;
  date_last_activity?: string;
};

type BitrixRecentListResult = {
  items?: BitrixRecentItem[];
  hasMorePages?: boolean;
  hasMore?: boolean;
};

type BitrixDialogMessage = {
  id: number;
  chat_id: number;
  author_id: number;
  date: string;
  text: string;
};

type BitrixDialogUser = {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  type?: string;
};

type BitrixDialogMessagesResult = {
  chat_id: number;
  messages: BitrixDialogMessage[];
  users: BitrixDialogUser[];
};

type BitrixConversationSyncOptions = {
  period?: PeriodKey;
  daysBack?: number;
  dialogLimit?: number;
  refresh?: boolean;
};

export type BitrixConversationSyncPayload = {
  source: "bitrix";
  importedAt: string;
  dashboard: ConversationDashboardMetrics;
  diagnostics: ConversationImportFileDiagnostic[];
  summary: {
    dialogsScanned: number;
    dialogsImported: number;
    messagesLoaded: number;
    daysBack: number;
    lookbackSince: string;
    filesLoaded: number;
    dialogsLoaded: number;
  };
  periodKey?: PeriodKey | null;
};

function normalizeWebhookUrl(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function periodRange(period: PeriodKey, now = new Date()) {
  const months: Record<PeriodKey, { year: number; month: number }> = {
    "may-2026": { year: 2026, month: 5 },
    "june-2026": { year: 2026, month: 6 },
    "july-2026": { year: 2026, month: 7 }
  };
  const { year, month } = months[period];
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  const factualEnd = now < end ? now : end;
  return { start, end, factualEnd };
}

function periodFromDate(date: Date): PeriodKey | null {
  const month = date.getUTCMonth() + 1;
  if (month === 5) return "may-2026";
  if (month === 6) return "june-2026";
  if (month === 7) return "july-2026";
  return null;
}

function hasBitrixConfig() {
  return Boolean(process.env.BITRIX_WEBHOOK_URL);
}

async function callBitrix<T>(method: string, body: Record<string, unknown>, attempt = 0): Promise<T> {
  const webhook = process.env.BITRIX_WEBHOOK_URL;
  if (!webhook) throw new Error("BITRIX_WEBHOOK_URL is not configured");

  const response = await fetch(`${normalizeWebhookUrl(webhook)}${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const data = await response.json() as BitrixResponse<T>;
  if (!response.ok || data.error) {
    const message = data.error_description || data.error || `Bitrix request failed: ${method}`;
    if (attempt < 2 && /too many requests/i.test(message)) {
      await sleep(500 * (attempt + 1));
      return callBitrix<T>(method, body, attempt + 1);
    }
    throw new Error(message);
  }
  if (data.result === undefined) throw new Error(`Bitrix request did not return result: ${method}`);
  return data.result;
}

function dateOrFallback(value?: string | null) {
  const parsed = value ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
}

function senderName(user?: BitrixDialogUser, authorId?: number) {
  const name = [user?.name ?? user?.first_name ?? "", user?.last_name ?? ""].join(" ").trim();
  return name || (authorId ? `User ${authorId}` : "Unknown");
}

function senderRole(authorId: number, users: Map<number, BitrixDialogUser>): ConversationMessage["senderRole"] {
  const user = users.get(authorId);
  if (!user) return authorId > 0 ? "client" : "system";
  if (user.type && user.type !== "user") return "client";
  return "manager";
}

function inferStage(text: string): DialogueStage {
  if (/оплат|счет|сч[её]т/i.test(text)) return "payment";
  if (/оформ|закаж|бер[уё]м|подтверд/i.test(text)) return "closing";
  if (/достав|отправ|курьер|почт/i.test(text)) return "delivery";
  if (/цен|стоим|итого|сумм/i.test(text)) return "pricing";
  if (/рекоменд|подойдет|вариант|подарок/i.test(text)) return "recommendation";
  if (/кому|повод|юбилей|день рож/i.test(text)) return "qualification";
  if (/актуально|напом|возвращаюсь/i.test(text)) return "follow_up";
  if (/не актуально|передум|не надо/i.test(text)) return "lost";
  return "first_touch";
}

function inferOutcome(text: string): DialogueOutcome {
  if (/оплат|оплачено|заказ оформ/i.test(text)) return "order";
  if (/счет|сч[её]т|invoice/i.test(text)) return "invoice";
  if (/не актуально|передум|отбой|не надо/i.test(text)) return "lost";
  return "unknown";
}

async function fetchRecentDialogs(since: string, dialogLimit: number) {
  const dialogs: BitrixRecentItem[] = [];
  let offset = 0;
  const limit = Math.min(200, Math.max(20, dialogLimit));

  while (dialogs.length < dialogLimit) {
    const result = await callBitrix<BitrixRecentListResult>("im.recent.list", {
      LAST_MESSAGE_DATE: since,
      SKIP_OPENLINES: "N",
      SKIP_DIALOG: "N",
      SKIP_CHAT: "N",
      UNREAD_ONLY: "N",
      PARSE_TEXT: "N",
      GET_ORIGINAL_TEXT: "Y",
      SKIP_UNDISTRIBUTED_OPENLINES: "Y",
      ONLY_COPILOT: "N",
      ONLY_CHANNEL: "N",
      CAN_MANAGE_MESSAGES: "N",
      OFFSET: offset,
      LIMIT: limit
    });

    const items = result.items ?? [];
    if (!items.length) break;
    dialogs.push(...items);
    if (!result.hasMorePages && !result.hasMore) break;
    offset += limit;
  }

  const unique = new Map<string, BitrixRecentItem>();
  dialogs.forEach((item) => {
    const key = String(item.id ?? item.chat_id);
    if (!unique.has(key)) unique.set(key, item);
  });

  return Array.from(unique.values()).slice(0, dialogLimit);
}

async function fetchDialogMessages(dialogId: string, sinceDate: Date, untilDate: Date) {
  const messages: BitrixDialogMessage[] = [];
  const users = new Map<number, BitrixDialogUser>();
  let firstId = 0;

  for (let page = 0; page < 40; page += 1) {
    const result = await callBitrix<BitrixDialogMessagesResult>("im.dialog.messages.get", {
      DIALOG_ID: dialogId,
      FIRST_ID: firstId,
      LIMIT: 50
    });

    (result.users ?? []).forEach((user) => users.set(Number(user.id), user));

    const batch = [...(result.messages ?? [])]
      .filter((item) => {
        const messageDate = dateOrFallback(item.date);
        return messageDate ? messageDate >= sinceDate && messageDate <= untilDate : false;
      })
      .sort((a, b) => a.id - b.id);

    if (!batch.length) break;
    messages.push(...batch);

    const newestId = Math.max(...batch.map((item) => item.id));
    if (!Number.isFinite(newestId) || newestId === firstId) break;
    firstId = newestId;

    if (batch.length < 50) break;
  }

  return {
    messages,
    users
  };
}

function normalizeBitrixMessages(dialog: BitrixRecentItem, rows: BitrixDialogMessage[], users: Map<number, BitrixDialogUser>): ConversationMessage[] {
  const manager = rows
    .map((message) => users.get(message.author_id))
    .find((user) => user && (!user.type || user.type === "user"));
  const managerName = manager ? senderName(manager) : null;

  return rows.map((row) => {
    const text = String(row.text ?? "").trim();
    const user = users.get(row.author_id);
    return {
      date: row.date ?? null,
      channel: "bitrix",
      dialogId: String(dialog.id ?? `chat${dialog.chat_id}`),
      sender: senderName(user, row.author_id),
      senderRole: senderRole(row.author_id, users),
      text,
      manager: managerName,
      stage: inferStage(text),
      outcome: inferOutcome(text),
      orderAmount: null,
      intents: classifyMessage(text)
    };
  }).filter((message) => message.text);
}

export async function syncBitrixConversationHistory(options: BitrixConversationSyncOptions = {}): Promise<BitrixConversationSyncPayload> {
  if (!hasBitrixConfig()) {
    throw new Error("BITRIX_WEBHOOK_URL is not configured");
  }

  const daysBack = Math.max(1, Math.min(14, options.daysBack ?? 1));
  const dialogLimit = Math.max(10, Math.min(200, options.dialogLimit ?? 80));
  const importedAt = new Date().toISOString();
  const periodKey = options.period ?? periodFromDate(new Date(importedAt));
  const range = periodKey ? periodRange(periodKey, new Date()) : null;
  const sinceDate = range?.start ?? new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const untilDate = range?.factualEnd ?? new Date();
  const sinceIso = sinceDate.toISOString();

  const recentDialogs = await fetchRecentDialogs(sinceIso, dialogLimit);
  const diagnostics: ConversationImportFileDiagnostic[] = [];
  const collectedMessages: ConversationMessage[] = [];

  for (const dialog of recentDialogs) {
    const dialogId = String(dialog.id ?? `chat${dialog.chat_id}`);
    try {
      const { messages, users } = await fetchDialogMessages(dialogId, sinceDate, untilDate);
      const normalized = normalizeBitrixMessages(dialog, messages, users);
      if (!normalized.length) continue;
      collectedMessages.push(...normalized);
      diagnostics.push({
        filename: `${dialog.title || dialogId}.bitrix`,
        messages: normalized.length,
        dialogs: 1,
        status: "ok",
        note: `Bitrix chat ${dialogId}`
      });
    } catch (error) {
      diagnostics.push({
        filename: `${dialog.title || dialogId}.bitrix`,
        messages: 0,
        dialogs: 0,
        status: "error",
        note: error instanceof Error ? error.message : "Bitrix chat import failed"
      });
    }
  }

  const dialogs = summarizeDialogs(collectedMessages);
  const dashboard = buildConversationDashboard(dialogs);

  await writeConversationSnapshot({
    version: 1,
    source: "bitrix",
    importedAt,
    importedDay: importedAt.slice(0, 10),
    periodKey,
    label: periodKey ? `Bitrix monthly sync (${periodKey})` : `Bitrix daily sync (${daysBack} дн.)`,
    dashboard,
    diagnostics,
    summary: {
      filesLoaded: recentDialogs.length,
      messagesLoaded: collectedMessages.length,
      dialogsLoaded: dialogs.length,
      filesParsed: diagnostics.filter((item) => item.status === "ok").length,
      filesFailed: diagnostics.filter((item) => item.status === "error").length
    }
  });

  return {
    source: "bitrix",
    importedAt,
    dashboard,
    diagnostics,
    summary: {
      dialogsScanned: recentDialogs.length,
      dialogsImported: dialogs.length,
      messagesLoaded: collectedMessages.length,
      daysBack,
      lookbackSince: sinceIso,
      filesLoaded: recentDialogs.length,
      dialogsLoaded: dialogs.length
    }
  };
}
