import {
  getShiftBoardSpreadsheetId,
  SHIFT_BOARD_CONTROL_TAB,
  shiftBoardSpreadsheetUrl
} from "@/config/shift-board";
import { bitrixBatch, bitrixListAll, chunkIds } from "@/lib/bitrix/rest-client";
import { loadUserNames } from "@/lib/bitrix/sales-foundation/customer-key";
import type { BitrixSnapshotDeal } from "@/lib/bitrix/snapshot-store";
import { listPaidSmartInvoicesForPeriod } from "@/lib/bitrix/smart-invoices";
import {
  deleteSheetTabs,
  ensureSheetTab,
  getGoogleAccessToken,
  getSheetIdByTitle,
  listSpreadsheetTabs,
  writeSheetTab
} from "@/lib/google/sheets-client";
import { firstNameFrom } from "@/lib/manager-cabinet/dates";
import { namesMatch } from "@/lib/manager-cabinet/match";
import { loadManagerSchedule } from "@/lib/sales/load-manager-schedule";
import { rigaTodayIso } from "@/lib/sales/manager-schedule";

const PORTAL = "https://bb-wood.bitrix24.eu";
const SKIP_MANAGER = /tehniskais|техническ|frigat|robot|бот|\badmin\b|админ/i;

type BitrixLead = {
  ID?: string;
  TITLE?: string;
  STATUS_ID?: string;
  SOURCE_ID?: string;
  DATE_CREATE?: string;
  ASSIGNED_BY_ID?: string;
};

type BitrixInvoice = {
  id?: string | number;
  title?: string;
  stageId?: string;
  opportunity?: string | number;
  currencyId?: string;
  assignedById?: string | number;
  createdTime?: string;
  movedTime?: string;
};

export type ShiftBoardManagerSnapshot = {
  bitrixUserId: string;
  fullName: string;
  tabTitle: string;
  onShift: boolean;
  leads: number;
  statusCounts: Record<string, number>;
  invoices: number;
  invoiceSum: number;
  payments: number;
  paymentSumEur: number;
  avgCheckEur: number | null;
  productsInInvoices: number;
  productsInPayments: number;
  productsPerPayment: number | null;
};

export type ShiftBoardSyncResult = {
  ok: true;
  spreadsheetId: string;
  spreadsheetUrl: string;
  day: string;
  syncedAt: string;
  dryRun: boolean;
  managers: ShiftBoardManagerSnapshot[];
  createdTabs: string[];
  removedTabs: string[];
  keptTabs: string[];
};

function dayRange(day: string) {
  return {
    from: `${day}T00:00:00+03:00`,
    to: `${day}T23:59:59+03:00`
  };
}

function sanitizeTabTitle(name: string): string {
  const first = firstNameFrom(name);
  const cleaned = first.replace(/[:\\/?*[\]]/g, "").trim() || "Менеджер";
  return cleaned.slice(0, 80);
}

function uniqueTabTitle(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let index = 2;
  while (used.has(`${base} ${index}`)) index += 1;
  const title = `${base} ${index}`;
  used.add(title);
  return title;
}

function leadUrl(id: string) {
  return `${PORTAL}/crm/lead/details/${id}/`;
}

function invoiceUrl(id: string) {
  return `${PORTAL}/crm/type/31/details/${id}/`;
}

function paymentSpaId(dealId: string): string {
  return dealId.replace(/^si31-/, "");
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  return String(value).replace("T", " ").slice(0, 16);
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function avgCheck(sum: number, count: number): number | null {
  if (!count) return null;
  return Math.round((sum / count) * 100) / 100;
}

function avgCheckLabel(sum: number, count: number): string {
  const value = avgCheck(sum, count);
  return value == null ? "—" : money(value);
}

function calcProductsPerPayment(products: number, payments: number): number | null {
  if (!payments) return null;
  return Math.round((products / payments) * 100) / 100;
}

function productsPerPaymentLabel(products: number, payments: number): string {
  const value = calcProductsPerPayment(products, payments);
  return value == null ? "—" : money(value);
}

function productCountFromBatchResult(result: unknown): number {
  const rows = Array.isArray(result)
    ? result
    : result && typeof result === "object" && Array.isArray((result as { productRows?: unknown[] }).productRows)
      ? (result as { productRows: unknown[] }).productRows
      : [];
  let total = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const qty = asNumber((row as { quantity?: unknown }).quantity);
    total += qty > 0 ? qty : 1;
  }
  return total;
}

async function loadInvoiceProductCounts(invoiceIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const unique = [...new Set(invoiceIds.map(String).filter(Boolean))];
  for (const chunk of chunkIds(unique, 20)) {
    const cmd: Record<string, string> = {};
    chunk.forEach((id, index) => {
      cmd[`p${index}`] =
        `crm.item.productrow.list?filter[%3DownerType]=SI&filter[%3DownerId]=${encodeURIComponent(id)}`;
    });
    try {
      const result = await bitrixBatch<unknown>(cmd);
      chunk.forEach((id, index) => {
        map.set(id, productCountFromBatchResult(result[`p${index}`]));
      });
    } catch {
      chunk.forEach((id) => map.set(id, 0));
    }
  }
  return map;
}

async function loadOnShiftNames(day: string): Promise<string[]> {
  try {
    const schedule = await loadManagerSchedule(day.slice(0, 7));
    const index = schedule.selected.days.findIndex((row) => row.date === day);
    if (index < 0) return [];
    return schedule.selected.managers.filter((row) => row.shifts[index]).map((row) => row.name);
  } catch {
    return [];
  }
}

function buildManagerRows(input: {
  day: string;
  syncedAt: string;
  fullName: string;
  onShift: boolean;
  leads: BitrixLead[];
  invoices: BitrixInvoice[];
  payments: BitrixSnapshotDeal[];
  productCounts: Map<string, number>;
}): string[][] {
  const statusCounts: Record<string, number> = {};
  for (const lead of input.leads) {
    const key = String(lead.STATUS_ID || "?");
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  }
  const invoiceSum = input.invoices.reduce((sum, row) => sum + asNumber(row.opportunity), 0);
  const paymentSumEur = input.payments.reduce((sum, row) => sum + asNumber(row.opportunity), 0);
  const productsInInvoices = input.invoices.reduce(
    (sum, row) => sum + (input.productCounts.get(String(row.id || "")) || 0),
    0
  );
  const productsInPayments = input.payments.reduce(
    (sum, row) => sum + (input.productCounts.get(paymentSpaId(String(row.id || ""))) || 0),
    0
  );

  const rows: string[][] = [
    ["Поле", "Значение"],
    ["Дата", input.day],
    ["Обновлено", input.syncedAt],
    ["Менеджер", input.fullName],
    ["На смене по графику", input.onShift ? "да (справочно)" : "нет / не в графике"],
    ["Лиды сегодня", String(input.leads.length)],
    ["NEW", String(statusCounts.NEW || 0)],
    ["IN_PROCESS", String(statusCounts.IN_PROCESS || 0)],
    ["CONVERTED", String(statusCounts.CONVERTED || 0)],
    ["Счета сегодня", String(input.invoices.length)],
    ["Сумма счетов (как в CRM)", money(invoiceSum)],
    ["Товаров в счетах", String(productsInInvoices)],
    ["Оплаты сегодня", String(input.payments.length)],
    ["Товаров в оплатах", String(productsInPayments)],
    ["Товаров на оплату", productsPerPaymentLabel(productsInPayments, input.payments.length)],
    ["Сумма оплат, EUR", money(paymentSumEur)],
    ["Средний чек, EUR", avgCheckLabel(paymentSumEur, input.payments.length)],
    [],
    ["Лиды"],
    ["ID", "Название", "Статус", "Источник", "Создан", "Ссылка"]
  ];

  for (const lead of input.leads) {
    const id = String(lead.ID || "");
    rows.push([
      id,
      lead.TITLE || "",
      String(lead.STATUS_ID || ""),
      String(lead.SOURCE_ID || ""),
      formatDateTime(lead.DATE_CREATE),
      id ? leadUrl(id) : ""
    ]);
  }

  rows.push([]);
  rows.push(["Счета"]);
  rows.push(["ID", "Название", "Стадия", "Сумма", "Валюта", "Товаров", "Создан", "Ссылка"]);
  for (const invoice of input.invoices) {
    const id = String(invoice.id || "");
    rows.push([
      id,
      invoice.title || "",
      String(invoice.stageId || ""),
      String(invoice.opportunity ?? ""),
      String(invoice.currencyId || "EUR"),
      String(input.productCounts.get(id) || 0),
      formatDateTime(invoice.createdTime || invoice.movedTime),
      id ? invoiceUrl(id) : ""
    ]);
  }

  rows.push([]);
  rows.push(["Оплаты"]);
  rows.push(["ID", "Название", "Дата оплаты", "Сумма EUR", "Товаров", "Сделка", "Ссылка"]);
  for (const payment of input.payments) {
    const spaId = paymentSpaId(String(payment.id || ""));
    rows.push([
      spaId,
      payment.title || "",
      payment.paymentDate || payment.closeDate || "",
      String(payment.opportunity ?? ""),
      String(input.productCounts.get(spaId) || 0),
      payment.parentDealId || "",
      spaId ? invoiceUrl(spaId) : ""
    ]);
  }

  return rows;
}

function money(value: number) {
  return String(Math.round(value * 100) / 100);
}

const CONTROL_COLS = 12;

function rgb(r: number, g: number, b: number) {
  return { red: r, green: g, blue: b };
}

async function formatControlTab(input: {
  spreadsheetId: string;
  sheetId: number;
  managerCount: number;
}) {
  // Layout (0-based):
  // 0 title, 1 updated, 2 spacer, 3 KPI labels, 4 KPI values, 5 spacer, 6 section, 7 table header, 8+ data
  const kpiLabelRow = 3;
  const kpiValueRow = 4;
  const sectionRow = 6;
  const headerRow = 7;
  const firstDataRow = 8;
  const lastDataRow = headerRow + Math.max(1, input.managerCount);
  const colWidths = [190, 58, 52, 72, 68, 58, 82, 68, 72, 62, 78, 72];

  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}:batchUpdate`;

  async function batchUpdate(requests: unknown[]) {
    const response = await fetch(sheetsUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ requests })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Shift board format failed: ${response.status} ${body.slice(0, 280)}`);
    }
  }

  // Clear leftover freeze/merges from older layouts so new merges can span full width.
  await batchUpdate([
    {
      updateSheetProperties: {
        properties: {
          sheetId: input.sheetId,
          gridProperties: { frozenRowCount: 0, frozenColumnCount: 0 }
        },
        fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount"
      }
    },
    {
      unmergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: 0,
          endRowIndex: 80,
          startColumnIndex: 0,
          endColumnIndex: CONTROL_COLS
        }
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: 0,
          endRowIndex: 80,
          startColumnIndex: 0,
          endColumnIndex: CONTROL_COLS
        },
        cell: { userEnteredFormat: {} },
        fields: "userEnteredFormat"
      }
    }
  ]);

  const mergeKpiPairs = Array.from({ length: 6 }, (_, index) => ({
    mergeCells: {
      range: {
        sheetId: input.sheetId,
        startRowIndex: kpiLabelRow,
        endRowIndex: kpiLabelRow + 1,
        startColumnIndex: index * 2,
        endColumnIndex: index * 2 + 2
      },
      mergeType: "MERGE_ALL"
    }
  })).concat(
    Array.from({ length: 6 }, (_, index) => ({
      mergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: kpiValueRow,
          endRowIndex: kpiValueRow + 1,
          startColumnIndex: index * 2,
          endColumnIndex: index * 2 + 2
        },
        mergeType: "MERGE_ALL"
      }
    }))
  );

  await batchUpdate([
    {
      mergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: CONTROL_COLS
        },
        mergeType: "MERGE_ALL"
      }
    },
    {
      mergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 0,
          endColumnIndex: CONTROL_COLS
        },
        mergeType: "MERGE_ALL"
      }
    },
    {
      mergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: sectionRow,
          endRowIndex: sectionRow + 1,
          startColumnIndex: 0,
          endColumnIndex: CONTROL_COLS
        },
        mergeType: "MERGE_ALL"
      }
    },
    ...mergeKpiPairs,
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: CONTROL_COLS
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 16, foregroundColor: rgb(1, 1, 1) },
            backgroundColor: rgb(0.12, 0.23, 0.37),
            horizontalAlignment: "LEFT",
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 0,
          endColumnIndex: CONTROL_COLS
        },
        cell: {
          userEnteredFormat: {
            textFormat: { fontSize: 10, foregroundColor: rgb(0.35, 0.4, 0.48) },
            backgroundColor: rgb(0.94, 0.96, 0.98),
            horizontalAlignment: "LEFT",
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: kpiLabelRow,
          endRowIndex: kpiLabelRow + 1,
          startColumnIndex: 0,
          endColumnIndex: CONTROL_COLS
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 9, foregroundColor: rgb(0.28, 0.35, 0.45) },
            backgroundColor: rgb(0.9, 0.93, 0.97),
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: kpiValueRow,
          endRowIndex: kpiValueRow + 1,
          startColumnIndex: 0,
          endColumnIndex: CONTROL_COLS
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 18, foregroundColor: rgb(0.1, 0.18, 0.3) },
            backgroundColor: rgb(0.97, 0.98, 1),
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: sectionRow,
          endRowIndex: sectionRow + 1,
          startColumnIndex: 0,
          endColumnIndex: CONTROL_COLS
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 11, foregroundColor: rgb(0.15, 0.22, 0.32) },
            backgroundColor: rgb(0.93, 0.95, 0.97),
            horizontalAlignment: "LEFT",
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: headerRow,
          endRowIndex: headerRow + 1,
          startColumnIndex: 0,
          endColumnIndex: CONTROL_COLS
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 9, foregroundColor: rgb(1, 1, 1) },
            backgroundColor: rgb(0.2, 0.45, 0.72),
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP"
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: firstDataRow,
          endRowIndex: lastDataRow + 1,
          startColumnIndex: 0,
          endColumnIndex: 1
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "LEFT",
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: firstDataRow,
          endRowIndex: lastDataRow + 1,
          startColumnIndex: 1,
          endColumnIndex: CONTROL_COLS
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)"
      }
    },
    {
      updateBorders: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: headerRow,
          endRowIndex: lastDataRow + 1,
          startColumnIndex: 0,
          endColumnIndex: CONTROL_COLS
        },
        top: { style: "SOLID", width: 1, color: rgb(0.78, 0.84, 0.9) },
        bottom: { style: "SOLID", width: 1, color: rgb(0.78, 0.84, 0.9) },
        left: { style: "SOLID", width: 1, color: rgb(0.78, 0.84, 0.9) },
        right: { style: "SOLID", width: 1, color: rgb(0.78, 0.84, 0.9) },
        innerHorizontal: { style: "SOLID", width: 1, color: rgb(0.88, 0.91, 0.94) },
        innerVertical: { style: "SOLID", width: 1, color: rgb(0.88, 0.91, 0.94) }
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: input.sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 42 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: input.sheetId, dimension: "ROWS", startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 26 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: input.sheetId, dimension: "ROWS", startIndex: kpiLabelRow, endIndex: kpiLabelRow + 1 },
        properties: { pixelSize: 24 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: input.sheetId, dimension: "ROWS", startIndex: kpiValueRow, endIndex: kpiValueRow + 1 },
        properties: { pixelSize: 44 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: input.sheetId, dimension: "ROWS", startIndex: sectionRow, endIndex: sectionRow + 1 },
        properties: { pixelSize: 28 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: input.sheetId, dimension: "ROWS", startIndex: headerRow, endIndex: headerRow + 1 },
        properties: { pixelSize: 36 },
        fields: "pixelSize"
      }
    },
    ...colWidths.map((pixelSize, index) => ({
      updateDimensionProperties: {
        range: {
          sheetId: input.sheetId,
          dimension: "COLUMNS",
          startIndex: index,
          endIndex: index + 1
        },
        properties: { pixelSize },
        fields: "pixelSize"
      }
    })),
    {
      updateSheetProperties: {
        properties: {
          sheetId: input.sheetId,
          gridProperties: { frozenRowCount: headerRow + 1, frozenColumnCount: 0 }
        },
        fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount"
      }
    }
  ]);
}

export async function syncShiftBoard(options: {
  spreadsheetId?: string;
  day?: string;
  dryRun?: boolean;
} = {}): Promise<ShiftBoardSyncResult> {
  const spreadsheetId = options.spreadsheetId?.trim() || getShiftBoardSpreadsheetId();
  const day = options.day || rigaTodayIso();
  const dryRun = options.dryRun === true;
  const syncedAt = new Intl.DateTimeFormat("sv-SE", {
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

  const { from, to } = dayRange(day);
  // Schedule is optional hint only — many new managers are not in the roster yet.
  const scheduleNames = await loadOnShiftNames(day);

  const leads = await bitrixListAll<BitrixLead>(
    "crm.lead.list",
    {
      filter: { ">=DATE_CREATE": from, "<=DATE_CREATE": to },
      select: ["ID", "TITLE", "STATUS_ID", "SOURCE_ID", "DATE_CREATE", "ASSIGNED_BY_ID"],
      order: { ID: "DESC" }
    },
    50
  );

  let invoicesCreated: BitrixInvoice[] = [];
  let invoicesMoved: BitrixInvoice[] = [];
  try {
    invoicesCreated = await bitrixListAll<BitrixInvoice>(
      "crm.item.list",
      {
        entityTypeId: 31,
        filter: { ">=createdTime": from, "<=createdTime": to },
        select: ["id", "title", "stageId", "opportunity", "currencyId", "assignedById", "createdTime", "movedTime"],
        order: { id: "DESC" }
      },
      50
    );
  } catch {
    invoicesCreated = [];
  }
  try {
    invoicesMoved = await bitrixListAll<BitrixInvoice>(
      "crm.item.list",
      {
        entityTypeId: 31,
        filter: { ">=movedTime": from, "<=movedTime": to },
        select: ["id", "title", "stageId", "opportunity", "currencyId", "assignedById", "createdTime", "movedTime"],
        order: { id: "DESC" }
      },
      50
    );
  } catch {
    invoicesMoved = [];
  }

  const invoicesById = new Map<string, BitrixInvoice>();
  for (const row of [...invoicesCreated, ...invoicesMoved]) {
    if (row.id == null) continue;
    invoicesById.set(String(row.id), row);
  }
  const invoices = [...invoicesById.values()];

  const payments = await listPaidSmartInvoicesForPeriod(day, day);

  const productCountIds = [
    ...new Set([
      ...invoices.map((row) => String(row.id || "")),
      ...payments.map((row) => paymentSpaId(String(row.id || "")))
    ].filter(Boolean))
  ];
  const productCounts = await loadInvoiceProductCounts(productCountIds);

  const assigneeIds = [
    ...new Set([
      ...leads.map((row) => String(row.ASSIGNED_BY_ID || "")),
      ...invoices.map((row) => String(row.assignedById || "")),
      ...payments.map((row) => String(row.assignedById || ""))
    ].filter(Boolean))
  ];
  const names = await loadUserNames(assigneeIds);

  const activeIds = new Set<string>();
  for (const lead of leads) {
    const id = String(lead.ASSIGNED_BY_ID || "");
    const name = names.get(id) || "";
    if (!id || SKIP_MANAGER.test(name)) continue;
    activeIds.add(id);
  }
  for (const invoice of invoices) {
    const id = String(invoice.assignedById || "");
    const name = names.get(id) || "";
    if (!id || SKIP_MANAGER.test(name)) continue;
    activeIds.add(id);
  }
  for (const payment of payments) {
    const id = String(payment.assignedById || "");
    const name = names.get(id) || payment.managerName || "";
    if (!id || SKIP_MANAGER.test(name)) continue;
    activeIds.add(id);
  }

  const managers: ShiftBoardManagerSnapshot[] = [];
  const usedTitles = new Set<string>([SHIFT_BOARD_CONTROL_TAB]);

  for (const bitrixUserId of [...activeIds]) {
    const fullName = names.get(bitrixUserId) || `ID ${bitrixUserId}`;
    if (SKIP_MANAGER.test(fullName)) continue;
    const inSchedule = scheduleNames.some((shiftName) => namesMatch(shiftName, fullName));
    const managerLeads = leads.filter((row) => String(row.ASSIGNED_BY_ID || "") === bitrixUserId);
    const managerInvoices = invoices.filter((row) => String(row.assignedById || "") === bitrixUserId);
    const managerPayments = payments.filter((row) => String(row.assignedById || "") === bitrixUserId);
    const statusCounts: Record<string, number> = {};
    for (const lead of managerLeads) {
      const key = String(lead.STATUS_ID || "?");
      statusCounts[key] = (statusCounts[key] || 0) + 1;
    }
    const invoiceSum = managerInvoices.reduce((sum, row) => sum + asNumber(row.opportunity), 0);
    const paymentSumEur = managerPayments.reduce((sum, row) => sum + asNumber(row.opportunity), 0);
    const productsInInvoices = managerInvoices.reduce(
      (sum, row) => sum + (productCounts.get(String(row.id || "")) || 0),
      0
    );
    const productsInPayments = managerPayments.reduce(
      (sum, row) => sum + (productCounts.get(paymentSpaId(String(row.id || ""))) || 0),
      0
    );
    managers.push({
      bitrixUserId,
      fullName,
      tabTitle: uniqueTabTitle(sanitizeTabTitle(fullName), usedTitles),
      onShift: inSchedule,
      leads: managerLeads.length,
      statusCounts,
      invoices: managerInvoices.length,
      invoiceSum,
      payments: managerPayments.length,
      paymentSumEur,
      avgCheckEur: avgCheck(paymentSumEur, managerPayments.length),
      productsInInvoices,
      productsInPayments,
      productsPerPayment: calcProductsPerPayment(productsInPayments, managerPayments.length)
    });
  }

  managers.sort((a, b) => {
    if (b.paymentSumEur !== a.paymentSumEur) return b.paymentSumEur - a.paymentSumEur;
    if (b.leads !== a.leads) return b.leads - a.leads;
    return a.fullName.localeCompare(b.fullName, "ru");
  });

  const desiredTitles = new Set([SHIFT_BOARD_CONTROL_TAB, ...managers.map((row) => row.tabTitle)]);
  const existingTabs = await listSpreadsheetTabs(spreadsheetId);
  const existingTitles = existingTabs.map((tab) => tab.title);
  const toRemove = existingTitles.filter((title) => !desiredTitles.has(title));
  const toCreate = [...desiredTitles].filter((title) => !existingTitles.includes(title));

  if (!dryRun) {
    await ensureSheetTab(spreadsheetId, SHIFT_BOARD_CONTROL_TAB);

    const totalLeads = managers.reduce((sum, row) => sum + row.leads, 0);
    const totalInvoices = managers.reduce((sum, row) => sum + row.invoices, 0);
    const totalPayments = managers.reduce((sum, row) => sum + row.payments, 0);
    const totalRevenueEur = managers.reduce((sum, row) => sum + row.paymentSumEur, 0);
    const totalProductsInPayments = managers.reduce((sum, row) => sum + row.productsInPayments, 0);

    const controlRows: string[][] = [
      [`СМЕНА СЕГОДНЯ · ${day}`],
      [`Обновлено: ${syncedAt} (Europe/Riga)`],
      [],
      ["Лиды", "", "Счета", "", "Оплаты", "", "Выручка, €", "", "Ср. чек, €", "", "Тов. на оплату", ""],
      [
        String(totalLeads),
        "",
        String(totalInvoices),
        "",
        String(totalPayments),
        "",
        money(totalRevenueEur),
        "",
        avgCheckLabel(totalRevenueEur, totalPayments),
        "",
        productsPerPaymentLabel(totalProductsInPayments, totalPayments),
        ""
      ],
      [],
      ["По менеджерам"],
      [
        "Менеджер",
        "Лиды",
        "NEW",
        "В работе",
        "Сделки",
        "Счета",
        "Σ счетов",
        "Товаров",
        "Тов/опл",
        "Оплаты",
        "Выручка",
        "Ср.чек"
      ]
    ];
    for (const row of managers) {
      controlRows.push([
        row.fullName,
        String(row.leads),
        String(row.statusCounts.NEW || 0),
        String(row.statusCounts.IN_PROCESS || 0),
        String(row.statusCounts.CONVERTED || 0),
        String(row.invoices),
        money(row.invoiceSum),
        String(row.productsInInvoices),
        row.productsPerPayment == null ? "—" : money(row.productsPerPayment),
        String(row.payments),
        money(row.paymentSumEur),
        row.avgCheckEur == null ? "—" : money(row.avgCheckEur)
      ]);
    }
    await writeSheetTab({
      spreadsheetId,
      tabTitle: SHIFT_BOARD_CONTROL_TAB,
      rows: controlRows,
      clearRange: `'${SHIFT_BOARD_CONTROL_TAB}'!A:Z`
    });

    const controlSheetId = await getSheetIdByTitle(spreadsheetId, SHIFT_BOARD_CONTROL_TAB);
    if (controlSheetId != null) {
      await formatControlTab({
        spreadsheetId,
        sheetId: controlSheetId,
        managerCount: managers.length
      });
    }

    for (const manager of managers) {
      const managerLeads = leads.filter((row) => String(row.ASSIGNED_BY_ID || "") === manager.bitrixUserId);
      const managerInvoices = invoices.filter(
        (row) => String(row.assignedById || "") === manager.bitrixUserId
      );
      const managerPayments = payments.filter((row) => String(row.assignedById || "") === manager.bitrixUserId);
      await writeSheetTab({
        spreadsheetId,
        tabTitle: manager.tabTitle,
        rows: buildManagerRows({
          day,
          syncedAt,
          fullName: manager.fullName,
          onShift: manager.onShift,
          leads: managerLeads,
          invoices: managerInvoices,
          payments: managerPayments,
          productCounts
        }),
        clearRange: `'${manager.tabTitle.replace(/'/g, "''")}'!A:Z`
      });
    }

    if (toRemove.length) {
      await deleteSheetTabs(spreadsheetId, toRemove);
    }
  }

  return {
    ok: true,
    spreadsheetId,
    spreadsheetUrl: shiftBoardSpreadsheetUrl(),
    day,
    syncedAt: new Date().toISOString(),
    dryRun,
    managers,
    createdTabs: toCreate,
    removedTabs: toRemove,
    keptTabs: [...desiredTitles]
  };
}
