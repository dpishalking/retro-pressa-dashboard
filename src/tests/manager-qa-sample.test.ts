import assert from "node:assert/strict";
import {
  categoryForClosedDeal,
  indexRopNotes,
  pickQaSamples,
  qaSampleWeek,
  resolveQaCategory
} from "@/lib/manager-qa-sample/sample";

const sunday = new Date("2026-10-18T17:00:00Z");
const sundayWeek = qaSampleWeek(sunday);
assert.equal(sundayWeek.startDay, "2026-10-12");
assert.equal(sundayWeek.endDay, "2026-10-18");
assert.equal(sundayWeek.label, "12.10–18.10.2026");

const monday = new Date("2026-10-19T15:00:00Z");
const previous = qaSampleWeek(monday);
assert.equal(previous.startDay, "2026-10-12");
assert.equal(previous.endDay, "2026-10-18");

const forced = qaSampleWeek(monday, "2026-10-19");
assert.equal(forced.startDay, "2026-10-19");
assert.equal(forced.endDay, "2026-10-25");

assert.equal(categoryForClosedDeal("5"), "refusal");
assert.equal(categoryForClosedDeal("LOSE"), "client_silent");
assert.equal(categoryForClosedDeal("UC_18ZQLE"), null);
assert.equal(categoryForClosedDeal("WON"), null);

assert.equal(resolveQaCategory({ paid: true, refusal: true, invoiceUnpaid: true, silent: true }), "paid");
assert.equal(resolveQaCategory({ paid: false, refusal: true, invoiceUnpaid: true, silent: true }), "refusal");
assert.equal(resolveQaCategory({ paid: false, refusal: false, invoiceUnpaid: true, silent: true }), "invoice_unpaid");
assert.equal(resolveQaCategory({ paid: false, refusal: false, invoiceUnpaid: false, silent: true }), "client_silent");

const picked = pickQaSamples([
  { managerId: "1", category: "paid", richness: 2, lastAt: "2026-10-18", reviewable: false },
  { managerId: "1", category: "paid", richness: 4, lastAt: "2026-10-17", reviewable: true },
  { managerId: "1", category: "paid", richness: 9, lastAt: "2026-10-16", reviewable: true },
  { managerId: "1", category: "paid", richness: 8, lastAt: "2026-10-15", reviewable: true },
  { managerId: "1", category: "paid", richness: 20, lastAt: "2026-10-14", reviewable: true },
  { managerId: "2", category: "refusal", richness: 3, lastAt: "2026-10-18", reviewable: true }
]);
assert.deepEqual(
  picked.filter((row) => row.managerId === "1").map((row) => row.richness),
  [20, 9, 8]
);
assert.equal(picked.filter((row) => row.managerId === "2").length, 1);

const notes = indexRopNotes(
  [
    ["Неделя", "Диалог", "Сделка", "Оценка", "Комментарий"],
    ["12.10–18.10.2026", "https://chat/1", "https://deal/1", "4", "коротко"]
  ],
  "12.10–18.10.2026"
);
assert.equal(notes.get("https://deal/1")?.score, "4");
assert.equal(notes.get("https://chat/1")?.note, "коротко");
