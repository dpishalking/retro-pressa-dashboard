import { bitrixListAll } from "@/lib/bitrix/rest-client";
import { asString, loadUserNames, multiValue } from "@/lib/bitrix/sales-foundation/customer-key";
import { formatLandingLeadAlert, helloMessage, type LandingLeadAlert } from "@/lib/landing-lead-alerts/format";
import { activeLandings, matchLanding, pageUrlFromLead } from "@/lib/landing-lead-alerts/landings";
import { loadAlertState, rememberIds, saveAlertState, type AlertState } from "@/lib/landing-lead-alerts/state";

const LOOKBACK_MS = 36 * 60 * 60 * 1000;

type RawLead = Record<string, unknown>;

export type LandingLeadAlertResult = {
  ok: boolean;
  bootstrapped: boolean;
  helloSent: boolean;
  checked: number;
  matched: number;
  sent: Array<{ id: string; landing: string }>;
  pending: string[];
  warning?: string;
};

type TelegramConfig = {
  token: string;
  chatIds: string[];
};

/** Даниил Пищалкин, @d_pishalking. Landing alerts go here unless overridden. */
export const DEFAULT_LANDING_LEAD_ALERT_CHAT_ID = "223071474";

export function telegramAlertConfig(env: Record<string, string | undefined> = process.env): TelegramConfig {
  const token = (env.LANDING_LEAD_ALERT_BOT_TOKEN || env.TRAINER_BOT_TOKEN || "").trim();
  const chatIds = (env.LANDING_LEAD_ALERT_CHAT_IDS || DEFAULT_LANDING_LEAD_ALERT_CHAT_ID)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return { token, chatIds };
}

function rigaStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

async function sendTelegram(token: string, chatId: string, text: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
    });
  } catch {
    throw new Error("Не удалось связаться с Telegram");
  }
  const data = (await response.json()) as { ok?: boolean; description?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.description || "Telegram не принял сообщение");
  }
}

async function sendToChats(config: TelegramConfig, text: string): Promise<void> {
  const errors: string[] = [];
  for (const chatId of config.chatIds) {
    try {
      await sendTelegram(config.token, chatId, text);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Telegram не принял сообщение");
    }
  }
  if (errors.length) throw new Error(errors.join("; "));
}

async function fetchRecentLeads(now: Date): Promise<RawLead[]> {
  return bitrixListAll<RawLead>("crm.lead.list", {
    order: { DATE_CREATE: "ASC" },
    filter: { ">=DATE_CREATE": rigaStamp(new Date(now.getTime() - LOOKBACK_MS)) },
    select: [
      "ID",
      "TITLE",
      "NAME",
      "LAST_NAME",
      "DATE_CREATE",
      "STATUS_ID",
      "SOURCE_ID",
      "SOURCE_DESCRIPTION",
      "COMMENTS",
      "ASSIGNED_BY_ID",
      "PHONE",
      "EMAIL",
      "UTM_SOURCE",
      "UTM_MEDIUM",
      "UTM_CAMPAIGN",
      "UTM_CONTENT",
      "UTM_TERM"
    ]
  });
}

async function statusNames(): Promise<Map<string, string>> {
  const rows = await bitrixListAll<{ STATUS_ID?: string; NAME?: string }>("crm.status.list", {
    filter: { ENTITY_ID: "STATUS" }
  });
  return new Map(rows.map((row) => [String(row.STATUS_ID || ""), String(row.NAME || "")]));
}

async function isRepeat(phone: string, email: string, selfId: string): Promise<boolean | null> {
  try {
    const ids = new Set<string>();
    if (phone) {
      const rows = await bitrixListAll<{ ID?: string }>("crm.lead.list", {
        filter: { PHONE: phone },
        select: ["ID"]
      });
      for (const row of rows) if (row.ID) ids.add(String(row.ID));
    }
    if (email) {
      const rows = await bitrixListAll<{ ID?: string }>("crm.lead.list", {
        filter: { EMAIL: email },
        select: ["ID"]
      });
      for (const row of rows) if (row.ID) ids.add(String(row.ID));
    }
    ids.delete(selfId);
    return ids.size > 0;
  } catch {
    return null;
  }
}

function toAlert(
  lead: RawLead,
  landingLabel: string,
  pageUrl: string,
  statusName: string,
  assignedName: string,
  repeat: boolean | null
): LandingLeadAlert {
  const name = [asString(lead.NAME), asString(lead.LAST_NAME)].filter(Boolean).join(" ");
  return {
    landingLabel,
    pageUrl,
    id: asString(lead.ID),
    title: asString(lead.TITLE),
    name,
    createdAt: asString(lead.DATE_CREATE),
    statusName,
    comment: asString(lead.COMMENTS),
    phone: multiValue(lead.PHONE)[0] || "",
    email: multiValue(lead.EMAIL)[0] || "",
    utmSource: asString(lead.UTM_SOURCE),
    utmMedium: asString(lead.UTM_MEDIUM),
    utmCampaign: asString(lead.UTM_CAMPAIGN),
    utmContent: asString(lead.UTM_CONTENT),
    utmTerm: asString(lead.UTM_TERM),
    assignedName,
    repeat
  };
}

export async function runLandingLeadAlerts(now = new Date()): Promise<LandingLeadAlertResult> {
  const config = telegramAlertConfig();
  const landings = activeLandings();
  const leads = await fetchRecentLeads(now);
  const matched = leads.flatMap((lead) => {
    const landing = matchLanding({
      sourceId: asString(lead.SOURCE_ID),
      sourceDescription: asString(lead.SOURCE_DESCRIPTION),
      title: asString(lead.TITLE),
      utmCampaign: asString(lead.UTM_CAMPAIGN)
    }, landings);
    return landing ? [{ lead, landing }] : [];
  });

  const state = await loadAlertState();
  const matchedIds = matched.map((item) => asString(item.lead.ID)).filter(Boolean);
  let next: AlertState = state.bootstrapped
    ? state
    : { bootstrapped: true, helloSent: false, notifiedIds: rememberIds(state.notifiedIds, matchedIds) };

  const telegramReady = Boolean(config.token && config.chatIds.length);
  const warning = telegramReady
    ? undefined
    : "Не задан токен бота или чат Telegram. Новые лиды подождут и уйдут, когда чат появится.";

  if (!state.bootstrapped) {
    if (telegramReady) {
      await sendToChats(config, helloMessage(landings.map((landing) => landing.label)));
      next = { ...next, helloSent: true };
    }
    await saveAlertState(next);
    return {
      ok: telegramReady,
      bootstrapped: true,
      helloSent: next.helloSent,
      checked: leads.length,
      matched: matched.length,
      sent: [],
      pending: [],
      warning: telegramReady
        ? undefined
        : "Чат Telegram не задан. Лиды, которые уже есть в CRM, повторно не пришлю. Новые подождут чат."
    };
  }

  const known = new Set(state.notifiedIds);
  const fresh = matched.filter((item) => {
    const id = asString(item.lead.ID);
    return id && !known.has(id);
  });

  if (warning) {
    return {
      ok: false,
      bootstrapped: true,
      helloSent: state.helloSent,
      checked: leads.length,
      matched: matched.length,
      sent: [],
      pending: fresh.map((item) => asString(item.lead.ID)),
      warning
    };
  }

  if (!state.helloSent) {
    await sendToChats(config, helloMessage(landings.map((landing) => landing.label)));
    next = { ...state, helloSent: true };
    await saveAlertState(next);
  }

  const statuses = fresh.length ? await statusNames() : new Map<string, string>();
  const users = fresh.length
    ? await loadUserNames(fresh.map((item) => asString(item.lead.ASSIGNED_BY_ID)))
    : new Map<string, string>();

  const sent: Array<{ id: string; landing: string }> = [];
  const pending: string[] = [];
  let sendError = "";
  const delivered = [...next.notifiedIds];

  for (const item of fresh) {
    const id = asString(item.lead.ID);
    const phone = multiValue(item.lead.PHONE)[0] || "";
    const email = multiValue(item.lead.EMAIL)[0] || "";
    const alert = toAlert(
      item.lead,
      item.landing.label,
      pageUrlFromLead(item.landing, asString(item.lead.SOURCE_DESCRIPTION)),
      statuses.get(asString(item.lead.STATUS_ID)) || asString(item.lead.STATUS_ID),
      users.get(asString(item.lead.ASSIGNED_BY_ID)) || "",
      await isRepeat(phone, email, id)
    );
    try {
      await sendToChats(config, formatLandingLeadAlert(alert));
      sent.push({ id, landing: item.landing.id });
      delivered.push(id);
      await saveAlertState({ ...next, notifiedIds: rememberIds([], delivered) });
    } catch (error) {
      pending.push(id);
      sendError = error instanceof Error ? error.message : "Не удалось отправить сообщение";
    }
  }

  return {
    ok: pending.length === 0,
    bootstrapped: true,
    helloSent: next.helloSent,
    checked: leads.length,
    matched: matched.length,
    sent,
    pending,
    warning: sendError || undefined
  };
}

