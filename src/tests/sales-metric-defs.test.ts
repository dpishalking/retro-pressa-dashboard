import assert from "node:assert/strict";
import { isSalesFunnelDeal, parseSheetNumber } from "@/lib/os-sheets/sales-metric-defs";
import { buildReconciliationRows } from "@/lib/os-sheets/sales-reconciliation";
import type { OrdersRow } from "@/lib/os-sheets/orders-mapper";
import { emptyOrdersRow } from "@/lib/os-sheets/orders-mapper";

assert.equal(isSalesFunnelDeal({ categoryId: "0", stageId: "NEW" }), true);
assert.equal(isSalesFunnelDeal({ categoryId: "", stageId: "WON" }), true);
assert.equal(isSalesFunnelDeal({ categoryId: "4", stageId: "C4:WON" }), false);
assert.equal(isSalesFunnelDeal({ categoryId: "0", stageId: "C4:WON" }), false);
assert.equal(parseSheetNumber("47,"), 47);
assert.equal(parseSheetNumber("1 234,5"), 1234.5);

function order(partial: Partial<OrdersRow>): OrdersRow {
  return { ...emptyOrdersRow(), ...partial };
}

const orders: OrdersRow[] = [
  order({
    order_id: "1",
    deal_id: "1",
    created_at: "2026-07-01T10:00:00+03:00",
    stage_id: "NEW",
    stage_semantic: "P",
    manager_id: "10",
    opportunity: "100",
    amount: "100",
    payment_status: "unpaid"
  }),
  order({
    order_id: "2",
    deal_id: "2",
    created_at: "2026-07-02T10:00:00+03:00",
    paid_at: "2026-07-05T03:00:00+03:00",
    stage_id: "WON",
    stage_semantic: "S",
    manager_id: "10",
    amount: "50",
    opportunity: "50",
    payment_status: "paid"
  }),
  order({
    order_id: "3",
    deal_id: "3",
    created_at: "2026-07-03T10:00:00+03:00",
    paid_at: "2026-07-04T03:00:00+03:00",
    stage_id: "C4:WON",
    stage_semantic: "S",
    manager_id: "99",
    amount: "47",
    opportunity: "47",
    payment_status: "paid"
  }),
  order({
    order_id: "4",
    deal_id: "4",
    created_at: "2025-01-01T10:00:00+03:00",
    stage_id: "PREPARATION",
    stage_semantic: "P",
    manager_id: "20",
    opportunity: "200",
    amount: "200",
    payment_status: "unpaid"
  })
];

const recon = buildReconciliationRows({
  legacySales: [],
  salesOsDaily: [
    {
      date: "2026-07-01",
      manager_id: "10",
      leads: "0",
      deals: "1",
      invoice_events: "0",
      payments: "0",
      paid_revenue: "0",
      active_deals: "0",
      active_pipeline_amount: "0"
    },
    {
      date: "2026-07-02",
      manager_id: "10",
      leads: "0",
      deals: "1",
      invoice_events: "0",
      payments: "0",
      paid_revenue: "0",
      active_deals: "0",
      active_pipeline_amount: "0"
    },
    {
      date: "2026-07-05",
      manager_id: "10",
      leads: "0",
      deals: "0",
      invoice_events: "0",
      payments: "1",
      paid_revenue: "50",
      active_deals: "0",
      active_pipeline_amount: "0"
    },
    {
      date: "2026-07-22",
      manager_id: "10",
      leads: "0",
      deals: "0",
      invoice_events: "0",
      payments: "0",
      paid_revenue: "0",
      active_deals: "1",
      active_pipeline_amount: "100"
    },
    {
      date: "2026-07-22",
      manager_id: "20",
      leads: "0",
      deals: "0",
      invoice_events: "0",
      payments: "0",
      paid_revenue: "0",
      active_deals: "1",
      active_pipeline_amount: "200"
    },
    {
      date: "2026-07-22",
      manager_id: "30",
      leads: "0",
      deals: "0",
      invoice_events: "0",
      payments: "0",
      paid_revenue: "0",
      active_deals: "1",
      active_pipeline_amount: "10"
    }
  ],
  orders,
  periods: ["2026-07"],
  checkedAt: "2026-07-22T12:00:00.000Z"
});

const monthAll = (metricId: string) =>
  recon.find((row) => row.period_type === "month" && row.period === "2026-07" && row.manager_id === "all" && row.metric_id === metricId);

assert.equal(monthAll("deals")?.legacy_value, "2");
assert.equal(monthAll("deals")?.sales_os_value, "2");
assert.equal(monthAll("deals")?.status, "matched");

assert.equal(monthAll("payments")?.legacy_value, "1");
assert.equal(monthAll("payments")?.sales_os_value, "1");
assert.equal(monthAll("paid_revenue")?.legacy_value, "50");
assert.equal(monthAll("paid_revenue")?.sales_os_value, "50");

assert.equal(monthAll("active_deals")?.legacy_value, "2");
assert.equal(monthAll("active_pipeline_amount")?.legacy_value, "300");

// Manager 20/30 are pipeline-only on Sales OS side; locked count = create/pay only → 1 (manager 10).
assert.equal(monthAll("manager_count")?.legacy_value, "1");
assert.equal(monthAll("manager_count")?.sales_os_value, "1");
assert.equal(monthAll("manager_count")?.status, "matched");

console.log("sales-metric-defs.test.ts: ok");
