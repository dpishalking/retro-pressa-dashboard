import { readFileSync } from "node:fs";

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

const env = loadEnv(new URL("../.env.local", import.meta.url));
const token = (env.SMARTDESK_TELEGRAM_BOT_TOKEN || "").trim();
const secret = (env.SMARTDESK_TELEGRAM_WEBHOOK_SECRET || "").trim();
if (!token || !secret) {
  console.error("Set SMARTDESK_TELEGRAM_BOT_TOKEN and SMARTDESK_TELEGRAM_WEBHOOK_SECRET in .env.local");
  process.exit(1);
}

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: "https://rp-bi.site/api/telegram/smartdesk",
    secret_token: secret,
    allowed_updates: ["message"]
  })
});
const body = await response.text();
if (!response.ok) {
  console.error(body);
  process.exit(1);
}
console.log(body);

const commands = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    commands: [
      { command: "queue", description: "Кто ждёт ответа" },
      { command: "report", description: "Диалоги и скорость за сегодня" }
    ]
  })
});
console.log(await commands.text());
