import { answerManagerQuestion, renderTelegramMessage } from "@/lib/manager-qa/answer";

type TelegramUser = { id?: number; is_bot?: boolean; username?: string };
type TelegramChat = { id: number; type?: string };
type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
  reply_to_message?: { from?: TelegramUser };
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

const seenUpdates = new Set<number>();
let botIdentity: { id: number; username: string } | null = null;

export function managerQaBotToken(): string {
  return process.env.TELEGRAM_MANAGER_QA_BOT_TOKEN?.trim() || "";
}

export function managerQaWebhookSecret(): string {
  return process.env.TELEGRAM_MANAGER_QA_WEBHOOK_SECRET?.trim() || "";
}

function allowedUserIds(): Set<string> {
  return new Set(
    (process.env.TELEGRAM_MANAGER_QA_USER_IDS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

export function isAllowedManager(userId: number | undefined): boolean {
  const allowed = allowedUserIds();
  if (allowed.size === 0) return true;
  return userId != null && allowed.has(String(userId));
}

function rememberUpdate(updateId: number): boolean {
  if (seenUpdates.has(updateId)) return false;
  seenUpdates.add(updateId);
  if (seenUpdates.size > 500) {
    const first = seenUpdates.values().next().value;
    if (first != null) seenUpdates.delete(first);
  }
  return true;
}

async function telegramCall(method: string, body: Record<string, unknown>) {
  const token = managerQaBotToken();
  if (!token) throw new Error("TELEGRAM_MANAGER_QA_BOT_TOKEN is empty");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({})) as { ok?: boolean; description?: string; result?: { id?: number; username?: string } };
  if (!response.ok || data.ok === false) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data;
}

async function getBotIdentity() {
  if (botIdentity) return botIdentity;
  const data = await telegramCall("getMe", {});
  const id = data.result?.id;
  const username = data.result?.username?.trim();
  if (!id || !username) throw new Error("Telegram getMe returned no bot identity");
  botIdentity = { id, username };
  return botIdentity;
}

function commandName(text: string): string {
  const head = text.trim().split(/\s+/)[0] ?? "";
  return head.split("@")[0]?.toLowerCase() ?? "";
}

function addressedToBot(message: TelegramMessage, bot: { id: number; username: string }): boolean {
  if (message.chat.type === "private") return true;
  const text = message.text ?? "";
  if (text.toLowerCase().includes(`@${bot.username.toLowerCase()}`)) return true;
  if (message.reply_to_message?.from?.id === bot.id) return true;
  const command = commandName(text);
  return command === "/ask" || command === "/start" || command === "/help";
}

function questionText(text: string, username: string): string {
  return text
    .replace(new RegExp(`@${username}`, "ig"), " ")
    .replace(/^\/(ask|start|help)(?:@\S+)?/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const START_TEXT = [
  "🤖 Помощник менеджера",
  "",
  "Напишите вопрос своими словами. Отвечу по базе знаний, карточкам продуктов и урокам CRM: доставка, сроки, оплата, цены, возражения и куда писать, если заказ встал.",
  "",
  "Можно сразу попросить материалы: «Скинь отзывы по поздравительной газете» или «Фото по книге жизни».",
  "Например: «Сколько занимает доставка в Италию и сколько стоит?»",
  "Если факта в базе нет, я так и скажу и ничего не придумаю."
].join("\n");

async function sendText(chatId: number, text: string, replyTo?: number) {
  const html = renderTelegramMessage(text);
  const payload = {
    chat_id: chatId,
    reply_to_message_id: replyTo,
    disable_web_page_preview: true
  };
  try {
    await telegramCall("sendMessage", { ...payload, text: html, parse_mode: "HTML" });
  } catch (error) {
    const description = error instanceof Error ? error.message : "";
    if (!/parse|entit|tag/i.test(description)) throw error;
    await telegramCall("sendMessage", { ...payload, text: html.replace(/<[^>]+>/g, "") });
  }
}

export async function handleManagerQaUpdate(update: TelegramUpdate): Promise<void> {
  if (!rememberUpdate(update.update_id)) return;
  const message = update.message;
  const text = message?.text?.trim() ?? "";
  if (!message || !text || message.from?.is_bot) return;

  try {
    const bot = await getBotIdentity();
    if (!addressedToBot(message, bot)) return;
    if (!isAllowedManager(message.from?.id)) {
      await sendText(message.chat.id, "Этот бот отвечает только менеджерам Retro Pressa.", message.message_id);
      return;
    }

    const command = commandName(text);
    if (command === "/start" || command === "/help") {
      await sendText(message.chat.id, START_TEXT, message.message_id);
      return;
    }

    const question = questionText(text, bot.username);
    if (!question) {
      await sendText(message.chat.id, START_TEXT, message.message_id);
      return;
    }

    await telegramCall("sendChatAction", { chat_id: message.chat.id, action: "typing" }).catch(() => undefined);
    const answer = await answerManagerQuestion(question);
    await sendText(message.chat.id, answer, message.message_id);
  } catch (error) {
    console.error("Manager QA reply failed:", error instanceof Error ? error.message : error);
    await sendText(message.chat.id, "Не получилось ответить. Напишите вопрос ещё раз.", message.message_id).catch(() => undefined);
  }
}
