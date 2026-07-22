import {
  SALES_DAILY_COLUMNS,
  SALES_DAILY_NUMERIC_COLUMNS,
  type SalesDailyColumn
} from "@/config/os-sheets";
import type { OrdersRow } from "@/lib/os-sheets/orders-mapper";

const numericColumnSet = new Set<string>(SALES_DAILY_NUMERIC_COLUMNS);

export type SalesDailyRow = Record<SalesDailyColumn, string>;
export type SalesDailySheetCell = string | number;

export function emptySalesDailyRow(): SalesDailyRow {
  return Object.fromEntries(SALES_DAILY_COLUMNS.map((column) => [column, ""])) as SalesDailyRow;
}

export function salesDailyRowFromSheetLine(header: string[], line: string[]): SalesDailyRow | null {
  const row = emptySalesDailyRow();
  header.forEach((rawKey, index) => {
    const key = rawKey.trim() as SalesDailyColumn;
    if (!SALES_DAILY_COLUMNS.includes(key)) return;
    row[key] = String(line[index] ?? "").trim();
  });
  return row.date ? row : null;
}

export function salesDailyRowToSheetLine(row: SalesDailyRow): SalesDailySheetCell[] {
  return SALES_DAILY_COLUMNS.map((column) => {
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

type DayManagerAgg = {
  managerId: string;
  managerName: string;
  dealsCreated: number;
  invoices: number;
  payments: number;
  revenue: number;
  lost: number;
  cohortInvoiced: number;
  cohortPaid: number;
};

function rowKey(date: string, managerId: string) {
  return `${date}::${managerId || "_"}`;
}

function ensureAgg(
  map: Map<string, DayManagerAgg>,
  date: string,
  managerId: string,
  managerName: string
): DayManagerAgg {
  const key = rowKey(date, managerId);
  const existing = map.get(key);
  if (existing) {
    if (!existing.managerName && managerName) existing.managerName = managerName;
    return existing;
  }
  const created: DayManagerAgg = {
    managerId,
    managerName,
    dealsCreated: 0,
    invoices: 0,
    payments: 0,
    revenue: 0,
    lost: 0,
    cohortInvoiced: 0,
    cohortPaid: 0
  };
  map.set(key, created);
  return created;
}

/**
 * Build Sales_Daily from Orders.
 * - deals_created / lost / cohort CR → by created_at
 * - invoices → by invoice_at
 * - payments / revenue / average_check → by paid_at
 */
export function buildSalesDailyFromOrders(input: {
  orders: OrdersRow[];
  periodPrefix: string;
  syncedAt: string;
}): SalesDailyRow[] {
  const byKey = new Map<string, DayManagerAgg>();

  for (const order of input.orders) {
    const managerId = order.manager_id?.trim() || "";
    const managerName = order.manager_name?.trim() || (managerId ? `ID ${managerId}` : "Unknown");
    const createdDate = toDateKey(order.created_at);
    const invoiceDate = toDateKey(order.invoice_at);
    const paidDate = toDateKey(order.paid_at);
    const status = order.payment_status?.trim() || "";

    if (createdDate?.startsWith(input.periodPrefix)) {
      const day = ensureAgg(byKey, createdDate, managerId, managerName);
      day.dealsCreated += 1;
      if (status === "paid" || status === "invoiced") day.cohortInvoiced += 1;
      if (status === "paid") day.cohortPaid += 1;
      if (status === "lost") day.lost += 1;
    }

    if (invoiceDate?.startsWith(input.periodPrefix) && (status === "invoiced" || status === "paid")) {
      const day = ensureAgg(byKey, invoiceDate, managerId, managerName);
      day.invoices += 1;
    }

    if (status === "paid" && paidDate?.startsWith(input.periodPrefix)) {
      const day = ensureAgg(byKey, paidDate, managerId, managerName);
      day.payments += 1;
      day.revenue += numberOrZero(order.amount);
    }
  }

  return Array.from(byKey.entries())
    .map(([key, agg]) => {
      const date = key.split("::")[0];
      const row = emptySalesDailyRow();
      row.date = date;
      row.manager_id = agg.managerId;
      row.manager_name = agg.managerName;
      row.deals_created = agg.dealsCreated ? String(agg.dealsCreated) : "";
      row.invoices = agg.invoices ? String(agg.invoices) : "";
      row.payments = agg.payments ? String(agg.payments) : "";
      row.revenue = agg.revenue ? String(Number(agg.revenue.toFixed(2))) : "";
      row.average_check = agg.payments > 0
        ? String(Number((agg.revenue / agg.payments).toFixed(2)))
        : "";
      row.lost = agg.lost ? String(agg.lost) : "";
      row.created_to_invoice_cr = agg.dealsCreated > 0
        ? String(Number(((agg.cohortInvoiced / agg.dealsCreated) * 100).toFixed(2)))
        : "";
      row.created_to_paid_cr = agg.dealsCreated > 0
        ? String(Number(((agg.cohortPaid / agg.dealsCreated) * 100).toFixed(2)))
        : "";
      row.data_status = "live";
      row.last_sync_at = input.syncedAt;
      row.source_of_truth = "computed";
      return row;
    })
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.manager_name.localeCompare(b.manager_name, "ru");
    });
}
