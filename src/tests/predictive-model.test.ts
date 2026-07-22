import assert from "node:assert/strict";
import {
  PREDICTIVE_LAG_KEYS,
  PREDICTIVE_LEAD_KEYS,
  PREDICTIVE_METRICS,
  PREDICTIVE_SLA_KEYS,
  buildFactCellUpdates,
  buildMonthDayColumns,
  collectFactsForMonth,
  countCalendarWeeksInMonth,
  countDataRows,
  layoutForMonth,
  parseDisplayDate,
  parsePredictiveDateColumns,
  resolveDayFacts
} from "@/lib/sales-os/predictive-model";

assert.ok(PREDICTIVE_LAG_KEYS.includes("revenue"));
assert.ok(PREDICTIVE_LEAD_KEYS.includes("leads"));
assert.ok(PREDICTIVE_SLA_KEYS.includes("dialogs"));
assert.ok(PREDICTIVE_SLA_KEYS.includes("no_reply_24h"));
assert.ok(PREDICTIVE_SLA_KEYS.includes("unpaid_invoices"));
assert.equal(PREDICTIVE_METRICS.dialogs.factRow, 27);
assert.equal(PREDICTIVE_METRICS.unpaid_invoices.factRow, 35);
assert.equal(countDataRows([["h"], ["1"], ["2"], [""]]), 2);

// July 2026: Wed 1st → 5 calendar weeks (29.06 … 02.08)
assert.equal(countCalendarWeeksInMonth("2026-07"), 5);
const july = layoutForMonth("2026-07");
assert.equal(july.weekCount, 5);
assert.equal(july.monthCol, 43); // AR after 5×8 week cols from D
assert.equal(july.weekBlocks.length, 5);

const days = buildMonthDayColumns("2026-07");
assert.equal(days.length, 35); // 5 weeks × 7
assert.equal(days.find((d) => d.iso === "2026-07-01")?.weekIndex, 0);
assert.equal(days.find((d) => d.iso === "2026-07-01")?.dayIndex, 2); // Wed
assert.equal(days.find((d) => d.iso === "2026-07-21")?.col, 29);
assert.equal(days.find((d) => d.iso === "2026-07-31")?.weekIndex, 4);
assert.equal(days.find((d) => d.iso === "2026-07-31")?.col, 40); // week5 Friday
assert.equal(parseDisplayDate("21.07", "2026-07"), "2026-07-21");
assert.equal(parseDisplayDate("46225", "2026-07"), "2026-07-22"); // Sheets serial

// Feb 2027 starts Monday → exactly 4 weeks
assert.equal(countCalendarWeeksInMonth("2027-02"), 4);

const grid: string[][] = Array.from({ length: 35 }, () => []);
grid[2] = [];
for (const day of days) grid[2][day.col] = `${day.iso.slice(8)}.${day.iso.slice(5, 7)}`;
const map = parsePredictiveDateColumns(grid, "2026-07");
assert.equal(map.get("2026-07-31"), 40);

const facts = resolveDayFacts({
  date: "2026-07-22",
  mariaDaily: [],
  dailyFact: [{
    date: "2026-07-22",
    leads: "10",
    deals_created: "4",
    payments: "2",
    revenue: "100",
    invoices: "3",
    dialogs: "8",
    stale_deals: "5",
    deals_without_next_activity: "6"
  }],
  alertSla: {
    asOfDate: "2026-07-22",
    no_reply_24h: 12,
    unpaid_invoices: 9
  }
});
assert.equal(facts.dialogs, 8);
assert.equal(facts.stale_deals, 5);
assert.equal(facts.no_next_activity, 6);
assert.equal(facts.no_reply_24h, 12);
assert.equal(facts.unpaid_invoices, 9);

const byDate = collectFactsForMonth({
  month: "2026-07",
  mariaDaily: [],
  dailyFact: [{
    date: "2026-07-22",
    leads: "1",
    deals_created: "1",
    payments: "1",
    revenue: "10",
    invoices: "1",
    dialogs: "2",
    stale_deals: "0",
    deals_without_next_activity: "0"
  }],
  alertSla: { asOfDate: "2026-07-22", no_reply_24h: 3, unpaid_invoices: 4 }
});
const updates = buildFactCellUpdates({
  tabTitle: "Предиктивка продажи",
  dateToCol: map,
  factsByDate: byDate
});
assert.ok(updates.some((u) => u.range === "'Предиктивка продажи'!AE27")); // Jul22 = Wed week4 = col 30 = AE
assert.ok(updates.some((u) => u.range.includes("!AE29") || u.range.includes("!AE35")));

console.log("predictive-model tests ok");
