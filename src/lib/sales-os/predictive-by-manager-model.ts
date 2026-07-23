/**
 * Per-manager predictive grids in the ROP predictive workbook.
 * Same visual frame as «Предиктивка продажи»; plans stay empty until a manager plan sheet is wired.
 */

import {
  PREDICTIVE_ASOF_DAY_ROW,
  PREDICTIVE_AUTO_FACT_METRICS,
  PREDICTIVE_METRICS,
  PREDICTIVE_SECTION_MICRO_ROW,
  buildMonthDayColumns,
  buildPtfFormulasForMetric,
  colLetter,
  formatSheetDateLabel,
  formatWeekDateRangeLabel,
  layoutForMonth,
  monthNameRu,
  type PredictiveMetricKey,
  type SheetCellUpdate,
  a1
} from "@/lib/sales-os/predictive-model";

export const PREDICTIVE_MANAGERS_INDEX_TAB = "Менеджеры — список";

export function managerPredictiveTabTitle(input: {
  managerId: string;
  managerName: string;
}): string {
  const name = String(input.managerName || "").trim() || `ID ${input.managerId}`;
  const raw = `М — ${name}`;
  // Sheets tab title max 100; keep id suffix for uniqueness.
  const suffix = ` [${input.managerId}]`;
  const maxName = 100 - suffix.length;
  const trimmed = raw.length > maxName ? `${raw.slice(0, Math.max(1, maxName - 1))}…` : raw;
  return `${trimmed}${suffix}`.slice(0, 100);
}

/** Grid like department template, but plan cells stay empty (no fake week split). */
export function buildManagerPredictiveGrid(input: {
  month: string;
  managerId: string;
  managerName: string;
}): string[][] {
  const layout = layoutForMonth(input.month);
  const { weekBlocks, monthCol } = layout;
  const width = monthCol + 1;
  const blank = () => Array.from({ length: width }, () => "");
  const rows: string[][] = Array.from({ length: PREDICTIVE_ASOF_DAY_ROW }, () => blank());
  const days = buildMonthDayColumns(input.month);
  const weekdays = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
  const monthL = colLetter(monthCol);

  rows[0][0] = "Запаздывающие (продажи)";
  rows[0][1] = input.managerName || input.managerId;
  rows[0][2] = monthNameRu(input.month);
  rows[0][3] = `manager_id=${input.managerId}`;

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

  sumFact(PREDICTIVE_METRICS.revenue.factRow);
  sumFact(PREDICTIVE_METRICS.sale.factRow);
  sumFact(PREDICTIVE_METRICS.leads.factRow);
  sumFact(PREDICTIVE_METRICS.deals.factRow);
  sumFact(PREDICTIVE_METRICS.invoices.factRow);

  // AOV / CR on fact only — plan rows stay empty until manager plans arrive.
  ratioAll(
    PREDICTIVE_METRICS.aov.factRow,
    PREDICTIVE_METRICS.revenue.factRow,
    PREDICTIVE_METRICS.sale.factRow
  );
  ratioAll(
    PREDICTIVE_METRICS.cr_l_deal.factRow,
    PREDICTIVE_METRICS.deals.factRow,
    PREDICTIVE_METRICS.leads.factRow
  );
  ratioAll(
    PREDICTIVE_METRICS.cr_deal_invoice.factRow,
    PREDICTIVE_METRICS.invoices.factRow,
    PREDICTIVE_METRICS.deals.factRow
  );
  ratioAll(
    PREDICTIVE_METRICS.cr_invoice_sale.factRow,
    PREDICTIVE_METRICS.sale.factRow,
    PREDICTIVE_METRICS.invoices.factRow
  );
  ratioAll(
    PREDICTIVE_METRICS.cr_l_sale.factRow,
    PREDICTIVE_METRICS.sale.factRow,
    PREDICTIVE_METRICS.leads.factRow
  );

  for (const key of Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]) {
    const meta = PREDICTIVE_METRICS[key];
    const formulas = buildPtfFormulasForMetric({ month: input.month, key });
    const ptf = rows[meta.ptfRow - 1];
    for (let col = 0; col < formulas.length; col += 1) ptf[col] = formulas[col] || "";
  }

  rows[PREDICTIVE_ASOF_DAY_ROW - 1][0] = "1";
  rows[PREDICTIVE_ASOF_DAY_ROW - 1][1] = "as_of_day";
  rows[PREDICTIVE_ASOF_DAY_ROW - 1][2] = "plans=later";

  return rows;
}

export type ManagerDayFact = {
  revenue: number;
  sale: number;
  leads: number;
  deals: number;
  invoices: number;
  aov: number | null;
};

export function aggregateManagerDayFacts(input: {
  dailyFact: Array<Record<string, string>>;
  managerId: string;
  month: string;
}): Map<string, ManagerDayFact> {
  const byDate = new Map<string, ManagerDayFact>();
  for (const row of input.dailyFact) {
    if (String(row.manager_id || "") !== input.managerId) continue;
    const date = String(row.date || "").slice(0, 10);
    if (!date.startsWith(input.month)) continue;
    const cur = byDate.get(date) || {
      revenue: 0,
      sale: 0,
      leads: 0,
      deals: 0,
      invoices: 0,
      aov: null
    };
    cur.leads += Number(row.leads || 0) || 0;
    cur.deals += Number(row.deals_created || 0) || 0;
    cur.invoices += Number(row.invoices || 0) || 0;
    cur.sale += Number(row.payments || 0) || 0;
    cur.revenue += Number(row.revenue || 0) || 0;
    byDate.set(date, cur);
  }
  for (const fact of byDate.values()) {
    fact.aov = fact.sale > 0 ? Number((fact.revenue / fact.sale).toFixed(2)) : null;
  }
  return byDate;
}

export function buildManagerFactCellUpdates(input: {
  tabTitle: string;
  dateToCol: Map<string, number>;
  factsByDate: Map<string, ManagerDayFact>;
}): SheetCellUpdate[] {
  const updates: SheetCellUpdate[] = [];
  for (const [date, facts] of input.factsByDate) {
    const col = input.dateToCol.get(date);
    if (col == null) continue;
    for (const key of PREDICTIVE_AUTO_FACT_METRICS) {
      const value = facts[key];
      if (value == null || !Number.isFinite(value as number)) continue;
      updates.push({
        range: a1(input.tabTitle, col, PREDICTIVE_METRICS[key].factRow),
        values: [[value as number]]
      });
    }
  }
  return updates;
}

export function monthTotalsFromDayFacts(facts: Map<string, ManagerDayFact>): ManagerDayFact {
  const out: ManagerDayFact = {
    revenue: 0,
    sale: 0,
    leads: 0,
    deals: 0,
    invoices: 0,
    aov: null
  };
  for (const f of facts.values()) {
    out.revenue += f.revenue;
    out.sale += f.sale;
    out.leads += f.leads;
    out.deals += f.deals;
    out.invoices += f.invoices;
  }
  out.aov = out.sale > 0 ? Number((out.revenue / out.sale).toFixed(2)) : null;
  return out;
}

export const MANAGER_INDEX_COLUMNS = [
  "manager_id",
  "manager_name",
  "tab_title",
  "leads",
  "deals",
  "invoices",
  "payments",
  "revenue",
  "aov",
  "month",
  "sync_updated_at"
] as const;
