import { bitrixListAll, bitrixResult } from "@/lib/bitrix/rest-client";
import { asString, loadUserNames, multiValue } from "@/lib/bitrix/sales-foundation/customer-key";
import { bitrixLeadUrl, formatLandingLeadAlert, formatRigaDateTime, helloMessage, type LandingLeadAlert } from "@/lib/landing-lead-alerts/format";
import {
  formatInstagramIntentAlert,
  intentLines,
  isInstagramDmLead,
  plainChatText,
  type ClientLine
} from "@/lib/landing-lead-alerts/instagram";
import { activeLandings, matchLanding, pageUrlFromLead } from "@/lib/landing-lead-alerts/landings";
import { loadAlertState, rememberIds, saveAlertState, type AlertState, type InstagramCheck } from "@/lib/landing-lead-alerts/state";

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

/** Даниил Пищалкин (@d_pishalking) and the second alert recipient. */
export const DEFAULT_LANDING_LEAD_ALERT_CHAT_IDS = ["223071474", "585011433"];

export function telegramAlertConfig(env: Record<string, string | undefined> = process.env): TelegramConfig {
  const token = (env.LANDING_LEAD_ALERT_BOT_TOKEN || env.TRAINER_BOT_TOKEN || "").trim();
  const chatIds = (env.LANDING_LEAD_ALERT_CHAT_IDS || DEFAULT_LANDING_LEAD_ALERT_CHAT_IDS.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return { token, chatIds };
}

/** Throws when nobody accepted the message. A partial miss is a warning, not a retry. */
export function deliveryWarning(delivered: number, errors: string[]): string | undefined {
  if (delivered <= 0) {
    throw new Error(errors.join("; ") || "Telegram не принял сообщение");
  }
  return errors.length ? `Часть чатов не получила сообщение. ${errors.join("; ")}` : undefined;
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

async function sendToChats(config: TelegramConfig, text: string): Promise<string | undefined> {
  const errors: string[] = [];
  let delivered = 0;
  for (const chatId of config.chatIds) {
    try {
      await sendTelegram(config.token, chatId, text);
      delivered += 1;
    } catch (error) {
      errors.push(`${chatId}: ${error instanceof Error ? error.message : "Telegram не принял сообщение"}`);
    }
  }
  return deliveryWarning(delivered, errors);
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
    repeat,
    bitrixUrl: bitrixLeadUrl(asString(lead.ID), process.env.BITRIX_WEBHOOK_URL || "")
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
    : {
        bootstrapped: true,
        helloSent: false,
        notifiedIds: rememberIds(state.notifiedIds, matchedIds),
        instagramBootstrapped: state.instagramBootstrapped,
        instagramChecks: state.instagramChecks
      };

  const telegramReady = Boolean(config.token && config.chatIds.length);
  const warning = telegramReady
    ? undefined
    : "Не задан токен бота или чат Telegram. Новые лиды подождут и уйдут, когда чат появится.";

  if (!state.bootstrapped) {
    let helloWarning: string | undefined;
    if (telegramReady) {
      helloWarning = await sendToChats(config, helloMessage(landings.map((landing) => landing.label)));
      next = { ...next, helloSent: true };
    }
    await saveAlertState(next);
    return {
      ok: telegramReady && !helloWarning,
      bootstrapped: true,
      helloSent: next.helloSent,
      checked: leads.length,
      matched: matched.length,
      sent: [],
      pending: [],
      warning: telegramReady
        ? helloWarning
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

  const sent: Array<{ id: string; landing: string }> = [];
  const pending: string[] = [];
  let sendError = "";

  if (!state.helloSent) {
    const helloWarning = await sendToChats(config, helloMessage(landings.map((landing) => landing.label)));
    next = { ...state, helloSent: true };
    await saveAlertState(next);
    if (helloWarning) sendError = helloWarning;
  }

  const statuses = fresh.length ? await statusNames() : new Map<string, string>();
  const users = fresh.length
    ? await loadUserNames(fresh.map((item) => asString(item.lead.ASSIGNED_BY_ID)))
    : new Map<string, string>();
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
      const partial = await sendToChats(config, formatLandingLeadAlert(alert));
      sent.push({ id, landing: item.landing.id });
      delivered.push(id);
      await saveAlertState({ ...next, notifiedIds: rememberIds([], delivered) });
      if (partial) sendError = partial;
    } catch (error) {
      pending.push(id);
      sendError = error instanceof Error ? error.message : "Не удалось отправить сообщение";
    }
  }

  next = { ...next, notifiedIds: rememberIds([], delivered) };

  const instagram = await scanInstagramIntents({
    now,
    leads,
    state: next,
    send: (text) => sendToChats(config, text)
  });

  return {
    ok: pending.length === 0 && instagram.pending.length === 0,
    bootstrapped: true,
    helloSent: next.helloSent,
    checked: leads.length,
    matched: matched.length + instagram.matched,
    sent: [...sent, ...instagram.sent],
    pending: [...pending, ...instagram.pending],
    warning: sendError || instagram.warning
  };
}

type OpenLineActivity = {
  OWNER_ID?: string;
  ASSOCIATED_ENTITY_ID?: string;
  LAST_UPDATED?: string;
  CREATED?: string;
};

type SessionHistory = {
  message?: Record<string, { date?: string; senderid?: string; text?: string; textlegacy?: string }>;
  users?: Record<string, { extranet?: boolean | string }>;
};

function parseBitrixDate(raw: string): number {
  const time = Date.parse(raw);
  return Number.isNaN(time) ? 0 : time;
}

function clientLines(history: SessionHistory): ClientLine[] {
  const users = history.users || {};
  return Object.values(history.message || {})
    .filter((message) => {
      const user = users[String(message.senderid || "")];
      return user?.extranet === true || user?.extranet === "Y" || user?.extranet === "1";
    })
    .map((message) => ({
      text: plainChatText(String(message.text || message.textlegacy || "")),
      at: parseBitrixDate(String(message.date || ""))
    }))
    .filter((line) => line.text);
}

async function scanInstagramIntents(input: {
  now: Date;
  leads: RawLead[];
  state: AlertState;
  send: (text: string) => Promise<string | undefined>;
}): Promise<{
  matched: number;
  sent: Array<{ id: string; landing: string }>;
  pending: string[];
  warning?: string;
}> {
  const igLeads = input.leads.filter((lead) =>
    isInstagramDmLead(asString(lead.SOURCE_ID), asString(lead.TITLE))
  );
  const empty = { matched: 0, sent: [], pending: [] as string[] };
  if (!igLeads.length && input.state.instagramBootstrapped) return empty;

  let activities: OpenLineActivity[] = [];
  try {
    activities = await bitrixListAll<OpenLineActivity>("crm.activity.list", {
      filter: {
        ">=CREATED": rigaStamp(new Date(input.now.getTime() - LOOKBACK_MS)),
        OWNER_TYPE_ID: 1,
        PROVIDER_ID: "IMOPENLINES_SESSION"
      },
      select: ["ID", "OWNER_ID", "ASSOCIATED_ENTITY_ID", "LAST_UPDATED", "CREATED"]
    });
  } catch (error) {
    return {
      ...empty,
      warning: error instanceof Error ? error.message : "Не удалось прочитать переписки Instagram"
    };
  }

  const byLead = new Map<string, { stamp: string; sessions: string[] }>();
  for (const activity of activities) {
    const leadId = asString(activity.OWNER_ID);
    const sessionId = asString(activity.ASSOCIATED_ENTITY_ID);
    if (!leadId || !sessionId) continue;
    const stamp = asString(activity.LAST_UPDATED) || asString(activity.CREATED);
    const current = byLead.get(leadId) || { stamp: "", sessions: [] };
    if (!current.sessions.includes(sessionId)) current.sessions.push(sessionId);
    if (stamp > current.stamp) current.stamp = stamp;
    byLead.set(leadId, current);
  }

  const checks: Record<string, InstagramCheck> = {};
  if (!input.state.instagramBootstrapped) {
    for (const lead of igLeads) {
      const id = asString(lead.ID);
      if (!id) continue;
      checks[id] = {
        stamp: byLead.get(id)?.stamp || "",
        alerted: false,
        checkedAt: input.now.toISOString()
      };
    }
    await saveAlertState({ ...input.state, instagramBootstrapped: true, instagramChecks: checks });
    return empty;
  }

  const sent: Array<{ id: string; landing: string }> = [];
  const pending: string[] = [];
  let warning: string | undefined;
  let matched = 0;

  for (const lead of igLeads) {
    const id = asString(lead.ID);
    if (!id) continue;
    const prev = input.state.instagramChecks[id];
    const activity = byLead.get(id);
    const stamp = activity?.stamp || "";
    if (prev?.alerted) {
      checks[id] = prev;
      continue;
    }
    if (prev && prev.stamp === stamp) {
      checks[id] = prev;
      continue;
    }
    if (!activity?.sessions.length) {
      checks[id] = prev || { stamp, alerted: false, checkedAt: input.now.toISOString() };
      continue;
    }

    try {
      const lines: ClientLine[] = [];
      for (const sessionId of activity.sessions) {
        const history = await bitrixResult<SessionHistory>("imopenlines.session.history.get", {
          SESSION_ID: Number(sessionId)
        });
        lines.push(...clientLines(history));
      }
      const since = prev?.checkedAt ? Date.parse(prev.checkedAt) : 0;
      const intent = intentLines(lines, Number.isNaN(since) ? 0 : since);
      if (!intent.tags.length) {
        checks[id] = { stamp, alerted: false, checkedAt: input.now.toISOString() };
        continue;
      }
      matched += 1;
      const name = [asString(lead.NAME), asString(lead.LAST_NAME)].filter(Boolean).join(" ")
        || asString(lead.TITLE).replace(/\s*-\s*Instagram\s*$/i, "");
      const partial = await input.send(
        formatInstagramIntentAlert({
          name,
          leadId: id,
          createdAtLabel: formatRigaDateTime(asString(lead.DATE_CREATE)),
          bitrixUrl: bitrixLeadUrl(id, process.env.BITRIX_WEBHOOK_URL || ""),
          tags: intent.tags,
          quotes: intent.quotes
        })
      );
      if (partial) warning = partial;
      checks[id] = { stamp, alerted: true, checkedAt: input.now.toISOString() };
      sent.push({ id, landing: intent.tags.map((tag) => tag.id).join("+") });
      await saveAlertState({ ...input.state, instagramBootstrapped: true, instagramChecks: { ...input.state.instagramChecks, ...checks } });
    } catch (error) {
      pending.push(id);
      warning = error instanceof Error ? error.message : "Не удалось отправить сообщение Instagram";
      if (prev) checks[id] = prev;
    }
  }

  await saveAlertState({
    ...input.state,
    instagramBootstrapped: true,
    instagramChecks: { ...input.state.instagramChecks, ...checks }
  });

  return { matched, sent, pending, warning };
}

