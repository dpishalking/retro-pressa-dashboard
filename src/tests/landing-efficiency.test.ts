import assert from "node:assert/strict";
import { parseLandingEfficiencySheet } from "../lib/landings/load-landing-efficiency";

const values = [
  ["", "Расход", "Заказы", "ROAS", "Клики", "Лиды CRM", "Квал. лиды", "CR лендинга", "CPL", "CPQL", "CR в продажу", "Кол-во заказов"],
  ["День", "€100,00", "€250,00", "250%", "1000", "50", "20", "5,00%", "€2,00", "€5,00", "10,00%", "5"],
  ["01.08.2026", "€40,00", "€100,00", "250%", "400", "20", "8", "5,00%", "€2,00", "€5,00", "10,00%", "2"],
  ["02.08.2026", "€60,00", "€150,00", "250%", "600", "30", "12", "5,00%", "€2,00", "€5,00", "10,00%", "3"],
  ["01.07.2026", "€10,00", "€0,00", "0%", "50", "2", "1", "4,00%", "€5,00", "€10,00", "-", "0"]
];

const parsed = parseLandingEfficiencySheet(values, "2026-08");
assert.equal(parsed.days.length, 2);
assert.equal(parsed.days[0].date, "2026-08-01");
assert.equal(parsed.days[0].spend, 40);
assert.equal(parsed.days[1].revenue, 150);
assert.equal(parsed.sheetTotals.spend, 100);
assert.equal(parsed.sheetTotals.roas, 2.5);

const july = parseLandingEfficiencySheet(values, "2026-07");
assert.equal(july.days.length, 1);
assert.equal(july.days[0].date, "2026-07-01");

console.log("landing-efficiency.test.ts: ok");
