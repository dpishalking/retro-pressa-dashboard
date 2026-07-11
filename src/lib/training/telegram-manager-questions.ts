import { collectManagerQuestion, looksLikeQuestion } from "@/lib/training/manager-questions";

type TelegramUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  is_bot?: boolean;
};

type TelegramChat = {
  id?: number;
  type?: string;
  title?: string;
};

type TelegramMessage = {
  message_id?: number;
  from?: TelegramUser;
  chat?: TelegramChat;
  text?: string;
  caption?: string;
};

export type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

function authorName(from?: TelegramUser): string | undefined {
  if (!from) return undefined;
  const parts = [from.first_name, from.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return from.username ? `@${from.username}` : undefined;
}

function isAllowedChat(chatId: string): boolean {
  const raw = process.env.TELEGRAM_MANAGER_QUESTIONS_CHAT_IDS?.trim();
  if (!raw) return true;
  const allowed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(chatId);
}

export async function handleManagerQuestionsTelegramUpdate(update: TelegramUpdate) {
  const message = update.message ?? update.edited_message;
  if (!message) {
    return { handled: false, reason: "not_text" as const };
  }
  if (message.from?.is_bot) {
    return { handled: false, reason: "bot_message" as const };
  }

  const text = (message.text ?? message.caption ?? "").trim();
  if (!text || text.startsWith("/")) {
    return { handled: false, reason: "not_text" as const };
  }

  const chatId = message.chat?.id != null ? String(message.chat.id) : undefined;
  if (chatId && !isAllowedChat(chatId)) {
    return { handled: false, reason: "chat_not_allowed" as const };
  }

  if (!looksLikeQuestion(text)) {
    return { handled: false, reason: "not_a_question" as const };
  }

  const result = await collectManagerQuestion({
    source: "telegram",
    text,
    authorName: authorName(message.from),
    authorId: message.from?.id != null ? String(message.from.id) : undefined,
    chatId,
    messageId: message.message_id != null ? String(message.message_id) : undefined
  });

  return {
    handled: true,
    collected: true,
    deduplicated: result.deduplicated,
    questionId: result.question.id
  };
}

export function readTelegramBotToken(): string | null {
  return process.env.TELEGRAM_MANAGER_QUESTIONS_BOT_TOKEN?.trim() || null;
}

export function readTelegramWebhookSecret(): string | null {
  return process.env.TELEGRAM_MANAGER_QUESTIONS_WEBHOOK_SECRET?.trim() || null;
}

export function managerQuestionsWebhookUrl(appBaseUrl: string): string {
  const base = appBaseUrl.replace(/\/$/, "");
  return `${base}/api/training/manager-questions/telegram-webhook`;
}

export async function registerManagerQuestionsTelegramWebhook(appBaseUrl: string) {
  const token = readTelegramBotToken();
  if (!token) {
    throw new Error("TELEGRAM_MANAGER_QUESTIONS_BOT_TOKEN is not configured");
  }

  const url = managerQuestionsWebhookUrl(appBaseUrl);
  const secret = readTelegramWebhookSecret();
  const body: Record<string, unknown> = {
    url,
    allowed_updates: ["message", "edited_message"],
    drop_pending_updates: false
  };
  if (secret) {
    body.secret_token = secret;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: boolean;
  };

  if (!response.ok || !data.ok) {
    throw new Error(data.description ?? `Telegram setWebhook failed (${response.status})`);
  }

  return { url, secretConfigured: Boolean(secret) };
}

export async function getManagerQuestionsTelegramWebhookInfo() {
  const token = readTelegramBotToken();
  if (!token) {
    throw new Error("TELEGRAM_MANAGER_QUESTIONS_BOT_TOKEN is not configured");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
    cache: "no-store"
  });
  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: {
      url?: string;
      has_custom_certificate?: boolean;
      pending_update_count?: number;
      last_error_message?: string;
    };
  };

  if (!response.ok || !data.ok) {
    throw new Error(data.description ?? `Telegram getWebhookInfo failed (${response.status})`);
  }

  return data.result ?? {};
}
