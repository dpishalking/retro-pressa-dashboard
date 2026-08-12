import assert from "node:assert/strict";
import {
  aggregateDays,
  cumulativeRoasThroughDay,
  monthWindowMature,
  parseLandingEfficiencySheet
} from "../lib/landings/load-landing-efficiency";
import { alxLandingDisplayName } from "../config/alx-landings";

const values = [
  ["", "Расход", "Заказы", "ROAS", "Клики", "Лиды CRM", "Квал. лиды", "CR лендинга", "CPL", "CPQL", "CR в продажу", "Кол-во заказов"],
  ["День", "€100,00", "€250,00", "250%", "1000", "50", "20", "5,00%", "€2,00", "€5,00", "10,00%", "5"],
  ["01.08.2026", "€40,00", "€100,00", "250%", "400", "20", "8", "5,00%", "€2,00", "€5,00", "10,00%", "2"],
  ["02.08.2026", "€60,00", "€150,00", "250%", "600", "30", "12", "5,00%", "€2,00", "€5,00", "10,00%", "3"],
  ["08.08.2026", "€20,00", "€80,00", "400%", "200", "10", "4", "5,00%", "€2,00", "€5,00", "10,00%", "1"],
  ["01.07.2026", "€10,00", "€0,00", "0%", "50", "2", "1", "4,00%", "€5,00", "€10,00", "-", "0"]
];

const parsed = parseLandingEfficiencySheet(values, "2026-08");
assert.equal(parsed.days.length, 3);
assert.equal(parsed.days[0].date, "2026-08-01");
assert.equal(parsed.days[0].spend, 40);
assert.equal(parsed.days[1].revenue, 150);
assert.equal(parsed.sheetTotals.spend, 100);
assert.equal(parsed.sheetTotals.roas, 2.5);

const july = parseLandingEfficiencySheet(values, "2026-07");
assert.equal(july.days.length, 1);
assert.equal(july.days[0].date, "2026-07-01");

// D7 includes days 1,2 only (day 8 is outside 1..7) → (100+150)/(40+60) = 2.5
assert.equal(cumulativeRoasThroughDay(parsed.days, 7), 2.5);
// D30 includes all three days → 330/120 = 2.75
assert.equal(cumulativeRoasThroughDay(parsed.days, 30), 330 / 120);

assert.equal(monthWindowMature("2026-08", 7, "2026-08-06"), false);
assert.equal(monthWindowMature("2026-08", 7, "2026-08-07"), true);
assert.equal(monthWindowMature("2026-07", 30, "2026-08-01"), true);

const immature = aggregateDays(parsed.days, "2026-08", "2026-08-03");
assert.equal(immature.roasD7Mature, false);
assert.equal(immature.roasD7, null);
assert.equal(immature.roas, 330 / 120);

const mature = aggregateDays(parsed.days, "2026-08", "2026-08-31");
assert.equal(mature.roasD7Mature, true);
assert.equal(mature.roasD30Mature, true);
assert.equal(mature.roasD7, 2.5);
assert.equal(mature.roasD30, 330 / 120);

const noTraffic = parseLandingEfficiencySheet(
  [
    ["", "Расход", "Заказы", "ROAS", "Клики", "Лиды CRM"],
    ["День"],
    ["01.08.2026", "€0,00", "€0,00", "0%", "0", "0"]
  ],
  "2026-08"
);
assert.equal(noTraffic.days.length, 1);
assert.equal(noTraffic.days[0].spend, 0);

assert.equal(alxLandingDisplayName({ sheetTitle: "https://retro-pressa.com/life" }), "retro-pressa.com/life");
assert.equal(alxLandingDisplayName({ sheetTitle: "https://retro-pressa.com/ru/" }), "retro-pressa.com/ru");

console.log("landing-efficiency.test.ts: ok");
