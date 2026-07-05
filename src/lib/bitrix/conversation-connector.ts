import { buildConversationDashboard, classifyMessage, summarizeDialogs } from "@/lib/conversation-intelligence";
import { appendToLivePeriodStore, conversationMessageKey, readLivePeriodStore } from "@/lib/conversation-live-store";
import { writeConversationSnapshot } from "@/lib/conversation-snapshot-store";
import { currentPeriodKey } from "@/lib/conversation-periods";
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

type BitrixOpenLineSession = {
  id?: string | number;
  chat_id?: number;
  session_id?: string | number;
  chat?: { id?: number };
  status?: string;
  source?: string;
  date_create?: string;
  date_closed?: string;
};

type BitrixOpenLineSessionsResult = {
  items?: BitrixOpenLineSession[];
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

type BitrixOpenLineHistoryResult = {
  chat_id?: number;
  messages?: BitrixDialogMessage[];
  items?: BitrixDialogMessage[];
  history?: BitrixDialogMessage[];
  users?: BitrixDialogUser[];
};

type BitrixConversationSyncOptions = {
  period?: PeriodKey;
  daysBack?: number;
  dialogLimit?: number;
  refresh?: boolean;
  incremental?: boolean;
};

export type BitrixConversationSyncPayload = {
  source: "bitrix";
  importedAt: string;
  dashboard: ConversationDashboardMetrics;
  diagnostics: ConversationImportFileDiagnostic[];
  periodKey?: PeriodKey | null;
  summary: {
    dialogsScanned: number;
    dialogsImported: number;
    messagesLoaded: number;
    daysBack: number;
    lookbackSince: string;
    filesLoaded: number;
    dialogsLoaded: number;
    messagesAdded?: number;
    dialogsAdded?: number;
    totalDialogs?: number;
    totalMessages?: number;
    incremental?: boolean;
  };
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

async function callBitrixOptional<T>(methods: Array<{ method: string; body: Record<string, unknown> }>) {
  const errors: string[] = [];
  for (const candidate of methods) {
    try {
      return await callBitrix<T>(candidate.method, candidate.body);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${candidate.method} failed`);
    }
  }
  throw new Error(errors[errors.length - 1] || "Bitrix request failed");
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
    let result: BitrixRecentListResult;
    try {
      result = await callBitrix<BitrixRecentListResult>("im.recent.list", {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/method not found/i.test(message)) return [];
      throw error;
    }

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

function sessionKey(session: BitrixOpenLineSession) {
  return String(session.id ?? session.session_id ?? session.chat_id ?? session.chat?.id ?? "");
}

function sortSessionsByRecency(sessions: BitrixOpenLineSession[]) {
  return [...sessions].sort((a, b) => {
    const aTime = dateOrFallback(a.date_create)?.getTime() ?? 0;
    const bTime = dateOrFallback(b.date_create)?.getTime() ?? 0;
    return bTime - aTime;
  });
}

async function fetchOpenLineSessions(period: PeriodKey, dialogLimit: number, incrementalSince?: Date) {
  const range = periodRange(period);
  const filterStart = incrementalSince && incrementalSince > range.start ? incrementalSince : range.start;
  const inPeriod = new Map<string, BitrixOpenLineSession>();
  const fallback = new Map<string, BitrixOpenLineSession>();
  const pageSize = 50;
  const maxPages = incrementalSince
    ? Math.max(2, Math.ceil(dialogLimit / pageSize))
    : Math.max(4, Math.ceil(dialogLimit / pageSize) + 2);

  const queries = [
    {
      FILTER: {
        ">=DATE_CREATE": filterStart.toISOString(),
        "<=DATE_CREATE": range.end.toISOString()
      },
      ORDER: { DATE_CREATE: "ASC" }
    },
    ...(incrementalSince ? [] : [{
      ORDER: { DATE_CREATE: "DESC" }
    }])
  ];

  try {
    for (const query of queries) {
      for (let page = 0; page < maxPages; page += 1) {
        const result = await callBitrix<BitrixOpenLineSessionsResult>("imopenlines.session.list", {
          ...query,
          LIMIT: pageSize,
          OFFSET: page * pageSize
        });

      const items = result.items ?? [];
      if (!items.length) break;

      items.forEach((session) => {
        const key = sessionKey(session);
        if (!key) return;
        const createdAt = dateOrFallback(session.date_create);
        const isInPeriod = createdAt ? createdAt >= range.start && createdAt <= range.end : false;
        if (isInPeriod) {
          if (!inPeriod.has(key)) inPeriod.set(key, session);
          return;
        }
        if (!fallback.has(key) && !inPeriod.has(key)) fallback.set(key, session);
      });

      if (!result.hasMorePages && !result.hasMore) break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/method not found/i.test(message)) throw error;
  }

  const ordered = [
    ...sortSessionsByRecency(Array.from(inPeriod.values())),
    ...sortSessionsByRecency(Array.from(fallback.values()))
  ];
  const unique = new Map<string, BitrixOpenLineSession>();
  ordered.forEach((session) => {
    const key = sessionKey(session);
    if (key && !unique.has(key)) unique.set(key, session);
  });

  return Array.from(unique.values()).slice(0, dialogLimit);
}

async function fetchDialogMessages(dialogId: string, sinceDate: Date, untilDate: Date) {
  const messages: BitrixDialogMessage[] = [];
  const users = new Map<number, BitrixDialogUser>();
  const result = await callBitrix<BitrixDialogMessagesResult>("im.dialog.messages.get", {
    DIALOG_ID: dialogId,
    LIMIT: 500
  });

  (result.users ?? []).forEach((user) => users.set(Number(user.id), user));

  const batch = [...(result.messages ?? [])]
    .filter((item) => {
      const messageDate = dateOrFallback(item.date);
      return messageDate ? messageDate >= sinceDate && messageDate <= untilDate : false;
    })
    .sort((a, b) => a.id - b.id);

  messages.push(...batch);

  return {
    messages,
    users
  };
}

async function fetchOpenLineHistory(session: BitrixOpenLineSession, sinceDate: Date, untilDate: Date) {
  const sessionId = String(session.id ?? session.session_id ?? session.chat_id ?? session.chat?.id ?? "");
  const chatId = Number(session.chat_id ?? session.chat?.id ?? 0);
  const result = await callBitrixOptional<BitrixOpenLineHistoryResult>([
    {
      method: "imopenlines.session.history.get",
      body: {
        SESSION_ID: sessionId,
        START: sinceDate.toISOString(),
        END: untilDate.toISOString()
      }
    },
    {
      method: "imopenlines.session.history.get",
      body: {
        CHAT_ID: chatId,
        START: sinceDate.toISOString(),
        END: untilDate.toISOString()
      }
    },
    {
      method: "im.dialog.messages.get",
      body: {
        DIALOG_ID: chatId ? `chat${chatId}` : sessionId,
        LIMIT: 500
      }
    }
  ]);

  return {
    messages: result.messages ?? result.items ?? result.history ?? [],
    users: new Map((result.users ?? []).map((user) => [Number(user.id), user]))
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

function normalizeOpenLineMessages(session: BitrixOpenLineSession, rows: BitrixDialogMessage[], users: Map<number, BitrixDialogUser>): ConversationMessage[] {
  const chatId = String(session.chat_id ?? session.chat?.id ?? session.id ?? session.session_id ?? "session");
  return rows.map((row) => {
    const text = String(row.text ?? "").trim();
    const user = users.get(row.author_id);
    return {
      date: row.date ?? null,
      channel: "bitrix",
      dialogId: chatId,
      sender: senderName(user, row.author_id),
      senderRole: senderRole(row.author_id, users),
      text,
      manager: null,
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

  const incremental = options.incremental === true;
  const daysBack = Math.max(1, Math.min(incremental ? 3 : 14, options.daysBack ?? (incremental ? 1 : 1)));
  const dialogLimit = Math.max(
    10,
    Math.min(incremental ? 50 : 120, options.dialogLimit ?? (incremental ? 40 : 80))
  );
  const importedAt = new Date().toISOString();
  const periodKey = options.period ?? periodFromDate(new Date(importedAt)) ?? currentPeriodKey();
  const range = periodKey ? periodRange(periodKey, new Date()) : null;
  const rollingSince = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const sinceDate = incremental ? rollingSince : (range?.start ?? rollingSince);
  const untilDate = range?.factualEnd ?? new Date();
  const sinceIso = sinceDate.toISOString();

  const recentDialogs = await fetchRecentDialogs(sinceIso, dialogLimit);
  const openLineSessions = periodKey
    ? await fetchOpenLineSessions(periodKey, dialogLimit, incremental ? sinceDate : undefined)
    : [];
  const diagnostics: ConversationImportFileDiagnostic[] = [];
  const collectedMessages: ConversationMessage[] = [];
  const seenMessages = new Set<string>();

  function addMessages(messages: ConversationMessage[]) {
    for (const message of messages) {
      const key = conversationMessageKey(message);
      if (seenMessages.has(key)) continue;
      seenMessages.add(key);
      collectedMessages.push(message);
    }
  }

  for (const session of openLineSessions) {
    const sessionKey = String(session.id ?? session.session_id ?? session.chat_id ?? session.chat?.id ?? "openline");
    const createdAt = dateOrFallback(session.date_create);
    if (incremental && createdAt && createdAt < sinceDate) continue;

    try {
      const { messages, users } = await fetchOpenLineHistory(session, sinceDate, untilDate);
      const normalized = normalizeOpenLineMessages(session, messages, users);
      if (!normalized.length) continue;
      addMessages(normalized);
      diagnostics.push({
        filename: `${sessionKey}.bitrix-openline`,
        messages: normalized.length,
        dialogs: 1,
        status: "ok",
        note: `Bitrix open line ${sessionKey}`
      });
    } catch (error) {
      diagnostics.push({
        filename: `${sessionKey}.bitrix-openline`,
        messages: 0,
        dialogs: 0,
        status: "error",
        note: error instanceof Error ? error.message : "Bitrix openline import failed"
      });
    }
  }

  for (const dialog of recentDialogs) {
    const dialogId = String(dialog.id ?? `chat${dialog.chat_id}`);
    try {
      const { messages, users } = await fetchDialogMessages(dialogId, sinceDate, untilDate);
      const normalized = normalizeBitrixMessages(dialog, messages, users);
      if (!normalized.length) continue;
      addMessages(normalized);
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

  const batchDialogs = summarizeDialogs(collectedMessages);
  const existingLive = incremental ? await readLivePeriodStore(periodKey) : null;

  if (!batchDialogs.length && !existingLive) {
    throw new Error(
      "Webhook Bitrix не имеет доступа к чатам. В настройках входящего вебхука добавьте права «Чат и уведомления (im)» и «Открытые линии (imopenlines)», затем повторите."
    );
  }

  let dashboard: ConversationDashboardMetrics;
  let totalDialogs: number;
  let totalMessages: number;
  let messagesAdded = collectedMessages.length;
  let dialogsAdded = batchDialogs.length;

  if (incremental) {
    const liveStore = await appendToLivePeriodStore({
      periodKey,
      incomingMessages: collectedMessages,
      importedAt
    });
    dashboard = liveStore.dashboard;
    totalDialogs = liveStore.summary.dialogsLoaded;
    totalMessages = liveStore.summary.messagesLoaded;
    messagesAdded = liveStore.summary.lastBatchMessages;
    dialogsAdded = liveStore.summary.lastBatchDialogs;
  } else {
    const dialogs = batchDialogs.length ? batchDialogs : summarizeDialogs(existingLive?.messages ?? []);
    dashboard = buildConversationDashboard(dialogs);
    totalDialogs = dialogs.length;
    totalMessages = collectedMessages.length || existingLive?.summary.messagesLoaded || 0;
  }

  const importedDay = importedAt.slice(0, 10);
  const dailyLabel = incremental
    ? `Bitrix · ${importedDay} (+${dialogsAdded} диалогов)`
    : periodKey
      ? `Bitrix monthly sync (${periodKey})`
      : `Bitrix daily sync (${daysBack} дн.)`;

  await writeConversationSnapshot({
    version: 1,
    source: "bitrix",
    importedAt,
    importedDay,
    periodKey,
    label: dailyLabel,
    dashboard: incremental ? dashboard : buildConversationDashboard(batchDialogs),
    diagnostics,
    summary: {
      filesLoaded: recentDialogs.length,
      messagesLoaded: incremental ? messagesAdded : collectedMessages.length,
      dialogsLoaded: incremental ? dialogsAdded : batchDialogs.length,
      filesParsed: diagnostics.filter((item) => item.status === "ok").length,
      filesFailed: diagnostics.filter((item) => item.status === "error").length
    }
  });

  return {
    source: "bitrix",
    importedAt,
    dashboard,
    diagnostics,
    periodKey,
    summary: {
      dialogsScanned: recentDialogs.length,
      dialogsImported: incremental ? dialogsAdded : batchDialogs.length,
      messagesLoaded: incremental ? messagesAdded : collectedMessages.length,
      daysBack,
      lookbackSince: sinceIso,
      filesLoaded: recentDialogs.length,
      dialogsLoaded: incremental ? dialogsAdded : batchDialogs.length,
      messagesAdded,
      dialogsAdded,
      totalDialogs,
      totalMessages,
      incremental
    }
  };
}
