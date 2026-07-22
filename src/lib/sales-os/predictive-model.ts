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
 * Row map (1-based) — plan / fact / PTF% (run-rate) per metric.
 * Funnel: Lead → Deal → Invoice → Sale → Revenue.
 *
 * polarity: higher_better → green when fact≥plan; lower_better → green when fact≤plan.
 * PTF% = at current pace, projected % of plan for the period (day/week/month).
 */
export const PREDICTIVE_METRICS = {
  revenue: { planRow: 4, factRow: 5, ptfRow: 6, label: "Revenue", kind: "lag", style: "currency", polarity: "higher_better", rpName: "Выручка €" },
  sale: { planRow: 7, factRow: 8, ptfRow: 9, label: "Sale", kind: "lag", style: "count", polarity: "higher_better", rpName: "Продажи" },
  aov: { planRow: 10, factRow: 11, ptfRow: 12, label: "AOV", kind: "lag", style: "currency", polarity: "higher_better", rpName: "Ср. чек €" },
  leads: { planRow: 14, factRow: 15, ptfRow: 16, label: "Leads", kind: "lead", style: "count", polarity: "higher_better", rpName: "Лиды" },
  deals: { planRow: 17, factRow: 18, ptfRow: 19, label: "Deals", kind: "lead", style: "count", polarity: "higher_better", rpName: "Сделки" },
  invoices: { planRow: 20, factRow: 21, ptfRow: 22, label: "Invoices", kind: "lead", style: "count", polarity: "higher_better", rpName: "Счета" },
  cr_l_deal: { planRow: 23, factRow: 24, ptfRow: 25, label: "CR L → Deal", kind: "lead", style: "percent", polarity: "higher_better", rpName: "CR Лид→Сделка" },
  cr_deal_invoice: { planRow: 26, factRow: 27, ptfRow: 28, label: "CR Deal → Inv", kind: "lead", style: "percent", polarity: "higher_better", rpName: "CR Сделка→Счёт" },
  cr_invoice_sale: { planRow: 29, factRow: 30, ptfRow: 31, label: "CR Inv → Sale", kind: "lead", style: "percent", polarity: "higher_better", rpName: "CR Счёт→Продажа" },
  cr_l_sale: { planRow: 32, factRow: 33, ptfRow: 34, label: "CR L → Sale", kind: "lead", style: "percent", polarity: "higher_better", rpName: "CR Лид→Продажа" }
} as const;

export type PredictiveMetricKey = keyof typeof PREDICTIVE_METRICS;
export type PredictivePolarity = "higher_better" | "lower_better";
export type TrafficLight = "green" | "yellow" | "red" | "none";

/** Pace vs plan: green ≥100%, yellow 90–99%, red <90% (inverted for lower_better). */
export const TRAFFIC_YELLOW_MIN_RATIO = 0.9;
export const TRAFFIC_YELLOW_MAX_RATIO_LOWER = 1.1;

export function classifyTrafficLight(input: {
  fact: number | null | undefined;
  plan: number | null | undefined;
  polarity: PredictivePolarity;
}): TrafficLight {
  const fact = input.fact;
  const plan = input.plan;
  if (fact == null || plan == null || !Number.isFinite(fact) || !Number.isFinite(plan) || plan === 0) {
    return "none";
  }
  const ratio = fact / plan;
  if (input.polarity === "higher_better") {
    if (ratio >= 1) return "green";
    if (ratio >= TRAFFIC_YELLOW_MIN_RATIO) return "yellow";
    return "red";
  }
  if (ratio <= 1) return "green";
  if (ratio <= TRAFFIC_YELLOW_MAX_RATIO_LOWER) return "yellow";
  return "red";
}

/**
 * Projected % of plan at current pace.
 * counts: (fact/plan)*(periodDays/elapsedDays)*100
 * rates (CR/AOV): fact/plan*100 (no time scale)
 */
export function runRatePct(input: {
  fact: number | null | undefined;
  plan: number | null | undefined;
  elapsedDays: number;
  periodDays: number;
  timeScale: boolean;
}): number | null {
  const fact = input.fact;
  const plan = input.plan;
  if (fact == null || plan == null || !Number.isFinite(fact) || !Number.isFinite(plan) || plan === 0) {
    return null;
  }
  if (!input.timeScale) {
    return Number(((fact / plan) * 100).toFixed(1));
  }
  if (!(input.elapsedDays > 0) || !(input.periodDays > 0)) return null;
  return Number(((fact / plan) * (input.periodDays / input.elapsedDays) * 100).toFixed(1));
}

export function daysInCalendarMonth(month: string): number {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export const PREDICTIVE_SECTION_MICRO_ROW = 13;
export const PREDICTIVE_GRID_LAST_ROW = 34;
/** Day-of-month used by PTF run-rate formulas (written each sync). */
export const PREDICTIVE_ASOF_DAY_ROW = 35;

/** Written by sync into fact day cells. CR stay as sheet formulas. */
export const PREDICTIVE_AUTO_FACT_METRICS = [
  "revenue",
  "sale",
  "aov",
  "leads",
  "deals",
  "invoices"
] as const;
export type PredictiveAutoFactMetric = (typeof PREDICTIVE_AUTO_FACT_METRICS)[number];

export const PREDICTIVE_LAG_KEYS = (Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]).filter(
  (key) => PREDICTIVE_METRICS[key].kind === "lag"
);

export const PREDICTIVE_LEAD_KEYS = (Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]).filter(
  (key) => PREDICTIVE_METRICS[key].kind === "lead"
);

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

/** Week total column label: Mon–Sun range, e.g. `29.06–05.07`. */
export function formatWeekDateRangeLabel(weekIsos: string[]): string {
  if (!weekIsos.length) return "";
  const first = formatDisplayDate(weekIsos[0]);
  const last = formatDisplayDate(weekIsos[weekIsos.length - 1]);
  return first === last ? first : `${first}–${last}`;
}

/** Text for Sheets so USER_ENTERED does not turn 01.07 into a date serial. */
export function formatSheetDateLabel(iso: string): string {
  return `'${formatDisplayDate(iso)}`;
}

export function parseDisplayDate(raw: string, monthHint: string): string | null {
  const text = String(raw || "").trim().replace(/^'/, "");
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
  const leads = String(values[PREDICTIVE_METRICS.leads.planRow - 1]?.[0] || "").trim().toLowerCase();
  const ptf = String(values[PREDICTIVE_METRICS.revenue.ptfRow - 1]?.[1] || "").trim().toLowerCase();
  return (
    (label.startsWith("revenue") || label.startsWith("выручка")) &&
    leads.startsWith("lead") &&
    (ptf.startsWith("прогноз") || ptf.startsWith("ptf") || ptf.startsWith("run"))
  );
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
export function buildPtfWeekFormula(input: {
  factRef: string;
  planRef: string;
  periodDays: number;
  startDay: number;
  endDay: number;
  asOfCell?: string;
  timeScale: boolean;
}): string {
  const asOf = input.asOfCell || `$A$${PREDICTIVE_ASOF_DAY_ROW}`;
  const onlyCurrent = `AND(${asOf}>=${input.startDay};${asOf}<=${input.endDay})`;
  const body = input.timeScale
    ? `${input.factRef}/${input.planRef}*${input.periodDays}/MAX(1;MIN(${input.periodDays};${asOf}-${input.startDay}+1))`
    : `${input.factRef}/${input.planRef}`;
  return `=IFERROR(IF(${onlyCurrent};${body};"");"")`;
}

export function buildPtfMonthFormula(input: {
  factRef: string;
  planRef: string;
  daysInMonth: number;
  asOfCell?: string;
  timeScale: boolean;
}): string {
  const asOf = input.asOfCell || `$A$${PREDICTIVE_ASOF_DAY_ROW}`;
  if (input.timeScale) {
    return `=IFERROR(${input.factRef}/${input.planRef}*${input.daysInMonth}/MAX(1;MIN(${input.daysInMonth};${asOf}));"")`;
  }
  return `=IFERROR(${input.factRef}/${input.planRef};"")`;
}

/** One row of PTF formulas (index = sheet column). Days empty; only current week + МЕС. */
export function buildPtfFormulasForMetric(input: {
  month: string;
  key: PredictiveMetricKey;
}): string[] {
  const layout = layoutForMonth(input.month);
  const { weekBlocks, monthCol } = layout;
  const meta = PREDICTIVE_METRICS[input.key];
  const days = buildMonthDayColumns(input.month);
  const monthL = colLetter(monthCol);
  const timeScale = meta.style !== "percent" && input.key !== "aov";
  const dim = daysInCalendarMonth(input.month);
  const out = Array.from({ length: monthCol + 1 }, () => "");
  out[1] = "прогноз";

  for (let w = 0; w < weekBlocks.length; w += 1) {
    const block = weekBlocks[w];
    const weekIsos = days.slice(w * 7, w * 7 + 7).filter((day) => day.iso.startsWith(input.month));
    if (!weekIsos.length) continue;
    const period = weekIsos.length;
    const startDay = Number(weekIsos[0].iso.slice(8, 10));
    const endDay = Number(weekIsos[weekIsos.length - 1].iso.slice(8, 10));
    const wL = colLetter(block.totalCol);
    out[block.totalCol] = buildPtfWeekFormula({
      factRef: `${wL}${meta.factRow}`,
      planRef: `${wL}${meta.planRow}`,
      periodDays: period,
      startDay,
      endDay,
      timeScale
    });
  }

  out[monthCol] = buildPtfMonthFormula({
    factRef: `${monthL}${meta.factRow}`,
    planRef: `${monthL}${meta.planRow}`,
    daysInMonth: dim,
    timeScale
  });
  return out;
}

/** Sparse updates to refresh прогноз formulas without full bootstrap. */
export function buildPtfCellUpdates(input: {
  tabTitle: string;
  month: string;
}): SheetCellUpdate[] {
  const { monthCol } = layoutForMonth(input.month);
  const updates: SheetCellUpdate[] = [];
  for (const key of Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]) {
    const meta = PREDICTIVE_METRICS[key];
    const formulas = buildPtfFormulasForMetric({ month: input.month, key });
    updates.push({
      range: `${quoteTab(input.tabTitle)}!A${meta.ptfRow}:${colLetter(monthCol)}${meta.ptfRow}`,
      values: [formulas]
    });
  }
  return updates;
}

export function buildTemplatePredictiveGrid(input: {
  month: string;
  planRevenue?: number | null;
  planSales?: number | null;
  planLeads?: number | null;
  planDeals?: number | null;
  planInvoices?: number | null;
}): string[][] {
  const layout = layoutForMonth(input.month);
  const { weekBlocks, monthCol, weekCount } = layout;
  const width = monthCol + 1;
  const blank = () => Array.from({ length: width }, () => "");
  const rows: string[][] = Array.from({ length: PREDICTIVE_ASOF_DAY_ROW }, () => blank());
  const days = buildMonthDayColumns(input.month);
  const weekdays = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
  const monthL = colLetter(monthCol);

  rows[0][0] = "Запаздывающие (продажи)";
  rows[0][2] = monthNameRu(input.month);
  rows[0][3] = "Месяц";

  for (let w = 0; w < weekBlocks.length; w += 1) {
    const block = weekBlocks[w];
    rows[1][block.totalCol] = `Неделя ${w + 1}`;
    const weekIsos = days.slice(w * 7, w * 7 + 7).map((d) => d.iso);
    rows[2][block.totalCol] = formatWeekDateRangeLabel(weekIsos);
    for (let d = 0; d < 7; d += 1) {
      rows[1][block.dayCols[d]] = weekdays[d];
      rows[2][block.dayCols[d]] = formatSheetDateLabel(days[w * 7 + d].iso);
    }
  }
  rows[1][monthCol] = "МЕС";

  rows[PREDICTIVE_SECTION_MICRO_ROW - 1][0] = "Микроконверсии (воронка)";

  const place = (key: PredictiveMetricKey) => {
    const meta = PREDICTIVE_METRICS[key];
    rows[meta.planRow - 1][0] = meta.label;
    rows[meta.planRow - 1][1] = "план";
    rows[meta.factRow - 1][1] = "факт";
    rows[meta.ptfRow - 1][1] = "прогноз";
  };

  /** Always install week/day split formulas; month value optional. */
  const splitPlan = (planRow: number, monthValue: string) => {
    const plan = rows[planRow - 1];
    if (monthValue) plan[monthCol] = monthValue;
    for (const block of weekBlocks) {
      const weekL = colLetter(block.totalCol);
      plan[block.totalCol] = `=${monthL}${planRow}/${weekCount}`;
      for (const col of block.dayCols) plan[col] = `=${weekL}${planRow}/7`;
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

  /** PTF%: only current week + МЕС. Closed weeks / day cells stay empty (no fake run-rate). */
  const installPtf = (key: PredictiveMetricKey) => {
    const meta = PREDICTIVE_METRICS[key];
    const ptf = rows[meta.ptfRow - 1];
    const formulas = buildPtfFormulasForMetric({ month: input.month, key });
    for (let col = 0; col < formulas.length; col += 1) ptf[col] = formulas[col] || "";
  };

  for (const key of Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]) place(key);

  const asPlan = (n: number | null | undefined) =>
    n != null && Number.isFinite(n) ? String(n) : "";

  splitPlan(PREDICTIVE_METRICS.revenue.planRow, asPlan(input.planRevenue));
  splitPlan(PREDICTIVE_METRICS.sale.planRow, asPlan(input.planSales));
  splitPlan(PREDICTIVE_METRICS.leads.planRow, asPlan(input.planLeads));
  splitPlan(PREDICTIVE_METRICS.deals.planRow, asPlan(input.planDeals));
  splitPlan(PREDICTIVE_METRICS.invoices.planRow, asPlan(input.planInvoices));

  sumFact(PREDICTIVE_METRICS.revenue.factRow);
  sumFact(PREDICTIVE_METRICS.sale.factRow);
  sumFact(PREDICTIVE_METRICS.leads.factRow);
  sumFact(PREDICTIVE_METRICS.deals.factRow);
  sumFact(PREDICTIVE_METRICS.invoices.factRow);

  ratioAll(PREDICTIVE_METRICS.aov.planRow, PREDICTIVE_METRICS.revenue.planRow, PREDICTIVE_METRICS.sale.planRow);
  {
    const factRow = PREDICTIVE_METRICS.aov.factRow;
    const fact = rows[factRow - 1];
    for (const block of weekBlocks) {
      const L = colLetter(block.totalCol);
      fact[block.totalCol] = `=IFERROR(${L}${PREDICTIVE_METRICS.revenue.factRow}/${L}${PREDICTIVE_METRICS.sale.factRow};"")`;
      for (const col of block.dayCols) {
        const dL = colLetter(col);
        fact[col] = `=IFERROR(${dL}${PREDICTIVE_METRICS.revenue.factRow}/${dL}${PREDICTIVE_METRICS.sale.factRow};"")`;
      }
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

  for (const key of Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]) installPtf(key);

  rows[PREDICTIVE_ASOF_DAY_ROW - 1][0] = "1";
  rows[PREDICTIVE_ASOF_DAY_ROW - 1][1] = "as_of_day";

  return rows;
}

/** Metrics whose МЕС plan is overwritten on every sync (СВОД + derived Deals). */
export const PREDICTIVE_SVOD_PLAN_METRICS = ["revenue", "sale", "leads", "deals", "invoices"] as const;
export type PredictiveSvodPlanMetric = (typeof PREDICTIVE_SVOD_PLAN_METRICS)[number];

/**
 * Deals plan needed to hit invoice plan at current Deal→Invoice CR.
 * deals = ceil(planInvoices / (invoicesFact / dealsFact))
 */
export function deriveDealsPlanForInvoices(input: {
  planInvoices: number | null | undefined;
  dealsFact: number;
  invoicesFact: number;
}): number | null {
  const planInv = input.planInvoices;
  if (planInv == null || !(planInv > 0)) return null;
  if (!(input.dealsFact > 0 && input.invoicesFact > 0)) return null;
  const cr = input.invoicesFact / input.dealsFact;
  if (!(cr > 0) || !Number.isFinite(cr)) return null;
  return Math.ceil(planInv / cr);
}

/** Upsert МЕС plan values + week/day split formulas (never touches fact rows). */
export function buildPlanMonthUpdates(input: {
  tabTitle: string;
  month: string;
  plans: Partial<Record<PredictiveSvodPlanMetric, number | null | undefined>>;
}): SheetCellUpdate[] {
  const { weekBlocks, monthCol, weekCount } = layoutForMonth(input.month);
  const monthL = colLetter(monthCol);
  const updates: SheetCellUpdate[] = [];

  for (const key of PREDICTIVE_SVOD_PLAN_METRICS) {
    const value = input.plans[key];
    if (value == null || !Number.isFinite(value)) continue;
    const planRow = PREDICTIVE_METRICS[key].planRow;
    updates.push({
      range: a1(input.tabTitle, monthCol, planRow),
      values: [[value]]
    });
    for (const block of weekBlocks) {
      updates.push({
        range: a1(input.tabTitle, block.totalCol, planRow),
        values: [[`=${monthL}${planRow}/${weekCount}`]]
      });
      for (const col of block.dayCols) {
        updates.push({
          range: a1(input.tabTitle, col, planRow),
          values: [[`=${colLetter(block.totalCol)}${planRow}/7`]]
        });
      }
    }
  }
  return updates;
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
    const current = String(dateRow[day.col] || "").trim().replace(/^'/, "");
    const currentIso = parseDisplayDate(current, input.month);
    if (currentIso !== day.iso && current !== next) {
      dateRow[day.col] = next;
      changed = true;
    }
  }
  for (let w = 0; w < weekBlocks.length; w += 1) {
    const col = weekBlocks[w].totalCol;
    const weekIsos = days.slice(w * 7, w * 7 + 7).map((d) => d.iso);
    const label = formatWeekDateRangeLabel(weekIsos);
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
  for (const row of dailyFact) {
    if (String(row.date || "").slice(0, 10) !== date) continue;
    leads += parseSheetNumber(row.leads);
    deals += parseSheetNumber(row.deals_created);
    payments += parseSheetNumber(row.payments);
    revenue += parseSheetNumber(row.revenue);
    invoices += parseSheetNumber(row.invoices);
  }
  return { leads, deals, payments, revenue, invoices };
}

export type DayFactValues = Partial<Record<PredictiveAutoFactMetric, number | null>> & {
  source: "maria" | "system" | "mixed" | "svod";
};

export function resolveDayFacts(input: {
  date: string;
  mariaDaily: MariaDailyRow[];
  mariaSnapshot?: Array<{ key?: string; value?: string }>;
  dailyFact: Array<Record<string, string>>;
  svodLeadsByDate?: Map<string, { paid: number; organic: number; total: number }> | null;
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

  // Leads: СВОД `day` (paid CRM) + `Органика` (CRM) — preferred over Bitrix duplicates.
  let leads: number | null = null;
  if (input.svodLeadsByDate?.has(input.date)) {
    leads = input.svodLeadsByDate.get(input.date)!.total;
    source = source === "maria" ? "mixed" : source === "system" ? "svod" : source;
  } else if (reportDate === input.date) {
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

  return {
    revenue,
    sale,
    leads,
    deals,
    invoices,
    aov,
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
  svodLeadsByDate?: Map<string, { paid: number; organic: number; total: number }> | null;
}): Map<string, DayFactValues> {
  const dates = new Set<string>();
  for (const row of input.mariaDaily) {
    if (row.date.startsWith(input.month)) dates.add(row.date);
  }
  for (const row of input.dailyFact) {
    const d = String(row.date || "").slice(0, 10);
    if (d.startsWith(input.month)) dates.add(d);
  }
  if (input.svodLeadsByDate) {
    for (const d of input.svodLeadsByDate.keys()) {
      if (d.startsWith(input.month)) dates.add(d);
    }
  }
  const snapDate = (input.mariaSnapshot || []).find((r) => r.key === "report_date")?.value;
  if (snapDate && String(snapDate).startsWith(input.month)) dates.add(String(snapDate));

  const out = new Map<string, DayFactValues>();
  for (const date of [...dates].sort()) {
    const facts = resolveDayFacts({
      date,
      mariaDaily: input.mariaDaily,
      mariaSnapshot: input.mariaSnapshot,
      dailyFact: input.dailyFact,
      svodLeadsByDate: input.svodLeadsByDate
    });
    const hasAny = PREDICTIVE_AUTO_FACT_METRICS.some(
      (k) => facts[k] != null && Number.isFinite(facts[k] as number)
    );
    if (hasAny) out.set(date, facts);
  }
  return out;
}
