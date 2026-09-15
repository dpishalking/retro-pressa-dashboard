/**
 * WABA / Wazzup posts CRM outbound into Open Lines as if the WhatsApp contact sent it.
 * Bitrix marks that contact as extranet, so last-role would look like the client wrote.
 */

export type OpenLineSpeaker = {
  role: "client" | "manager";
  name: string;
  text: string;
};

const OUTGOING_RU = /^=+\s*Исходящее\s+сообщение\s*,?\s*автор:\s*([^=]+?)\s*=+\s*/i;
const OUTGOING_EN = /^=+\s*Outgoing\s+message\s*,?\s*author:\s*([^=]+?)\s*=+\s*/i;

function normalizeOpenLineText(raw: string) {
  return raw.replace(/<br\s*\/?>/gi, "\n").replace(/^\uFEFF/, "").trim();
}

export function parseOpenLineManagerEcho(raw: string) {
  const normalized = normalizeOpenLineText(raw);
  const match = normalized.match(OUTGOING_RU) || normalized.match(OUTGOING_EN);
  if (!match) return null;
  const named = match[1]?.match(/\(([^)]+)\)/);
  const authorName = named?.[1]?.trim() || null;
  return {
    authorName,
    body: normalized.slice(match[0].length).trim()
  };
}

export function resolveOpenLineSpeaker(input: {
  extranet?: boolean | string;
  userName?: string;
  text: string;
}): OpenLineSpeaker {
  const echo = parseOpenLineManagerEcho(input.text);
  if (echo) {
    return {
      role: "manager",
      name: echo.authorName || "Менеджер",
      text: echo.body
    };
  }
  const isClient = input.extranet === true || input.extranet === "Y";
  return {
    role: isClient ? "client" : "manager",
    name: input.userName || (isClient ? "Клиент" : "Менеджер"),
    text: input.text
  };
}
