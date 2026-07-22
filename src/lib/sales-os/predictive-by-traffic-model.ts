import {
  PREDICTIVE_ASOF_DAY_ROW,
  PREDICTIVE_DATE_ROW,
  PREDICTIVE_METRICS,
  PREDICTIVE_SECTION_MICRO_ROW,
  buildMonthDayColumns,
  buildPtfMonthFormula,
  buildPtfWeekFormula,
  colLetter,
  daysInCalendarMonth,
  formatSheetDateLabel,
  formatWeekDateRangeLabel,
  layoutForMonth,
  monthNameRu,
  parseDisplayDate,
  quoteTab,
  type PredictiveMetricKey,
  type SheetCellUpdate
} from "@/lib/sales-os/predictive-model";
import type { TrafficChannel, TrafficDaySplit } from "@/lib/sales-os/traffic-channel-facts";
import type { SvodSalesPlanSlice } from "@/lib/sales-os/svod-plans";

export const TRAFFIC_PAID_TAB_DEFAULT = "Продажи — Paid";
export const TRAFFIC_ORGANIC_TAB_DEFAULT = "Продажи — Organic";

export function getTrafficPaidTabTitle(): string {
  return process.env.PREDICTIVE_TRAFFIC_PAID_TAB?.trim() || TRAFFIC_PAID_TAB_DEFAULT;
}

export function getTrafficOrganicTabTitle(): string {
  return process.env.PREDICTIVE_TRAFFIC_ORGANIC_TAB?.trim() || TRAFFIC_ORGANIC_TAB_DEFAULT;
}

export function trafficTabTitleForChannel(channel: TrafficChannel): string {
  return channel === "paid" ? getTrafficPaidTabTitle() : getTrafficOrganicTabTitle();
}

export function trafficChannelTitle(channel: TrafficChannel): string {
  return channel === "paid" ? "Продажи — платный трафик" : "Продажи — органика";
}

export const TRAFFIC_CHANNELS = ["paid", "organic"] as const;

/** Same row map as main predictive sheet (single block). */
export const TRAFFIC_DIAGNOSIS_START_ROW = PREDICTIVE_ASOF_DAY_ROW + 2;

/**
 * One channel = one sheet, same layout/formulas as «Предиктивка продажи».
 * `planDeals` — same derive as main sheet (ceil invoices plan ÷ Deal→Inv fact CR).
 */
export function buildTrafficChannelGrid(input: {
  month: string;
  channel: TrafficChannel;
  plans: SvodSalesPlanSlice | null | undefined;
  planDeals?: number | null;
}): string[][] {
  const layout = layoutForMonth(input.month);
  const { weekBlocks, monthCol, weekCount } = layout;
  const width = monthCol + 1;
  const blank = () => Array.from({ length: width }, () => "");
  const rows: string[][] = Array.from({ length: TRAFFIC_DIAGNOSIS_START_ROW + 10 }, () => blank());
  const days = buildMonthDayColumns(input.month);
  const weekdays = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
  const monthL = colLetter(monthCol);
  const asOf = `$A$${PREDICTIVE_ASOF_DAY_ROW}`;

  rows[0][0] = trafficChannelTitle(input.channel);
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

  for (const key of Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]) {
    const meta = PREDICTIVE_METRICS[key];
    rows[meta.planRow - 1][0] = meta.label;
    rows[meta.planRow - 1][1] = "план";
    rows[meta.factRow - 1][1] = "факт";
    rows[meta.ptfRow - 1][1] = "прогноз";
  }

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
    const body = (L: string) => `=IFERROR(${L}${numRow}/${L}${denRow};"")`;
    for (const block of weekBlocks) {
      for (const col of [...block.dayCols, block.totalCol]) {
        row[col] = body(colLetter(col));
      }
    }
    row[monthCol] = body(monthL);
  };

  const installPtf = (key: PredictiveMetricKey) => {
    const meta = PREDICTIVE_METRICS[key];
    const ptf = rows[meta.ptfRow - 1];
    const timeScale = meta.style !== "percent" && key !== "aov";
    const dim = daysInCalendarMonth(input.month);
    for (let w = 0; w < weekBlocks.length; w += 1) {
      const block = weekBlocks[w];
      for (const col of block.dayCols) ptf[col] = "";
      const weekIsos = days.slice(w * 7, w * 7 + 7).filter((day) => day.iso.startsWith(input.month));
      if (!weekIsos.length) {
        ptf[block.totalCol] = "";
        continue;
      }
      const period = weekIsos.length;
      const startDay = Number(weekIsos[0].iso.slice(8, 10));
      const endDay = Number(weekIsos[weekIsos.length - 1].iso.slice(8, 10));
      const wL = colLetter(block.totalCol);
      ptf[block.totalCol] = buildPtfWeekFormula({
        factRef: `${wL}${meta.factRow}`,
        planRef: `${wL}${meta.planRow}`,
        periodDays: period,
        startDay,
        endDay,
        asOfCell: asOf,
        timeScale
      });
    }
    ptf[monthCol] = buildPtfMonthFormula({
      factRef: `${monthL}${meta.factRow}`,
      planRef: `${monthL}${meta.planRow}`,
      daysInMonth: dim,
      asOfCell: asOf,
      timeScale
    });
  };

  const asPlan = (n: number | null | undefined) =>
    n != null && Number.isFinite(n) ? String(n) : "";

  splitPlan(PREDICTIVE_METRICS.revenue.planRow, asPlan(input.plans?.revenue));
  splitPlan(PREDICTIVE_METRICS.sale.planRow, asPlan(input.plans?.sale));
  splitPlan(PREDICTIVE_METRICS.leads.planRow, asPlan(input.plans?.leads));
  splitPlan(PREDICTIVE_METRICS.deals.planRow, asPlan(input.planDeals));
  splitPlan(PREDICTIVE_METRICS.invoices.planRow, asPlan(input.plans?.invoices));

  sumFact(PREDICTIVE_METRICS.revenue.factRow);
  sumFact(PREDICTIVE_METRICS.sale.factRow);
  sumFact(PREDICTIVE_METRICS.leads.factRow);
  sumFact(PREDICTIVE_METRICS.deals.factRow);
  sumFact(PREDICTIVE_METRICS.invoices.factRow);

  // Same formula map as «Предиктивка продажи» (plan CR from plan rows, fact from fact rows).
  ratioAll(PREDICTIVE_METRICS.aov.planRow, PREDICTIVE_METRICS.revenue.planRow, PREDICTIVE_METRICS.sale.planRow);
  ratioAll(PREDICTIVE_METRICS.aov.factRow, PREDICTIVE_METRICS.revenue.factRow, PREDICTIVE_METRICS.sale.factRow);
  ratioAll(PREDICTIVE_METRICS.cr_l_deal.planRow, PREDICTIVE_METRICS.deals.planRow, PREDICTIVE_METRICS.leads.planRow);
  ratioAll(PREDICTIVE_METRICS.cr_l_deal.factRow, PREDICTIVE_METRICS.deals.factRow, PREDICTIVE_METRICS.leads.factRow);
  ratioAll(
    PREDICTIVE_METRICS.cr_deal_invoice.planRow,
    PREDICTIVE_METRICS.invoices.planRow,
    PREDICTIVE_METRICS.deals.planRow
  );
  ratioAll(
    PREDICTIVE_METRICS.cr_deal_invoice.factRow,
    PREDICTIVE_METRICS.invoices.factRow,
    PREDICTIVE_METRICS.deals.factRow
  );
  ratioAll(
    PREDICTIVE_METRICS.cr_invoice_sale.planRow,
    PREDICTIVE_METRICS.sale.planRow,
    PREDICTIVE_METRICS.invoices.planRow
  );
  ratioAll(
    PREDICTIVE_METRICS.cr_invoice_sale.factRow,
    PREDICTIVE_METRICS.sale.factRow,
    PREDICTIVE_METRICS.invoices.factRow
  );
  ratioAll(PREDICTIVE_METRICS.cr_l_sale.planRow, PREDICTIVE_METRICS.sale.planRow, PREDICTIVE_METRICS.leads.planRow);
  ratioAll(PREDICTIVE_METRICS.cr_l_sale.factRow, PREDICTIVE_METRICS.sale.factRow, PREDICTIVE_METRICS.leads.factRow);

  for (const key of Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]) installPtf(key);

  rows[PREDICTIVE_ASOF_DAY_ROW - 1][0] = "1";
  rows[PREDICTIVE_ASOF_DAY_ROW - 1][1] = "as_of_day";
  rows[TRAFFIC_DIAGNOSIS_START_ROW - 1][0] = "Где мы теряем деньги";
  rows[TRAFFIC_DIAGNOSIS_START_ROW][0] =
    input.channel === "paid"
      ? "(автодиагностика платного потока — без CPL/ROAS)"
      : "(автодиагностика органики — без CPL/ROAS)";

  return rows;
}

export function buildTrafficFactCellUpdates(input: {
  tabTitle: string;
  month: string;
  channel: TrafficChannel;
  dateToCol: Map<string, number>;
  factsByDate: Map<string, TrafficDaySplit>;
}): SheetCellUpdate[] {
  const updates: SheetCellUpdate[] = [];
  for (const [date, split] of input.factsByDate) {
    if (!date.startsWith(input.month)) continue;
    const col = input.dateToCol.get(date);
    if (col == null) continue;
    const agg = split[input.channel];
    const pairs: Array<[number, number]> = [
      [PREDICTIVE_METRICS.revenue.factRow, agg.revenue],
      [PREDICTIVE_METRICS.sale.factRow, agg.sale],
      [PREDICTIVE_METRICS.leads.factRow, agg.leads],
      [PREDICTIVE_METRICS.deals.factRow, agg.deals],
      [PREDICTIVE_METRICS.invoices.factRow, agg.invoices]
    ];
    for (const [row, value] of pairs) {
      if (!Number.isFinite(value)) continue;
      updates.push({
        range: `${quoteTab(input.tabTitle)}!${colLetter(col)}${row}`,
        values: [[value]]
      });
    }
    if (agg.sale > 0) {
      updates.push({
        range: `${quoteTab(input.tabTitle)}!${colLetter(col)}${PREDICTIVE_METRICS.aov.factRow}`,
        values: [[Number((agg.revenue / agg.sale).toFixed(2))]]
      });
    }
  }
  return updates;
}

export function buildTrafficDiagnosisRows(lines: Array<{ title: string; body: string }>): string[][] {
  const rows: string[][] = [];
  for (const line of lines) {
    rows.push([line.title, ""]);
    rows.push(["", line.body]);
    rows.push(["", ""]);
  }
  return rows;
}

export function parseTrafficDateColumns(values: string[][], month: string): Map<string, number> {
  const row = values[PREDICTIVE_DATE_ROW - 1] || [];
  const map = new Map<string, number>();
  for (let col = 0; col < row.length; col += 1) {
    const iso = parseDisplayDate(String(row[col] || ""), month);
    if (iso && iso.startsWith(month)) map.set(iso, col);
  }
  return map;
}
