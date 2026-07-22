import assert from "node:assert/strict";
import {
  PREDICTIVE_LAG_KEYS,
  PREDICTIVE_LEAD_KEYS,
  PREDICTIVE_METRICS,
  PREDICTIVE_GRID_LAST_ROW,
  PREDICTIVE_ASOF_DAY_ROW,
  buildFactCellUpdates,
  buildMonthDayColumns,
  buildPtfFormulasForMetric,
  buildPtfWeekFormula,
  classifyTrafficLight,
  collectFactsForMonth,
  countCalendarWeeksInMonth,
  deriveDealsPlanForInvoices,
  layoutForMonth,
  parseDisplayDate,
  parsePredictiveDateColumns,
  resolveDayFacts,
  runRatePct,
  formatWeekDateRangeLabel
} from "@/lib/sales-os/predictive-model";

assert.ok(PREDICTIVE_LAG_KEYS.includes("revenue"));
assert.ok(PREDICTIVE_LEAD_KEYS.includes("leads"));
assert.ok(!("dialogs" in PREDICTIVE_METRICS));
assert.equal(PREDICTIVE_GRID_LAST_ROW, 34);
assert.equal(PREDICTIVE_ASOF_DAY_ROW, 35);
assert.equal(PREDICTIVE_METRICS.cr_l_sale.ptfRow, 34);
assert.equal(PREDICTIVE_METRICS.revenue.ptfRow, 6);

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
assert.equal(
  formatWeekDateRangeLabel([
    "2026-06-29",
    "2026-06-30",
    "2026-07-01",
    "2026-07-02",
    "2026-07-03",
    "2026-07-04",
    "2026-07-05"
  ]),
  "29.06–05.07"
);
assert.equal(deriveDealsPlanForInvoices({ planInvoices: 733, dealsFact: 1170, invoicesFact: 301 }), 2850);
assert.equal(
  runRatePct({ fact: 1170, plan: 2850, elapsedDays: 22, periodDays: 31, timeScale: true }),
  57.8
);
assert.equal(runRatePct({ fact: 0.5, plan: 0.5, elapsedDays: 22, periodDays: 31, timeScale: false }), 100);
assert.equal(classifyTrafficLight({ fact: 100, plan: 100, polarity: "higher_better" }), "green");
assert.equal(classifyTrafficLight({ fact: 95, plan: 100, polarity: "higher_better" }), "yellow");
assert.equal(classifyTrafficLight({ fact: 89, plan: 100, polarity: "higher_better" }), "red");
assert.equal(classifyTrafficLight({ fact: 100, plan: 100, polarity: "lower_better" }), "green");
assert.equal(classifyTrafficLight({ fact: 105, plan: 100, polarity: "lower_better" }), "yellow");
assert.equal(classifyTrafficLight({ fact: 120, plan: 100, polarity: "lower_better" }), "red");
assert.equal(PREDICTIVE_METRICS.revenue.polarity, "higher_better");
assert.equal(PREDICTIVE_METRICS.leads.polarity, "higher_better");

// Closed weeks: empty PTF; current week gated by as_of day range
const salePtf = buildPtfFormulasForMetric({ month: "2026-07", key: "sale" });
assert.equal(salePtf[1], "прогноз");
assert.equal(salePtf[july.weekBlocks[0].dayCols[0]], ""); // day cells stay empty
assert.match(salePtf[july.weekBlocks[0].totalCol], /AND\(\$A\$35>=1;\$A\$35<=5\)/); // Jul week1 = 1–5
assert.match(salePtf[july.weekBlocks[3].totalCol], /AND\(\$A\$35>=20;\$A\$35<=26\)/); // week4
assert.match(salePtf[july.monthCol], /31\/MAX\(1;MIN\(31;\$A\$35\)\)/);
assert.equal(
  buildPtfWeekFormula({
    factRef: "D8",
    planRef: "D7",
    periodDays: 7,
    startDay: 20,
    endDay: 26,
    timeScale: true
  }),
  `=IFERROR(IF(AND($A$35>=20;$A$35<=26);D8/D7*7/MAX(1;MIN(7;$A$35-20+1));"");"")`
);

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
    invoices: "3"
  }]
});
assert.equal(facts.leads, 10);
assert.equal(facts.deals, 4);
assert.equal(facts.sale, 2);
assert.equal(facts.revenue, 100);
assert.equal(facts.invoices, 3);
assert.equal(facts.aov, 50);

const byDate = collectFactsForMonth({
  month: "2026-07",
  mariaDaily: [],
  dailyFact: [{
    date: "2026-07-22",
    leads: "1",
    deals_created: "1",
    payments: "1",
    revenue: "10",
    invoices: "1"
  }]
});
const updates = buildFactCellUpdates({
  tabTitle: "Предиктивка продажи",
  dateToCol: map,
  factsByDate: byDate
});
assert.ok(updates.some((u) => u.range === "'Предиктивка продажи'!AE5")); // Jul22 revenue fact
assert.ok(updates.some((u) => u.range === "'Предиктивка продажи'!AE15")); // Jul22 leads fact
assert.ok(!updates.some((u) => /AE3[6-9]|AE4[0-9]|AE5[0-5]/.test(u.range)));

console.log("predictive-model tests ok");
