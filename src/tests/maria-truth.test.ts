import assert from "node:assert/strict";
import {
  applyMariaTruthToDaily,
  parseMariaNumber,
  parseMariaReportDate,
  parseMariaTruthGrid
} from "@/lib/sales-os/maria-truth";
import { emptyMariaDailyRow } from "@/lib/sales-os/maria-daily";

assert.equal(parseMariaNumber("€21 729"), 21729);
assert.equal(parseMariaNumber("1859"), 1859);
assert.equal(parseMariaNumber("€1,50"), 1.5);
assert.equal(parseMariaNumber("1464%"), 1464);
assert.equal(parseMariaReportDate("Отчет за 21.07.2026(поменять день)"), "2026-07-21");

const grid = [
  ["Показатели за вчера", "", "", "Отчет за 21.07.2026", "", "", "ПЛАН"],
  ["Лидов трафик", "53", "", "", "", "", "Лиды", "3333"],
  ["Лидов органика", "4"],
  ["Счетов (шт)", "28", "", "", "", "", "Продажи", "667"],
  ["Счетов (евро)", "1859", "", "", "", "", "Выручка", "€46 667"],
  ["Показатели за месяц"],
  ["Счетов (шт)", "367"],
  ["Счетов (евро)", "€24 927"],
  ["Продаж (мес)", "314"],
  ["Выручка (мес)", "€21 729"],
  ["", "", "", "", "", "", "", "", "", "План по выручке", "32 076"]
];

const snap = parseMariaTruthGrid(grid);
assert.equal(snap.reportDate, "2026-07-21");
assert.equal(snap.yesterday.invoicesCount, 28);
assert.equal(snap.yesterday.invoicesAmount, 1859);
assert.equal(snap.month.salesCount, 314);
assert.equal(snap.month.revenue, 21729);
assert.equal(snap.plan.revenue, 46667);
assert.equal(snap.plan.runrateRevenue, 32076);

const existing = [emptyMariaDailyRow()];
existing[0].date = "2026-07-21";
existing[0].paid_total_count = "22";
existing[0].paid_total_amount = "1510";
existing[0].paid_same_day_count = "18";
existing[0].paid_same_day_amount = "1275";

const merged = applyMariaTruthToDaily({
  existing,
  snapshot: snap,
  syncedAt: "t"
});
const day = merged.find((row) => row.date === "2026-07-21")!;
assert.equal(day.invoices_count, "28");
assert.equal(day.invoices_amount, "1859");
assert.equal(day.paid_total_count, "22", "preserve chat paid totals");
assert.equal(day.paid_total_amount, "1510");

console.log("maria-truth.test.ts: ok");
