import { appendToLivePeriodStore, conversationMessageKey } from "@/lib/conversation-live-store";
import { writeConversationSnapshot } from "@/lib/conversation-snapshot-store";
import { currentPeriodKey } from "@/lib/conversation-periods";
import { buildConversationDashboard, classifyMessage, summarizeDialogs } from "@/lib/conversation-intelligence";
import type {
  ConversationDashboardMetrics,
  ConversationImportFileDiagnostic,
  ConversationMessage,
  DialogueOutcome,
  DialogueStage,
  PeriodKey,
} from "@/types/metrics";

type BitrixResponse<T> = {
  result?: T;
  error?: string;
  error_description?: string;
};

type BitrixCrmActivity = {
  ID: string;
  CREATED?: string;
  OWNER_ID?: string;
  OWNER_TYPE_ID?: string;
  ASSOCIATED_ENTITY_ID?: string;
  SUBJECT?: string;
  RESPONSIBLE_ID?: string;
};

type BitrixHistoryUser = {
  id: string;
  name?: string;
  extranet?: boolean | string;
};

type BitrixHistoryMessage = {
  id: string;
  date?: string;
  senderid?: string;
  text?: string;
  textlegacy?: string;
};

type BitrixSessionHistoryResult = {
  sessionId?: number;
  chatId?: number;
  message?: Record<string, BitrixHistoryMessage>;
  users?: Record<string, BitrixHistoryUser>;
};

export type BitrixOpenLineCrmSyncOptions = {
  period?: PeriodKey;
  dateFrom?: string;
  dateTo?: string;
  sessionLimit?: number;
  startOffset?: number;
};

export type BitrixOpenLineCrmSyncPayload = {
  source: "bitrix";
  importedAt: string;
  periodKey: PeriodKey;
  dashboard: ConversationDashboardMetrics;
  diagnostics: ConversationImportFileDiagnostic[];
  summary: {
    activitiesScanned: number;
    sessionsImported: number;
    messagesLoaded: number;
    messagesAdded: number;
    dialogsAdded: number;
    totalDialogs: number;
    totalMessages: number;
    dateFrom: string;
    dateTo: string;
    nextOffset: number;
    hasMore: boolean;
  };
};

function normalizeWebhookUrl(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function periodRange(period: PeriodKey) {
  const months: Record<PeriodKey, { year: number; month: number }> = {
    "may-2026": { year: 2026, month: 5 },
    "june-2026": { year: 2026, month: 6 },
    "july-2026": { year: 2026, month: 7 },
  };
  const { year, month } = months[period];
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  return { start, end };
}

function isoDayRange(dateFrom: string, dateTo: string) {
  return {
    from: `${dateFrom}T00:00:00+03:00`,
    to: `${dateTo}T23:59:59+03:00`,
  };
}

async function callBitrix<T>(method: string, body: Record<string, unknown>, attempt = 0): Promise<T> {
  const webhook = process.env.BITRIX_WEBHOOK_URL;
  if (!webhook) throw new Error("BITRIX_WEBHOOK_URL is not configured");

  const response = await fetch(`${normalizeWebhookUrl(webhook)}${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
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

function isSystemMessage(message: BitrixHistoryMessage) {
  const senderId = String(message.senderid ?? "0");
  if (senderId === "0") return true;
  const text = String(message.text ?? message.textlegacy ?? "").trim();
  if (!text) return true;
  return /^(Enquiry |A new lead was created|Диалог закреплен|Conversation )/i.test(text)
    || /начал работу с диалогом|завершил работу с диалогом|transferred to/i.test(text);
}

function cleanMessageText(text: string) {
  return text
    .replace(/\[USER=\d+ REPLACE\]([^\[]+)\[\/USER\]/gi, "$1")
    .replace(/\[b\]|\[\/b\]/gi, "")
    .trim();
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

function normalizeSessionMessages(
  sessionId: string,
  leadId: string | null,
  history: BitrixSessionHistoryResult,
): ConversationMessage[] {
  const users = history.users ?? {};
  const rows = Object.values(history.message ?? {})
    .filter((message) => !isSystemMessage(message))
    .sort((left, right) => String(left.date ?? "").localeCompare(String(right.date ?? "")));

  return rows.map((row) => {
    const senderId = String(row.senderid ?? "");
    const user = users[senderId];
    const isClient = user?.extranet === true || user?.extranet === "Y";
    const senderRole: ConversationMessage["senderRole"] = isClient ? "client" : "manager";
    const text = cleanMessageText(String(row.text ?? row.textlegacy ?? ""));
    return {
      date: row.date ?? null,
      channel: "bitrix",
      dialogId: sessionId,
      sender: user?.name || (isClient ? "Клиент" : "Менеджер"),
      senderRole,
      text,
      manager: null,
      stage: inferStage(text),
      outcome: inferOutcome(text),
      orderAmount: leadId ? null : null,
      intents: classifyMessage(text),
    };
  }).filter((message) => message.text);
}

async function listOpenLineActivities(input: {
  dateFrom: string;
  dateTo: string;
  start: number;
  limit: number;
}) {
  const range = isoDayRange(input.dateFrom, input.dateTo);
  const result = await callBitrix<BitrixCrmActivity[]>("crm.activity.list", {
    filter: {
      ">=CREATED": range.from,
      "<=CREATED": range.to,
      TYPE_ID: "6",
      PROVIDER_ID: "IMOPENLINES_SESSION",
    },
    select: [
      "ID",
      "CREATED",
      "OWNER_ID",
      "OWNER_TYPE_ID",
      "ASSOCIATED_ENTITY_ID",
      "SUBJECT",
      "RESPONSIBLE_ID",
    ],
    order: { CREATED: "ASC" },
    start: input.start,
  });

  return result;
}

async function fetchSessionHistory(sessionId: string) {
  return callBitrix<BitrixSessionHistoryResult>("imopenlines.session.history.get", {
    SESSION_ID: Number(sessionId),
  });
}

export async function syncBitrixOpenLinesViaCrm(
  options: BitrixOpenLineCrmSyncOptions = {},
): Promise<BitrixOpenLineCrmSyncPayload> {
  const periodKey = options.period ?? currentPeriodKey();
  const range = periodRange(periodKey);
  const dateFrom = options.dateFrom ?? range.start.toISOString().slice(0, 10);
  const dateTo = options.dateTo ?? range.end.toISOString().slice(0, 10);
  const sessionLimit = Math.max(1, Math.min(500, options.sessionLimit ?? 200));
  const startOffset = Math.max(0, options.startOffset ?? 0);
  const importedAt = new Date().toISOString();
  const diagnostics: ConversationImportFileDiagnostic[] = [];
  const collectedMessages: ConversationMessage[] = [];
  const seenMessages = new Set<string>();
  const seenSessions = new Set<string>();

  let activitiesScanned = 0;
  let offset = startOffset;
  let hasMore = true;

  while (seenSessions.size < sessionLimit && hasMore) {
    const page = await listOpenLineActivities({
      dateFrom,
      dateTo,
      start: offset,
      limit: 50,
    });

    if (!page.length) {
      hasMore = false;
      break;
    }

    activitiesScanned += page.length;
    offset += page.length;
    if (page.length < 50) hasMore = false;

    for (const activity of page) {
      if (seenSessions.size >= sessionLimit) break;
      const sessionId = String(activity.ASSOCIATED_ENTITY_ID ?? "").trim();
      if (!sessionId || seenSessions.has(sessionId)) continue;
      seenSessions.add(sessionId);

      try {
        const history = await fetchSessionHistory(sessionId);
        const leadId = activity.OWNER_TYPE_ID === "1" ? String(activity.OWNER_ID ?? "") : null;
        const normalized = normalizeSessionMessages(sessionId, leadId, history);
        if (!normalized.length) continue;

        for (const message of normalized) {
          const key = conversationMessageKey(message);
          if (seenMessages.has(key)) continue;
          seenMessages.add(key);
          collectedMessages.push(message);
        }

        diagnostics.push({
          filename: `${sessionId}.openline-crm`,
          messages: normalized.length,
          dialogs: 1,
          status: "ok",
          note: activity.SUBJECT || `Open line session ${sessionId}`,
        });
      } catch (error) {
        diagnostics.push({
          filename: `${sessionId}.openline-crm`,
          messages: 0,
          dialogs: 0,
          status: "error",
          note: error instanceof Error ? error.message : "Open line history import failed",
        });
      }

      if (seenSessions.size % 20 === 0) {
        await sleep(150);
      }
    }
  }

  const liveStore = await appendToLivePeriodStore({
    periodKey,
    incomingMessages: collectedMessages,
    importedAt,
  });

  await writeConversationSnapshot({
    version: 1,
    source: "bitrix",
    importedAt,
    importedDay: importedAt.slice(0, 10),
    periodKey,
    label: `Bitrix open lines · ${dateFrom}..${dateTo} (+${liveStore.summary.lastBatchDialogs} диалогов)`,
    dashboard: liveStore.dashboard,
    diagnostics,
    summary: {
      filesLoaded: seenSessions.size,
      messagesLoaded: liveStore.summary.lastBatchMessages,
      dialogsLoaded: liveStore.summary.lastBatchDialogs,
      filesParsed: diagnostics.filter((item) => item.status === "ok").length,
      filesFailed: diagnostics.filter((item) => item.status === "error").length,
    },
  });

  return {
    source: "bitrix",
    importedAt,
    periodKey,
    dashboard: liveStore.dashboard,
    diagnostics,
    summary: {
      activitiesScanned,
      sessionsImported: diagnostics.filter((item) => item.status === "ok").length,
      messagesLoaded: collectedMessages.length,
      messagesAdded: liveStore.summary.lastBatchMessages,
      dialogsAdded: liveStore.summary.lastBatchDialogs,
      totalDialogs: liveStore.summary.dialogsLoaded,
      totalMessages: liveStore.summary.messagesLoaded,
      dateFrom,
      dateTo,
      nextOffset: offset,
      hasMore,
    },
  };
}

export function summarizeOpenLineMessages(messages: ConversationMessage[]) {
  return summarizeDialogs(messages);
}
