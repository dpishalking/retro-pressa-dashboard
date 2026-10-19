/**
 * Sunday sample of manager dialogs for a manual QA checklist.
 * Sheet: https://docs.google.com/spreadsheets/d/1ORzOOjXRXqP3VoAkbLbzA3O8ltpNGMbEShaFyIFy1sk
 */

import { resolveOpenLineSpeaker } from "@/lib/bitrix/openline-waba";
import {
  BITRIX_SALES_CATEGORY_ID,
  BITRIX_SMART_INVOICE_ENTITY_TYPE_ID,
  BITRIX_SMART_INVOICE_PAID_STAGE_ID
} from "@/lib/bitrix/metric-definitions";
import { arrayResult, bitrixBatch, bitrixListAll, bitrixResult, chunkIds, requireBitrixWebhook } from "@/lib/bitrix/rest-client";
import { loadUserNames } from "@/lib/bitrix/sales-foundation/customer-key";
import { appendSheetRows, deleteSheetTabs, listSpreadsheetTabs, readSheetValues } from "@/lib/google/sheets-client";
import {
  QA_HISTORY_TAB,
  QA_LOG_TAB,
  QA_SETTINGS_TAB,
  buildManagerSheet,
  buildSummarySheet,
  defaultSettingsRows,
  formatQaSheets,
  historyHeader,
  historyRowsFromSheet,
  managerSheetTitle,
  parseSettings,
  recentEpisodeKeys,
  writeQaSheet
} from "@/lib/manager-qa-sample/sheet";
import {
  INVOICE_SENT_STAGE_ID,
  MIN_LIVE_MESSAGES,
  QA_CATEGORIES,
  QA_CATEGORY_LABEL,
  QA_SAMPLE_PER_CATEGORY,
  SILENCE_HOURS,
  SILENT_LOST_STAGE_IDS,
  SILENT_OPEN_STAGE_IDS,
  categoryForClosedDeal,
  endedWithGoodbye,
  isEligibleDialogue,
  isHardRefusalText,
  isSystemLine,
  liveMessages,
  pickQaSamples,
  qaSampleWeek,
  refusalFromStage,
  silenceQualifies,
  type DialogueLine,
  type QaCategory
} from "@/lib/manager-qa-sample/sample";

export const QA_SAMPLE_SPREADSHEET_ID = "1ORzOOjXRXqP3VoAkbLbzA3O8ltpNGMbEShaFyIFy1sk";
export const QA_SUMMARY_TAB = "Сводка";

const SKIP_USER_IDS = new Set(["0", "1", "8", "70"]);
const HISTORY_POOL = 15;
const HOUR_MS = 3_600_000;

type Invoice = {
  id?: string | number;
  title?: string;
  opportunity?: string | number;
  currencyId?: string;
  assignedById?: string | number;
  movedTime?: string;
  stageId?: string;
  parentId2?: string | number;
};

type Deal = {
  ID?: string;
  TITLE?: string;
  STAGE_ID?: string;
  LEAD_ID?: string | number;
  ASSIGNED_BY_ID?: string;
  OPPORTUNITY?: string | number;
  CURRENCY_ID?: string;
  CLOSEDATE?: string;
};

type Activity = {
  OWNER_ID?: string;
  OWNER_TYPE_ID?: string;
  ASSOCIATED_ENTITY_ID?: string;
  SUBJECT?: string;
  START_TIME?: string;
  CREATED?: string;
};

type HistoryMessage = { date?: string; senderid?: string | number; text?: string; textlegacy?: string; system?: string };
type History = {
  chatId?: number;
  message?: Record<string, HistoryMessage>;
  users?: Record<string, { name?: string; extranet?: boolean | string }>;
};

type SessionRef = { sessionId: string; at: string; subject: string };

type Candidate = {
  managerId: string;
  category: QaCategory;
  dealId: string;
  leadId: string;
  sessionId: string;
  stageId: string;
  stageName: string;
  subject: string;
  eventAt: string;
  invoiceLabel: string;
  basis: string;
  eligible: boolean;
  repeat: boolean;
  liveMessages: number;
  day: string;
  channel: string;
  key: string;
  episode: string;
  dialogUrl: string;
  crmUrl: string;
};

export type ManagerQaSampleResult = {
  ok: true;
  spreadsheetId: string;
  sheetUrl: string;
  weekLabel: string;
  startDay: string;
  endDay: string;
  dryRun: boolean;
  managers: number;
  dialogs: number;
  candidates: number;
  passed: number;
  byCategory: Record<QaCategory, number>;
  managersDetail: Array<{ id: string; name: string; counts: Record<QaCategory, number>; problem: string }>;
  skipped: { short: number; noHistory: number; needsReview: number };
  warnings: string[];
};

function portalBase() {
  const webhook = requireBitrixWebhook();
  return webhook.match(/^https?:\/\/[^/]+/)?.[0] || "https://bb-wood.bitrix24.eu";
}

function cleanText(value: string) {
  return value
    .replace(/\[USER=\d+ REPLACE\]([^\[]+)\[\/USER\]/gi, "$1")
    .replace(/\[b\]|\[\/b\]|\[i\]|\[\/i\]/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function channelOf(subject: string) {
  if (/whatsapp/i.test(subject)) return "WhatsApp";
  if (/telegram/i.test(subject)) return "Telegram";
  if (/instagram/i.test(subject)) return "Instagram";
  if (/\bvk\b|вконтакте/i.test(subject)) return "VK";
  return "";
}

function skipManager(id: string, name: string) {
  if (!id || SKIP_USER_IDS.has(id)) return true;
  return /техническ|tehnisk|администратор|^admin$|робот|bitrix/i.test(name);
}

function dealUrl(portal: string, id: string) {
  return id ? `${portal}/crm/deal/details/${id}/` : "";
}

function dialogUrl(portal: string, chatId: number | undefined, sessionId: string) {
  if (chatId) return `${portal}/online/?IM_DIALOG=chat${chatId}`;
  return sessionId ? `${portal}/online/?IM_HISTORY=imol|${sessionId}` : "";
}

async function listInvoices(stageId: string, startIso: string, endIso: string) {
  return bitrixListAll<Invoice>("crm.item.list", {
    entityTypeId: BITRIX_SMART_INVOICE_ENTITY_TYPE_ID,
    filter: {
      stageId,
      ">=movedTime": startIso,
      "<=movedTime": endIso
    },
    select: ["id", "title", "opportunity", "currencyId", "assignedById", "movedTime", "stageId", "parentId2"]
  });
}

async function listDeals(ids: string[]) {
  const unique = [...new Set(ids.filter((id) => id && id !== "0"))];
  const deals: Deal[] = [];
  for (const part of chunkIds(unique, 40)) {
    deals.push(
      ...(await bitrixListAll<Deal>("crm.deal.list", {
        filter: { "@ID": part },
        select: ["ID", "TITLE", "STAGE_ID", "LEAD_ID", "ASSIGNED_BY_ID", "OPPORTUNITY", "CURRENCY_ID", "CLOSEDATE"]
      }))
    );
  }
  return new Map(deals.map((deal) => [String(deal.ID), deal]));
}

async function latestSessions(ownerType: string, ownerIds: string[]) {
  const map = new Map<string, SessionRef>();
  const unique = [...new Set(ownerIds.filter((id) => id && id !== "0"))];
  for (const part of chunkIds(unique, 20)) {
    const cmd: Record<string, string> = {};
    part.forEach((id, index) => {
      const query = new URLSearchParams();
      query.set("filter[OWNER_TYPE_ID]", ownerType);
      query.set("filter[OWNER_ID]", id);
      query.set("filter[PROVIDER_ID]", "IMOPENLINES_SESSION");
      query.append("select[]", "ASSOCIATED_ENTITY_ID");
      query.append("select[]", "START_TIME");
      query.append("select[]", "CREATED");
      query.append("select[]", "SUBJECT");
      query.set("order[START_TIME]", "DESC");
      cmd[`a${index}`] = `crm.activity.list?${query.toString()}`;
    });
    const result = await bitrixBatch<Activity[] | { items?: Activity[] }>(cmd);
    part.forEach((id, index) => {
      const activity = arrayResult(result[`a${index}`])[0];
      const sessionId = String(activity?.ASSOCIATED_ENTITY_ID || "");
      if (!sessionId) return;
      map.set(id, {
        sessionId,
        at: String(activity?.START_TIME || activity?.CREATED || ""),
        subject: String(activity?.SUBJECT || "")
      });
    });
  }
  return map;
}

async function histories(sessionIds: string[]) {
  const map = new Map<string, History | null>();
  for (const part of chunkIds([...new Set(sessionIds.filter(Boolean))], 20)) {
    const cmd: Record<string, string> = {};
    part.forEach((id, index) => {
      cmd[`h${index}`] = `imopenlines.session.history.get?SESSION_ID=${encodeURIComponent(id)}`;
    });
    try {
      const result = await bitrixBatch<History>(cmd);
      part.forEach((id, index) => map.set(id, result[`h${index}`] ?? null));
    } catch {
      part.forEach((id) => map.set(id, null));
    }
  }
  return map;
}

function dialogueStats(history: History | null, cutoffMs: number, minimum: number) {
  const lines: DialogueLine[] = [];
  const dated: Array<DialogueLine & { date: string; senderId: string; extranet: boolean }> = [];
  for (const message of Object.values(history?.message || {})) {
    if (message.system === "Y") continue;
    const date = String(message.date || "");
    if (date && new Date(date).getTime() > cutoffMs) continue;
    const senderId = String(message.senderid || "");
    const user = history?.users?.[senderId];
    const extranet = user?.extranet === true || user?.extranet === "Y" || user?.extranet === "1";
    const speaker = resolveOpenLineSpeaker({
      extranet: user?.extranet,
      userName: user?.name,
      text: String(message.text || message.textlegacy || "")
    });
    const text = cleanText(speaker.text);
    if (!text) continue;
    const line = { role: speaker.role, text, system: isSystemLine(text) };
    lines.push(line);
    dated.push({ ...line, date, senderId, extranet });
  }
  dated.sort((left, right) => left.date.localeCompare(right.date));
  const episode = liveMessages(lines);
  const last = dated.filter((line) => !line.system).at(-1) || null;
  const silentHours = last?.date ? (cutoffMs - new Date(last.date).getTime()) / HOUR_MS : 0;
  const counts = new Map<string, number>();
  for (const line of dated) {
    if (line.role !== "manager" || line.system || line.extranet || !line.senderId || line.senderId === "0") continue;
    counts.set(line.senderId, (counts.get(line.senderId) || 0) + 1);
  }
  return {
    eligible: isEligibleDialogue(lines, minimum),
    liveMessages: episode.length,
    lastRole: last?.role || null,
    lastAt: last?.date || "",
    silentHours,
    goodbye: endedWithGoodbye(lines),
    clientText: episode.filter((line) => line.role === "client").map((line) => line.text).join("\n"),
    managerCounts: [...counts.entries()].map(([managerId, messages]) => ({ managerId, messages })),
    chatId: history?.chatId,
    historyMissing: history == null
  };
}

function rememberSession(map: Map<string, SessionRef>, key: string, next: SessionRef) {
  if (!key || !next.sessionId) return;
  const current = map.get(key);
  if (!current || next.at > current.at) map.set(key, next);
}

async function readOptional(spreadsheetId: string, title: string) {
  try {
    return await readSheetValues({
      spreadsheetId,
      range: `'${title.replace(/'/g, "''")}'!A:P`
    });
  } catch {
    return [] as string[][];
  }
}

function qaSpreadsheetId(explicit?: string) {
  return explicit?.trim() || process.env.REPORT_SPREADSHEET_ID?.trim() || QA_SAMPLE_SPREADSHEET_ID;
}

export async function syncManagerQaSample(options: {
  spreadsheetId?: string;
  weekOf?: string;
  dryRun?: boolean;
  now?: Date;
} = {}): Promise<ManagerQaSampleResult> {
  const spreadsheetId = qaSpreadsheetId(options.spreadsheetId);
  const dryRun = options.dryRun === true;
  const now = options.now ?? new Date();
  const week = qaSampleWeek(now, options.weekOf);
  const warnings: string[] = [];
  const portal = portalBase();

  const [paidInvoices, sentInvoices, lostDeals, weekActivities, stages, settingsRows, historySheet] = await Promise.all([
    listInvoices(BITRIX_SMART_INVOICE_PAID_STAGE_ID, week.startIso, week.endIso),
    bitrixListAll<Invoice>("crm.item.list", {
      entityTypeId: BITRIX_SMART_INVOICE_ENTITY_TYPE_ID,
      filter: { stageId: INVOICE_SENT_STAGE_ID },
      select: ["id", "title", "opportunity", "currencyId", "assignedById", "movedTime", "stageId", "parentId2"]
    }),
    bitrixListAll<Deal>("crm.deal.list", {
      filter: {
        CATEGORY_ID: BITRIX_SALES_CATEGORY_ID,
        STAGE_SEMANTIC_ID: "F",
        ">=CLOSEDATE": week.startDay,
        "<=CLOSEDATE": week.endDay
      },
      select: ["ID", "TITLE", "STAGE_ID", "LEAD_ID", "ASSIGNED_BY_ID", "OPPORTUNITY", "CURRENCY_ID", "CLOSEDATE"]
    }),
    bitrixListAll<Activity>("crm.activity.list", {
      filter: {
        PROVIDER_ID: "IMOPENLINES_SESSION",
        ">=START_TIME": week.startIso,
        "<=START_TIME": week.endIso
      },
      select: ["OWNER_ID", "OWNER_TYPE_ID", "ASSOCIATED_ENTITY_ID", "SUBJECT", "START_TIME", "CREATED"],
      order: { START_TIME: "DESC" }
    }),
    bitrixListAll<{ STATUS_ID?: string; NAME?: string }>("crm.status.list", { filter: { ENTITY_ID: "DEAL_STAGE" } }),
    readOptional(spreadsheetId, QA_SETTINGS_TAB),
    readOptional(spreadsheetId, QA_HISTORY_TAB)
  ]);
  const settings = parseSettings(settingsRows);
  const minMessages = settings.minMessages || MIN_LIVE_MESSAGES;
  const silenceHours = settings.silenceHours || SILENCE_HOURS;
  const recentEpisodes = recentEpisodeKeys(historySheet, week.label);

  const stageNames = new Map(stages.map((stage) => [String(stage.STATUS_ID || ""), String(stage.NAME || "")]));
  const sessionByDeal = new Map<string, SessionRef>();
  const sessionByLead = new Map<string, SessionRef>();
  for (const activity of weekActivities) {
    const session = {
      sessionId: String(activity.ASSOCIATED_ENTITY_ID || ""),
      at: String(activity.START_TIME || activity.CREATED || ""),
      subject: String(activity.SUBJECT || "")
    };
    const ownerId = String(activity.OWNER_ID || "");
    if (String(activity.OWNER_TYPE_ID) === "2") rememberSession(sessionByDeal, ownerId, session);
    if (String(activity.OWNER_TYPE_ID) === "1") rememberSession(sessionByLead, ownerId, session);
  }

  const paidDealIds = new Set(paidInvoices.map((invoice) => String(invoice.parentId2 || "")).filter((id) => id && id !== "0"));
  const sentDealIds = new Set(sentInvoices.map((invoice) => String(invoice.parentId2 || "")).filter((id) => id && id !== "0"));
  const dealIds = [
    ...paidDealIds,
    ...sentDealIds,
    ...lostDeals.map((deal) => String(deal.ID || "")),
    ...sessionByDeal.keys()
  ];
  const deals = await listDeals(dealIds);
  for (const deal of lostDeals) deals.set(String(deal.ID), deal);

  const invoiceByDeal = new Map<string, Invoice>();
  for (const invoice of [...paidInvoices, ...sentInvoices]) {
    const dealId = String(invoice.parentId2 || "");
    if (!dealId || dealId === "0") continue;
    const current = invoiceByDeal.get(dealId);
    const paid = String(invoice.stageId) === BITRIX_SMART_INVOICE_PAID_STAGE_ID;
    const currentPaid = current ? String(current.stageId) === BITRIX_SMART_INVOICE_PAID_STAGE_ID : false;
    if (!current || (paid && !currentPaid)) invoiceByDeal.set(dealId, invoice);
  }

  const classified = new Map<string, { category: QaCategory; eventAt: string }>();
  function consider(dealId: string, category: QaCategory, eventAt: string) {
    const current = classified.get(dealId);
    if (!current) {
      classified.set(dealId, { category, eventAt });
      return;
    }
    const rank = (value: QaCategory) => QA_CATEGORIES.indexOf(value);
    if (rank(category) < rank(current.category)) classified.set(dealId, { category, eventAt });
  }

  for (const dealId of paidDealIds) {
    const invoice = invoiceByDeal.get(dealId);
    consider(dealId, "paid", String(invoice?.movedTime || ""));
  }
  for (const deal of lostDeals) {
    const stageId = String(deal.STAGE_ID || "");
    if (stageId === "UC_IN8ZIK") {
      consider(String(deal.ID), "refusal", String(deal.CLOSEDATE || ""));
      continue;
    }
    const category = categoryForClosedDeal(stageId);
    if (category) consider(String(deal.ID), category, String(deal.CLOSEDATE || ""));
  }
  for (const invoice of sentInvoices) {
    const dealId = String(invoice.parentId2 || "");
    if (!dealId || dealId === "0" || paidDealIds.has(dealId)) continue;
    const movedAt = String(invoice.movedTime || "");
    const sentThisWeek = movedAt >= week.startIso && movedAt <= week.endIso;
    const leadId = String(deals.get(dealId)?.LEAD_ID || "");
    const talkedThisWeek = sessionByDeal.has(dealId) || Boolean(leadId && sessionByLead.has(leadId));
    if (!sentThisWeek && !talkedThisWeek) continue;
    const talkedAt = sessionByDeal.get(dealId)?.at || (leadId ? sessionByLead.get(leadId)?.at : "") || movedAt;
    consider(dealId, "invoice_unpaid", talkedThisWeek ? talkedAt : movedAt);
  }
  for (const [dealId, deal] of deals) {
    if (classified.has(dealId)) continue;
    if (!SILENT_OPEN_STAGE_IDS.has(String(deal.STAGE_ID || ""))) continue;
    if (!sessionByDeal.has(dealId)) continue;
    consider(dealId, "client_silent", sessionByDeal.get(dealId)?.at || "");
  }

  const missingSessionDeals: string[] = [];
  const missingSessionLeads: string[] = [];
  for (const dealId of classified.keys()) {
    const deal = deals.get(dealId);
    const leadId = String(deal?.LEAD_ID || "");
    if (!sessionByDeal.has(dealId) && !(leadId && sessionByLead.has(leadId))) {
      missingSessionDeals.push(dealId);
      if (leadId && leadId !== "0") missingSessionLeads.push(leadId);
    }
  }
  const [extraDealSessions, extraLeadSessions] = await Promise.all([
    latestSessions("2", missingSessionDeals),
    latestSessions("1", missingSessionLeads)
  ]);
  for (const [id, session] of extraDealSessions) rememberSession(sessionByDeal, id, session);
  for (const [id, session] of extraLeadSessions) rememberSession(sessionByLead, id, session);

  const managerIds = [...classified.keys()].map((dealId) => String(deals.get(dealId)?.ASSIGNED_BY_ID || invoiceByDeal.get(dealId)?.assignedById || ""));
  const userNames = await loadUserNames(managerIds);

  const pooled: Candidate[] = [];
  const perManager = new Map<string, number>();
  const ordered = [...classified.entries()].sort((left, right) => right[1].eventAt.localeCompare(left[1].eventAt));
  for (const [dealId, outcome] of ordered) {
    const deal = deals.get(dealId);
    const invoice = invoiceByDeal.get(dealId);
    const managerId = String(deal?.ASSIGNED_BY_ID || invoice?.assignedById || "");
    const managerName = userNames.get(managerId) || "";
    if (skipManager(managerId, managerName)) continue;
    if (/^тест\b/i.test(String(deal?.TITLE || ""))) continue;
    const bucket = `${managerId}|${outcome.category}`;
    const taken = perManager.get(bucket) || 0;
    if (taken >= HISTORY_POOL) continue;
    perManager.set(bucket, taken + 1);
    const leadId = String(deal?.LEAD_ID || "");
    const session = sessionByDeal.get(dealId) || (leadId ? sessionByLead.get(leadId) : undefined);
    const stageId = String(deal?.STAGE_ID || "");
    const invoiceId = invoice?.id ? String(invoice.id) : "";
    pooled.push({
      managerId,
      category: outcome.category,
      dealId,
      leadId,
      sessionId: session?.sessionId || "",
      stageId,
      stageName: stageNames.get(stageId) || stageId,
      subject: session?.subject || "",
      eventAt: outcome.eventAt,
      invoiceLabel: invoiceId
        ? `Счёт ${invoiceId}, ${outcome.category === "paid" ? "оплачен" : "отправлен, не оплачен"}`
        : "",
      basis: outcome.category === "paid"
        ? "оплачено"
        : outcome.category === "refusal"
          ? `отказ: ${stageNames.get(stageId) || stageId}`
          : outcome.category === "invoice_unpaid"
            ? "выставлен счёт"
            : `нет ответа ${SILENCE_HOURS} ч`,
      eligible: false,
      repeat: false,
      liveMessages: 0,
      day: "",
      channel: channelOf(session?.subject || ""),
      key: "",
      episode: "",
      dialogUrl: "",
      crmUrl: ""
    });
  }

  const probeId = paidInvoices.find((invoice) => invoice.id)?.id;
  if (probeId) {
    try {
      const payments = await bitrixResult<unknown[] | { items?: unknown[] }>("crm.item.payment.list", {
        entityTypeId: BITRIX_SMART_INVOICE_ENTITY_TYPE_ID,
        entityId: probeId
      });
      const items = Array.isArray(payments) ? payments : payments.items || [];
      if (!items.length) {
        warnings.push("crm.item.payment.list пустой: оплата подтверждается стадией счёта DT31_2:P, не стадией сделки WON.");
      }
    } catch {
      warnings.push("crm.item.payment.list недоступен: оплата подтверждается стадией счёта DT31_2:P.");
    }
  }

  const history = await histories(pooled.map((row) => row.sessionId));
  const withSession = pooled.filter((row) => row.sessionId);
  const missingHistory = withSession.filter((row) => history.get(row.sessionId) == null);
  if (withSession.length > 0 && missingHistory.length === withSession.length) {
    throw new Error("Bitrix не вернул историю сообщений. Отчёт не записан, чтобы не получилась ложная пустая выборка.");
  }

  const cutoffMs = new Date(week.endIso).getTime();
  const weekStartMs = new Date(week.startIso).getTime();
  const speakerIds: string[] = [];
  const statsBySession = new Map<string, ReturnType<typeof dialogueStats>>();
  for (const row of pooled) {
    if (!row.sessionId || statsBySession.has(row.sessionId)) continue;
    const stats = dialogueStats(history.get(row.sessionId) || null, cutoffMs, minMessages);
    statsBySession.set(row.sessionId, stats);
    speakerIds.push(...stats.managerCounts.map((item) => item.managerId));
  }
  const speakerNames = await loadUserNames(speakerIds);
  for (const [id, name] of speakerNames) userNames.set(id, name);

  const skipped = { short: 0, noHistory: 0, needsReview: 0 };
  const ready: Candidate[] = [];
  const seenDeals = new Set<string>();
  for (const row of pooled) {
    if (seenDeals.has(row.dealId)) continue;
    if (!row.sessionId || history.get(row.sessionId) == null) {
      skipped.noHistory += 1;
      continue;
    }
    const stats = statsBySession.get(row.sessionId) || dialogueStats(null, cutoffMs, minMessages);
    if (!stats.eligible) {
      skipped.short += 1;
      continue;
    }
    if (row.category === "refusal") {
      const verdict = refusalFromStage(row.stageId, stats.clientText);
      if (verdict !== "refusal") {
        if (verdict === "needs_review") skipped.needsReview += 1;
        continue;
      }
    } else if (row.category !== "paid" && isHardRefusalText(stats.clientText)) {
      skipped.needsReview += 1;
      continue;
    }
    if (row.category === "client_silent") {
      const closed = SILENT_LOST_STAGE_IDS.has(row.stageId);
      const quiet = silenceQualifies({
        lastRole: stats.lastRole,
        hours: stats.silentHours,
        goodbye: stats.goodbye,
        threshold: silenceHours
      });
      const thresholdAt = stats.lastAt ? new Date(stats.lastAt).getTime() + silenceHours * HOUR_MS : 0;
      const silenceInWeek = thresholdAt >= weekStartMs && thresholdAt <= cutoffMs;
      if (stats.goodbye || stats.lastRole !== "manager") {
        if (closed) skipped.needsReview += 1;
        continue;
      }
      if (!closed && (!quiet || !silenceInWeek)) continue;
    }
    const managerId = speakingManager(stats.managerCounts, row.managerId, userNames);
    if (!managerId || skipManager(managerId, userNames.get(managerId) || "")) continue;
    if (settings.enabled.size > 0 && settings.enabled.get(managerId) === false) continue;
    seenDeals.add(row.dealId);
    const episode = `${managerId}|${row.dealId}|${row.sessionId}`;
    ready.push({
      ...row,
      managerId,
      eligible: true,
      repeat: recentEpisodes.has(episode),
      liveMessages: stats.liveMessages,
      day: (stats.lastAt || row.eventAt).slice(0, 10),
      channel: row.channel || channelOf(row.subject),
      episode,
      key: [week.label, managerId, "deal", row.dealId, row.sessionId].join("|"),
      dialogUrl: dialogUrl(portal, stats.chatId, row.sessionId),
      crmUrl: dealUrl(portal, row.dealId),
      basis: row.category === "client_silent" ? `нет ответа ${silenceHours} ч` : row.basis
    });
  }

  const picked = pickQaSamples(ready, QA_SAMPLE_PER_CATEGORY, week.label);
  const byCategory = Object.fromEntries(QA_CATEGORIES.map((category) => [category, 0])) as Record<QaCategory, number>;
  for (const row of picked) byCategory[row.category] += 1;
  if (skipped.noHistory) warnings.push(`Нет истории сообщений: ${skipped.noHistory}. Эти диалоги не включены.`);
  if (!picked.length) warnings.push("За неделю не нашлось содержательных диалогов для выборки.");

  const syncedAt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now).replace(",", "");
  const period = `${week.startDay} 00:00 — ${week.endDay} 20:00 МСК`;

  const countsByManager = new Map<string, Record<QaCategory, number>>();
  const scopeIds = new Set<string>();
  for (const row of pooled) {
    if (skipManager(row.managerId, userNames.get(row.managerId) || "")) continue;
    if (settings.enabled.size > 0 && settings.enabled.get(row.managerId) === false) continue;
    scopeIds.add(row.managerId);
  }
  for (const row of ready) scopeIds.add(row.managerId);
  for (const id of scopeIds) {
    countsByManager.set(id, { paid: 0, refusal: 0, invoice_unpaid: 0, client_silent: 0 });
  }
  for (const row of picked) {
    const counts = countsByManager.get(row.managerId) || { paid: 0, refusal: 0, invoice_unpaid: 0, client_silent: 0 };
    counts[row.category] += 1;
    countsByManager.set(row.managerId, counts);
  }
  const managersDetail = [...countsByManager.entries()]
    .map(([id, counts]) => ({
      id,
      name: userNames.get(id) || settings.names.get(id) || id,
      counts,
      problem: QA_CATEGORIES
        .filter((category) => counts[category] < QA_SAMPLE_PER_CATEGORY)
        .map((category) => `${QA_CATEGORY_LABEL[category].slice(0, 1)} ${counts[category]}/${QA_SAMPLE_PER_CATEGORY}`)
        .join(", ")
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "ru"));

  if (!dryRun) {
    const tabsBefore = await listSpreadsheetTabs(spreadsheetId);
    const manualByManager = new Map<string, Map<string, { checked: string; score: string; comment: string; checkedAt: string }>>();
    const archiveRows: string[][] = [];
    const carriedManual: string[][] = [];
    for (const tab of tabsBefore) {
      if (!tab.title.startsWith("M_")) continue;
      const sheetRows = await readOptional(spreadsheetId, tab.title);
      const parsed = historyRowsFromSheet(sheetRows, week.label);
      const managerId = String(sheetRows.find((line) => line[0] === "Менеджер" && line[2] === "ID")?.[3] || tab.title.split("_")[1] || "");
      if (managerId && parsed.checks.size) manualByManager.set(managerId, parsed.checks);
      archiveRows.push(...parsed.previous);
      carriedManual.push(...parsed.current.filter((line) => [line[5], line[6], line[7], line[8]].some(Boolean)));
    }
    const pickedKeys = new Set(picked.map((row) => row.key));
    archiveRows.push(...carriedManual.filter((line) => !pickedKeys.has(String(line[10] || ""))));

    const writtenTitles: string[] = [];
    for (const manager of managersDetail) {
      const rows = picked.filter((row) => row.managerId === manager.id);
      if (!rows.length) continue;
      const title = managerSheetTitle(manager.id, manager.name);
      writtenTitles.push(title);
      await writeQaSheet({
        spreadsheetId,
        tabTitle: title,
        columns: "P",
        rows: buildManagerSheet({
          managerName: manager.name,
          managerId: manager.id,
          weekLabel: week.label,
          period,
          syncedAt,
          rows: rows.map((row) => ({
            managerId: row.managerId,
            category: row.category,
            dealId: row.dealId,
            sessionId: row.sessionId,
            channel: row.channel,
            eventAt: row.eventAt,
            liveMessages: row.liveMessages,
            invoiceLabel: row.invoiceLabel,
            basis: row.basis,
            crmUrl: row.crmUrl,
            dialogUrl: row.dialogUrl,
            key: row.key,
            repeat: row.repeat
          })),
          manual: manualByManager.get(manager.id) || new Map()
        })
      });
    }
    await formatQaSheets(spreadsheetId, writtenTitles, 5);

    const tabsAfter = await listSpreadsheetTabs(spreadsheetId);
    const gidByTitle = new Map(tabsAfter.map((tab) => [tab.title, tab.sheetId]));
    await writeQaSheet({
      spreadsheetId,
      tabTitle: QA_SUMMARY_TAB,
      columns: "L",
      rows: buildSummarySheet({
        weekLabel: week.label,
        period,
        syncedAt,
        managers: managersDetail.map((manager) => {
          const title = managerSheetTitle(manager.id, manager.name);
          const manual = manualByManager.get(manager.id);
          const managerRows = picked.filter((row) => row.managerId === manager.id);
          const checked = managerRows.filter((row) => /^да$/i.test(manual?.get(row.key)?.checked || "")).length;
          return {
            id: manager.id,
            name: manager.name,
            counts: manager.counts,
            checked,
            sheetTitle: title,
            gid: gidByTitle.get(title) ?? null,
            spreadsheetId,
            problem: manager.problem
          };
        })
      })
    });

    const knownHistory = new Set(
      historySheet
        .filter((line) => line.includes("key") || line.length > 10)
        .map((line) => String(line[10] || line.at(-1) || ""))
        .filter((key) => key.includes("|"))
    );
    const freshArchive = archiveRows.filter((line) => !knownHistory.has(String(line[10] || "")));
    if (!historySheet.length) {
      await writeQaSheet({
        spreadsheetId,
        tabTitle: QA_HISTORY_TAB,
        columns: "K",
        rows: [historyHeader(), ...freshArchive]
      });
    } else if (freshArchive.length) {
      await appendSheetRows({ spreadsheetId, tabTitle: QA_HISTORY_TAB, rows: freshArchive });
    }

    if (!settingsRows.length) {
      await writeQaSheet({
        spreadsheetId,
        tabTitle: QA_SETTINGS_TAB,
        columns: "C",
        rows: defaultSettingsRows(managersDetail.map((manager) => ({ id: manager.id, name: manager.name })))
      });
    } else {
      const known = new Set(settings.enabled.keys());
      const additions = managersDetail
        .filter((manager) => !known.has(manager.id))
        .map((manager) => [manager.id, manager.name, "Да"]);
      if (additions.length) await appendSheetRows({ spreadsheetId, tabTitle: QA_SETTINGS_TAB, rows: additions });
    }

    const journalRow = [[
      syncedAt,
      week.label,
      warnings.length ? "записано с замечаниями" : "записано",
      String(classified.size),
      String(ready.length),
      String(picked.length),
      String(skipped.short),
      String(skipped.noHistory),
      String(skipped.needsReview),
      warnings.join(" | ")
    ]];
    const journalHeader = [[
      "Время",
      "Неделя",
      "Статус",
      "Кандидаты CRM",
      "Прошли фильтр",
      "Выбрано",
      "Короткие",
      "Нет истории",
      "На проверку",
      "Замечания"
    ]];
    if (!((await readOptional(spreadsheetId, QA_LOG_TAB))[0] || []).includes("Время")) {
      await writeQaSheet({ spreadsheetId, tabTitle: QA_LOG_TAB, columns: "J", rows: [...journalHeader, ...journalRow] });
    } else {
      await appendSheetRows({ spreadsheetId, tabTitle: QA_LOG_TAB, rows: journalRow });
    }

    const leftover = (await listSpreadsheetTabs(spreadsheetId)).some((tab) => tab.title === "Выборка");
    if (leftover) await deleteSheetTabs(spreadsheetId, ["Выборка"]);
  }

  return {
    ok: true,
    spreadsheetId,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    weekLabel: week.label,
    startDay: week.startDay,
    endDay: week.endDay,
    dryRun,
    managers: managersDetail.length,
    dialogs: picked.length,
    candidates: classified.size,
    passed: ready.length,
    byCategory,
    managersDetail,
    skipped,
    warnings
  };
}

function speakingManager(
  counts: Array<{ managerId: string; messages: number }>,
  assigneeId: string,
  names: Map<string, string>
) {
  const ranked = counts
    .filter((row) => row.messages > 0 && !skipManager(row.managerId, names.get(row.managerId) || ""))
    .sort((left, right) => right.messages - left.messages || left.managerId.localeCompare(right.managerId));
  if (ranked[0]) return ranked[0].managerId;
  if (!skipManager(assigneeId, names.get(assigneeId) || "")) return assigneeId;
  return "";
}
