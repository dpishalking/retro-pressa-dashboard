import assert from "node:assert/strict";
import {
  countUniqueLeads,
  countUniqueLeadsWithHistory,
  normalizePhone,
  pipelineAgeAnalysis,
  sumDelivery
} from "@/lib/analytics-os/decision-extras";
import type { BitrixSnapshotDeal } from "@/lib/bitrix/snapshot-store";

assert.equal(normalizePhone("37120000001"), "7120000001");
assert.equal(normalizePhone("20000001"), "20000001");
assert.equal(normalizePhone("37128373939"), "");
assert.equal(normalizePhone("+371 28373939"), "");

{
  const stats = countUniqueLeads([
    { id: "1", phones: ["+37120000001"], emails: [] },
    { id: "2", phones: ["37120000001"], emails: [] },
    { id: "3", phones: [], emails: ["a@test.com"] },
    { id: "4", phones: [], emails: ["A@test.com"] },
    { id: "5", phones: [], emails: [] }
  ]);
  assert.equal(stats.created, 5);
  assert.equal(stats.unique, 3);
  assert.equal(stats.duplicateApprox, 2);
}

{
  const history = [{ id: "h1", phones: ["37120000001"], emails: [] }];
  const period = [
    { id: "1", phones: ["37120000001"], emails: [] },
    { id: "2", phones: ["37120000099"], emails: [] }
  ];
  const stats = countUniqueLeadsWithHistory(period, history);
  assert.equal(stats.unique, 1);
  assert.equal(stats.historyDuplicates, 1);
  assert.equal(stats.duplicateApprox, 1);
}

{
  const deals = [
    { opportunity: 100, deliveryPrice: 10 },
    { opportunity: 50, deliveryPrice: 0 },
    { opportunity: 80, deliveryPrice: null }
  ] as BitrixSnapshotDeal[];
  const d = sumDelivery(deals);
  assert.equal(d.cash, 230);
  assert.equal(d.delivery, 12.65);
  assert.equal(d.productRevenue, 217.35);
  assert.equal(d.deliverySharePct, 0.055);
  assert.equal(d.dealsWithDelivery, 1);
  assert.equal(d.dealsWithField, 2);
}

{
  const now = new Date("2026-08-08T12:00:00Z");
  const open = [
    {
      opportunity: 100,
      dateCreate: "2026-06-01T12:00:00Z",
      lastActivityAt: "2026-08-07T12:00:00Z",
      stageId: "UC_1",
      stageName: "В диалоге"
    },
    {
      opportunity: 200,
      dateCreate: "2026-07-20T12:00:00Z",
      lastActivityAt: "2026-07-20T12:00:00Z",
      stageId: "UC_2",
      stageName: "Производство"
    },
    {
      opportunity: 50,
      dateCreate: "2026-06-01T12:00:00Z",
      stageId: "UC_1",
      stageName: "В диалоге"
    }
  ] as BitrixSnapshotDeal[];
  const age = pipelineAgeAnalysis(open, now);
  // First deal: idle 1 day (activity), not stuck; second+third idle long → stuck
  assert.equal(age.stuckOver7d.deals, 2);
  assert.equal(age.stuckOver7d.amount, 250);
  assert.equal(age.totalAmount, 350);
  assert.ok(age.byStage.length >= 2);
  assert.ok((age.activityCoveragePct || 0) > 0.5);
}

console.log("decision-extras.test.ts: ok");
