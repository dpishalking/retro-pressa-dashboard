import { readFile } from "node:fs/promises";
import path from "node:path";
import { answerManagerQuestion, renderTelegramMessage } from "@/lib/manager-qa/answer";
import {
  formatProductMessages,
  loadManagerCorpus,
  managerProductButtons,
  prepareOutgoingLinks,
  type ManagerCorpus,
  type OutgoingFile
} from "@/lib/manager-qa/catalog";

type TelegramUser = { id?: number; is_bot?: boolean; username?: string };
type TelegramChat = { id: number; type?: string };
type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
  reply_to_message?: { from?: TelegramUser };
};

type TelegramCallback = {
  id: string;
  data?: string;
  from?: TelegramUser;
  message?: { chat: TelegramChat; message_id: number };
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallback;
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
  if (text.trim().toLowerCase() === "наши продукты") return true;
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
  "Кнопка «Наши продукты» открывает карточки: информация, видео, фото и отзывы.",
  "Можно сразу попросить материалы: «Скинь отзывы по поздравительной газете» или «Фото по книге жизни».",
  "Например: «Сколько занимает доставка в Италию и сколько стоит?»",
  "Если факта в базе нет, я так и скажу и ничего не придумаю."
].join("\n");

const PRODUCT_KEYBOARD = {
  keyboard: [[{ text: "Наши продукты" }]],
  resize_keyboard: true,
  is_persistent: true
};

let corpusTask: Promise<ManagerCorpus> | null = null;

function managerCorpus(): Promise<ManagerCorpus> {
  corpusTask ??= loadManagerCorpus().catch((error) => {
    corpusTask = null;
    throw error;
  });
  return corpusTask;
}

async function telegramForm(method: string, form: FormData) {
  const token = managerQaBotToken();
  if (!token) throw new Error("TELEGRAM_MANAGER_QA_BOT_TOKEN is empty");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body: form });
  const data = await response.json().catch(() => ({})) as { ok?: boolean; description?: string };
  if (!response.ok || data.ok === false) throw new Error(data.description || `Telegram ${method} failed`);
}

async function sendFiles(chatId: number, files: OutgoingFile[]) {
  const photos = files.filter((item) => item.kind === "photo").slice(0, 20);
  const rest = files.filter((item) => item.kind !== "photo").slice(0, 6);
  for (let index = 0; index < photos.length; index += 10) {
    const group = photos.slice(index, index + 10);
    try {
      if (group.length === 1) await sendOneFile(chatId, group[0]);
      else await sendPhotoGroup(chatId, group);
    } catch (error) {
      console.error("Manager QA photo failed:", error instanceof Error ? error.message : error);
    }
  }
  for (const file of rest) {
    try {
      await sendOneFile(chatId, file);
    } catch (error) {
      console.error("Manager QA file failed:", error instanceof Error ? error.message : error);
    }
  }
}

async function sendOneFile(chatId: number, file: OutgoingFile) {
  const method = file.kind === "photo" ? "sendPhoto" : file.kind === "video" ? "sendVideo" : "sendDocument";
  const field = file.kind === "photo" ? "photo" : file.kind === "video" ? "video" : "document";
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (file.caption) form.append("caption", file.caption);
  if (file.url) {
    await telegramCall(method, { chat_id: chatId, [field]: file.url, caption: file.caption || undefined });
    return;
  }
  if (!file.filePath) return;
  const bytes = await readFile(file.filePath);
  form.append(field, new Blob([new Uint8Array(bytes)]), path.basename(file.filePath));
  await telegramForm(method, form);
}

async function sendPhotoGroup(chatId: number, files: OutgoingFile[]) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  const media = [];
  for (const [index, file] of files.entries()) {
    const key = `f${index}`;
    const item: { type: "photo"; media: string; caption?: string } = { type: "photo", media: file.url || `attach://${key}` };
    if (file.caption) item.caption = file.caption;
    if (file.filePath) {
      const bytes = await readFile(file.filePath);
      form.append(key, new Blob([new Uint8Array(bytes)]), path.basename(file.filePath));
    }
    media.push(item);
  }
  form.append("media", JSON.stringify(media));
  await telegramForm("sendMediaGroup", form);
}

async function sendText(chatId: number, text: string, replyTo?: number, replyMarkup: Record<string, unknown> = PRODUCT_KEYBOARD) {
  const prepared = prepareOutgoingLinks(text);
  const html = renderTelegramMessage(prepared.text || (prepared.files.length ? "Материалы ниже." : text));
  const payload = {
    chat_id: chatId,
    reply_to_message_id: replyTo,
    disable_web_page_preview: true,
    reply_markup: replyMarkup
  };
  try {
    await telegramCall("sendMessage", { ...payload, text: html, parse_mode: "HTML" });
  } catch (error) {
    const description = error instanceof Error ? error.message : "";
    if (!/parse|entit|tag/i.test(description)) throw error;
    await telegramCall("sendMessage", { ...payload, text: html.replace(/<[^>]+>/g, "") });
  }
  if (prepared.files.length) {
    await sendFiles(chatId, prepared.files).catch((error) => {
      console.error("Manager QA files failed:", error instanceof Error ? error.message : error);
    });
  }
}

async function sendProductMenu(chatId: number) {
  const buttons = managerProductButtons(await managerCorpus());
  await sendText(chatId, "Наши продукты\n\nНажмите продукт: пришлю информацию, видео, фото и отзывы.", undefined, {
    inline_keyboard: buttons.map((item) => [{ text: item.label, callback_data: `p:${item.id}` }])
  });
}

async function handleProductPick(callback: TelegramCallback) {
  const chatId = callback.message?.chat.id;
  await telegramCall("answerCallbackQuery", { callback_query_id: callback.id }).catch(() => undefined);
  if (!chatId) return;
  if (!isAllowedManager(callback.from?.id)) {
    await sendText(chatId, "Этот бот отвечает только менеджерам Retro Pressa.");
    return;
  }
  const productId = callback.data?.startsWith("p:") ? callback.data.slice(2) : "";
  const messages = formatProductMessages(productId, await managerCorpus());
  if (!messages?.length) {
    await sendText(chatId, "Этот продукт не найден.");
    return;
  }
  for (const message of messages) await sendText(chatId, message);
}

export async function handleManagerQaUpdate(update: TelegramUpdate): Promise<void> {
  if (!rememberUpdate(update.update_id)) return;
  if (update.callback_query) {
    try {
      await handleProductPick(update.callback_query);
    } catch (error) {
      console.error("Manager QA product pick failed:", error instanceof Error ? error.message : error);
    }
    return;
  }
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

    if (text.toLowerCase() === "наши продукты") {
      await sendProductMenu(message.chat.id);
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
