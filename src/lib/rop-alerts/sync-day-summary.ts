/**
 * ROP alerts workbook — «Сводка дня» + detail tabs.
 * https://docs.google.com/spreadsheets/d/1_bVqzLXOrIsV9A3UaD7UnRFPYp74FT4kXfw370Cx820
 *
 * CRM cohorts from Bitrix REST; dialog alerts from open IMOPENLINES sessions
 * (last non-system message from manager, age > 24h).
 */

import { EXCLUDED_LEAD_STATUS_IDS } from "@/lib/bitrix/metric-definitions";
import {
  arrayResult,
  bitrixBatch,
  bitrixList,
  bitrixListAll,
  bitrixResult,
  chunkIds,
  requireBitrixWebhook
} from "@/lib/bitrix/rest-client";
import { loadUserNames } from "@/lib/bitrix/sales-foundation/customer-key";
import { writeSheetTab } from "@/lib/google/sheets-client";
import { PREDICTIVE_SPREADSHEET_ID_DEFAULT } from "@/lib/sales-os/predictive-model";

export const ROP_ALERTS_SPREADSHEET_ID_DEFAULT = PREDICTIVE_SPREADSHEET_ID_DEFAULT;

export const ROP_ALERTS_TABS = {
  summary: "Сводка дня",
  unprocessedLeads: "Необработанные лиды",
  unpaidInvoices: "Счета без оплаты",
  leadInWork: "Лид в работе висит сутки",
  dialogNoReply: "В диалоге без ответа сутки",
  lostDialogs: "Потерянные диалоги",
  thinking: "Я подумаю (номера телефонов)",
  clientNoReply: "Клиент не ответил"
} as const;

const DEAL_STAGE_DIALOG = "UC_8ZC4BD";
const DEAL_STAGE_THINKING = "PREPARATION";
const INVOICE_STAGE_SENT = "DT31_2:S";
const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;
const THINKING_CLOSE_DAYS = 15;

type PhoneField = { VALUE?: string } | string | null | undefined;

type BitrixLead = {
  ID?: string;
  TITLE?: string;
  SOURCE_ID?: string;
  STATUS_ID?: string;
  DATE_CREATE?: string;
  DATE_MODIFY?: string;
  ASSIGNED_BY_ID?: string;
  ADDRESS_COUNTRY?: string;
  PHONE?: PhoneField[] | PhoneField;
};

type BitrixDeal = {
  ID?: string;
  TITLE?: string;
  STAGE_ID?: string;
  OPPORTUNITY?: string | number;
  CURRENCY_ID?: string;
  DATE_CREATE?: string;
  DATE_MODIFY?: string;
  CLOSEDATE?: string;
  ASSIGNED_BY_ID?: string;
  PHONE?: PhoneField[] | PhoneField;
  CONTACT_ID?: string;
};

type BitrixInvoice = {
  id?: number | string;
  title?: string;
  opportunity?: number | string;
  currencyId?: string;
  assignedById?: number | string;
  begindate?: string;
  movedTime?: string;
  createdTime?: string;
  parentId2?: number | string;
  contactId?: number | string;
};

type OpenLineActivity = {
  ID?: string;
  CREATED?: string;
  OWNER_ID?: string;
  OWNER_TYPE_ID?: string;
  ASSOCIATED_ENTITY_ID?: string;
  SUBJECT?: string;
  RESPONSIBLE_ID?: string;
  START_TIME?: string;
};

type SessionHistory = {
  users?: Record<string, { name?: string; extranet?: boolean | string }>;
  message?: Record<
    string,
    { id?: string; senderid?: string | number; date?: string; text?: string; textlegacy?: string }
  >;
};

export type RopAlertsSyncOptions = {
  spreadsheetId?: string;
  dryRun?: boolean;
  includeDialogs?: boolean;
  dialogHistoryLimit?: number;
};

export type RopAlertsSyncResult = {
  ok: true;
  spreadsheetId: string;
  syncedAt: string;
  timezone: "Europe/Riga";
  yesterday: string;
  dryRun: boolean;
  summary: Record<string, string | number>;
  tabs: Record<string, number>;
  warnings: string[];
};

function portalBaseUrl() {
  const webhook = requireBitrixWebhook();
  return webhook.match(/^https?:\/\/[^/]+/)?.[0] || "https://bb-wood.bitrix24.eu";
}

function leadUrl(id: string) {
  return `${portalBaseUrl()}/crm/lead/details/${id}/`;
}

function dealUrl(id: string) {
  return `${portalBaseUrl()}/crm/deal/details/${id}/`;
}

function invoiceUrl(id: string) {
  return `${portalBaseUrl()}/crm/type/31/details/${id}/`;
}

function firstPhone(value: PhoneField[] | PhoneField): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const phone = firstPhone(item);
      if (phone) return phone;
    }
    return "";
  }
  if (value && typeof value === "object" && "VALUE" in value) return String(value.VALUE ?? "").trim();
  if (typeof value === "string") return value.trim();
  return "";
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function formatDateTime(iso: string | undefined, timeZone = "Europe/Riga") {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function formatDate(iso: string | undefined, timeZone = "Europe/Riga") {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function rigaTodayYesterday() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const today = fmt.format(new Date());
  const noon = new Date(`${today}T12:00:00+03:00`);
  noon.setUTCDate(noon.getUTCDate() - 1);
  const yesterday = fmt.format(noon);
  return { today, yesterday };
}

function hoursSince(iso: string | undefined, now = Date.now()) {
  if (!iso) return 0;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return 0;
  return Math.max(0, Math.floor((now - ts) / HOUR_MS));
}

function daysSince(iso: string | undefined, now = Date.now()) {
  if (!iso) return 0;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return 0;
  return Math.floor((now - ts) / DAY_MS);
}

function parseChannel(subject: string | undefined) {
  const match = (subject || "").match(/\(([^)]+)\)\s*$/);
  return match?.[1]?.trim() || "Open Line";
}

function parseClientName(subject: string | undefined) {
  const match = (subject || "").match(/Open Channel chat:\s*"([^"]+)"/i);
  return match?.[1]?.trim() || "";
}

function isSystemHistoryMessage(message: {
  senderid?: string | number;
  text?: string;
  textlegacy?: string;
}) {
  const senderId = String(message.senderid ?? "0");
  if (senderId === "0") return true;
  const text = String(message.text ?? message.textlegacy ?? "").trim();
  if (!text) return true;
  return (
    /^(Enquiry |A new lead was created|Диалог закреплен|Conversation )/i.test(text) ||
    /начал работу с диалогом|завершил работу с диалогом|transferred to/i.test(text)
  );
}

function lastHumanMessage(history: SessionHistory | null | undefined) {
  if (!history?.message) return null;
  const users = history.users ?? {};
  const rows = Object.values(history.message)
    .filter((message) => !isSystemHistoryMessage(message))
    .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
  const last = rows[rows.length - 1];
  if (!last) return null;
  const user = users[String(last.senderid ?? "")];
  const isClient = user?.extranet === true || user?.extranet === "Y";
  return {
    date: last.date ?? "",
    text: String(last.text ?? last.textlegacy ?? "")
      .replace(/\[USER=\d+ REPLACE\]([^\[]+)\[\/USER\]/gi, "$1")
      .replace(/\[b\]|\[\/b\]/gi, "")
      .trim(),
    role: (isClient ? "client" : "manager") as "client" | "manager"
  };
}

async function loadStatusMap(entityId: string) {
  const rows = await bitrixResult<Array<{ STATUS_ID?: string; NAME?: string }>>("crm.status.list", {
    filter: { ENTITY_ID: entityId }
  });
  const map = new Map<string, string>();
  for (const row of rows || []) {
    if (row.STATUS_ID) map.set(String(row.STATUS_ID), String(row.NAME || row.STATUS_ID));
  }
  return map;
}

async function countBitrix(method: string, body: Record<string, unknown>) {
  const page = await bitrixList(method, { ...body, select: ["ID"], start: -1 });
  const total = (page as { total?: number }).total;
  if (typeof total === "number") return total;
  return arrayResult(page.result).length;
}

async function fetchSessionHistories(sessionIds: string[]) {
  const map = new Map<string, SessionHistory | null>();
  for (const chunk of chunkIds(sessionIds, 40)) {
    const cmd: Record<string, string> = {};
    chunk.forEach((id, index) => {
      cmd[`h${index}`] = `imopenlines.session.history.get?SESSION_ID=${encodeURIComponent(id)}`;
    });
    const result = await bitrixBatch<SessionHistory>(cmd);
    chunk.forEach((id, index) => {
      map.set(id, result[`h${index}`] ?? null);
    });
  }
  return map;
}

async function loadContacts(ids: string[]) {
  const phones = new Map<string, string>();
  const names = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  for (const chunk of chunkIds(unique, 40)) {
    const cmd: Record<string, string> = {};
    chunk.forEach((id, index) => {
      cmd[`c${index}`] = `crm.contact.get?ID=${encodeURIComponent(id)}`;
    });
    const result = await bitrixBatch<{
      ID?: string;
      NAME?: string;
      LAST_NAME?: string;
      PHONE?: PhoneField[];
    }>(cmd);
    for (const value of Object.values(result)) {
      if (!value?.ID) continue;
      const id = String(value.ID);
      phones.set(id, firstPhone(value.PHONE));
      names.set(id, `${value.NAME || ""} ${value.LAST_NAME || ""}`.trim());
    }
  }
  return { phones, names };
}

async function loadEntitiesById<T extends { ID?: string }>(
  method: "crm.lead.list" | "crm.deal.list",
  ids: string[],
  select: string[]
) {
  const map = new Map<string, T>();
  for (const chunk of chunkIds([...new Set(ids.filter(Boolean))], 50)) {
    if (!chunk.length) continue;
    const rows = await bitrixListAll<T>(method, {
      filter: { ID: chunk },
      select
    });
    for (const row of rows) {
      if (row.ID) map.set(String(row.ID), row);
    }
  }
  return map;
}

async function collectDialogAlerts(input: {
  limit: number;
  now: number;
  userNames: Map<string, string>;
  dealStageNames: Map<string, string>;
  warnings: string[];
}) {
  const lostDialogRows: string[][] = [
    [
      "Сессия",
      "Канал",
      "Клиент",
      "Сделка",
      "Лид",
      "Телефон",
      "Менеджер",
      "Ждёт (ч)",
      "Дата в переписке",
      "Последнее сообщение",
      "Ссылка Bitrix"
    ]
  ];
  const dialogNoReplyRows: string[][] = [
    [
      "Сделка",
      "Название",
      "# Сумма",
      "Валюта",
      "Канал",
      "Клиент",
      "Часов без ответа",
      "Последнее сообщение",
      "Менеджер",
      "Телефон",
      "Ссылка Bitrix"
    ]
  ];
  const clientNoReplyRows: string[][] = [
    [
      "Тип",
      "ID",
      "Название",
      "Стадия",
      "Сумма",
      "Валюта",
      "Часов без ответа",
      "Сообщение менеджера",
      "Канал",
      "Клиент",
      "Менеджер",
      "Телефон"
    ]
  ];

  const openSessions = await bitrixListAll<OpenLineActivity>("crm.activity.list", {
    filter: { TYPE_ID: "6", PROVIDER_ID: "IMOPENLINES_SESSION", COMPLETED: "N" },
    select: [
      "ID",
      "CREATED",
      "OWNER_ID",
      "OWNER_TYPE_ID",
      "ASSOCIATED_ENTITY_ID",
      "SUBJECT",
      "RESPONSIBLE_ID",
      "START_TIME"
    ],
    order: { ID: "ASC" }
  });

  const older = openSessions.filter((row) => hoursSince(row.CREATED || row.START_TIME, input.now) >= 24);
  const candidates = older.slice(0, input.limit);
  if (older.length > input.limit) {
    input.warnings.push(`Dialog scan capped at ${input.limit} of ${older.length} open sessions older than 24h`);
  }

  const histories = await fetchSessionHistories(candidates.map((row) => String(row.ASSOCIATED_ENTITY_ID)));

  const dealMap = await loadEntitiesById<BitrixDeal>(
    "crm.deal.list",
    candidates.filter((row) => String(row.OWNER_TYPE_ID) === "2").map((row) => String(row.OWNER_ID || "")),
    ["ID", "TITLE", "STAGE_ID", "OPPORTUNITY", "CURRENCY_ID", "ASSIGNED_BY_ID", "PHONE", "CONTACT_ID"]
  );
  const leadMap = await loadEntitiesById<BitrixLead>(
    "crm.lead.list",
    candidates.filter((row) => String(row.OWNER_TYPE_ID) === "1").map((row) => String(row.OWNER_ID || "")),
    ["ID", "TITLE", "PHONE", "ASSIGNED_BY_ID"]
  );

  const moreNames = await loadUserNames([
    ...candidates.map((row) => String(row.RESPONSIBLE_ID || "")),
    ...[...dealMap.values()].map((d) => String(d.ASSIGNED_BY_ID || "")),
    ...[...leadMap.values()].map((l) => String(l.ASSIGNED_BY_ID || ""))
  ]);
  for (const [id, name] of moreNames) input.userNames.set(id, name);

  let clientNoReplySum = 0;

  for (const activity of candidates) {
    const sessionId = String(activity.ASSOCIATED_ENTITY_ID || "");
    const last = lastHumanMessage(histories.get(sessionId));
    if (!last || last.role !== "manager") continue;
    if (hoursSince(last.date, input.now) < 24) continue;

    const ownerType = String(activity.OWNER_TYPE_ID || "");
    const ownerId = String(activity.OWNER_ID || "");
    const channel = parseChannel(activity.SUBJECT);
    const clientFromSubject = parseClientName(activity.SUBJECT);
    const waitHours = hoursSince(last.date, input.now);

    if (ownerType === "1") {
      const lead = leadMap.get(ownerId);
      const managerId = String(lead?.ASSIGNED_BY_ID || activity.RESPONSIBLE_ID || "");
      lostDialogRows.push([
        sessionId,
        channel,
        clientFromSubject || lead?.TITLE || "",
        "—",
        ownerId,
        firstPhone(lead?.PHONE),
        input.userNames.get(managerId) || "",
        String(waitHours),
        "—",
        last.text.slice(0, 120),
        ownerId ? leadUrl(ownerId) : ""
      ]);
      continue;
    }

    if (ownerType !== "2") continue;
    const deal = dealMap.get(ownerId);
    const stageId = String(deal?.STAGE_ID || "");
    const amount = asNumber(deal?.OPPORTUNITY);
    const currency = deal?.CURRENCY_ID || "EUR";
    const phone = firstPhone(deal?.PHONE);
    const title = deal?.TITLE || "";
    const client = clientFromSubject || title;
    const managerId = String(deal?.ASSIGNED_BY_ID || activity.RESPONSIBLE_ID || "");
    const manager = input.userNames.get(managerId) || "";

    if (stageId === DEAL_STAGE_DIALOG) {
      dialogNoReplyRows.push([
        ownerId,
        title,
        String(amount),
        currency,
        channel,
        client,
        String(waitHours),
        last.text.slice(0, 120),
        manager,
        phone,
        dealUrl(ownerId)
      ]);
    } else {
      clientNoReplyRows.push([
        "Сделка",
        ownerId,
        title,
        input.dealStageNames.get(stageId) || stageId,
        formatMoney(amount),
        currency,
        String(waitHours),
        last.text.slice(0, 120),
        channel,
        client,
        manager,
        phone
      ]);
      clientNoReplySum += amount;
    }
  }

  return {
    lostDialogRows,
    dialogNoReplyRows,
    clientNoReplyRows,
    clientNoReplySum,
    lostDialogCount: lostDialogRows.length - 1,
    dialogNoReplyCount: dialogNoReplyRows.length - 1,
    clientNoReplyCount: clientNoReplyRows.length - 1
  };
}

export async function syncRopAlertsDaySummary(
  options: RopAlertsSyncOptions = {}
): Promise<RopAlertsSyncResult> {
  const spreadsheetId =
    options.spreadsheetId?.trim() ||
    process.env.ROP_ALERTS_SPREADSHEET_ID?.trim() ||
    ROP_ALERTS_SPREADSHEET_ID_DEFAULT;
  const dryRun = options.dryRun === true;
  const includeDialogs = options.includeDialogs !== false;
  const dialogHistoryLimit = Math.max(50, Math.min(900, options.dialogHistoryLimit ?? 800));
  const warnings: string[] = [];
  const now = Date.now();
  const { today, yesterday } = rigaTodayYesterday();
  const syncedAtLabel = formatDateTime(new Date().toISOString());

  const [
    sourceNames,
    leadStatusNames,
    dealStageNames,
    newLeads,
    inProcessLeads,
    thinkingDeals,
    sentInvoices,
    yesterdayLeadsCount,
    yesterdayWonCount,
    yesterdayOlCount
  ] = await Promise.all([
    loadStatusMap("SOURCE"),
    loadStatusMap("STATUS"),
    loadStatusMap("DEAL_STAGE"),
    bitrixListAll<BitrixLead>("crm.lead.list", {
      filter: { STATUS_ID: "NEW" },
      select: [
        "ID",
        "TITLE",
        "SOURCE_ID",
        "STATUS_ID",
        "DATE_CREATE",
        "ASSIGNED_BY_ID",
        "ADDRESS_COUNTRY",
        "PHONE"
      ],
      order: { ID: "ASC" }
    }),
    bitrixListAll<BitrixLead>("crm.lead.list", {
      filter: { STATUS_ID: "IN_PROCESS" },
      select: ["ID", "TITLE", "SOURCE_ID", "DATE_CREATE", "DATE_MODIFY", "ASSIGNED_BY_ID", "ADDRESS_COUNTRY", "PHONE"],
      order: { DATE_MODIFY: "ASC" }
    }),
    bitrixListAll<BitrixDeal>("crm.deal.list", {
      filter: { STAGE_ID: DEAL_STAGE_THINKING },
      select: [
        "ID",
        "TITLE",
        "OPPORTUNITY",
        "CURRENCY_ID",
        "CLOSEDATE",
        "DATE_MODIFY",
        "DATE_CREATE",
        "ASSIGNED_BY_ID",
        "PHONE",
        "CONTACT_ID"
      ],
      order: { CLOSEDATE: "ASC" }
    }),
    bitrixListAll<BitrixInvoice>("crm.item.list", {
      entityTypeId: 31,
      filter: { stageId: INVOICE_STAGE_SENT },
      select: [
        "id",
        "title",
        "opportunity",
        "currencyId",
        "assignedById",
        "begindate",
        "movedTime",
        "createdTime",
        "parentId2",
        "contactId"
      ],
      order: { id: "ASC" }
    }),
    countBitrix("crm.lead.list", {
      filter: {
        ">=DATE_CREATE": `${yesterday}T00:00:00`,
        "<DATE_CREATE": `${today}T00:00:00`
      }
    }),
    countBitrix("crm.deal.list", {
      filter: {
        STAGE_SEMANTIC_ID: "S",
        ">=CLOSEDATE": `${yesterday}T00:00:00`,
        "<CLOSEDATE": `${today}T00:00:00`
      }
    }),
    countBitrix("crm.activity.list", {
      filter: {
        TYPE_ID: "6",
        PROVIDER_ID: "IMOPENLINES_SESSION",
        ">=CREATED": `${yesterday}T00:00:00+03:00`,
        "<CREATED": `${today}T00:00:00+03:00`
      }
    })
  ]);

  const excluded = new Set<string>(EXCLUDED_LEAD_STATUS_IDS);
  const filteredNew = newLeads.filter((lead) => !excluded.has(String(lead.STATUS_ID || "")));
  const stuckLeads = inProcessLeads.filter(
    (lead) => hoursSince(lead.DATE_MODIFY || lead.DATE_CREATE, now) >= 24
  );

  const thinkingFresh: BitrixDeal[] = [];
  const thinkingStale: BitrixDeal[] = [];
  let thinkingSum = 0;
  for (const deal of thinkingDeals) {
    const base = deal.CLOSEDATE || deal.DATE_MODIFY || deal.DATE_CREATE;
    thinkingSum += asNumber(deal.OPPORTUNITY);
    if (daysSince(base, now) > THINKING_CLOSE_DAYS) thinkingStale.push(deal);
    else thinkingFresh.push(deal);
  }

  const unpaidSum = sentInvoices.reduce((sum, row) => sum + asNumber(row.opportunity), 0);

  const userNames = await loadUserNames([
    ...filteredNew.map((l) => String(l.ASSIGNED_BY_ID || "")),
    ...stuckLeads.map((l) => String(l.ASSIGNED_BY_ID || "")),
    ...thinkingDeals.map((d) => String(d.ASSIGNED_BY_ID || "")),
    ...sentInvoices.map((i) => String(i.assignedById || ""))
  ]);

  const { phones: contactPhones, names: contactNames } = await loadContacts([
    ...sentInvoices.map((row) => String(row.contactId || "")),
    ...thinkingDeals.map((row) => String(row.CONTACT_ID || ""))
  ]);

  const dialogs = includeDialogs
    ? await collectDialogAlerts({
        limit: dialogHistoryLimit,
        now,
        userNames,
        dealStageNames,
        warnings
      })
    : {
        lostDialogRows: [
          [
            "Сессия",
            "Канал",
            "Клиент",
            "Сделка",
            "Лид",
            "Телефон",
            "Менеджер",
            "Ждёт (ч)",
            "Дата в переписке",
            "Последнее сообщение",
            "Ссылка Bitrix"
          ]
        ],
        dialogNoReplyRows: [
          [
            "Сделка",
            "Название",
            "# Сумма",
            "Валюта",
            "Канал",
            "Клиент",
            "Часов без ответа",
            "Последнее сообщение",
            "Менеджер",
            "Телефон",
            "Ссылка Bitrix"
          ]
        ],
        clientNoReplyRows: [
          [
            "Тип",
            "ID",
            "Название",
            "Стадия",
            "Сумма",
            "Валюта",
            "Часов без ответа",
            "Сообщение менеджера",
            "Канал",
            "Клиент",
            "Менеджер",
            "Телефон"
          ]
        ],
        clientNoReplySum: 0,
        lostDialogCount: 0,
        dialogNoReplyCount: 0,
        clientNoReplyCount: 0
      };

  if (!includeDialogs) warnings.push("Dialog tabs skipped (includeDialogs=false)");

  const cr =
    yesterdayLeadsCount > 0 ? Math.round((yesterdayWonCount / yesterdayLeadsCount) * 1000) / 10 : 0;

  const summaryRows: string[][] = [
    ["Метрика", "Значение"],
    ["Обновлено", syncedAtLabel],
    ["Неоплаченных счетов", String(sentInvoices.length)],
    ["Сумма неоплаченных счетов", formatMoney(unpaidSum)],
    ["Клиент не ответил (>24ч)", String(dialogs.clientNoReplyCount)],
    ["Сумма (сделки без ответа)", formatMoney(dialogs.clientNoReplySum)],
    ["Потерянных диалогов", String(dialogs.lostDialogCount)],
    ["«Я подумаю» (до 15 дн)", String(thinkingFresh.length)],
    ["Сумма «Я подумаю»", formatMoney(thinkingSum)],
    ["«Я подумаю» закрыть (>15 дн)", String(thinkingStale.length)],
    ["Необработанных лидов", String(filteredNew.length)],
    ["Лид в работе >24ч", String(stuckLeads.length)],
    ["В диалоге без ответа >24ч", String(dialogs.dialogNoReplyCount)],
    ["--- Вчера ---"],
    ["Лидов вчера", String(yesterdayLeadsCount)],
    ["Сессий ОЛ вчера", String(yesterdayOlCount)],
    ["Сделок WON вчера", String(yesterdayWonCount)],
    ["Конверсия лид→сделка вчера, %", String(cr)],
    ["Валюта", "EUR"]
  ];

  const unprocessedRows: string[][] = [
    [
      "Лид",
      "Название",
      "Источник",
      "Страна",
      "Создан",
      "Этап воронки",
      "Часов без обработки",
      "Менеджер",
      "Телефон",
      "Ссылка Bitrix"
    ],
    ...filteredNew.map((lead) => {
      const id = String(lead.ID || "");
      return [
        id,
        lead.TITLE || "",
        sourceNames.get(String(lead.SOURCE_ID || "")) || String(lead.SOURCE_ID || ""),
        lead.ADDRESS_COUNTRY || "",
        formatDateTime(lead.DATE_CREATE),
        leadStatusNames.get("NEW") || "Новый лид",
        String(hoursSince(lead.DATE_CREATE, now)),
        userNames.get(String(lead.ASSIGNED_BY_ID || "")) || "",
        firstPhone(lead.PHONE),
        id ? leadUrl(id) : ""
      ];
    })
  ];

  const unpaidRows: string[][] = [
    [
      "Счёт",
      "Сделка",
      "Клиент",
      "Сумма",
      "Валюта",
      "Дата отправки",
      "Дней без ответа",
      "Менеджер",
      "Телефон",
      "Ссылка Bitrix"
    ],
    ...sentInvoices.map((invoice) => {
      const id = String(invoice.id || "");
      const contactId = String(invoice.contactId || "");
      const sentAt = invoice.movedTime || invoice.begindate || invoice.createdTime;
      return [
        id,
        String(invoice.parentId2 || ""),
        contactNames.get(contactId) || invoice.title || "",
        String(asNumber(invoice.opportunity)),
        invoice.currencyId || "EUR",
        formatDate(sentAt),
        String(Math.max(0, daysSince(sentAt, now))),
        userNames.get(String(invoice.assignedById || "")) || "",
        contactPhones.get(contactId) || "",
        id ? invoiceUrl(id) : ""
      ];
    })
  ];

  const leadInWorkRows: string[][] = [
    [
      "Лид",
      "Название",
      "Источник",
      "Страна",
      "В работе с",
      "Часов в работе",
      "Менеджер",
      "Телефон",
      "Ссылка Bitrix"
    ],
    ...stuckLeads.map((lead) => {
      const id = String(lead.ID || "");
      const since = lead.DATE_MODIFY || lead.DATE_CREATE;
      return [
        id,
        lead.TITLE || "",
        sourceNames.get(String(lead.SOURCE_ID || "")) || String(lead.SOURCE_ID || ""),
        lead.ADDRESS_COUNTRY || "",
        formatDateTime(since),
        String(hoursSince(since, now)),
        userNames.get(String(lead.ASSIGNED_BY_ID || "")) || "",
        firstPhone(lead.PHONE),
        id ? leadUrl(id) : ""
      ];
    })
  ];

  const thinkingRows: string[][] = [
    [
      "# Сделка",
      "Название",
      "# Сумма",
      "Валюта",
      "📅 Дата в сделке",
      "📅 Дело до",
      "# Просрочено (дн)",
      "Проблема",
      "👤 Менеджер",
      "Телефон",
      "Ссылка Bitrix"
    ],
    ...thinkingDeals.map((deal) => {
      const id = String(deal.ID || "");
      const close = deal.CLOSEDATE || "";
      return [
        id,
        deal.TITLE || "",
        String(asNumber(deal.OPPORTUNITY)),
        deal.CURRENCY_ID || "EUR",
        formatDate(close),
        "—",
        String(Math.max(0, daysSince(close, now))),
        "Нет дела (есть дата в CRM)",
        userNames.get(String(deal.ASSIGNED_BY_ID || "")) || "",
        firstPhone(deal.PHONE) || contactPhones.get(String(deal.CONTACT_ID || "")) || "",
        id ? dealUrl(id) : ""
      ];
    })
  ];

  const tabsWritten: Record<string, number> = {
    [ROP_ALERTS_TABS.summary]: summaryRows.length,
    [ROP_ALERTS_TABS.unprocessedLeads]: unprocessedRows.length - 1,
    [ROP_ALERTS_TABS.unpaidInvoices]: unpaidRows.length - 1,
    [ROP_ALERTS_TABS.leadInWork]: leadInWorkRows.length - 1,
    [ROP_ALERTS_TABS.thinking]: thinkingRows.length - 1,
    [ROP_ALERTS_TABS.lostDialogs]: dialogs.lostDialogCount,
    [ROP_ALERTS_TABS.dialogNoReply]: dialogs.dialogNoReplyCount,
    [ROP_ALERTS_TABS.clientNoReply]: dialogs.clientNoReplyCount
  };

  if (!dryRun) {
    await writeSheetTab({
      spreadsheetId,
      tabTitle: ROP_ALERTS_TABS.summary,
      rows: summaryRows,
      clearRange: `'${ROP_ALERTS_TABS.summary}'!A:B`
    });
    await writeSheetTab({ spreadsheetId, tabTitle: ROP_ALERTS_TABS.unprocessedLeads, rows: unprocessedRows });
    await writeSheetTab({ spreadsheetId, tabTitle: ROP_ALERTS_TABS.unpaidInvoices, rows: unpaidRows });
    await writeSheetTab({ spreadsheetId, tabTitle: ROP_ALERTS_TABS.leadInWork, rows: leadInWorkRows });
    await writeSheetTab({ spreadsheetId, tabTitle: ROP_ALERTS_TABS.thinking, rows: thinkingRows });
    await writeSheetTab({ spreadsheetId, tabTitle: ROP_ALERTS_TABS.lostDialogs, rows: dialogs.lostDialogRows });
    await writeSheetTab({
      spreadsheetId,
      tabTitle: ROP_ALERTS_TABS.dialogNoReply,
      rows: dialogs.dialogNoReplyRows
    });
    await writeSheetTab({
      spreadsheetId,
      tabTitle: ROP_ALERTS_TABS.clientNoReply,
      rows: dialogs.clientNoReplyRows
    });
  }

  return {
    ok: true,
    spreadsheetId,
    syncedAt: new Date().toISOString(),
    timezone: "Europe/Riga",
    yesterday,
    dryRun,
    summary: {
      updatedAt: syncedAtLabel,
      unpaidInvoices: sentInvoices.length,
      unpaidSum: formatMoney(unpaidSum),
      clientNoReply: dialogs.clientNoReplyCount,
      clientNoReplySum: formatMoney(dialogs.clientNoReplySum),
      lostDialogs: dialogs.lostDialogCount,
      thinkingFresh: thinkingFresh.length,
      thinkingStale: thinkingStale.length,
      thinkingSum: formatMoney(thinkingSum),
      unprocessedLeads: filteredNew.length,
      leadInWork: stuckLeads.length,
      dialogNoReply: dialogs.dialogNoReplyCount,
      leadsYesterday: yesterdayLeadsCount,
      olSessionsYesterday: yesterdayOlCount,
      wonYesterday: yesterdayWonCount,
      crYesterdayPct: cr
    },
    tabs: tabsWritten,
    warnings
  };
}
