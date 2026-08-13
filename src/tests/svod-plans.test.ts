import assert from "node:assert/strict";
import {
  findSvodPlanColumn,
  parseMonthlyPlanIndicators,
  parseSvodDailyLeads,
  parseSvodDayDate,
  parseSvodObshiePlans,
  parseSvodPaidOrganicPlans,
  parseSvodPlanNumber,
  resolveCompanyMonthPlan,
  sumSvodVerifiedLeads
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

const fullIndicators = parseMonthlyPlanIndicators(
  [
    ["Показатели", "", "Июль", "", "", "", "", "Август"],
    ["", "", "План", "", "Факт", "", "", "План"],
    ["ОБЩИЕ"],
    ["Выручка", "", "36274", "", "", "", "", "46676"],
    ["Бюджет", "", "4500", "", "", "", "", "4500"],
    ["Лиды", "", "3334", "", "", "", "", "3334"],
    ["Оплаты шт.", "", "533", "", "", "", "", "667"],
    ["Facebook"],
    ["Выручка", "", "29017", "", "", "", "", "37338"],
    ["Расходы"],
    ["Аренда офиса Минск", "", "500", "", "", "", "", "500"]
  ],
  "2026-08"
);
assert.equal(fullIndicators.length, 6);
assert.equal(fullIndicators[0].label, "Выручка");
assert.equal(fullIndicators[0].value, 46676);
assert.equal(fullIndicators[4].section, "Facebook");
assert.equal(fullIndicators[5].section, "Расходы");

// `day` Лиды CRM is already ALX+Органика; Органика is breakdown only.
const daily = parseSvodDailyLeads({
  paidSheet: [
    ["День", "Расход", "y", "z", "k", "Лиды CRM"],
    ["День"],
    ["21.07.2026", "120,5", "", "", "", "57"],
    ["22.07.2026", "80", "", "", "", "50"],
    ["23.07.2026", "40", "", "", "", "10"]
  ],
  organicSheet: [
    ["День", "a", "b", "c", "d", "e", "f", "g", "Лиды", "Лиды CRM"],
    ["День"],
    ["21.07.2026", "", "", "", "", "", "", "", "0", "4"],
    ["22.07.2026", "", "", "", "", "", "", "", "0", "10"],
    ["23.07.2026", "", "", "", "", "", "", "", "0", "1"]
  ],
  month: "2026-07"
});
assert.equal(daily.get("2026-07-21")?.total, 57);
assert.equal(daily.get("2026-07-21")?.organic, 4);
assert.equal(daily.get("2026-07-21")?.paid, 53);
assert.equal(daily.get("2026-07-21")?.spend, 120.5);
assert.equal(daily.get("2026-07-22")?.total, 50);
assert.equal(daily.get("2026-07-22")?.paid, 40);

const verifiedMtd = sumSvodVerifiedLeads(daily, { month: "2026-07", throughDate: "2026-07-21" });
assert.equal(verifiedMtd.total, 57);
assert.equal(verifiedMtd.paid, 53);
assert.equal(verifiedMtd.organic, 4);
assert.equal(verifiedMtd.spend, 120.5);
assert.equal(verifiedMtd.days, 1);
assert.equal(verifiedMtd.lastDay, "2026-07-21");

// REGRESSION: day «Лиды CRM» = 851 already includes organic. Never 851+200=1051.
const noDoubleOrganic = parseSvodDailyLeads({
  paidSheet: [
    ["День", "x", "y", "z", "k", "Лиды CRM"],
    ["День"],
    ["01.08.2026", "", "", "", "", "851"]
  ],
  organicSheet: [
    ["День", "a", "b", "c", "d", "e", "f", "g", "Лиды", "Лиды CRM"],
    ["День"],
    ["01.08.2026", "", "", "", "", "", "", "", "0", "200"]
  ],
  month: "2026-08"
});
assert.equal(noDoubleOrganic.get("2026-08-01")?.total, 851);
assert.equal(noDoubleOrganic.get("2026-08-01")?.organic, 200);
assert.equal(noDoubleOrganic.get("2026-08-01")?.paid, 651);
assert.notEqual(noDoubleOrganic.get("2026-08-01")?.total, 851 + 200);
const mtd851 = sumSvodVerifiedLeads(noDoubleOrganic, { month: "2026-08" });
assert.equal(mtd851.total, 851);
assert.equal(mtd851.paid + mtd851.organic, mtd851.total);

const facebookFirst: string[][] = [
  ["Показатели", "", "Август"],
  ["", "", "План"],
  ["Facebook"],
  ["Выручка", "", "37338"],
  ["Лиды", "", "2667"],
  ["Оплаты шт.", "", "533"],
  ["Средний чек оплата", "", "70"],
  ["Конверсия Лид в оплату", "", "20%"],
  ["Органика"],
  ["Выручка", "", "9338"],
  ["Лиды", "", "667"],
  ["Оплаты шт.", "", "134"],
  ["ОБЩИЕ"],
  ["Выручка", "", "46676"],
  ["Лиды", "", "3334"],
  ["Оплаты шт.", "", "667"],
  ["Средний чек оплата", "", "70"]
];
const facebookFirstObshie = parseSvodObshiePlans(facebookFirst, "2026-08");
assert.equal(facebookFirstObshie?.revenue, 46676);
assert.equal(facebookFirstObshie?.leads, 3334);
assert.equal(facebookFirstObshie?.sale, 667);
const facebookFirstChannels = parseSvodPaidOrganicPlans(facebookFirst, "2026-08");
const recovered = resolveCompanyMonthPlan({
  obshie: facebookFirstObshie,
  channels: facebookFirstChannels
});
assert.equal(recovered.revenue, 46676);
assert.equal(recovered.leads, 3334);

const copiedFacebookAsCompany: string[][] = [
  ["Показатели", "", "Август"],
  ["", "", "План"],
  ["ОБЩИЕ"],
  ["Выручка", "", "37338"],
  ["Лиды", "", "2667"],
  ["Оплаты шт.", "", "533"],
  ["Средний чек оплата", "", "70"],
  ["Facebook"],
  ["Выручка", "", "37338"],
  ["Лиды", "", "2667"],
  ["Оплаты шт.", "", "533"],
  ["Органика"],
  ["Выручка", "", "9338"],
  ["Лиды", "", "667"],
  ["Оплаты шт.", "", "134"]
];
const copied = resolveCompanyMonthPlan({
  obshie: parseSvodObshiePlans(copiedFacebookAsCompany, "2026-08"),
  channels: parseSvodPaidOrganicPlans(copiedFacebookAsCompany, "2026-08")
});
assert.equal(copied.revenue, 46676);
assert.equal(copied.leads, 3334);
assert.equal(copied.sale, 667);

const loweredOnPurpose: string[][] = [
  ["Показатели", "", "Август"],
  ["", "", "План"],
  ["ОБЩИЕ"],
  ["Выручка", "", "37338"],
  ["Лиды", "", "2667"],
  ["Оплаты шт.", "", "533"],
  ["Средний чек оплата", "", "70"],
  ["Facebook"],
  ["Выручка", "", "28000"],
  ["Лиды", "", "2000"],
  ["Оплаты шт.", "", "400"],
  ["Органика"],
  ["Выручка", "", "9338"],
  ["Лиды", "", "667"],
  ["Оплаты шт.", "", "133"]
];
const lowered = resolveCompanyMonthPlan({
  obshie: parseSvodObshiePlans(loweredOnPurpose, "2026-08"),
  channels: parseSvodPaidOrganicPlans(loweredOnPurpose, "2026-08")
});
assert.equal(lowered.revenue, 37338);
assert.equal(lowered.leads, 2667);

console.log("svod-plans tests ok");
