import {
  getShiftBoardSpreadsheetId,
  SHIFT_BOARD_CONTROL_TAB,
  shiftBoardSpreadsheetUrl
} from "@/config/shift-board";
import { bitrixBatch, bitrixListAll, chunkIds } from "@/lib/bitrix/rest-client";
import { loadUserNames } from "@/lib/bitrix/sales-foundation/customer-key";
import type { BitrixSnapshotDeal } from "@/lib/bitrix/snapshot-store";
import { listPaidSmartInvoicesForPeriod, loadBitrixCurrencyRatesToBase, toBaseCurrencyAmount } from "@/lib/bitrix/smart-invoices";
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

function avgCheckLabel(sum: number, count: number): number | string {
  const value = avgCheck(sum, count);
  return value == null ? "—" : money(value);
}

function calcProductsPerPayment(products: number, payments: number): number | null {
  if (!payments) return null;
  return Math.round((products / payments) * 100) / 100;
}

function productsPerPaymentLabel(products: number, payments: number): number | string {
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

type SheetCell = string | number | boolean | null;
type SheetRow = SheetCell[];

type ManagerTabBuild = {
  rows: SheetRow[];
  leadHeaderRow: number;
  leadCount: number;
  invoiceHeaderRow: number;
  invoiceCount: number;
  paymentHeaderRow: number;
  paymentCount: number;
};

function buildManagerRows(input: {
  day: string;
  syncedAt: string;
  fullName: string;
  onShift: boolean;
  leads: BitrixLead[];
  invoices: BitrixInvoice[];
  payments: BitrixSnapshotDeal[];
  productCounts: Map<string, number>;
  fx: { baseCurrency: string; rates: Map<string, number> };
}): ManagerTabBuild {
  const statusCounts: Record<string, number> = {};
  for (const lead of input.leads) {
    const key = String(lead.STATUS_ID || "?");
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  }
  const toEur = (amount: unknown, currencyId?: string | null) =>
    toBaseCurrencyAmount(asNumber(amount), currencyId, input.fx.rates, input.fx.baseCurrency);
  const invoiceSum = input.invoices.reduce(
    (sum, row) => sum + toEur(row.opportunity, row.currencyId),
    0
  );
  const paymentSumEur = input.payments.reduce((sum, row) => sum + asNumber(row.opportunity), 0);
  const productsInInvoices = input.invoices.reduce(
    (sum, row) => sum + (input.productCounts.get(String(row.id || "")) || 0),
    0
  );
  const productsInPayments = input.payments.reduce(
    (sum, row) => sum + (input.productCounts.get(paymentSpaId(String(row.id || ""))) || 0),
    0
  );
  const scheduleLabel = input.onShift ? "да (справочно)" : "нет / не в графике";

  const rows: SheetRow[] = [
    [`МЕНЕДЖЕР · ${input.fullName}`],
    [
      `Дата: ${input.day}  ·  Обновлено: ${input.syncedAt}  ·  NEW ${statusCounts.NEW || 0}  ·  В работе ${statusCounts.IN_PROCESS || 0}  ·  Сделки ${statusCounts.CONVERTED || 0}  ·  График: ${scheduleLabel}`
    ],
    [],
    ["Лиды", "", "Счета", "", "Оплаты", "", "Выручка, €", ""],
    [
      input.leads.length,
      "",
      input.invoices.length,
      "",
      input.payments.length,
      "",
      money(paymentSumEur),
      ""
    ],
    ["Ср. чек, €", "", "Тов. на оплату", "", "Товаров", "", "Σ счетов", ""],
    [
      avgCheckLabel(paymentSumEur, input.payments.length),
      "",
      productsPerPaymentLabel(productsInPayments, input.payments.length),
      "",
      productsInInvoices,
      "",
      money(invoiceSum),
      ""
    ],
    [],
    ["Лиды"]
  ];

  const leadHeaderRow = rows.length;
  rows.push(["ID", "Название", "Статус", "Источник", "Создан", "Ссылка", "", ""]);
  for (const lead of input.leads) {
    const id = String(lead.ID || "");
    rows.push([
      id,
      lead.TITLE || "",
      String(lead.STATUS_ID || ""),
      String(lead.SOURCE_ID || ""),
      formatDateTime(lead.DATE_CREATE),
      id ? leadUrl(id) : "",
      "",
      ""
    ]);
  }

  rows.push([]);
  rows.push(["Счета"]);
  const invoiceHeaderRow = rows.length;
  rows.push(["ID", "Название", "Стадия", "Сумма", "Валюта", "Товаров", "Создан", "Ссылка"]);
  for (const invoice of input.invoices) {
    const id = String(invoice.id || "");
    rows.push([
      id,
      invoice.title || "",
      String(invoice.stageId || ""),
      money(toEur(invoice.opportunity, invoice.currencyId)),
      input.fx.baseCurrency || "EUR",
      input.productCounts.get(id) || 0,
      formatDateTime(invoice.createdTime || invoice.movedTime),
      id ? invoiceUrl(id) : ""
    ]);
  }

  rows.push([]);
  rows.push(["Оплаты"]);
  const paymentHeaderRow = rows.length;
  rows.push(["ID", "Название", "Дата оплаты", "Сумма EUR", "Товаров", "Сделка", "Ссылка", ""]);
  for (const payment of input.payments) {
    const spaId = paymentSpaId(String(payment.id || ""));
    rows.push([
      spaId,
      payment.title || "",
      payment.paymentDate || payment.closeDate || "",
      asNumber(payment.opportunity),
      input.productCounts.get(spaId) || 0,
      payment.parentDealId || "",
      spaId ? invoiceUrl(spaId) : "",
      ""
    ]);
  }

  return {
    rows,
    leadHeaderRow,
    leadCount: input.leads.length,
    invoiceHeaderRow,
    invoiceCount: input.invoices.length,
    paymentHeaderRow,
    paymentCount: input.payments.length
  };
}

function money(value: number) {
  return Math.round(value * 100) / 100;
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
  // 0 title, 1 updated, 2 spacer,
  // 3 KPI labels, 4 primary values (counts / avg), 5 euro under Счета/Оплаты,
  // 6 spacer, 7 section, 8 table header, 9+ data
  const kpiLabelRow = 3;
  const kpiPrimaryRow = 4;
  const kpiEuroRow = 5;
  const sectionRow = 7;
  const headerRow = 8;
  const firstDataRow = 9;
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

  // 4 KPI columns × 2 sheet columns.
  const mergeKpiLabels = Array.from({ length: 4 }, (_, index) => ({
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
  }));

  // Лиды + Ср. чек values span primary+euro rows; Счета/Оплаты keep count and € stacked.
  const mergeKpiValues = [
    {
      mergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: kpiPrimaryRow,
          endRowIndex: kpiEuroRow + 1,
          startColumnIndex: 0,
          endColumnIndex: 2
        },
        mergeType: "MERGE_ALL"
      }
    },
    {
      mergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: kpiPrimaryRow,
          endRowIndex: kpiPrimaryRow + 1,
          startColumnIndex: 2,
          endColumnIndex: 4
        },
        mergeType: "MERGE_ALL"
      }
    },
    {
      mergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: kpiEuroRow,
          endRowIndex: kpiEuroRow + 1,
          startColumnIndex: 2,
          endColumnIndex: 4
        },
        mergeType: "MERGE_ALL"
      }
    },
    {
      mergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: kpiPrimaryRow,
          endRowIndex: kpiPrimaryRow + 1,
          startColumnIndex: 4,
          endColumnIndex: 6
        },
        mergeType: "MERGE_ALL"
      }
    },
    {
      mergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: kpiEuroRow,
          endRowIndex: kpiEuroRow + 1,
          startColumnIndex: 4,
          endColumnIndex: 6
        },
        mergeType: "MERGE_ALL"
      }
    },
    {
      mergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: kpiPrimaryRow,
          endRowIndex: kpiEuroRow + 1,
          startColumnIndex: 6,
          endColumnIndex: 8
        },
        mergeType: "MERGE_ALL"
      }
    }
  ];

  const intFormat = { type: "NUMBER", pattern: "0" };
  const moneyFormat = { type: "NUMBER", pattern: "0.00" };

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
    ...mergeKpiLabels,
    ...mergeKpiValues,
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
          endColumnIndex: 8
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 9, foregroundColor: rgb(0.28, 0.35, 0.45) },
            backgroundColor: rgb(0.9, 0.93, 0.97),
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP"
          }
        },
        fields:
          "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: kpiPrimaryRow,
          endRowIndex: kpiEuroRow + 1,
          startColumnIndex: 0,
          endColumnIndex: 8
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 18, foregroundColor: rgb(0.1, 0.18, 0.3) },
            backgroundColor: rgb(0.97, 0.98, 1),
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            numberFormat: intFormat
          }
        },
        fields:
          "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,numberFormat)"
      }
    },
    // Money: avg check + euro rows under Счета/Оплаты
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: kpiPrimaryRow,
          endRowIndex: kpiEuroRow + 1,
          startColumnIndex: 6,
          endColumnIndex: 8
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 18, foregroundColor: rgb(0.1, 0.18, 0.3) },
            backgroundColor: rgb(0.97, 0.98, 1),
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            numberFormat: moneyFormat
          }
        },
        fields:
          "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,numberFormat)"
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: kpiEuroRow,
          endRowIndex: kpiEuroRow + 1,
          startColumnIndex: 2,
          endColumnIndex: 6
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 14, foregroundColor: rgb(0.1, 0.18, 0.3) },
            backgroundColor: rgb(0.97, 0.98, 1),
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            numberFormat: moneyFormat
          }
        },
        fields:
          "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,numberFormat)"
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
            verticalAlignment: "MIDDLE",
            numberFormat: intFormat
          }
        },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,numberFormat)"
      }
    },
    // Money columns in manager table: Σ счетов(6), Тов/опл(8), Выручка(10), Ср.чек(11)
    ...[6, 8, 10, 11].map((columnIndex) => ({
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
            verticalAlignment: "MIDDLE",
            numberFormat: moneyFormat
          }
        },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,numberFormat)"
      }
    })),
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
        properties: { pixelSize: 28 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: input.sheetId, dimension: "ROWS", startIndex: kpiPrimaryRow, endIndex: kpiPrimaryRow + 1 },
        properties: { pixelSize: 36 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: input.sheetId, dimension: "ROWS", startIndex: kpiEuroRow, endIndex: kpiEuroRow + 1 },
        properties: { pixelSize: 28 },
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

const MANAGER_COLS = 8;

async function shiftBoardBatchUpdate(spreadsheetId: string, requests: unknown[]) {
  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
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

function mergePairRequests(sheetId: number, rowIndex: number, pairCount: number) {
  return Array.from({ length: pairCount }, (_, index) => ({
    mergeCells: {
      range: {
        sheetId,
        startRowIndex: rowIndex,
        endRowIndex: rowIndex + 1,
        startColumnIndex: index * 2,
        endColumnIndex: index * 2 + 2
      },
      mergeType: "MERGE_ALL"
    }
  }));
}

function tableFormatRequests(input: {
  sheetId: number;
  headerRow: number;
  rowCount: number;
  colCount: number;
}) {
  const firstDataRow = input.headerRow + 1;
  const lastDataRow = input.headerRow + Math.max(1, input.rowCount);
  return [
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: input.headerRow - 1,
          endRowIndex: input.headerRow,
          startColumnIndex: 0,
          endColumnIndex: input.colCount
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
          startRowIndex: input.headerRow,
          endRowIndex: input.headerRow + 1,
          startColumnIndex: 0,
          endColumnIndex: input.colCount
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
          endColumnIndex: input.colCount
        },
        cell: {
          userEnteredFormat: {
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat.verticalAlignment"
      }
    },
    {
      updateBorders: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: input.headerRow,
          endRowIndex: lastDataRow + 1,
          startColumnIndex: 0,
          endColumnIndex: input.colCount
        },
        top: { style: "SOLID", width: 1, color: rgb(0.78, 0.84, 0.9) },
        bottom: { style: "SOLID", width: 1, color: rgb(0.78, 0.84, 0.9) },
        left: { style: "SOLID", width: 1, color: rgb(0.78, 0.84, 0.9) },
        right: { style: "SOLID", width: 1, color: rgb(0.78, 0.84, 0.9) },
        innerHorizontal: { style: "SOLID", width: 1, color: rgb(0.88, 0.91, 0.94) },
        innerVertical: { style: "SOLID", width: 1, color: rgb(0.88, 0.91, 0.94) }
      }
    }
  ];
}

async function formatManagerTab(input: {
  spreadsheetId: string;
  sheetId: number;
  layout: ManagerTabBuild;
}) {
  const kpiLabelRow1 = 3;
  const kpiValueRow1 = 4;
  const kpiLabelRow2 = 5;
  const kpiValueRow2 = 6;
  const leadSectionRow = input.layout.leadHeaderRow - 1;
  const invoiceSectionRow = input.layout.invoiceHeaderRow - 1;
  const paymentSectionRow = input.layout.paymentHeaderRow - 1;
  const endRow = Math.max(
    input.layout.paymentHeaderRow + Math.max(1, input.layout.paymentCount) + 2,
    40
  );
  const colWidths = [78, 260, 120, 100, 90, 80, 130, 220];

  await shiftBoardBatchUpdate(input.spreadsheetId, [
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
          endRowIndex: endRow,
          startColumnIndex: 0,
          endColumnIndex: MANAGER_COLS
        }
      }
    },
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: 0,
          endRowIndex: endRow,
          startColumnIndex: 0,
          endColumnIndex: MANAGER_COLS
        },
        cell: { userEnteredFormat: {} },
        fields: "userEnteredFormat"
      }
    }
  ]);

  await shiftBoardBatchUpdate(input.spreadsheetId, [
    {
      mergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: MANAGER_COLS
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
          endColumnIndex: MANAGER_COLS
        },
        mergeType: "MERGE_ALL"
      }
    },
    {
      mergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: leadSectionRow,
          endRowIndex: leadSectionRow + 1,
          startColumnIndex: 0,
          endColumnIndex: MANAGER_COLS
        },
        mergeType: "MERGE_ALL"
      }
    },
    {
      mergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: invoiceSectionRow,
          endRowIndex: invoiceSectionRow + 1,
          startColumnIndex: 0,
          endColumnIndex: MANAGER_COLS
        },
        mergeType: "MERGE_ALL"
      }
    },
    {
      mergeCells: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: paymentSectionRow,
          endRowIndex: paymentSectionRow + 1,
          startColumnIndex: 0,
          endColumnIndex: MANAGER_COLS
        },
        mergeType: "MERGE_ALL"
      }
    },
    ...mergePairRequests(input.sheetId, kpiLabelRow1, 4),
    ...mergePairRequests(input.sheetId, kpiValueRow1, 4),
    ...mergePairRequests(input.sheetId, kpiLabelRow2, 4),
    ...mergePairRequests(input.sheetId, kpiValueRow2, 4),
    {
      repeatCell: {
        range: {
          sheetId: input.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: MANAGER_COLS
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
          endColumnIndex: MANAGER_COLS
        },
        cell: {
          userEnteredFormat: {
            textFormat: { fontSize: 10, foregroundColor: rgb(0.35, 0.4, 0.48) },
            backgroundColor: rgb(0.94, 0.96, 0.98),
            horizontalAlignment: "LEFT",
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
          startRowIndex: kpiLabelRow1,
          endRowIndex: kpiLabelRow1 + 1,
          startColumnIndex: 0,
          endColumnIndex: MANAGER_COLS
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
          startRowIndex: kpiValueRow1,
          endRowIndex: kpiValueRow1 + 1,
          startColumnIndex: 0,
          endColumnIndex: MANAGER_COLS
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
          startRowIndex: kpiLabelRow2,
          endRowIndex: kpiLabelRow2 + 1,
          startColumnIndex: 0,
          endColumnIndex: MANAGER_COLS
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
          startRowIndex: kpiValueRow2,
          endRowIndex: kpiValueRow2 + 1,
          startColumnIndex: 0,
          endColumnIndex: MANAGER_COLS
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 16, foregroundColor: rgb(0.1, 0.18, 0.3) },
            backgroundColor: rgb(0.97, 0.98, 1),
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment)"
      }
    },
    ...tableFormatRequests({
      sheetId: input.sheetId,
      headerRow: input.layout.leadHeaderRow,
      rowCount: input.layout.leadCount,
      colCount: 6
    }),
    ...tableFormatRequests({
      sheetId: input.sheetId,
      headerRow: input.layout.invoiceHeaderRow,
      rowCount: input.layout.invoiceCount,
      colCount: MANAGER_COLS
    }),
    ...tableFormatRequests({
      sheetId: input.sheetId,
      headerRow: input.layout.paymentHeaderRow,
      rowCount: input.layout.paymentCount,
      colCount: 7
    }),
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
        properties: { pixelSize: 34 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: input.sheetId, dimension: "ROWS", startIndex: kpiValueRow1, endIndex: kpiValueRow1 + 1 },
        properties: { pixelSize: 42 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: input.sheetId, dimension: "ROWS", startIndex: kpiValueRow2, endIndex: kpiValueRow2 + 1 },
        properties: { pixelSize: 38 },
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
          gridProperties: {
            frozenRowCount: 8,
            frozenColumnCount: 0
          }
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
  const fx = await loadBitrixCurrencyRatesToBase();
  const toEur = (amount: unknown, currencyId?: string | null) =>
    toBaseCurrencyAmount(asNumber(amount), currencyId, fx.rates, fx.baseCurrency);

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
    const invoiceSum = managerInvoices.reduce(
      (sum, row) => sum + toEur(row.opportunity, row.currencyId),
      0
    );
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
    const totalInvoiceSum = managers.reduce((sum, row) => sum + row.invoiceSum, 0);
    const totalPayments = managers.reduce((sum, row) => sum + row.payments, 0);
    const totalRevenueEur = managers.reduce((sum, row) => sum + row.paymentSumEur, 0);

    const controlRows: SheetRow[] = [
      [`СМЕНА СЕГОДНЯ · ${day}`],
      [`Обновлено: ${syncedAt} (Europe/Riga)`],
      [],
      ["Лиды", "", "Счета · €", "", "Оплаты · €", "", "Ср. чек", ""],
      [
        totalLeads,
        "",
        totalInvoices,
        "",
        totalPayments,
        "",
        avgCheckLabel(totalRevenueEur, totalPayments),
        ""
      ],
      ["", "", money(totalInvoiceSum), "", money(totalRevenueEur), "", "", ""],
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
        row.leads,
        row.statusCounts.NEW || 0,
        row.statusCounts.IN_PROCESS || 0,
        row.statusCounts.CONVERTED || 0,
        row.invoices,
        money(row.invoiceSum),
        row.productsInInvoices,
        row.productsPerPayment == null ? "—" : money(row.productsPerPayment),
        row.payments,
        money(row.paymentSumEur),
        row.avgCheckEur == null ? "—" : money(row.avgCheckEur)
      ]);
    }
    await writeSheetTab({
      spreadsheetId,
      tabTitle: SHIFT_BOARD_CONTROL_TAB,
      rows: controlRows,
      clearRange: `'${SHIFT_BOARD_CONTROL_TAB}'!A:Z`,
      valueInputOption: "USER_ENTERED"
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
      const managerSheet = buildManagerRows({
        day,
        syncedAt,
        fullName: manager.fullName,
        onShift: manager.onShift,
        leads: managerLeads,
        invoices: managerInvoices,
        payments: managerPayments,
        productCounts,
        fx
      });
      await writeSheetTab({
        spreadsheetId,
        tabTitle: manager.tabTitle,
        rows: managerSheet.rows,
        clearRange: `'${manager.tabTitle.replace(/'/g, "''")}'!A:Z`,
        valueInputOption: "USER_ENTERED"
      });
      const managerSheetId = await getSheetIdByTitle(spreadsheetId, manager.tabTitle);
      if (managerSheetId != null) {
        await formatManagerTab({
          spreadsheetId,
          sheetId: managerSheetId,
          layout: managerSheet
        });
      }
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
