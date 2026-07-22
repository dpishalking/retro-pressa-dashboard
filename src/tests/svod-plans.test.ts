import assert from "node:assert/strict";
import {
  findSvodPlanColumn,
  parseSvodDailyLeads,
  parseSvodDayDate,
  parseSvodObshiePlans,
  parseSvodPaidOrganicPlans,
  parseSvodPlanNumber
} from "@/lib/sales-os/svod-plans";

assert.equal(parseSvodPlanNumber("€36 274"), 36274);
assert.equal(parseSvodPlanNumber("3 334"), 3334);
assert.equal(parseSvodPlanNumber("#DIV/0!"), null);
assert.equal(parseSvodDayDate("21.07.2026"), "2026-07-21");

const grid: string[][] = [
  ["Показатели", "ИЮЛЬ", "Июль", "", "", "", "АВГУСТ", "Август"],
  ["", "", "План", "", "Факт", "", "", "План"],
  ["ОБЩИЕ"],
  ["Выручка", "", "€36274", "", "", "", "", "€37341"],
  ["Лиды", "", "3334", "", "", "", "", "3334"],
  ["Счета шт", "", "733", "", "", "", "", "733"],
  ["Оплаты шт.", "", "533", "", "", "", "", "533"],
  ["Средний чек оплата", "", "68", "", "", "", "", "70"],
  ["Facebook"],
  ["Выручка", "", "29017", "", "", "", "", "29870"]
];

assert.equal(findSvodPlanColumn(grid, "2026-07"), 2);
const plans = parseSvodObshiePlans(grid, "2026-07");
assert.ok(plans);
assert.equal(plans!.revenue, 36274);
assert.equal(plans!.leads, 3334);
assert.equal(plans!.invoices, 733);
assert.equal(plans!.sale, 533);
assert.equal(plans!.aov, 68);

const channelGrid: string[][] = [
  ["Показатели", "", "Июль", "", "Факт"],
  ["", "", "План", "", "Факт"],
  ["ОБЩИЕ"],
  ["Выручка", "", "36274"],
  ["Лиды", "", "3334"],
  ["Счета шт", "", "733"],
  ["Оплаты шт.", "", "533"],
  ["Средний чек оплата", "", "68"],
  ["Facebook"],
  ["Выручка", "", "29017"],
  ["Бюджет", "", "4500"],
  ["ROAS", "", "645"],
  ["Лиды", "", "2667"],
  ["CPL", "", "1.69"],
  ["Счета шт", "", "587"],
  ["Оплаты шт.", "", "427"],
  ["Конверсия Лид в счет", "", "22%"],
  ["Конверсия Лид в оплату", "", "16%"],
  ["Счет в оплату", "", "73%"],
  ["Средний чек оплата", "", "68"],
  ["Яндекс директ"],
  ["Выручка", "", ""],
  ["Лиды", "", ""],
  ["Счета шт", "", "0"],
  ["Оплаты шт.", "", "0"],
  ["Органика"],
  ["Выручка", "", "7257"],
  ["Лиды", "", "667"],
  ["Счета шт", "", "147"],
  ["Оплаты шт.", "", "107"],
  ["Конверсия Лид в счет", "", "22%"],
  ["Конверсия Лид в оплату", "", "16%"],
  ["Счет в оплату", "", "73%"],
  ["Средний чек оплата", "", "68"],
  ["Расходы"]
];
const channel = parseSvodPaidOrganicPlans(channelGrid, "2026-07");
assert.ok(channel);
assert.equal(channel!.obshie.revenue, 36274);
assert.equal(channel!.paid.revenue, 29017);
assert.equal(channel!.paid.leads, 2667);
assert.equal(channel!.paid.invoices, 587);
assert.equal(channel!.paid.sale, 427);
assert.equal(channel!.organic.revenue, 7257);
assert.equal(channel!.organic.leads, 667);
assert.equal(channel!.organic.sale, 107);
assert.equal(channel!.paid.crLeadInvoice, 0.22);
assert.equal(channel!.paid.crLeadSale, 0.16);
assert.equal(channel!.paid.crInvoiceSale, 0.73);
assert.equal(channel!.organic.crLeadSale, 0.16);
assert.ok(channel!.paidSections.some((s) => /facebook/i.test(s)));

const daily = parseSvodDailyLeads({
  paidSheet: [
    ["День", "x", "y", "z", "k", "Лиды CRM"],
    ["День"],
    ["21.07.2026", "", "", "", "", "53"],
    ["22.07.2026", "", "", "", "", "40"]
  ],
  organicSheet: [
    ["День", "a", "b", "c", "d", "e", "f", "g", "Лиды", "Лиды CRM"],
    ["День"],
    ["21.07.2026", "", "", "", "", "", "", "", "0", "4"],
    ["22.07.2026", "", "", "", "", "", "", "", "0", "10"]
  ],
  month: "2026-07"
});
assert.equal(daily.get("2026-07-21")?.paid, 53);
assert.equal(daily.get("2026-07-21")?.organic, 4);
assert.equal(daily.get("2026-07-21")?.total, 57);
assert.equal(daily.get("2026-07-22")?.total, 50);

console.log("svod-plans tests ok");
