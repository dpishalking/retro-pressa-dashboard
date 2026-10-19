import assert from "node:assert/strict";
import { buildManagerSheet, historyRowsFromSheet, managerSheetTitle } from "@/lib/manager-qa-sample/sheet";
import {
  categoryForClosedDeal,
  isEligibleDialogue,
  isHardRefusalText,
  isHesitationText,
  isPaidInvoiceStage,
  isUnpaidIssuedInvoice,
  pickQaSamples,
  primaryManagerId,
  qaSampleWeek,
  readManualChecks,
  refusalFromStage,
  resolveQaCategory,
  silenceQualifies,
  type DialogueLine
} from "@/lib/manager-qa-sample/sample";

const sunday = new Date("2026-10-18T17:00:00Z");
const sundayWeek = qaSampleWeek(sunday);
assert.equal(sundayWeek.startDay, "2026-10-12");
assert.equal(sundayWeek.endDay, "2026-10-18");
assert.equal(sundayWeek.endIso, "2026-10-18T20:00:00+03:00");
assert.equal(sundayWeek.label, "12.10–18.10.2026");

const monday = new Date("2026-10-19T15:00:00Z");
const previous = qaSampleWeek(monday);
assert.equal(previous.startDay, "2026-10-12");
assert.equal(previous.endIso, "2026-10-18T20:00:00+03:00");

const forced = qaSampleWeek(monday, "2026-10-19");
assert.equal(forced.startDay, "2026-10-19");
assert.equal(forced.endDay, "2026-10-25");

assert.equal(isPaidInvoiceStage("DT31_2:P"), true);
assert.equal(isPaidInvoiceStage("WON"), false);
assert.equal(categoryForClosedDeal("WON"), null);
assert.equal(resolveQaCategory({ paid: true, refusal: false, invoiceUnpaid: true, silent: true }), "paid");

assert.equal(isHardRefusalText("Я не буду покупать"), true);
assert.equal(isHesitationText("дорого, подумаю"), true);
assert.equal(isHardRefusalText("дорого, подумаю"), false);
assert.equal(refusalFromStage("5", "дорого, подумаю"), "refusal");
assert.equal(refusalFromStage("UC_IN8ZIK", "дорого, подумаю"), "needs_review");
assert.equal(refusalFromStage("UC_IN8ZIK", "не буду покупать"), "refusal");
assert.equal(refusalFromStage("UC_18ZQLE", "не буду покупать"), null);
assert.equal(categoryForClosedDeal("UC_18ZQLE"), null);
assert.equal(categoryForClosedDeal("LOSE"), "client_silent");

assert.equal(isUnpaidIssuedInvoice("DT31_2:S"), true);
assert.equal(isUnpaidIssuedInvoice("DT31_2:D"), false);
assert.equal(isUnpaidIssuedInvoice("DT31_2:P"), false);

assert.equal(silenceQualifies({ lastRole: "manager", hours: 49, goodbye: false }), true);
assert.equal(silenceQualifies({ lastRole: "manager", hours: 12, goodbye: false }), false);
assert.equal(silenceQualifies({ lastRole: "client", hours: 49, goodbye: false }), false);
assert.equal(silenceQualifies({ lastRole: "manager", hours: 49, goodbye: true }), false);

function lines(count: number, role: DialogueLine["role"] = "client"): DialogueLine[] {
  return Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? role : "manager",
    text: index % 2 === 0 ? "Да" : "Какой формат смотрите?"
  }));
}

assert.equal(isEligibleDialogue(lines(4)), false);
assert.equal(isEligibleDialogue(lines(5)), true);
assert.equal(
  isEligibleDialogue([
    { role: "manager", text: "Диалог закреплен" },
    { role: "manager", text: "Session closed automatically" },
    { role: "manager", text: "Обращение перенаправлено" },
    { role: "manager", text: "начал работу с диалогом" },
    { role: "manager", text: "завершил работу с диалогом" }
  ]),
  false
);

assert.equal(resolveQaCategory({ paid: true, refusal: false, invoiceUnpaid: true, silent: false }), "paid");
assert.equal(resolveQaCategory({ paid: false, refusal: false, invoiceUnpaid: true, silent: true }), "invoice_unpaid");

assert.equal(primaryManagerId([{ managerId: "9", messages: 4 }, { managerId: "3", messages: 1 }], "3"), "9");
assert.equal(primaryManagerId([], "3"), "3");

const two = pickQaSamples(
  [
    { managerId: "1", category: "paid" as const, key: "a", day: "2026-10-12", eligible: true, repeat: false },
    { managerId: "1", category: "paid" as const, key: "b", day: "2026-10-13", eligible: true, repeat: false },
    { managerId: "1", category: "paid" as const, key: "short", day: "2026-10-14", eligible: false, repeat: false }
  ],
  3,
  "12.10–18.10.2026"
);
assert.equal(two.length, 2);
assert.equal(two.some((row) => row.key === "short"), false);

const managers = pickQaSamples(
  [
    { managerId: "1", category: "paid" as const, key: "a", day: "2026-10-12", eligible: true, repeat: false },
    { managerId: "2", category: "paid" as const, key: "b", day: "2026-10-12", eligible: true, repeat: false }
  ],
  3,
  "week"
);
assert.deepEqual(managers.map((row) => row.managerId).sort(), ["1", "2"]);

const repeatPool = [
  { managerId: "1", category: "refusal" as const, key: "fresh", day: "2026-10-12", eligible: true, repeat: false },
  { managerId: "1", category: "refusal" as const, key: "old", day: "2026-10-13", eligible: true, repeat: true }
];
assert.equal(pickQaSamples(repeatPool, 1, "week")[0]?.key, "fresh");
const once = pickQaSamples(repeatPool, 3, "week").map((row) => row.key);
const twice = pickQaSamples(repeatPool, 3, "week").map((row) => row.key);
assert.deepEqual(once, twice);

const manual = readManualChecks([
  ["Категория", "Проверено", "Оценка по чек-листу", "Комментарий руководителя", "Дата проверки", "Ключ"],
  ["A. Успешная оплата", "Да", "4", "коротко", "19.10.2026", "12.10–18.10.2026|9|deal|100|55"]
]);
assert.equal(manual.get("12.10–18.10.2026|9|deal|100|55")?.score, "4");
assert.equal(manual.get("12.10–18.10.2026|9|deal|100|55")?.comment, "коротко");

const sheet = buildManagerSheet({
  managerName: "Галина Кулиш",
  managerId: "9",
  weekLabel: "12.10–18.10.2026",
  period: "2026-10-12 00:00 — 2026-10-18 20:00 МСК",
  syncedAt: "2026-10-19 10:00",
  rows: [
    {
      managerId: "9",
      category: "paid",
      dealId: "100",
      sessionId: "55",
      channel: "WhatsApp",
      eventAt: "2026-10-14T11:00:00+03:00",
      liveMessages: 8,
      invoiceLabel: "Счёт 5478, оплачен",
      basis: "оплачено",
      crmUrl: "https://bb-wood.bitrix24.eu/crm/deal/details/100/",
      dialogUrl: "https://bb-wood.bitrix24.eu/online/?IM_DIALOG=chat1",
      key: "12.10–18.10.2026|9|deal|100|55",
      repeat: false
    }
  ],
  manual
});
const flat = sheet.flat().join("\n");
const dataRow = sheet.at(-1) || [];
assert.equal(dataRow[11], "Да");
assert.equal(dataRow[12], "4");
assert.equal(dataRow[13], "коротко");
assert.equal(flat.includes("Последняя реплика"), false);
assert.equal(flat.includes("+371"), false);
assert.match(flat, /A 1\/3/);

const archived = historyRowsFromSheet(sheet, "19.10–25.10.2026");
assert.equal(archived.previous.length, 1);
assert.equal(archived.previous[0]?.[10], "12.10–18.10.2026|9|deal|100|55");
assert.equal(managerSheetTitle("9", "Галина Кулиш"), "M_9_Галина");
assert.equal(managerSheetTitle("9", "A/B:C"), "M_9_ABC");

console.log("manager-qa-sample tests passed");
