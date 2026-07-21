import {
  FINANCE_COLUMNS,
  FINANCE_MANUAL_COLUMNS,
  FINANCE_NUMERIC_COLUMNS,
  type FinanceColumn
} from "@/config/os-sheets";
import type { OrdersRow } from "@/lib/os-sheets/orders-mapper";
import type { TrafficSheetRow } from "@/lib/os-sheets/traffic-mapper";

const numericColumnSet = new Set<string>(FINANCE_NUMERIC_COLUMNS);

export type FinanceRow = Record<FinanceColumn, string>;
export type FinanceSheetCell = string | number;

export function emptyFinanceRow(): FinanceRow {
  return Object.fromEntries(FINANCE_COLUMNS.map((column) => [column, ""])) as FinanceRow;
}

export function financeRowFromSheetLine(header: string[], line: string[]): FinanceRow | null {
  const row = emptyFinanceRow();
  header.forEach((rawKey, index) => {
    const key = rawKey.trim() as FinanceColumn;
    if (!FINANCE_COLUMNS.includes(key)) return;
    row[key] = String(line[index] ?? "").trim();
  });
  return row.date ? row : null;
}

export function financeRowToSheetLine(row: FinanceRow): FinanceSheetCell[] {
  return FINANCE_COLUMNS.map((column) => {
    const raw = row[column] ?? "";
    if (!numericColumnSet.has(column)) return raw;
    if (!raw.trim()) return "";
    const value = Number(raw.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(value) ? value : raw;
  });
}

function toDateKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dotted = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotted) {
    const year = dotted[3].length === 2 ? `20${dotted[3]}` : dotted[3];
    return `${year}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}`;
  }
  return null;
}

function numberOrZero(value: string) {
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

type DayAgg = {
  factRevenue: number;
  cashIn: number;
  adSpend: number;
  paidOrders: number;
};

function ensureDay(map: Map<string, DayAgg>, date: string): DayAgg {
  const existing = map.get(date);
  if (existing) return existing;
  const created = { factRevenue: 0, cashIn: 0, adSpend: 0, paidOrders: 0 };
  map.set(date, created);
  return created;
}

export function buildFinanceFactsFromSources(input: {
  orders: OrdersRow[];
  traffic: TrafficSheetRow[];
  periodPrefix: string;
  syncedAt: string;
}): FinanceRow[] {
  const byDate = new Map<string, DayAgg>();

  for (const order of input.orders) {
    if (order.payment_status !== "paid") continue;
    const date = toDateKey(order.paid_at || order.created_at);
    if (!date || !date.startsWith(input.periodPrefix)) continue;
    const amount = numberOrZero(order.amount);
    const day = ensureDay(byDate, date);
    day.factRevenue += amount;
    day.cashIn += amount;
    day.paidOrders += 1;
  }

  for (const row of input.traffic) {
    const date = toDateKey(row.date);
    if (!date || !date.startsWith(input.periodPrefix)) continue;
    const day = ensureDay(byDate, date);
    day.adSpend += numberOrZero(row.spend);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, agg]) => {
      const row = emptyFinanceRow();
      row.date = date;
      row.fact_revenue = agg.factRevenue ? String(Number(agg.factRevenue.toFixed(2))) : "";
      row.cash_in = agg.cashIn ? String(Number(agg.cashIn.toFixed(2))) : "";
      row.ad_spend = agg.adSpend ? String(Number(agg.adSpend.toFixed(2))) : "";
      row.paid_orders = agg.paidOrders ? String(agg.paidOrders) : "";
      row.net_cash_flow = String(Number((agg.cashIn - agg.adSpend).toFixed(2)));
      row.margin = agg.cashIn > 0
        ? String(Number((((agg.cashIn - agg.adSpend) / agg.cashIn) * 100).toFixed(2)))
        : "";
      row.data_status = "live";
      row.source_of_truth = "computed";
      row.last_sync_at = input.syncedAt;
      return row;
    });
}

export function mergeFinanceRows(existingRows: FinanceRow[], computedRows: FinanceRow[]): FinanceRow[] {
  const existingByDate = new Map(existingRows.map((row) => [row.date, row]));
  const computedDates = new Set(computedRows.map((row) => row.date));

  const merged = computedRows.map((incoming) => {
    const existing = existingByDate.get(incoming.date);
    if (!existing) return incoming;

    const next = { ...incoming };
    for (const column of FINANCE_MANUAL_COLUMNS) {
      next[column] = existing[column] || "";
    }

    const cashOut = numberOrZero(next.cash_out);
    const payroll = numberOrZero(next.payroll);
    const opex = numberOrZero(next.opex);
    const cashIn = numberOrZero(next.cash_in);
    const adSpend = numberOrZero(next.ad_spend);
    next.net_cash_flow = String(Number((cashIn - adSpend - cashOut - payroll - opex).toFixed(2)));
    next.margin = cashIn > 0
      ? String(Number((((cashIn - adSpend - cashOut - payroll - opex) / cashIn) * 100).toFixed(2)))
      : next.margin;

    const hasManual = FINANCE_MANUAL_COLUMNS.some((column) => Boolean(existing[column]?.trim()));
    next.source_of_truth = hasManual ? "hybrid" : "computed";
    return next;
  });

  for (const existing of existingRows) {
    if (computedDates.has(existing.date)) continue;
    // Keep purely manual days (plans / cash balance without orders yet).
    merged.push(existing);
  }

  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

export function resolveMonthlyRevenuePlan(existingRows: FinanceRow[]): number {
  const fromSheet = existingRows
    .map((row) => numberOrZero(row.plan_revenue))
    .find((value) => value > 0);
  if (fromSheet) return fromSheet;

  const fromEnv = Number(process.env.OS_PLAN_REVENUE_MONTH?.trim() || "");
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;

  // Fallback close to current ops plan (~€30k / month).
  return 30_000;
}

export function applyFinanceRunRate(
  rows: FinanceRow[],
  input: { monthlyPlan: number; calendarDays: number }
): FinanceRow[] {
  let mtd = 0;
  const plan = input.monthlyPlan;

  return rows.map((row) => {
    mtd += numberOrZero(row.fact_revenue);
    const dayOfMonth = Number(row.date.slice(8, 10)) || 1;
    const elapsedDays = Math.max(1, Math.min(dayOfMonth, input.calendarDays));
    const runRate = (mtd / elapsedDays) * input.calendarDays;
    const next = { ...row };
    if (!next.plan_revenue?.trim()) next.plan_revenue = String(plan);
    next.mtd_revenue = String(Number(mtd.toFixed(2)));
    next.run_rate_revenue = String(Number(runRate.toFixed(2)));
    next.rr_pct = plan > 0 ? String(Number(((runRate / plan) * 100).toFixed(2))) : "";
    next.plan_completion_pct = plan > 0 ? String(Number(((mtd / plan) * 100).toFixed(2))) : "";
    return next;
  });
}
