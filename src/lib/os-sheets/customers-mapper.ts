import {
  CUSTOMERS_COLUMNS,
  CUSTOMERS_NUMERIC_COLUMNS,
  type CustomersColumn
} from "@/config/os-sheets";
import { resolveCustomerIdentity } from "@/lib/os-sheets/customer-identity";
import type { OrdersRow } from "@/lib/os-sheets/orders-mapper";

const numericColumnSet = new Set<string>(CUSTOMERS_NUMERIC_COLUMNS);

export type CustomersRow = Record<CustomersColumn, string>;
export type CustomersSheetCell = string | number;

export function emptyCustomersRow(): CustomersRow {
  return Object.fromEntries(CUSTOMERS_COLUMNS.map((column) => [column, ""])) as CustomersRow;
}

export function resolveCustomerKey(order: OrdersRow): { customer_key: string; customer_key_type: string } {
  if (order.customer_key?.trim()) {
    return {
      customer_key: order.customer_key.trim(),
      customer_key_type: order.customer_key_type?.trim() || "lead"
    };
  }
  return resolveCustomerIdentity({
    leadId: order.lead_id,
    dealId: order.deal_id,
    orderId: order.order_id
  });
}

function numberOrZero(value: string) {
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function ts(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : 0;
}

export function customersRowToSheetLine(row: CustomersRow): CustomersSheetCell[] {
  return CUSTOMERS_COLUMNS.map((column) => {
    const raw = row[column] ?? "";
    if (!numericColumnSet.has(column)) return raw;
    if (!raw.trim()) return "";
    const value = Number(raw.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(value) ? value : raw;
  });
}

type Agg = {
  keyType: string;
  country: string;
  firstOrderId: string;
  lastOrderId: string;
  firstDealAt: string;
  lastDealAt: string;
  firstTs: number;
  lastTs: number;
  dealsCount: number;
  paidOrdersCount: number;
  totalPaidRevenue: number;
  lastManagerId: string;
  lastManagerName: string;
};

export function buildCustomersFromOrders(input: {
  orders: OrdersRow[];
  syncedAt: string;
}): CustomersRow[] {
  const byKey = new Map<string, Agg>();

  for (const order of input.orders) {
    const identity = resolveCustomerKey(order);
    if (!identity.customer_key) continue;

    const createdAt = order.created_at || order.paid_at || "";
    const createdTs = ts(createdAt);
    const isPaid = order.payment_status === "paid";
    const amount = isPaid ? numberOrZero(order.amount) : 0;

    const existing = byKey.get(identity.customer_key);
    if (!existing) {
      byKey.set(identity.customer_key, {
        keyType: identity.customer_key_type,
        country: order.country || "",
        firstOrderId: order.order_id,
        lastOrderId: order.order_id,
        firstDealAt: createdAt,
        lastDealAt: createdAt,
        firstTs: createdTs,
        lastTs: createdTs,
        dealsCount: 1,
        paidOrdersCount: isPaid ? 1 : 0,
        totalPaidRevenue: amount,
        lastManagerId: order.manager_id || "",
        lastManagerName: order.manager_name || ""
      });
      continue;
    }

    existing.dealsCount += 1;
    if (isPaid) {
      existing.paidOrdersCount += 1;
      existing.totalPaidRevenue += amount;
    }
    if (order.country && !existing.country) existing.country = order.country;

    if (!existing.firstTs || (createdTs && createdTs < existing.firstTs)) {
      existing.firstTs = createdTs;
      existing.firstDealAt = createdAt;
      existing.firstOrderId = order.order_id;
    }
    if (createdTs >= existing.lastTs) {
      existing.lastTs = createdTs;
      existing.lastDealAt = createdAt;
      existing.lastOrderId = order.order_id;
      existing.lastManagerId = order.manager_id || existing.lastManagerId;
      existing.lastManagerName = order.manager_name || existing.lastManagerName;
    }
  }

  return Array.from(byKey.entries())
    .map(([customerKey, agg]) => {
      const row = emptyCustomersRow();
      row.customer_key = customerKey;
      row.customer_key_type = agg.keyType;
      row.country = agg.country;
      row.first_order_id = agg.firstOrderId;
      row.last_order_id = agg.lastOrderId;
      row.first_deal_at = agg.firstDealAt;
      row.last_deal_at = agg.lastDealAt;
      row.deals_count = String(agg.dealsCount);
      row.paid_orders_count = agg.paidOrdersCount ? String(agg.paidOrdersCount) : "";
      row.total_paid_revenue = agg.totalPaidRevenue
        ? String(Number(agg.totalPaidRevenue.toFixed(2)))
        : "";
      row.last_manager_id = agg.lastManagerId;
      row.last_manager_name = agg.lastManagerName;
      row.data_status = "live";
      row.last_sync_at = input.syncedAt;
      return row;
    })
    .sort((a, b) => Number(b.total_paid_revenue || 0) - Number(a.total_paid_revenue || 0)
      || a.customer_key.localeCompare(b.customer_key));
}
