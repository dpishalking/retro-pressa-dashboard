import assert from "node:assert/strict";
import {
  buildRopBoard,
  classifyTrafficLight,
  expectedPaceAmount,
  mergeSettingsWithRopPlan,
  paceDeviationPct
} from "@/lib/sales-os/rop-board";
import { mergeMariaDailyRows, MARIA_DAILY_SEED } from "@/lib/sales-os/maria-daily";

assert.equal(expectedPaceAmount(31000, "2026-07", "2026-07-22"), Number(((31000 * 22) / 31).toFixed(10)));
assert.equal(paceDeviationPct(100, 100), 0);
assert.ok(Math.abs((paceDeviationPct(85, 100) || 0) + 15) < 0.001);

assert.equal(classifyTrafficLight({
  deviationPct: 0,
  yellowPct: -5,
  redPct: -15,
  hasPlan: true
}), "GREEN");

assert.equal(classifyTrafficLight({
  deviationPct: -8,
  yellowPct: -5,
  redPct: -15,
  hasPlan: true
}), "YELLOW");

assert.equal(classifyTrafficLight({
  deviationPct: -20,
  yellowPct: -5,
  redPct: -15,
  hasPlan: true
}), "RED");

assert.equal(classifyTrafficLight({
  deviationPct: null,
  yellowPct: -5,
  redPct: -15,
  hasPlan: false
}), "NO_PLAN");

const merged = mergeSettingsWithRopPlan({
  systemSettings: [
    { key: "currency_default", value: "EUR", notes: "", updated_at: "t" }
  ],
  existingSettings: [
    { key: "plan_paid_revenue_eur", value: "25000", notes: "keep", updated_at: "old" }
  ],
  syncedAt: "2026-07-22T00:00:00.000Z",
  defaultPlanMonth: "2026-07"
});
assert.equal(merged.find((row) => row.key === "plan_paid_revenue_eur")?.value, "25000");
assert.equal(merged.find((row) => row.key === "plan_month")?.value, "2026-07");
assert.equal(merged.find((row) => row.key === "rop_flueger_source")?.value, "maria");

const preserved = mergeMariaDailyRows({
  existing: [{
    date: "2026-07-21",
    invoices_count: "99",
    invoices_amount: "1",
    paid_same_day_count: "1",
    paid_same_day_amount: "1",
    paid_total_count: "1",
    paid_total_amount: "1",
    notes: "keep",
    source: "maria",
    updated_at: "x"
  }],
  seed: MARIA_DAILY_SEED,
  syncedAt: "t"
});
assert.equal(preserved.find((row) => row.date === "2026-07-21")?.invoices_count, "99");

const seeded = mergeMariaDailyRows({ existing: [], syncedAt: "t" });
assert.equal(seeded.find((row) => row.date === "2026-07-21")?.paid_total_amount, "1510");

const board = buildRopBoard({
  settings: [
    { key: "plan_month", value: "2026-07" },
    { key: "plan_paid_revenue_eur", value: "31000" },
    { key: "traffic_light_yellow_pct", value: "-5" },
    { key: "traffic_light_red_pct", value: "-15" },
    { key: "overload_active_deals_threshold", value: "40" },
    { key: "rop_flueger_source", value: "maria" }
  ],
  dailyFact: [
    {
      date: "2026-07-21",
      manager_id: "10",
      manager_name: "Anna",
      deals_created: "2",
      payments: "36",
      revenue: "2397"
    },
    {
      date: "2026-07-22",
      manager_id: "20",
      manager_name: "Boris",
      deals_created: "0",
      payments: "0",
      revenue: "0"
    }
  ],
  pipeline: Array.from({ length: 45 }).map(() => ({
    assigned_by_id: "20",
    assigned_by_name: "Boris",
    opportunity: "10"
  })),
  mariaDaily: MARIA_DAILY_SEED,
  today: "2026-07-22",
  syncedAt: "2026-07-22T12:00:00.000Z"
});

assert.equal(board.find((row) => row.item === "paid_total_count")?.value, "22");
assert.equal(board.find((row) => row.item === "paid_total_amount")?.value, "1510");
assert.equal(board.find((row) => row.item === "invoices_count")?.value, "28");
assert.equal(board.find((row) => row.item === "paid_total_amount")?.status, "MARIA");

const boardSheet = buildRopBoard({
  settings: [
    { key: "plan_month", value: "2026-07" },
    { key: "rop_flueger_source", value: "maria" }
  ],
  dailyFact: board[0] ? [
    { date: "2026-07-21", manager_id: "10", manager_name: "A", deals_created: "1", payments: "36", revenue: "2397" }
  ] : [],
  pipeline: [],
  mariaDaily: MARIA_DAILY_SEED,
  mariaSnapshot: [
    { key: "report_date", value: "2026-07-21" },
    { key: "yesterday_invoices_count", value: "28" },
    { key: "yesterday_invoices_amount", value: "1859" },
    { key: "month_sales_count", value: "314" },
    { key: "month_revenue", value: "21729" },
    { key: "plan_revenue", value: "46667" }
  ],
  today: "2026-07-22",
  syncedAt: "t"
});
assert.equal(boardSheet.find((row) => row.item === "fact_revenue_eur")?.value, "21729");
assert.equal(boardSheet.find((row) => row.item === "fact_revenue_eur")?.status, "MARIA_SHEET");
assert.equal(boardSheet.find((row) => row.item === "plan_revenue_eur")?.value, "46667");
assert.equal(boardSheet.find((row) => row.item === "invoices_count")?.value, "28");

const light = board.find((row) => row.item === "traffic_light");
assert.equal(light?.value, "RED");

const mgrBoris = board.find((row) => row.section === "managers" && row.item.includes("Boris"));
assert.equal(mgrBoris?.status, "risk_overload");

console.log("sales-rop-board.test.ts: ok");
