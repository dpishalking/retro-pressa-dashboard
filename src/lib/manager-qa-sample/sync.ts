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
import { arrayResult, bitrixBatch, bitrixListAll, chunkIds, requireBitrixWebhook } from "@/lib/bitrix/rest-client";
import { loadUserNames } from "@/lib/bitrix/sales-foundation/customer-key";
import { listSpreadsheetTabs, readSheetValues, renameSheetTab, writeSheetTab } from "@/lib/google/sheets-client";
import {
  QA_CATEGORIES,
  QA_CATEGORY_LABEL,
  QA_SAMPLE_PER_CATEGORY,
  SILENT_OPEN_STAGE_IDS,
  categoryForClosedDeal,
  indexRopNotes,
  pickQaSamples,
  qaSampleWeek,
  type QaCategory
} from "@/lib/manager-qa-sample/sample";

export const QA_SAMPLE_SPREADSHEET_ID = "1ORzOOjXRXqP3VoAkbLbzA3O8ltpNGMbEShaFyIFy1sk";
export const QA_SAMPLE_TAB = "Выборка";
export const QA_SUMMARY_TAB = "Сводка";

const INVOICE_SENT_STAGE_ID = "DT31_2:S";
const SKIP_USER_IDS = new Set(["0", "1", "8", "70"]);
const HISTORY_POOL = 8;
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
  client: string;
  amount: string;
  currency: string;
  stageName: string;
  subject: string;
  eventAt: string;
  richness: number;
  lastAt: string;
  lastLine: string;
  reviewable: boolean;
  dialogUrl: string;
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
  byCategory: Record<QaCategory, number>;
  warnings: string[];
};

function portalBase() {
  const webhook = requireBitrixWebhook();
  return webhook.match(/^https?:\/\/[^/]+/)?.[0] || "https://bb-wood.bitrix24.eu";
}

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value: unknown) {
  const number = asNumber(value);
  if (!number) return "";
  return number.toFixed(2).replace(".", ",");
}

function cleanText(value: string) {
  return value
    .replace(/\[USER=\d+ REPLACE\]([^\[]+)\[\/USER\]/gi, "$1")
    .replace(/\[b\]|\[\/b\]|\[i\]|\[\/i\]/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function isSystemText(text: string) {
  return /^(Enquiry |A new lead was created|Диалог закреплен|Conversation |Contact information saved|Data received:)/i.test(text)
    || /начал работу с диалогом|завершил работу с диалогом|transferred to|session closed automatically|обращение перенаправлено|диалог заверш/i.test(text);
}

function clientFromSubject(subject: string) {
  const match = subject.match(/Open Channel chat:\s*"([^"]+)"/i) || subject.match(/Open Channel chat:\s*(.+)$/i);
  return match?.[1]?.replace(/\s*\([^)]*\)\s*$/, "").trim() || "";
}

function clientName(deal: Deal | undefined, subject: string) {
  const fromChat = clientFromSubject(subject);
  if (fromChat) return fromChat;
  const title = String(deal?.TITLE || "").replace(/^\d+\s*[—-]\s*/, "").trim();
  return title || "Без имени";
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

function dialogueStats(history: History | null, now: number) {
  const lines: Array<{ role: "client" | "manager"; text: string; date: string }> = [];
  for (const message of Object.values(history?.message || {})) {
    if (message.system === "Y") continue;
    const user = history?.users?.[String(message.senderid || "")];
    const speaker = resolveOpenLineSpeaker({
      extranet: user?.extranet,
      userName: user?.name,
      text: String(message.text || message.textlegacy || "")
    });
    const text = cleanText(speaker.text);
    if (!text || text.length < 2 || isSystemText(text)) continue;
    lines.push({ role: speaker.role, text, date: String(message.date || "") });
  }
  lines.sort((left, right) => left.date.localeCompare(right.date));
  const managerLines = lines.filter((line) => line.role === "manager").length;
  const clientLines = lines.filter((line) => line.role === "client").length;
  const last = lines.at(-1) || null;
  const silentHours = last ? (now - new Date(last.date).getTime()) / HOUR_MS : 0;
  return {
    richness: managerLines + clientLines,
    reviewable: managerLines >= 2 && clientLines >= 1,
    lastAt: last?.date || "",
    lastLine: last ? `${last.role === "manager" ? "Менеджер" : "Клиент"}: ${last.text.slice(0, 140)}` : "",
    clientSilent: Boolean(last && last.role === "manager" && silentHours >= 24),
    chatId: history?.chatId
  };
}

function rememberSession(map: Map<string, SessionRef>, key: string, next: SessionRef) {
  if (!key || !next.sessionId) return;
  const current = map.get(key);
  if (!current || next.at > current.at) map.set(key, next);
}

async function ensureSampleTab(spreadsheetId: string) {
  const tabs = await listSpreadsheetTabs(spreadsheetId);
  const first = tabs.find((tab) => tab.sheetId === 0) || tabs[0];
  if (first && /^(лист\s*1|sheet1)$/i.test(first.title)) {
    await renameSheetTab(spreadsheetId, first.sheetId, QA_SAMPLE_TAB);
  }
}

export async function syncManagerQaSample(options: {
  spreadsheetId?: string;
  weekOf?: string;
  dryRun?: boolean;
  now?: Date;
} = {}): Promise<ManagerQaSampleResult> {
  const spreadsheetId = options.spreadsheetId?.trim() || QA_SAMPLE_SPREADSHEET_ID;
  const dryRun = options.dryRun === true;
  const now = options.now ?? new Date();
  const week = qaSampleWeek(now, options.weekOf);
  const warnings: string[] = [];
  const portal = portalBase();

  const [paidInvoices, sentInvoices, lostDeals, weekActivities, stages] = await Promise.all([
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
    bitrixListAll<{ STATUS_ID?: string; NAME?: string }>("crm.status.list", { filter: { ENTITY_ID: "DEAL_STAGE" } })
  ]);

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
    const category = categoryForClosedDeal(String(deal.STAGE_ID || ""));
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
    const moneySource = outcome.category === "paid" || outcome.category === "invoice_unpaid" ? invoice?.opportunity : deal?.OPPORTUNITY;
    const currency = outcome.category === "paid" || outcome.category === "invoice_unpaid"
      ? invoice?.currencyId || deal?.CURRENCY_ID || "EUR"
      : deal?.CURRENCY_ID || "EUR";
    pooled.push({
      managerId,
      category: outcome.category,
      dealId,
      leadId,
      sessionId: session?.sessionId || "",
      client: clientName(deal, session?.subject || ""),
      amount: money(moneySource),
      currency: String(currency || "EUR"),
      stageName: stageNames.get(String(deal?.STAGE_ID || "")) || String(deal?.STAGE_ID || ""),
      subject: session?.subject || "",
      eventAt: outcome.eventAt,
      richness: 0,
      lastAt: outcome.eventAt,
      lastLine: "",
      reviewable: false,
      dialogUrl: ""
    });
  }

  const history = await histories(pooled.map((row) => row.sessionId));
  const nowMs = now.getTime();
  const ready: Candidate[] = [];
  for (const row of pooled) {
    const stats = dialogueStats(row.sessionId ? history.get(row.sessionId) || null : null, nowMs);
    const openSilence = row.category === "client_silent" && SILENT_OPEN_STAGE_IDS.has(
      String(deals.get(row.dealId)?.STAGE_ID || "")
    );
    if (openSilence && !stats.clientSilent) continue;
    ready.push({
      ...row,
      richness: stats.richness,
      lastAt: stats.lastAt || row.lastAt,
      lastLine: stats.lastLine,
      reviewable: stats.reviewable,
      dialogUrl: dialogUrl(portal, stats.chatId, row.sessionId)
    });
  }

  const picked = pickQaSamples(ready);
  picked.sort((left, right) => {
    const manager = (userNames.get(left.managerId) || "").localeCompare(userNames.get(right.managerId) || "", "ru");
    if (manager) return manager;
    const category = QA_CATEGORIES.indexOf(left.category) - QA_CATEGORIES.indexOf(right.category);
    return category || right.lastAt.localeCompare(left.lastAt);
  });

  const byCategory = Object.fromEntries(QA_CATEGORIES.map((category) => [category, 0])) as Record<QaCategory, number>;
  for (const row of picked) byCategory[row.category] += 1;

  const quote = (title: string) => `'${title.replace(/'/g, "''")}'`;
  let notes = new Map<string, { score: string; note: string }>();
  if (!dryRun) {
    try {
      const existing = await readSheetValues({
        spreadsheetId,
        range: `${quote(QA_SAMPLE_TAB)}!A1:M`
      });
      notes = indexRopNotes(existing, week.label);
    } catch {
      notes = new Map();
    }
  }

  const syncedAt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now).replace(",", "");

  const header = [
    "Неделя",
    "Категория",
    "Менеджер",
    "Клиент",
    "Сумма",
    "Валюта",
    "Стадия сделки",
    "Сообщений",
    "Последняя реплика",
    "Диалог",
    "Сделка",
    "Оценка",
    "Комментарий"
  ];
  const dataRows = picked.map((row) => {
    const dealLink = dealUrl(portal, row.dealId);
    const kept = notes.get(row.dialogUrl) || notes.get(dealLink);
    return [
      week.label,
      QA_CATEGORY_LABEL[row.category],
      userNames.get(row.managerId) || row.managerId,
      row.client,
      row.amount,
      row.currency,
      row.stageName,
      row.richness ? String(row.richness) : "",
      row.lastLine,
      row.dialogUrl,
      dealLink,
      kept?.score || "",
      kept?.note || ""
    ];
  });
  const sampleRows = [
    ["Еженедельная выборка диалогов для контроля качества"],
    [
      "Период",
      week.label,
      "Сформировано",
      `${syncedAt} МСК`,
      "По 3 диалога в каждой категории. Если меньше — за неделю больше не нашлось. Оценку по чек-листу ставит руководитель."
    ],
    [],
    header,
    ...dataRows
  ];

  const summaryHeader = ["Менеджер", ...QA_CATEGORIES.map((category) => QA_CATEGORY_LABEL[category]), "Всего"];
  const byManager = new Map<string, Record<QaCategory, number>>();
  for (const row of picked) {
    const name = userNames.get(row.managerId) || row.managerId;
    const counts = byManager.get(name) || { paid: 0, refusal: 0, invoice_unpaid: 0, client_silent: 0 };
    counts[row.category] += 1;
    byManager.set(name, counts);
  }
  const summaryRows = [
    ["Сводка выборки", week.label],
    ["Норма", `${QA_SAMPLE_PER_CATEGORY} диалога в категории`],
    [],
    summaryHeader,
    ...[...byManager.entries()]
      .sort((left, right) => left[0].localeCompare(right[0], "ru"))
      .map(([name, counts]) => [
        name,
        ...QA_CATEGORIES.map((category) => String(counts[category])),
        String(QA_CATEGORIES.reduce((sum, category) => sum + counts[category], 0))
      ])
  ];

  if (!dryRun) {
    await ensureSampleTab(spreadsheetId);
    await writeSheetTab({
      spreadsheetId,
      tabTitle: QA_SAMPLE_TAB,
      rows: sampleRows,
      clearRange: `${quote(QA_SAMPLE_TAB)}!A:M`
    });
    await writeSheetTab({
      spreadsheetId,
      tabTitle: QA_SUMMARY_TAB,
      rows: summaryRows,
      clearRange: `${quote(QA_SUMMARY_TAB)}!A:F`
    });
  }

  const managers = new Set(picked.map((row) => row.managerId));
  if (!picked.length) warnings.push("За неделю не нашлось диалогов для выборки");

  return {
    ok: true,
    spreadsheetId,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    weekLabel: week.label,
    startDay: week.startDay,
    endDay: week.endDay,
    dryRun,
    managers: managers.size,
    dialogs: picked.length,
    byCategory,
    warnings
  };
}
