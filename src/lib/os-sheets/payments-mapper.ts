import {
  PAYMENTS_COLUMNS,
  PAYMENTS_NUMERIC_COLUMNS,
  type PaymentsColumn
} from "@/config/os-sheets";
import { resolveCustomerKey } from "@/lib/os-sheets/customers-mapper";
import type { OrdersRow } from "@/lib/os-sheets/orders-mapper";

const numericColumnSet = new Set<string>(PAYMENTS_NUMERIC_COLUMNS);

export type PaymentsRow = Record<PaymentsColumn, string>;
export type PaymentsSheetCell = string | number;

export function emptyPaymentsRow(): PaymentsRow {
  return Object.fromEntries(PAYMENTS_COLUMNS.map((column) => [column, ""])) as PaymentsRow;
}

export function paymentsRowToSheetLine(row: PaymentsRow): PaymentsSheetCell[] {
  return PAYMENTS_COLUMNS.map((column) => {
    const raw = row[column] ?? "";
    if (!numericColumnSet.has(column)) return raw;
    if (!raw.trim()) return "";
    const value = Number(raw.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(value) ? value : raw;
  });
}

function numberOrEmpty(value: string) {
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? String(Number(parsed.toFixed(2))) : "";
}

export function buildPaymentsFromOrders(input: {
  orders: OrdersRow[];
  syncedAt: string;
}): PaymentsRow[] {
  return input.orders
    .filter((order) => order.payment_status === "paid")
    .map((order) => {
      const row = emptyPaymentsRow();
      row.payment_id = order.order_id || order.deal_id;
      row.order_id = order.order_id;
      row.deal_id = order.deal_id;
      row.customer_key = resolveCustomerKey(order).customer_key;
      row.paid_at = order.paid_at || order.created_at;
      row.amount = numberOrEmpty(order.amount);
      row.currency = order.currency || "EUR";
      row.manager_id = order.manager_id;
      row.manager_name = order.manager_name;
      row.product_sku = order.product_sku;
      row.product_name = order.product_name;
      row.country = order.country;
      row.data_status = "live";
      row.last_sync_at = input.syncedAt;
      row.source_of_truth = "computed";
      return row;
    })
    .sort((a, b) => (a.paid_at || "").localeCompare(b.paid_at || "") || a.payment_id.localeCompare(b.payment_id));
}
