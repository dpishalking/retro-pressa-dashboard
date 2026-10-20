import { formatRigaDateTime } from "@/lib/landing-lead-alerts/format";

/** Same recipients as landing-lead alerts: Даниил and the second chat. */
const DEFAULT_CHAT_IDS = ["223071474", "585011433"];

type RegisteredManager = {
  name: string;
  login: string;
  createdAt: string;
};

function alertConfig() {
  const token = (process.env.LANDING_LEAD_ALERT_BOT_TOKEN || process.env.TRAINER_BOT_TOKEN || "").trim();
  const chatIds = (process.env.LANDING_LEAD_ALERT_CHAT_IDS || DEFAULT_CHAT_IDS.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return { token, chatIds };
}

export function formatManagerRegistrationAlert(user: RegisteredManager): string {
  return [
    "Новая регистрация менеджера",
    "",
    user.name.trim() || "Без имени",
    `Логин: ${user.login}`,
    `Когда: ${formatRigaDateTime(user.createdAt)} (Рига)`
  ].join("\n");
}

async function sendTelegram(token: string, chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000)
  });
  const data = (await response.json()) as { ok?: boolean; description?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.description || "Telegram не принял сообщение");
  }
}

/** Does not throw: a missed alert must not block registration. */
export async function notifyManagerRegistered(user: RegisteredManager): Promise<void> {
  const { token, chatIds } = alertConfig();
  if (!token || chatIds.length === 0) {
    console.warn("Registration alert skipped: Telegram is not configured");
    return;
  }

  const text = formatManagerRegistrationAlert(user);
  const results = await Promise.allSettled(chatIds.map((chatId) => sendTelegram(token, chatId, text)));
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length === results.length) {
    console.warn("Registration alert was not delivered", failed);
    return;
  }
  if (failed.length) {
    console.warn("Registration alert missed some chats", failed);
  }
}
