/**
 * Weekly ROP report from live Bitrix.
 * Tab «РОП · неделя» — current week snapshot; «РОП · недели» — append history row.
 */

import {
  getRopWeeklySpreadsheetId,
  ROP_WEEKLY_HISTORY_TAB,
  ROP_WEEKLY_TAB,
  ropWeeklySpreadsheetUrl
} from "@/config/rop-weekly";
import {
  BITRIX_QUALIFIED_LEAD_STATUS_ID,
  BITRIX_SALES_CATEGORY_ID,
  EXCLUDED_LEAD_STATUS_IDS,
  PAID_LEAD_SOURCE_IDS
} from "@/lib/bitrix/metric-definitions";
import { bitrixList, bitrixListAll, arrayResult } from "@/lib/bitrix/rest-client";
import { loadUserNames } from "@/lib/bitrix/sales-foundation/customer-key";
import { listPaidSmartInvoicesForPeriod, loadBitrixCurrencyRatesToBase, toBaseCurrencyAmount } from "@/lib/bitrix/smart-invoices";
import {
  ensureSheetTab,
  getGoogleAccessToken,
  getSheetIdByTitle,
  readSheetValues,
  writeSheetTab,
  writeSheetValues
} from "@/lib/google/sheets-client";
import { rigaTodayIso } from "@/lib/sales/manager-schedule";

const SKIP_MANAGER = /tehniskais|техническ|frigat|robot|бот|\badmin\b|админ/i;
const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;
const DEAL_STAGE_DIALOG = "UC_8ZC4BD";
const DEAL_STAGE_THINKING = "PREPARATION";
const INVOICE_STAGE_SENT = "DT31_2:S";
const SERVICE_PHONE_TAILS = ["28373939"];
const PAID_SOURCE_SET = new Set(PAID_LEAD_SOURCE_IDS);
const EXCLUDED_LEADS = new Set<string>(EXCLUDED_LEAD_STATUS_IDS);

type SheetCell = string | number | boolean | null;
type SheetRow = SheetCell[];

type BitrixLead = {
  ID?: string;
  STATUS_ID?: string;
  SOURCE_ID?: string;
  DATE_CREATE?: string;
  DATE_MODIFY?: string;
  ASSIGNED_BY_ID?: string;
  PHONE?: Array<{ VALUE?: string }> | { VALUE?: string };
  EMAIL?: Array<{ VALUE?: string }> | { VALUE?: string };
};

type BitrixDeal = {
  ID?: string;
  STAGE_ID?: string;
  STAGE_SEMANTIC_ID?: string;
  OPPORTUNITY?: string | number;
  DATE_CREATE?: string;
  DATE_MODIFY?: string;
  CLOSEDATE?: string;
  ASSIGNED_BY_ID?: string;
};

type BitrixInvoice = {
  id?: string | number;
  opportunity?: string | number;
  currencyId?: string;
  assignedById?: string | number;
  createdTime?: string;
  movedTime?: string;
  stageId?: string;
};

export type RopWeeklySyncOptions = {
  spreadsheetId?: string;
  /** Any day inside the target week (YYYY-MM-DD, Europe/Riga). Default: today. */
  weekOf?: string;
  dryRun?: boolean;
};

export type RopWeeklySyncResult = {
  ok: true;
  spreadsheetId: string;
  spreadsheetUrl: string;
  weekStart: string;
  weekEnd: string;
  syncedAt: string;
  dryRun: boolean;
  summary: Record<string, number | string>;
  managers: number;
};

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function ratioPct(num: number, den: number) {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

function formatSyncedAt() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(new Date())
    .replace(",", "");
}

function rigaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    iso: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday") // Mon, Tue, ...
  };
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6
};

/** Monday–Sunday week containing `day` (YYYY-MM-DD) in Europe/Riga. */
export function rigaWeekRange(day: string): { weekStart: string; weekEnd: string } {
  const noon = new Date(`${day}T12:00:00+03:00`);
  const { weekday } = rigaParts(noon);
  const offset = WEEKDAY_INDEX[weekday] ?? 0;
  const monday = new Date(noon);
  monday.setUTCDate(monday.getUTCDate() - offset);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return {
    weekStart: rigaParts(monday).iso,
    weekEnd: rigaParts(sunday).iso
  };
}

function dayRange(fromDay: string, toDay: string) {
  return {
    from: `${fromDay}T00:00:00+03:00`,
    to: `${toDay}T23:59:59+03:00`
  };
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

function normalizePhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (SERVICE_PHONE_TAILS.some((tail) => digits === tail || digits.endsWith(tail))) return "";
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function phonesOf(lead: BitrixLead) {
  const raw = lead.PHONE;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return [...new Set(list.map((item) => normalizePhone(item?.VALUE)).filter(Boolean))];
}

function emailsOf(lead: BitrixLead) {
  const raw = lead.EMAIL;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return [
    ...new Set(
      list
        .map((item) => String(item?.VALUE || "").trim().toLowerCase())
        .filter(Boolean)
    )
  ];
}

function countBitrix(method: string, body: Record<string, unknown>) {
  return bitrixList(method, { ...body, select: ["ID"], start: -1 }).then((page) => {
    const total = (page as { total?: number }).total;
    if (typeof total === "number") return total;
    return arrayResult(page.result).length;
  });
}

async function loadHistoryKeys(beforeDay: string) {
  const historyFrom = (() => {
    const d = new Date(`${beforeDay}T12:00:00+03:00`);
    d.setUTCDate(d.getUTCDate() - 120);
    return rigaParts(d).iso;
  })();
  const history = await bitrixListAll<BitrixLead>("crm.lead.list", {
    filter: {
      ">=DATE_CREATE": `${historyFrom}T00:00:00+03:00`,
      "<DATE_CREATE": `${beforeDay}T00:00:00+03:00`
    },
    select: ["ID", "STATUS_ID", "PHONE", "EMAIL", "DATE_CREATE"],
    order: { ID: "ASC" }
  });
  const phones = new Set<string>();
  const emails = new Set<string>();
  for (const lead of history) {
    if (EXCLUDED_LEADS.has(String(lead.STATUS_ID || ""))) continue;
    for (const phone of phonesOf(lead)) phones.add(phone);
    for (const email of emailsOf(lead)) emails.add(email);
  }
  return { phones, emails };
}

function countDuplicates(leads: BitrixLead[], history: { phones: Set<string>; emails: Set<string> }) {
  let duplicates = 0;
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  for (const lead of leads) {
    const phones = phonesOf(lead);
    const emails = emailsOf(lead);
    const isDup =
      phones.some((p) => history.phones.has(p) || seenPhones.has(p)) ||
      emails.some((e) => history.emails.has(e) || seenEmails.has(e));
    if (isDup) duplicates += 1;
    for (const p of phones) seenPhones.add(p);
    for (const e of emails) seenEmails.add(e);
  }
  return duplicates;
}

async function formatWeeklyTab(input: {
  spreadsheetId: string;
  sheetId: number;
  managerCount: number;
}) {
  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  const intFormat = { type: "NUMBER", pattern: "0" };
  const moneyFormat = { type: "NUMBER", pattern: "0.00" };
  const headerRow = 16;
  const firstDataRow = 17;
  const lastDataRow = headerRow + Math.max(1, input.managerCount);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: input.sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 10
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, fontSize: 16, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  backgroundColor: { red: 0.12, green: 0.23, blue: 0.37 }
                }
              },
              fields: "userEnteredFormat(textFormat,backgroundColor)"
            }
          },
          {
            repeatCell: {
              range: {
                sheetId: input.sheetId,
                startRowIndex: headerRow,
                endRowIndex: headerRow + 1,
                startColumnIndex: 0,
                endColumnIndex: 10
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, fontSize: 9, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  backgroundColor: { red: 0.2, green: 0.45, blue: 0.72 },
                  horizontalAlignment: "CENTER"
                }
              },
              fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)"
            }
          },
          {
            repeatCell: {
              range: {
                sheetId: input.sheetId,
                startRowIndex: firstDataRow,
                endRowIndex: lastDataRow + 1,
                startColumnIndex: 1,
                endColumnIndex: 10
              },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: "CENTER",
                  numberFormat: intFormat
                }
              },
              fields: "userEnteredFormat(horizontalAlignment,numberFormat)"
            }
          },
          ...[3, 5, 6].map((columnIndex) => ({
            repeatCell: {
              range: {
                sheetId: input.sheetId,
                startRowIndex: firstDataRow,
                endRowIndex: lastDataRow + 1,
                startColumnIndex: columnIndex,
                endColumnIndex: columnIndex + 1
              },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: "CENTER",
                  numberFormat: moneyFormat
                }
              },
              fields: "userEnteredFormat(horizontalAlignment,numberFormat)"
            }
          })),
          {
            updateSheetProperties: {
              properties: {
                sheetId: input.sheetId,
                gridProperties: { frozenRowCount: headerRow + 1 }
              },
              fields: "gridProperties.frozenRowCount"
            }
          }
        ]
      })
    }
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ROP weekly format failed: ${response.status} ${body.slice(0, 240)}`);
  }
}

async function upsertWeeklyHistoryRow(input: {
  spreadsheetId: string;
  weekStart: string;
  weekEnd: string;
  syncedAt: string;
  leads: number;
  uniqueLeads: number;
  duplicates: number;
  qlLeads: number;
  deals: number;
  invoices: number;
  invoiceSum: number;
  payments: number;
  revenue: number;
  avgCheck: number;
  crLeadPay: number;
  stockNew: number;
  stockInProcessOld: number;
  thinkingStale: number;
  unpaidCount: number;
  unpaidSum: number;
}) {
  const header: SheetRow = [
    "Неделя с",
    "Неделя по",
    "Обновлено",
    "Лиды",
    "Уникальные",
    "Дубли",
    "QL",
    "Сделки",
    "Счета",
    "Σ счетов",
    "Оплаты",
    "Выручка",
    "Ср.чек",
    "Лид→оплата %",
    "NEW",
    "В работе >24ч",
    "Подумаю >15д",
    "Неоплач. счета",
    "Σ неоплач."
  ];
  const dataRow: SheetRow = [
    input.weekStart,
    input.weekEnd,
    input.syncedAt,
    input.leads,
    input.uniqueLeads,
    input.duplicates,
    input.qlLeads,
    input.deals,
    input.invoices,
    input.invoiceSum,
    input.payments,
    input.revenue,
    input.avgCheck,
    input.crLeadPay,
    input.stockNew,
    input.stockInProcessOld,
    input.thinkingStale,
    input.unpaidCount,
    input.unpaidSum
  ];

  await ensureSheetTab(input.spreadsheetId, ROP_WEEKLY_HISTORY_TAB);
  const tab = `'${ROP_WEEKLY_HISTORY_TAB.replace(/'/g, "''")}'`;
  const existing = await readSheetValues({
    spreadsheetId: input.spreadsheetId,
    range: `${tab}!A:A`
  });

  if (!existing.length) {
    await writeSheetValues({
      spreadsheetId: input.spreadsheetId,
      range: `${tab}!A1`,
      rows: [header, dataRow],
      valueInputOption: "USER_ENTERED"
    });
    return;
  }

  const weekRowIndex = existing.findIndex((row, index) => index > 0 && String(row[0] || "") === input.weekStart);
  if (weekRowIndex >= 0) {
    await writeSheetValues({
      spreadsheetId: input.spreadsheetId,
      range: `${tab}!A${weekRowIndex + 1}`,
      rows: [dataRow],
      valueInputOption: "USER_ENTERED"
    });
    return;
  }

  await writeSheetValues({
    spreadsheetId: input.spreadsheetId,
    range: `${tab}!A${existing.length + 1}`,
    rows: [dataRow],
    valueInputOption: "USER_ENTERED"
  });
}

export async function syncRopWeeklyReport(
  options: RopWeeklySyncOptions = {}
): Promise<RopWeeklySyncResult> {
  const spreadsheetId = options.spreadsheetId?.trim() || getRopWeeklySpreadsheetId();
  const dryRun = options.dryRun === true;
  const weekOf = options.weekOf?.trim() || rigaTodayIso();
  const { weekStart, weekEnd } = rigaWeekRange(weekOf);
  const syncedAt = formatSyncedAt();
  const now = Date.now();
  const { from, to } = dayRange(weekStart, weekEnd);

  const [leadsRaw, dealsCreated, invoicesCreated, invoicesMoved, payments, historyKeys, fx] =
    await Promise.all([
      bitrixListAll<BitrixLead>("crm.lead.list", {
        filter: { ">=DATE_CREATE": from, "<=DATE_CREATE": to },
        select: ["ID", "STATUS_ID", "SOURCE_ID", "DATE_CREATE", "ASSIGNED_BY_ID", "PHONE", "EMAIL"],
        order: { ID: "ASC" }
      }),
      bitrixListAll<BitrixDeal>("crm.deal.list", {
        filter: {
          CATEGORY_ID: BITRIX_SALES_CATEGORY_ID,
          ">=DATE_CREATE": from,
          "<=DATE_CREATE": to
        },
        select: ["ID", "ASSIGNED_BY_ID", "DATE_CREATE", "OPPORTUNITY"],
        order: { ID: "ASC" }
      }),
      bitrixListAll<BitrixInvoice>("crm.item.list", {
        entityTypeId: 31,
        filter: { ">=createdTime": from, "<=createdTime": to },
        select: ["id", "opportunity", "currencyId", "assignedById", "createdTime", "movedTime", "stageId"],
        order: { id: "ASC" }
      }).catch(() => [] as BitrixInvoice[]),
      bitrixListAll<BitrixInvoice>("crm.item.list", {
        entityTypeId: 31,
        filter: { ">=movedTime": from, "<=movedTime": to },
        select: ["id", "opportunity", "currencyId", "assignedById", "createdTime", "movedTime", "stageId"],
        order: { id: "ASC" }
      }).catch(() => [] as BitrixInvoice[]),
      listPaidSmartInvoicesForPeriod(weekStart, weekEnd),
      loadHistoryKeys(weekStart),
      loadBitrixCurrencyRatesToBase()
    ]);

  const toEur = (amount: unknown, currencyId?: string | null) =>
    money(toBaseCurrencyAmount(asNumber(amount), currencyId, fx.rates, fx.baseCurrency));

  const leads = leadsRaw.filter((lead) => !EXCLUDED_LEADS.has(String(lead.STATUS_ID || "")));
  const duplicates = countDuplicates(leads, historyKeys);
  const uniqueLeads = Math.max(0, leads.length - duplicates);
  const paidLeads = leads.filter((lead) => PAID_SOURCE_SET.has(String(lead.SOURCE_ID || ""))).length;
  const organicLeads = leads.length - paidLeads;
  const qlLeads = leads.filter(
    (lead) => String(lead.STATUS_ID || "") === BITRIX_QUALIFIED_LEAD_STATUS_ID
  ).length;

  const invoicesById = new Map<string, BitrixInvoice>();
  for (const row of [...invoicesCreated, ...invoicesMoved]) {
    if (row.id == null) continue;
    invoicesById.set(String(row.id), row);
  }
  const invoices = [...invoicesById.values()];
  const invoiceSum = invoices.reduce((sum, row) => sum + toEur(row.opportunity, row.currencyId), 0);
  const paymentSum = payments.reduce((sum, row) => sum + asNumber(row.opportunity), 0);
  const avgCheck = payments.length ? money(paymentSum / payments.length) : 0;

  const [
    stockNew,
    stockInProcess,
    stockDialog,
    stockThinking,
    stockUnpaid,
    stockPipelineCount
  ] = await Promise.all([
    countBitrix("crm.lead.list", { filter: { STATUS_ID: "NEW" } }),
    bitrixListAll<BitrixLead>("crm.lead.list", {
      filter: { STATUS_ID: "IN_PROCESS" },
      select: ["ID", "DATE_MODIFY", "DATE_CREATE"]
    }),
    countBitrix("crm.deal.list", {
      filter: { CATEGORY_ID: BITRIX_SALES_CATEGORY_ID, STAGE_ID: DEAL_STAGE_DIALOG }
    }),
    bitrixListAll<BitrixDeal>("crm.deal.list", {
      filter: { CATEGORY_ID: BITRIX_SALES_CATEGORY_ID, STAGE_ID: DEAL_STAGE_THINKING },
      select: ["ID", "CLOSEDATE", "DATE_MODIFY", "DATE_CREATE", "OPPORTUNITY"]
    }),
    bitrixListAll<BitrixInvoice>("crm.item.list", {
      entityTypeId: 31,
      filter: { stageId: INVOICE_STAGE_SENT },
      select: ["id", "opportunity", "currencyId"]
    }),
    countBitrix("crm.deal.list", {
      filter: { CATEGORY_ID: BITRIX_SALES_CATEGORY_ID, STAGE_SEMANTIC_ID: "P" }
    })
  ]);

  const stockInProcessOld = stockInProcess.filter(
    (lead) => hoursSince(lead.DATE_MODIFY || lead.DATE_CREATE, now) >= 24
  ).length;
  let thinkingFresh = 0;
  let thinkingStale = 0;
  for (const deal of stockThinking) {
    const base = deal.CLOSEDATE || deal.DATE_MODIFY || deal.DATE_CREATE;
    if (daysSince(base, now) > 15) thinkingStale += 1;
    else thinkingFresh += 1;
  }
  const unpaidSum = stockUnpaid.reduce((sum, row) => sum + toEur(row.opportunity, row.currencyId), 0);

  const assigneeIds = [
    ...new Set(
      [
        ...leads.map((l) => String(l.ASSIGNED_BY_ID || "")),
        ...dealsCreated.map((d) => String(d.ASSIGNED_BY_ID || "")),
        ...invoices.map((i) => String(i.assignedById || "")),
        ...payments.map((p) => String(p.assignedById || ""))
      ].filter(Boolean)
    )
  ];
  const names = await loadUserNames(assigneeIds);

  type ManagerAgg = {
    id: string;
    name: string;
    leads: number;
    ql: number;
    deals: number;
    invoices: number;
    invoiceSum: number;
    payments: number;
    paymentSum: number;
  };
  const byManager = new Map<string, ManagerAgg>();
  function manager(id: string): ManagerAgg | null {
    if (!id) return null;
    const name = names.get(id) || `ID ${id}`;
    if (SKIP_MANAGER.test(name)) return null;
    let row = byManager.get(id);
    if (!row) {
      row = {
        id,
        name,
        leads: 0,
        ql: 0,
        deals: 0,
        invoices: 0,
        invoiceSum: 0,
        payments: 0,
        paymentSum: 0
      };
      byManager.set(id, row);
    }
    return row;
  }

  for (const lead of leads) {
    const row = manager(String(lead.ASSIGNED_BY_ID || ""));
    if (!row) continue;
    row.leads += 1;
    if (String(lead.STATUS_ID || "") === BITRIX_QUALIFIED_LEAD_STATUS_ID) row.ql += 1;
  }
  for (const deal of dealsCreated) {
    const row = manager(String(deal.ASSIGNED_BY_ID || ""));
    if (row) row.deals += 1;
  }
  for (const invoice of invoices) {
    const row = manager(String(invoice.assignedById || ""));
    if (!row) continue;
    row.invoices += 1;
    row.invoiceSum += toEur(invoice.opportunity, invoice.currencyId);
  }
  for (const payment of payments) {
    const row = manager(String(payment.assignedById || ""));
    if (!row) continue;
    row.payments += 1;
    row.paymentSum += asNumber(payment.opportunity);
  }

  const managers = [...byManager.values()].sort((a, b) => {
    if (b.paymentSum !== a.paymentSum) return b.paymentSum - a.paymentSum;
    if (b.leads !== a.leads) return b.leads - a.leads;
    return a.name.localeCompare(b.name, "ru");
  });

  const crLeadDeal = ratioPct(dealsCreated.length, leads.length);
  const crDealInvoice = ratioPct(invoices.length, dealsCreated.length);
  const crInvoicePay = ratioPct(payments.length, invoices.length);
  const crLeadPay = ratioPct(payments.length, leads.length);

  const rows: SheetRow[] = [
    [`РОП · НЕДЕЛЯ · ${weekStart} … ${weekEnd}`],
    [`Обновлено: ${syncedAt} (Europe/Riga)  ·  источник: Bitrix`],
    [],
    ["ПОТОК НЕДЕЛИ"],
    ["Лиды", "Уникальные ≈", "Дубли", "Платные", "Органика", "QL", "Сделки", "Счета", "Оплаты", "Выручка €"],
    [
      leads.length,
      uniqueLeads,
      duplicates,
      paidLeads,
      organicLeads,
      qlLeads,
      dealsCreated.length,
      invoices.length,
      payments.length,
      money(paymentSum)
    ],
    [],
    ["КОНВЕРСИИ (в рамках недели, не когорта)"],
    ["Лид→сделка %", "Сделка→счёт %", "Счёт→оплата %", "Лид→оплата %", "Ср. чек €", "Σ счетов €"],
    [
      crLeadDeal,
      crDealInvoice,
      crInvoicePay,
      crLeadPay,
      avgCheck,
      money(invoiceSum)
    ],
    [],
    ["СТОК СЕЙЧАС"],
    [
      "NEW",
      "В работе >24ч",
      "В диалоге",
      "Я подумаю ≤15д",
      "Я подумаю >15д",
      "Неоплач. счета",
      "Σ неоплач. €",
      "Активный пайплайн шт"
    ],
    [
      stockNew,
      stockInProcessOld,
      stockDialog,
      thinkingFresh,
      thinkingStale,
      stockUnpaid.length,
      money(unpaidSum),
      stockPipelineCount
    ],
    [],
    ["ПО МЕНЕДЖЕРАМ"],
    [
      "Менеджер",
      "Лиды",
      "QL",
      "Сделки",
      "Счета",
      "Σ счетов",
      "Оплаты",
      "Выручка",
      "Ср.чек",
      "Лид→оплата %"
    ]
  ];

  for (const row of managers) {
    rows.push([
      row.name,
      row.leads,
      row.ql,
      row.deals,
      row.invoices,
      money(row.invoiceSum),
      row.payments,
      money(row.paymentSum),
      row.payments ? money(row.paymentSum / row.payments) : 0,
      ratioPct(row.payments, row.leads)
    ]);
  }

  if (!dryRun) {
    await writeSheetTab({
      spreadsheetId,
      tabTitle: ROP_WEEKLY_TAB,
      rows,
      clearRange: `'${ROP_WEEKLY_TAB.replace(/'/g, "''")}'!A:Z`,
      valueInputOption: "USER_ENTERED"
    });
    const sheetId = await getSheetIdByTitle(spreadsheetId, ROP_WEEKLY_TAB);
    if (sheetId != null) {
      await formatWeeklyTab({
        spreadsheetId,
        sheetId,
        managerCount: managers.length
      });
    }

    await upsertWeeklyHistoryRow({
      spreadsheetId,
      weekStart,
      weekEnd,
      syncedAt,
      leads: leads.length,
      uniqueLeads,
      duplicates,
      qlLeads,
      deals: dealsCreated.length,
      invoices: invoices.length,
      invoiceSum: money(invoiceSum),
      payments: payments.length,
      revenue: money(paymentSum),
      avgCheck,
      crLeadPay,
      stockNew,
      stockInProcessOld,
      thinkingStale,
      unpaidCount: stockUnpaid.length,
      unpaidSum: money(unpaidSum)
    });
  }

  return {
    ok: true,
    spreadsheetId,
    spreadsheetUrl: ropWeeklySpreadsheetUrl(),
    weekStart,
    weekEnd,
    syncedAt,
    dryRun,
    summary: {
      leads: leads.length,
      uniqueLeads,
      duplicates,
      qlLeads,
      deals: dealsCreated.length,
      invoices: invoices.length,
      invoiceSum: money(invoiceSum),
      payments: payments.length,
      revenue: money(paymentSum),
      avgCheck,
      crLeadPay,
      stockNew,
      stockUnpaid: stockUnpaid.length
    },
    managers: managers.length
  };
}
