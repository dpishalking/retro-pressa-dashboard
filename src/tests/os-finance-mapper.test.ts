import {
  buildFinanceFactsFromSources,
  mergeFinanceRows,
  emptyFinanceRow
} from "@/lib/os-sheets/finance-mapper";
import { emptyOrdersRow } from "@/lib/os-sheets/orders-mapper";
import { emptyTrafficRow } from "@/lib/os-sheets/traffic-mapper";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const order = emptyOrdersRow();
order.order_id = "1";
order.payment_status = "paid";
order.paid_at = "2026-07-10T12:00:00+03:00";
order.amount = "100";

const traffic = emptyTrafficRow();
traffic.date = "2026-07-10";
traffic.spend = "20";
traffic.lead_kind = "paid";

const rows = buildFinanceFactsFromSources({
  orders: [order],
  traffic: [traffic],
  periodPrefix: "2026-07",
  syncedAt: "2026-07-21T12:00:00.000Z"
});

assert(rows.length === 1, "one finance day");
assert(rows[0].fact_revenue === "100", "revenue");
assert(rows[0].ad_spend === "20", "spend");
assert(rows[0].net_cash_flow === "80", "net");

const existing = emptyFinanceRow();
existing.date = "2026-07-10";
existing.payroll = "30";
existing.notes = "ручной ФОТ";

const merged = mergeFinanceRows([existing], rows);
assert(merged[0].payroll === "30", "payroll preserved");
assert(merged[0].net_cash_flow === "50", "net after payroll");
assert(merged[0].source_of_truth === "hybrid", "hybrid");

console.log("os-finance mapper ok");
