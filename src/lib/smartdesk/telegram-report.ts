const WAITING_LABEL = "ждёт-ответа";
const SKIP_AGENT = "SmartDesk Integrations";
const QUEUE_LIMIT = 30;
const RIGA = "Europe/Riga";

export type SmartdeskCommand = "queue" | "report" | "help";

export type WaitingChat = {
  id: number;
  inbox: string;
  assignee: string;
  contact: string;
  waitingSince: number;
  lastText: string;
  incoming: boolean;
};

export type ReportRow = {
  name: string;
  conversations: number;
  incoming: number;
  outgoing: number;
  replySeconds: number;
};

type SmartdeskEnv = {
  baseUrl: string;
  accountId: string;
  apiToken: string;
  botToken: string;
  chatIds: string[];
};

type ConversationPayload = {
  id?: number;
  inbox_id?: number;
  waiting_since?: number | null;
  last_activity_at?: number;
  meta?: {
    assignee?: { name?: string } | null;
    sender?: { name?: string } | null;
  };
  last_non_activity_message?: {
    content?: string | null;
    message_type?: number;
    created_at?: number;
  } | null;
};

export function smartdeskEnv(env: Record<string, string | undefined> = process.env): SmartdeskEnv {
  return {
    baseUrl: (env.SMARTDESK_BASE_URL || "https://desk.smartai-crm.com").replace(/\/$/, ""),
    accountId: (env.SMARTDESK_ACCOUNT_ID || "11").trim(),
    apiToken: (env.SMARTDESK_API_TOKEN || "").trim(),
    botToken: (env.SMARTDESK_TELEGRAM_BOT_TOKEN || "").trim(),
    chatIds: (env.SMARTDESK_TELEGRAM_CHAT_IDS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  };
}

export function commandOf(text: string): SmartdeskCommand | null {
  const raw = text.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const command = raw.split("@")[0];
  if (command === "/queue" || command === "/waiting" || command === "очередь") return "queue";
  if (command === "/report" || command === "/otchet" || command === "отчёт" || command === "отчет") return "report";
  if (command === "/start" || command === "/help") return "help";
  return null;
}

export function startOfTodayUnix(now = Date.now(), timeZone = RIGA): number {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const noonUtc = Date.parse(`${day}T12:00:00Z`);
  const hourInZone = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(noonUtc)
  );
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 1000) - (hourInZone - 12) * 3600;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} мин`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${String(hours).replace(".", ",")} ч`;
}

export function chunkText(text: string, limit = 3800): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    const cut = rest.lastIndexOf("\n", limit);
    const at = cut > 200 ? cut : limit;
    chunks.push(rest.slice(0, at).trimEnd());
    rest = rest.slice(at).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function displayName(value: string | undefined, fallback: string): string {
  const name = (value || "").trim();
  const digits = name.replace(/\D/g, "");
  if (!name || digits.length >= 8) return fallback;
  return name;
}

function oneLine(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return "без текста";
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

export function formatQueue(chats: WaitingChat[], total: number, now = Date.now(), accountId = "11"): string {
  const shown = [...chats].sort((a, b) => a.waitingSince - b.waitingSince).slice(0, QUEUE_LIMIT);
  const lines = [`Очередь «ждёт-ответа»: ${total}`, ""];
  if (!shown.length) {
    lines.push("Сейчас пусто.");
    return lines.join("\n");
  }
  for (const chat of shown) {
    const age = formatDuration(Math.floor(now / 1000) - chat.waitingSince);
    const who = chat.incoming ? "клиент" : "мы";
    lines.push(`${chat.assignee} · ${chat.contact} · ${chat.inbox} · ${age} · ${who}`);
    lines.push(`${oneLine(chat.lastText)}`);
    lines.push(`https://desk.smartai-crm.com/app/accounts/${accountId}/conversations/${chat.id}`);
    lines.push("");
  }
  if (total > shown.length) lines.push(`Ещё ${total - shown.length}. В списке самые долгие.`);
  return lines.join("\n").trim();
}

export type ReportPart = "summary" | "managers" | "inboxes";

export function formatReport(input: {
  dayLabel: string;
  managers: ReportRow[];
  inboxes: ReportRow[];
  waiting: number;
  part?: ReportPart;
}): string {
  const part = input.part ?? "summary";
  const lines = [`SmartDesk за ${input.dayLabel}, Рига`, ""];
  if (part !== "inboxes") {
    lines.push("Менеджеры");
    if (!input.managers.length) lines.push("Живых диалогов нет.");
    for (const row of input.managers) {
      lines.push(
        `${row.name} — ${row.conversations} диал., ответ ${formatDuration(row.replySeconds)}, исх ${row.outgoing}`
      );
    }
  }
  if (part !== "managers") {
    if (part !== "inboxes") lines.push("");
    lines.push("Источники");
    if (!input.inboxes.length) lines.push("Пусто.");
    for (const row of input.inboxes) {
      lines.push(`${row.name} — ${row.conversations} диал., ответ ${formatDuration(row.replySeconds)}`);
    }
  }
  lines.push("", `Очередь «ждёт-ответа»: ${input.waiting}.`);
  return lines.join("\n");
}

export function helpText(chatId: number, allowed: boolean): string {
  const lines = [
    "Бот SmartDesk.",
    "/queue — кто ждёт ответа",
    "/report — диалоги и скорость за сегодня",
    "",
    `Ваш chat id: ${chatId}`
  ];
  if (!allowed) lines.push("Этого чата нет в SMARTDESK_TELEGRAM_CHAT_IDS, отчёты закрыты.");
  return lines.join("\n");
}

async function smartdeskGet(path: string, version: "v1" | "v2" = "v1"): Promise<unknown> {
  const { baseUrl, accountId, apiToken } = smartdeskEnv();
  if (!apiToken) throw new Error("SMARTDESK_API_TOKEN is empty");
  const response = await fetch(`${baseUrl}/api/${version}/accounts/${accountId}${path}`, {
    headers: { api_access_token: apiToken },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`SmartDesk ${response.status}`);
  return response.json();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function inboxNames(): Promise<Map<number, string>> {
  const body = asRecord(await smartdeskGet("/inboxes"));
  const items = Array.isArray(body.payload) ? body.payload : [];
  const names = new Map<number, string>();
  for (const item of items) {
    const row = asRecord(item);
    names.set(asNumber(row.id), String(row.name || row.id || ""));
  }
  return names;
}

function toWaitingChat(row: ConversationPayload, inboxes: Map<number, string>): WaitingChat | null {
  if (!row.id) return null;
  const message = row.last_non_activity_message;
  const waitingSince = row.waiting_since || message?.created_at || row.last_activity_at || Math.floor(Date.now() / 1000);
  return {
    id: row.id,
    inbox: inboxes.get(row.inbox_id || 0) || String(row.inbox_id || ""),
    assignee: displayName(row.meta?.assignee?.name, "Не назначен"),
    contact: displayName(row.meta?.sender?.name, "Клиент"),
    waitingSince,
    lastText: message?.content || "",
    incoming: message?.message_type === 0
  };
}

export async function buildQueueText(now = Date.now()): Promise<string> {
  const inboxes = await inboxNames();
  const chats: WaitingChat[] = [];
  let total = 0;
  for (let page = 1; page <= 4; page += 1) {
    const params = new URLSearchParams({ status: "open", assignee_type: "all", page: String(page) });
    params.append("labels[]", WAITING_LABEL);
    const body = asRecord(await smartdeskGet(`/conversations?${params.toString()}`));
    const data = asRecord(body.data);
    const payload = Array.isArray(data.payload) ? data.payload : [];
    total = asNumber(asRecord(data.meta).all_count) || total;
    for (const item of payload) {
      const chat = toWaitingChat(item as ConversationPayload, inboxes);
      if (chat) chats.push(chat);
    }
    if (payload.length < 25) break;
  }
  return formatQueue(chats, total || chats.length, now, smartdeskEnv().accountId);
}

async function summary(type: "agent" | "inbox", id: number, since: number, until: number): Promise<ReportRow | null> {
  const params = new URLSearchParams({
    type,
    id: String(id),
    since: String(since),
    until: String(until)
  });
  const body = asRecord(await smartdeskGet(`/reports/summary?${params.toString()}`, "v2"));
  const conversations = asNumber(body.conversations_count);
  const incoming = asNumber(body.incoming_messages_count);
  if (conversations === 0) return null;
  return {
    name: "",
    conversations,
    incoming,
    outgoing: asNumber(body.outgoing_messages_count),
    replySeconds: asNumber(body.reply_time)
  };
}

export async function buildReportText(now = Date.now(), part: ReportPart = "summary"): Promise<string> {
  const since = startOfTodayUnix(now);
  const until = Math.floor(now / 1000);
  const dayLabel = new Intl.DateTimeFormat("ru-RU", {
    timeZone: RIGA,
    day: "numeric",
    month: "long"
  }).format(now);

  const [agentBody, inboxBody, waitingBody] = await Promise.all([
    smartdeskGet("/agents"),
    smartdeskGet("/inboxes"),
    smartdeskGet(`/conversations/meta?status=open&labels[]=${encodeURIComponent(WAITING_LABEL)}`)
  ]);
  const agents = (Array.isArray(agentBody) ? agentBody : [])
    .map((item) => asRecord(item))
    .filter((agent) => String(agent.name || "") !== SKIP_AGENT);
  const inboxes = (Array.isArray(asRecord(inboxBody).payload) ? asRecord(inboxBody).payload : []).map((item) => asRecord(item));

  const managerRows = part === "inboxes"
    ? []
    : (
      await Promise.all(
        agents.map(async (agent) => {
          const row = await summary("agent", asNumber(agent.id), since, until);
          if (!row) return null;
          row.name = String(agent.name || agent.id);
          return row;
        })
      )
    )
      .filter((row): row is ReportRow => Boolean(row))
      .sort((a, b) => b.conversations - a.conversations);

  const inboxRows = part === "managers"
    ? []
    : (
      await Promise.all(
        inboxes.map(async (inbox) => {
          const row = await summary("inbox", asNumber(inbox.id), since, until);
          if (!row) return null;
          row.name = String(inbox.name || inbox.id);
          return row;
        })
      )
    )
      .filter((row): row is ReportRow => Boolean(row))
      .sort((a, b) => b.conversations - a.conversations);

  const waiting = asNumber(asRecord(asRecord(waitingBody).meta).all_count);
  return formatReport({ dayLabel, managers: managerRows, inboxes: inboxRows, waiting, part });
}

export async function replyForCommand(command: SmartdeskCommand, chatId: number, allowed: boolean): Promise<string> {
  if (command === "help" || !allowed) return helpText(chatId, allowed);
  if (command === "queue") return buildQueueText();
  return buildReportText();
}

type TelegramUpdate = {
  message?: {
    chat?: { id?: number };
    text?: string;
  };
};

export async function handleSmartdeskTelegramUpdate(update: TelegramUpdate | null): Promise<void> {
  const message = update?.message;
  const chatId = message?.chat?.id;
  const text = message?.text;
  if (!chatId || !text) return;
  const command = commandOf(text);
  if (!command) return;

  const { botToken, chatIds } = smartdeskEnv();
  if (!botToken) return;
  const allowed = chatIds.includes(String(chatId));
  if (!allowed && command !== "help") return;

  const reply = await replyForCommand(command, chatId, allowed);
  for (const chunk of chunkText(reply)) {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram ${response.status}: ${body.slice(0, 180)}`);
    }
  }
}
