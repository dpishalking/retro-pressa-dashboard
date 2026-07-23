import assert from "node:assert/strict";
import {
  aggregateManagerDayFacts,
  buildManagerPredictiveGrid,
  managerPredictiveTabTitle,
  monthTotalsFromDayFacts
} from "@/lib/sales-os/predictive-by-manager-model";
import { PREDICTIVE_METRICS } from "@/lib/sales-os/predictive-model";

const title = managerPredictiveTabTitle({ managerId: "99194", managerName: "Иван Тест" });
assert.ok(title.startsWith("М — Иван Тест"));
assert.ok(title.includes("[99194]"));
assert.ok(title.length <= 100);

const grid = buildManagerPredictiveGrid({
  month: "2026-07",
  managerId: "99194",
  managerName: "Иван Тест"
});
assert.equal(grid[0][1], "Иван Тест");
assert.equal(grid[PREDICTIVE_METRICS.revenue.planRow - 1][1], "план");
// No invented week plan split when plans are empty
assert.equal(String(grid[PREDICTIVE_METRICS.revenue.planRow - 1][3] || ""), "");
assert.ok(String(grid[PREDICTIVE_METRICS.revenue.factRow - 1][3] || "").startsWith("=SUM"));

const facts = aggregateManagerDayFacts({
  dailyFact: [
    {
      date: "2026-07-01",
      manager_id: "99194",
      leads: "3",
      deals_created: "1",
      invoices: "1",
      payments: "1",
      revenue: "100"
    },
    {
      date: "2026-07-01",
      manager_id: "1",
      leads: "9",
      deals_created: "0",
      invoices: "0",
      payments: "0",
      revenue: "0"
    }
  ],
  managerId: "99194",
  month: "2026-07"
});
assert.equal(facts.get("2026-07-01")?.leads, 3);
assert.equal(monthTotalsFromDayFacts(facts).revenue, 100);

console.log("predictive-by-manager.test.ts: ok");
