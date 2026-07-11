import { Bot } from "grammy";
import { JWT } from "google-auth-library";

const SHEET_HEADERS = [
  "timestamp",
  "chat_id",
  "chat_title",
  "message_id",
  "author_id",
  "author_name",
  "text",
  "is_question",
  "category",
  "status",
  "answer",
  "source"
];

const QUESTION_WORDS = [
  "как",
  "что",
  "где",
  "когда",
  "почему",
  "зачем",
  "сколько",
  "какой",
  "какая",
  "какие",
  "можно ли",
  "подскажите",
  "подскажет",
  "не понимаю",
  "не понятно",
  "непонятно"
];

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function parseList(value) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
}

// Всегда исключаем этих пользователей, даже если env не задан.
const DEFAULT_EXCLUDED_USERNAMES = ["anna_last", "marija_pat"];

function mergedExcludedUsernames() {
  return [...new Set([...DEFAULT_EXCLUDED_USERNAMES, ...parseList(process.env.EXCLUDED_USERNAMES)])];
}

const config = {
  botToken: required("TELEGRAM_MANAGER_QUESTIONS_BOT_TOKEN"),
  spreadsheetId: required("MANAGER_QUESTIONS_SHEET_ID"),
  sheetName: process.env.MANAGER_QUESTIONS_SHEET_NAME?.trim() || "Лист1",
  serviceAccountEmail: required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  privateKey: required("GOOGLE_PRIVATE_KEY").replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n"),
  excludedUsernames: mergedExcludedUsernames(),
  excludedUserIds: parseList(process.env.EXCLUDED_USER_IDS),
  allowedChatIds: parseList(process.env.TELEGRAM_MANAGER_QUESTIONS_CHAT_IDS),
  onlyQuestions: (process.env.ONLY_QUESTIONS ?? "true").trim().toLowerCase() !== "false"
};

const jwt = new JWT({
  email: config.serviceAccountEmail,
  key: config.privateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

function quoteTab(title) {
  return `'${title.replace(/'/g, "''")}'`;
}

async function sheetsRequest(method, path, body) {
  const { token } = await jwt.getAccessToken();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}${path}`,
    {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Sheets ${method} failed: ${data?.error?.message || response.status}`);
  }
  return data;
}

async function ensureHeaderRow() {
  const tab = quoteTab(config.sheetName);
  const range = encodeURIComponent(`${tab}!A1:L1`);
  const data = await sheetsRequest("GET", `/values/${range}`);
  const firstRow = data.values?.[0] ?? [];
  if (firstRow.length > 0) return;

  await sheetsRequest(
    "PUT",
    `/values/${range}?valueInputOption=RAW`,
    { values: [SHEET_HEADERS] }
  );
  console.log("Header row written to", config.sheetName);
}

async function appendRow(row) {
  const tab = quoteTab(config.sheetName);
  const range = encodeURIComponent(`${tab}!A1`);
  await sheetsRequest(
    "POST",
    `/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { values: [row] }
  );
}

function looksLikeQuestion(text) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("?")) return true;
  return QUESTION_WORDS.some((word) => normalized.includes(word));
}

function authorName(from) {
  const parts = [from?.first_name, from?.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return from?.username ? `@${from.username}` : "";
}

function isExcluded(from) {
  if (!from) return false;
  const username = from.username?.toLowerCase();
  if (username && config.excludedUsernames.includes(username)) return true;
  if (config.excludedUserIds.includes(String(from.id))) return true;
  return false;
}

function isAllowedChat(chatId) {
  if (config.allowedChatIds.length === 0) return true;
  return config.allowedChatIds.includes(String(chatId));
}

const bot = new Bot(config.botToken);

bot.on("message", async (ctx) => {
  try {
    const message = ctx.message;
    const from = message.from;
    if (from?.is_bot) return;
    if (isExcluded(from)) return;
    if (!isAllowedChat(message.chat.id)) return;

    const text = (message.text ?? message.caption ?? "").trim();
    if (!text || text.startsWith("/")) return;

    const question = looksLikeQuestion(text);
    if (config.onlyQuestions && !question) return;

    const timestamp = new Date((message.date ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();
    const row = [
      timestamp,
      String(message.chat.id),
      message.chat.title ?? "",
      String(message.message_id),
      from?.id != null ? String(from.id) : "",
      authorName(from),
      text,
      question ? "true" : "false",
      "",
      "new",
      "",
      "telegram"
    ];

    await appendRow(row);
  } catch (error) {
    console.error("Failed to store message:", error instanceof Error ? error.message : error);
  }
});

bot.catch((error) => {
  console.error("Bot error:", error);
});

async function main() {
  await ensureHeaderRow();
  console.log("Manager questions bot started. Only questions:", config.onlyQuestions);
  if (config.excludedUsernames.length || config.excludedUserIds.length) {
    console.log("Excluded:", [...config.excludedUsernames, ...config.excludedUserIds].join(", "));
  }
  await bot.start();
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
