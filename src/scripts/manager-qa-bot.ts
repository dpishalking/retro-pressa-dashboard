import { handleManagerQaUpdate, managerQaBotToken, type TelegramUpdate } from "@/lib/manager-qa/telegram";

const token = managerQaBotToken();
if (!token) {
  console.error("TELEGRAM_MANAGER_QA_BOT_TOKEN is empty");
  process.exit(1);
}

async function telegram(method: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : "{}"
  });
  const data = await response.json().catch(() => ({})) as {
    ok?: boolean;
    description?: string;
    result?: TelegramUpdate[];
  };
  if (!response.ok || data.ok === false) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await telegram("deleteWebhook", { drop_pending_updates: false });
  console.log("Manager QA bot is polling. Telegram webhook is off, so the bot does not depend on the office computer.");

  let offset = 0;
  for (;;) {
    try {
      const data = await telegram("getUpdates", {
        timeout: 50,
        offset,
        allowed_updates: ["message", "callback_query"]
      });
      for (const update of data.result || []) {
        offset = update.update_id + 1;
        try {
          await handleManagerQaUpdate(update);
        } catch (error) {
          console.error("Update failed:", error instanceof Error ? error.message : error);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Poll error:", message);
      if (/webhook|terminated/i.test(message)) {
        await telegram("deleteWebhook", { drop_pending_updates: false }).catch(() => undefined);
      }
      await sleep(3000);
    }
  }
}

main().catch((error) => {
  console.error("Fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
