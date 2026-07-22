import { parseSheetNumber } from "@/lib/os-sheets/sales-metric-defs";
import type { MariaDailyRow } from "@/lib/sales-os/maria-daily";
import { mariaHasPaidFact, mariaRowForDate } from "@/lib/sales-os/maria-daily";

/**
 * Predictive front — ROP alerts workbook:
 * https://docs.google.com/spreadsheets/d/1_bVqzLXOrIsV9A3UaD7UnRFPYp74FT4kXfw370Cx820
 * tab «Предиктивка продажи»
 *
 * Lag = outcomes. Lead = drivers.
 */

export const PREDICTIVE_SPREADSHEET_ID_DEFAULT = "1_bVqzLXOrIsV9A3UaD7UnRFPYp74FT4kXfw370Cx820";
export const PREDICTIVE_TAB_DEFAULT = "Предиктивка продажи";

export function getPredictiveSpreadsheetId(): string {
  return process.env.PREDICTIVE_SALES_SPREADSHEET_ID?.trim() || PREDICTIVE_SPREADSHEET_ID_DEFAULT;
}

export function getPredictiveTabTitle(): string {
  return process.env.PREDICTIVE_SALES_TAB?.trim() || PREDICTIVE_TAB_DEFAULT;
}

/** One week block: total column + Mon…Sun (0-based). */
export type PredictiveWeekBlock = {
  totalCol: number;
  dayCols: readonly [number, number, number, number, number, number, number];
};

export type PredictiveMonthLayout = {
  month: string;
  weekCount: number;
  weekBlocks: PredictiveWeekBlock[];
  monthCol: number;
};

/** First data column after metric label / plan|fact / month name. */
export const PREDICTIVE_FIRST_WEEK_COL = 3;
/** Columns per week: total + 7 days. */
export const PREDICTIVE_COLS_PER_WEEK = 8;

export const PREDICTIVE_HEADER_ROW = 2;
export const PREDICTIVE_DATE_ROW = 3;

/** How many Mon–Sun weeks touch the calendar month (usually 4 or 5). */
export function countCalendarWeeksInMonth(month: string): number {
  const start = mondayOnOrBefore(`${month}-01`);
  let weeks = 0;
  let cursor = start;
  for (let guard = 0; guard < 8; guard += 1) {
    const touchesMonth = [0, 1, 2, 3, 4, 5, 6].some((d) => isoAddDays(cursor, d).startsWith(month));
    if (!touchesMonth) break;
    weeks += 1;
    cursor = isoAddDays(cursor, 7);
  }
  return Math.max(weeks, 4);
}

export function buildWeekBlocks(weekCount: number): PredictiveWeekBlock[] {
  const blocks: PredictiveWeekBlock[] = [];
  for (let w = 0; w < weekCount; w += 1) {
    const totalCol = PREDICTIVE_FIRST_WEEK_COL + w * PREDICTIVE_COLS_PER_WEEK;
    blocks.push({
      totalCol,
      dayCols: [
        totalCol + 1,
        totalCol + 2,
        totalCol + 3,
        totalCol + 4,
        totalCol + 5,
        totalCol + 6,
        totalCol + 7
      ]
    });
  }
  return blocks;
}

export function monthColForWeekCount(weekCount: number): number {
  return PREDICTIVE_FIRST_WEEK_COL + weekCount * PREDICTIVE_COLS_PER_WEEK;
}

export function layoutForMonth(month: string): PredictiveMonthLayout {
  const weekCount = countCalendarWeeksInMonth(month);
  return {
    month,
    weekCount,
    weekBlocks: buildWeekBlocks(weekCount),
    monthCol: monthColForWeekCount(weekCount)
  };
}

/** @deprecated static 4-week layout — prefer layoutForMonth(month). */
export const PREDICTIVE_WEEK_BLOCKS = buildWeekBlocks(4);
/** @deprecated static month col for 4 weeks (AJ) — prefer layoutForMonth(month).monthCol. */
export const PREDICTIVE_MONTH_COL = monthColForWeekCount(4);

/**
 * Row map (1-based) — sales + micro-conversions + SLA.
 * Funnel: Lead → Deal → Invoice → Sale → Revenue.
 * SLA: dialogs / no-reply / stale / no-next / unpaid invoices.
 */
export const PREDICTIVE_METRICS = {
  revenue: { planRow: 4, factRow: 5, label: "Revenue", kind: "lag", style: "currency", rpName: "Выручка €" },
  sale: { planRow: 6, factRow: 7, label: "Sale", kind: "lag", style: "count", rpName: "Продажи" },
  aov: { planRow: 8, factRow: 9, label: "AOV", kind: "lag", style: "currency", rpName: "Ср. чек €" },
  leads: { planRow: 11, factRow: 12, label: "Leads", kind: "lead", style: "count", rpName: "Лиды" },
  deals: { planRow: 13, factRow: 14, label: "Deals", kind: "lead", style: "count", rpName: "Сделки" },
  invoices: { planRow: 15, factRow: 16, label: "Invoices", kind: "lead", style: "count", rpName: "Счета" },
  cr_l_deal: { planRow: 17, factRow: 18, label: "CR L → Deal", kind: "lead", style: "percent", rpName: "CR Лид→Сделка" },
  cr_deal_invoice: { planRow: 19, factRow: 20, label: "CR Deal → Inv", kind: "lead", style: "percent", rpName: "CR Сделка→Счёт" },
  cr_invoice_sale: { planRow: 21, factRow: 22, label: "CR Inv → Sale", kind: "lead", style: "percent", rpName: "CR Счёт→Продажа" },
  cr_l_sale: { planRow: 23, factRow: 24, label: "CR L → Sale", kind: "lead", style: "percent", rpName: "CR Лид→Продажа" },
  dialogs: { planRow: 26, factRow: 27, label: "Dialogs", kind: "sla", style: "count", rpName: "Диалоги" },
  no_reply_24h: { planRow: 28, factRow: 29, label: "No reply 24h", kind: "sla", style: "count", rpName: "Диалог без ответа" },
  stale_deals: { planRow: 30, factRow: 31, label: "Stale deals", kind: "sla", style: "count", rpName: "Зависшие сделки" },
  no_next_activity: { planRow: 32, factRow: 33, label: "No next act.", kind: "sla", style: "count", rpName: "Без след. активности" },
  unpaid_invoices: { planRow: 34, factRow: 35, label: "Unpaid inv.", kind: "sla", style: "count", rpName: "Счета без оплаты" }
} as const;

export type PredictiveMetricKey = keyof typeof PREDICTIVE_METRICS;

export const PREDICTIVE_SECTION_MICRO_ROW = 10;
export const PREDICTIVE_SECTION_SLA_ROW = 25;
export const PREDICTIVE_GRID_LAST_ROW = 35;

/** Written by sync into fact day cells. CR stay as sheet formulas. */
export const PREDICTIVE_AUTO_FACT_METRICS = [
  "revenue",
  "sale",
  "aov",
  "leads",
  "deals",
  "invoices",
  "dialogs",
  "no_reply_24h",
  "stale_deals",
  "no_next_activity",
  "unpaid_invoices"
] as const;
export type PredictiveAutoFactMetric = (typeof PREDICTIVE_AUTO_FACT_METRICS)[number];

export const PREDICTIVE_LAG_KEYS = (Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]).filter(
  (key) => PREDICTIVE_METRICS[key].kind === "lag"
);

export const PREDICTIVE_LEAD_KEYS = (Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]).filter(
  (key) => PREDICTIVE_METRICS[key].kind === "lead"
);

export const PREDICTIVE_SLA_KEYS = (Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]).filter(
  (key) => PREDICTIVE_METRICS[key].kind === "sla"
);

/** Alert queue tabs in the same ROP workbook (snapshot counts → as-of day). */
export const PREDICTIVE_ALERT_TABS = {
  noReply24h: "В диалоге без ответа сутки",
  unpaidInvoices: "Счета без оплаты"
} as const;

export function colLetter(index0: number): string {
  let n = index0 + 1;
  let out = "";
  while (n > 0) {
    n -= 1;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}

export function quoteTab(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

export function a1(tab: string, col0: number, row1: number): string {
  return `${quoteTab(tab)}!${colLetter(col0)}${row1}`;
}

export function isoAddDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOnOrBefore(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  const dow = d.getUTCDay();
  const back = dow === 0 ? 6 : dow - 1;
  return isoAddDays(iso, -back);
}

export function formatDisplayDate(iso: string): string {
  const [, m, day] = iso.split("-");
  return `${day}.${m}`;
}

export function parseDisplayDate(raw: string, monthHint: string): string | null {
  const text = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const serial = Number(text.replace(",", "."));
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000 && !text.includes(".")) {
    // Google Sheets serial day → UTC date (epoch 1899-12-30).
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const m = text.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const mon = m[2].padStart(2, "0");
  const year = m[3] || monthHint.slice(0, 4);
  return `${year}-${mon}-${day}`;
}

export type PredictiveDayColumn = {
  col: number;
  iso: string;
  weekIndex: number;
  dayIndex: number;
};

/** Mon–Sun columns for every calendar week that touches the month (4 or 5). */
export function buildMonthDayColumns(month: string): PredictiveDayColumn[] {
  const { weekBlocks } = layoutForMonth(month);
  const start = mondayOnOrBefore(`${month}-01`);
  const out: PredictiveDayColumn[] = [];
  for (let w = 0; w < weekBlocks.length; w += 1) {
    const block = weekBlocks[w];
    for (let d = 0; d < 7; d += 1) {
      out.push({
        col: block.dayCols[d],
        iso: isoAddDays(start, w * 7 + d),
        weekIndex: w,
        dayIndex: d
      });
    }
  }
  return out;
}

export function parsePredictiveDateColumns(values: string[][], monthHint: string): Map<string, number> {
  const { weekBlocks } = layoutForMonth(monthHint);
  const dateRow = values[PREDICTIVE_DATE_ROW - 1] || [];
  const map = new Map<string, number>();
  for (const block of weekBlocks) {
    for (const col of block.dayCols) {
      const iso = parseDisplayDate(dateRow[col] || "", monthHint);
      if (iso) map.set(iso, col);
    }
  }
  return map;
}

export function isPredictiveGridBootstrapped(values: string[][]): boolean {
  const label = String(values[PREDICTIVE_METRICS.revenue.planRow - 1]?.[0] || "").trim().toLowerCase();
  const dialogs = String(values[PREDICTIVE_METRICS.dialogs.planRow - 1]?.[0] || "").trim().toLowerCase();
  return (label.startsWith("revenue") || label.startsWith("выручка")) && dialogs.startsWith("dialog");
}

/** True when week count / МЕС column match the calendar for this month. */
export function isPredictiveLayoutCurrent(values: string[][], month: string): boolean {
  if (!isPredictiveGridBootstrapped(values)) return false;
  const { weekCount, monthCol } = layoutForMonth(month);
  const header = values[PREDICTIVE_HEADER_ROW - 1] || [];
  const mes = String(header[monthCol] || "").trim().toUpperCase();
  if (mes !== "МЕС") return false;
  let found = 0;
  for (const cell of header) {
    if (/^неделя\s+\d+/i.test(String(cell || "").trim())) found += 1;
  }
  return found === weekCount;
}

export function monthNameRu(month: string): string {
  const names = [
    "ЯНВАРЬ", "ФЕВРАЛЬ", "МАРТ", "АПРЕЛЬ", "МАЙ", "ИЮНЬ",
    "ИЮЛЬ", "АВГУСТ", "СЕНТЯБРЬ", "ОКТЯБРЬ", "НОЯБРЬ", "ДЕКАБРЬ"
  ];
  const idx = Number(month.slice(5, 7)) - 1;
  return names[idx] || month;
}

/**
 * Sales predictive template: Lag (выручка/продажи) + микроконверсии воронки.
 * Без маркетинга (Budget/Klicks/CPL/ROAS/CAC).
 */
export function buildTemplatePredictiveGrid(input: {
  month: string;
  planRevenue?: number | null;
  planSales?: number | null;
}): string[][] {
  const layout = layoutForMonth(input.month);
  const { weekBlocks, monthCol, weekCount } = layout;
  const width = monthCol + 1;
  const blank = () => Array.from({ length: width }, () => "");
  const rows: string[][] = Array.from({ length: PREDICTIVE_GRID_LAST_ROW }, () => blank());
  const days = buildMonthDayColumns(input.month);
  const weekdays = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
  const monthL = colLetter(monthCol);

  rows[0][0] = "Запаздывающие (продажи)";
  rows[0][2] = monthNameRu(input.month);
  rows[0][3] = "Месяц";

  for (let w = 0; w < weekBlocks.length; w += 1) {
    const block = weekBlocks[w];
    rows[1][block.totalCol] = `Неделя ${w + 1}`;
    rows[2][block.totalCol] = `Даты недели ${w + 1}`;
    for (let d = 0; d < 7; d += 1) {
      rows[1][block.dayCols[d]] = weekdays[d];
      rows[2][block.dayCols[d]] = formatDisplayDate(days[w * 7 + d].iso);
    }
  }
  rows[1][monthCol] = "МЕС";

  rows[PREDICTIVE_SECTION_MICRO_ROW - 1][0] = "Микроконверсии (воронка)";
  rows[PREDICTIVE_SECTION_SLA_ROW - 1][0] = "SLA / качество";

  const place = (key: PredictiveMetricKey) => {
    const meta = PREDICTIVE_METRICS[key];
    rows[meta.planRow - 1][0] = meta.label;
    rows[meta.planRow - 1][1] = "план";
    rows[meta.factRow - 1][1] = "факт";
  };

  const splitPlan = (planRow: number, monthValue: string) => {
    const plan = rows[planRow - 1];
    if (monthValue) plan[monthCol] = monthValue;
    for (const block of weekBlocks) {
      const weekL = colLetter(block.totalCol);
      if (monthValue) {
        plan[block.totalCol] = `=${monthL}${planRow}/${weekCount}`;
        for (const col of block.dayCols) plan[col] = `=${weekL}${planRow}/7`;
      }
    }
  };

  const sumFact = (factRow: number) => {
    const fact = rows[factRow - 1];
    for (const block of weekBlocks) {
      const a = colLetter(block.dayCols[0]);
      const b = colLetter(block.dayCols[6]);
      fact[block.totalCol] = `=SUM(${a}${factRow}:${b}${factRow})`;
    }
    fact[monthCol] = `=${weekBlocks.map((b) => `${colLetter(b.totalCol)}${factRow}`).join("+")}`;
  };

  const ratioAll = (row1: number, numRow: number, denRow: number) => {
    const row = rows[row1 - 1];
    for (const block of weekBlocks) {
      for (const col of [...block.dayCols, block.totalCol]) {
        const L = colLetter(col);
        row[col] = `=IFERROR(${L}${numRow}/${L}${denRow};"")`;
      }
    }
    row[monthCol] = `=IFERROR(${monthL}${numRow}/${monthL}${denRow};"")`;
  };

  for (const key of Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]) place(key);

  const rev = input.planRevenue != null && Number.isFinite(input.planRevenue) ? String(input.planRevenue) : "";
  const sales = input.planSales != null && Number.isFinite(input.planSales) ? String(input.planSales) : "";
  splitPlan(PREDICTIVE_METRICS.revenue.planRow, rev);
  splitPlan(PREDICTIVE_METRICS.sale.planRow, sales);
  splitPlan(PREDICTIVE_METRICS.leads.planRow, "");
  splitPlan(PREDICTIVE_METRICS.deals.planRow, "");
  splitPlan(PREDICTIVE_METRICS.invoices.planRow, "");
  for (const key of PREDICTIVE_SLA_KEYS) {
    if (PREDICTIVE_METRICS[key].style === "count") splitPlan(PREDICTIVE_METRICS[key].planRow, "");
  }

  sumFact(PREDICTIVE_METRICS.revenue.factRow);
  sumFact(PREDICTIVE_METRICS.sale.factRow);
  sumFact(PREDICTIVE_METRICS.leads.factRow);
  sumFact(PREDICTIVE_METRICS.deals.factRow);
  sumFact(PREDICTIVE_METRICS.invoices.factRow);
  sumFact(PREDICTIVE_METRICS.dialogs.factRow);
  sumFact(PREDICTIVE_METRICS.no_reply_24h.factRow);
  sumFact(PREDICTIVE_METRICS.stale_deals.factRow);
  sumFact(PREDICTIVE_METRICS.no_next_activity.factRow);
  sumFact(PREDICTIVE_METRICS.unpaid_invoices.factRow);

  ratioAll(PREDICTIVE_METRICS.aov.planRow, PREDICTIVE_METRICS.revenue.planRow, PREDICTIVE_METRICS.sale.planRow);
  {
    const factRow = PREDICTIVE_METRICS.aov.factRow;
    const fact = rows[factRow - 1];
    for (const block of weekBlocks) {
      const L = colLetter(block.totalCol);
      fact[block.totalCol] = `=IFERROR(${L}${PREDICTIVE_METRICS.revenue.factRow}/${L}${PREDICTIVE_METRICS.sale.factRow};"")`;
    }
    fact[monthCol] = `=IFERROR(${monthL}${PREDICTIVE_METRICS.revenue.factRow}/${monthL}${PREDICTIVE_METRICS.sale.factRow};"")`;
  }

  ratioAll(PREDICTIVE_METRICS.cr_l_deal.planRow, PREDICTIVE_METRICS.deals.planRow, PREDICTIVE_METRICS.leads.planRow);
  ratioAll(PREDICTIVE_METRICS.cr_l_deal.factRow, PREDICTIVE_METRICS.deals.factRow, PREDICTIVE_METRICS.leads.factRow);
  ratioAll(PREDICTIVE_METRICS.cr_deal_invoice.planRow, PREDICTIVE_METRICS.invoices.planRow, PREDICTIVE_METRICS.deals.planRow);
  ratioAll(PREDICTIVE_METRICS.cr_deal_invoice.factRow, PREDICTIVE_METRICS.invoices.factRow, PREDICTIVE_METRICS.deals.factRow);
  ratioAll(PREDICTIVE_METRICS.cr_invoice_sale.planRow, PREDICTIVE_METRICS.sale.planRow, PREDICTIVE_METRICS.invoices.planRow);
  ratioAll(PREDICTIVE_METRICS.cr_invoice_sale.factRow, PREDICTIVE_METRICS.sale.factRow, PREDICTIVE_METRICS.invoices.factRow);
  ratioAll(PREDICTIVE_METRICS.cr_l_sale.planRow, PREDICTIVE_METRICS.sale.planRow, PREDICTIVE_METRICS.leads.planRow);
  ratioAll(PREDICTIVE_METRICS.cr_l_sale.factRow, PREDICTIVE_METRICS.sale.factRow, PREDICTIVE_METRICS.leads.factRow);

  return rows;
}

/** @deprecated alias */
export const buildCleanPredictiveGrid = buildTemplatePredictiveGrid;

/** Date row updates only (never touches plan/fact metrics). */
export function buildDateRowUpdates(input: {
  tabTitle: string;
  month: string;
  existingValues: string[][];
}): { range: string; values: string[][] } | null {
  const { weekBlocks, monthCol } = layoutForMonth(input.month);
  const days = buildMonthDayColumns(input.month);
  const dateRow = [...(input.existingValues[PREDICTIVE_DATE_ROW - 1] || [])];
  while (dateRow.length <= monthCol) dateRow.push("");

  let changed = false;
  for (const day of days) {
    const next = formatDisplayDate(day.iso);
    if (String(dateRow[day.col] || "").trim() !== next) {
      dateRow[day.col] = next;
      changed = true;
    }
  }
  for (let w = 0; w < weekBlocks.length; w += 1) {
    const col = weekBlocks[w].totalCol;
    const label = `Даты недели ${w + 1}`;
    if (String(dateRow[col] || "").trim() !== label) {
      dateRow[col] = label;
      changed = true;
    }
  }
  if (!changed) return null;
  return {
    range: `${quoteTab(input.tabTitle)}!A${PREDICTIVE_DATE_ROW}:${colLetter(monthCol)}${PREDICTIVE_DATE_ROW}`,
    values: [dateRow.slice(0, monthCol + 1)]
  };
}

/** Keep metric labels short (no dual English · Russian titles). */
export function buildMetricLabelUpdates(tabTitle: string): Array<{ range: string; values: string[][] }> {
  return (Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]).map((key) => {
    const meta = PREDICTIVE_METRICS[key];
    return {
      range: a1(tabTitle, 0, meta.planRow),
      values: [[meta.label]]
    };
  });
}

export type SystemDayAgg = {
  leads: number;
  deals: number;
  payments: number;
  revenue: number;
  invoices: number;
  dialogs: number;
  stale_deals: number;
  no_next_activity: number;
};

export function aggregateSystemDailyFact(
  dailyFact: Array<Record<string, string>>,
  date: string
): SystemDayAgg {
  let leads = 0;
  let deals = 0;
  let payments = 0;
  let revenue = 0;
  let invoices = 0;
  let dialogs = 0;
  let stale_deals = 0;
  let no_next_activity = 0;
  for (const row of dailyFact) {
    if (String(row.date || "").slice(0, 10) !== date) continue;
    leads += parseSheetNumber(row.leads);
    deals += parseSheetNumber(row.deals_created);
    payments += parseSheetNumber(row.payments);
    revenue += parseSheetNumber(row.revenue);
    invoices += parseSheetNumber(row.invoices);
    dialogs += parseSheetNumber(row.dialogs);
    stale_deals += parseSheetNumber(row.stale_deals);
    no_next_activity += parseSheetNumber(row.deals_without_next_activity);
  }
  return { leads, deals, payments, revenue, invoices, dialogs, stale_deals, no_next_activity };
}

export type AlertSlaSnapshot = {
  asOfDate: string;
  no_reply_24h: number;
  unpaid_invoices: number;
};

export function countDataRows(values: string[][]): number {
  return values.slice(1).filter((row) => String(row[0] ?? "").trim() !== "").length;
}

export type DayFactValues = Partial<Record<PredictiveAutoFactMetric, number | null>> & {
  source: "maria" | "system" | "mixed" | "alerts";
};

export function resolveDayFacts(input: {
  date: string;
  mariaDaily: MariaDailyRow[];
  mariaSnapshot?: Array<{ key?: string; value?: string }>;
  dailyFact: Array<Record<string, string>>;
  alertSla?: AlertSlaSnapshot | null;
}): DayFactValues {
  const snap = Object.fromEntries(
    (input.mariaSnapshot || []).map((row) => [String(row.key || "").trim(), String(row.value || "").trim()])
  );
  const maria = mariaRowForDate(input.mariaDaily, input.date);
  const system = aggregateSystemDailyFact(input.dailyFact, input.date);
  const reportDate = snap.report_date || "";

  let revenue: number | null = null;
  let sale: number | null = null;
  let source: DayFactValues["source"] = "system";

  if (mariaHasPaidFact(maria)) {
    revenue = parseSheetNumber(maria!.paid_total_amount);
    sale = parseSheetNumber(maria!.paid_total_count);
    source = "maria";
  } else if (system.payments > 0 || system.revenue > 0) {
    revenue = system.revenue;
    sale = system.payments;
    source = "system";
  }

  let leads: number | null = null;
  if (reportDate === input.date) {
    const t = parseSheetNumber(snap.yesterday_traffic_leads);
    const o = parseSheetNumber(snap.yesterday_organic_leads);
    if (snap.yesterday_traffic_leads || snap.yesterday_organic_leads) {
      leads = t + o;
      source = source === "system" ? "mixed" : source;
    }
  }
  if (leads == null && system.leads > 0) leads = system.leads;

  let invoices: number | null = null;
  if (maria && String(maria.invoices_count || "").trim() !== "") {
    invoices = parseSheetNumber(maria.invoices_count);
    source = source === "system" ? "mixed" : source === "maria" ? "maria" : "mixed";
  } else if (system.invoices > 0) {
    invoices = system.invoices;
  }

  let deals: number | null = null;
  if (system.deals > 0) {
    deals = system.deals;
    if (source === "maria") source = "mixed";
  }

  let aov: number | null = null;
  if (revenue != null && sale != null && sale > 0) {
    aov = Number((revenue / sale).toFixed(2));
  } else if (reportDate === input.date && snap.yesterday_avg_check) {
    aov = parseSheetNumber(snap.yesterday_avg_check);
  }

  const hasSystemDay = input.dailyFact.some((row) => String(row.date || "").slice(0, 10) === input.date);
  const dialogs = hasSystemDay ? system.dialogs : null;
  const stale_deals = hasSystemDay ? system.stale_deals : null;
  const no_next_activity = hasSystemDay ? system.no_next_activity : null;

  let no_reply_24h: number | null = null;
  let unpaid_invoices: number | null = null;
  if (input.alertSla && input.alertSla.asOfDate === input.date) {
    no_reply_24h = input.alertSla.no_reply_24h;
    unpaid_invoices = input.alertSla.unpaid_invoices;
    if (source === "system" || source === "maria") source = "mixed";
  }

  return {
    revenue,
    sale,
    leads,
    deals,
    invoices,
    aov,
    dialogs,
    stale_deals,
    no_next_activity,
    no_reply_24h,
    unpaid_invoices,
    source
  };
}

export type SheetCellUpdate = {
  range: string;
  values: Array<Array<string | number>>;
};

/** Sparse fact-day updates only — never plan rows, never week/month totals. */
export function buildFactCellUpdates(input: {
  tabTitle: string;
  dateToCol: Map<string, number>;
  factsByDate: Map<string, DayFactValues>;
}): SheetCellUpdate[] {
  const updates: SheetCellUpdate[] = [];
  for (const [date, facts] of input.factsByDate) {
    const col = input.dateToCol.get(date);
    if (col == null) continue;
    for (const key of PREDICTIVE_AUTO_FACT_METRICS) {
      const value = facts[key];
      if (value == null || !Number.isFinite(value)) continue;
      updates.push({
        range: a1(input.tabTitle, col, PREDICTIVE_METRICS[key].factRow),
        values: [[value]]
      });
    }
  }
  return updates;
}

export function collectFactsForMonth(input: {
  month: string;
  mariaDaily: MariaDailyRow[];
  mariaSnapshot?: Array<{ key?: string; value?: string }>;
  dailyFact: Array<Record<string, string>>;
  alertSla?: AlertSlaSnapshot | null;
}): Map<string, DayFactValues> {
  const dates = new Set<string>();
  for (const row of input.mariaDaily) {
    if (row.date.startsWith(input.month)) dates.add(row.date);
  }
  for (const row of input.dailyFact) {
    const d = String(row.date || "").slice(0, 10);
    if (d.startsWith(input.month)) dates.add(d);
  }
  const snapDate = (input.mariaSnapshot || []).find((r) => r.key === "report_date")?.value;
  if (snapDate && String(snapDate).startsWith(input.month)) dates.add(String(snapDate));
  if (input.alertSla?.asOfDate?.startsWith(input.month)) dates.add(input.alertSla.asOfDate);

  const out = new Map<string, DayFactValues>();
  for (const date of [...dates].sort()) {
    const facts = resolveDayFacts({
      date,
      mariaDaily: input.mariaDaily,
      mariaSnapshot: input.mariaSnapshot,
      dailyFact: input.dailyFact,
      alertSla: input.alertSla
    });
    const hasAny = PREDICTIVE_AUTO_FACT_METRICS.some(
      (k) => facts[k] != null && Number.isFinite(facts[k] as number)
    );
    if (hasAny) out.set(date, facts);
  }
  return out;
}
