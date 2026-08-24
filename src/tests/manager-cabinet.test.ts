import assert from "node:assert/strict";
import { canAccessRoute } from "@/lib/auth/access";
import { canAccessManagerCabinet, canPickCabinetManager } from "@/lib/manager-cabinet/access";
import { aggregateManagerCabinetFacts } from "@/lib/manager-cabinet/facts";
import { matchUniqueByName, namesMatch } from "@/lib/manager-cabinet/match";
import { cabinetWindowBounds } from "@/lib/manager-cabinet/period";
import {
  firstCabinetManagerId,
  resolveBitrixUserId,
  resolveCabinetTarget
} from "@/lib/manager-cabinet/resolve-target";
import { staticRoster } from "@/lib/manager-cabinet/roster";
import { prorateByShifts } from "@/lib/payroll/calculator";
import type { BitrixSnapshot } from "@/lib/bitrix/snapshot-store";

assert.equal(canAccessRoute("mop", "/me"), true);
assert.equal(canAccessManagerCabinet("mop"), true);
assert.equal(canPickCabinetManager("mop"), false);
assert.equal(canPickCabinetManager("rop"), true);
assert.equal(canAccessRoute("partner", "/me"), false);

{
  const h1 = cabinetWindowBounds("2026-08", "h1");
  assert.equal(h1.start, "2026-08-01");
  assert.equal(h1.end, "2026-08-15");
  const h2 = cabinetWindowBounds("2026-08", "h2");
  assert.equal(h2.start, "2026-08-16");
  assert.equal(h2.end, "2026-08-31");
}

assert.equal(namesMatch("Надежда", "Надежда Веклич"), true);
assert.equal(namesMatch("Анастасия", "Anastasija Zabkova"), true);
assert.equal(namesMatch("Елена", "Jelena Zabkova"), true);
assert.equal(namesMatch("Кира", "Надежда Веклич"), false);

{
  const roster = staticRoster();
  assert.equal(resolveBitrixUserId({ bitrixUserId: "98908", name: "X" }, roster), "98908");
  assert.equal(resolveBitrixUserId({ bitrixUserId: null, name: "Надежда" }, roster), "98908");
  assert.equal(matchUniqueByName("Надежда", roster)?.bitrixId, "98908");

  const darya = {
    id: "user-darya",
    name: "Дарья",
    bitrixUserId: null,
    accessLevel: "mop" as const,
    active: true
  };
  const adminDefault = resolveCabinetTarget({
    accessLevel: "admin",
    sessionId: "admin",
    requestedId: null,
    users: [darya],
    roster
  });
  assert.equal(adminDefault.bitrixUserId, "98908");
  assert.equal(adminDefault.managerName, "Надежда Веклич");

  const adminPicked = resolveCabinetTarget({
    accessLevel: "admin",
    sessionId: "admin",
    requestedId: "3290",
    users: [darya],
    roster
  });
  assert.equal(adminPicked.bitrixUserId, "3290");
  assert.equal(adminPicked.managerName, "Anastasija Zabkova");

  const mopUnlinked = resolveCabinetTarget({
    accessLevel: "mop",
    sessionId: "user-darya",
    requestedId: "98908",
    users: [darya],
    roster
  });
  assert.equal(mopUnlinked.bitrixUserId, null);
  assert.equal(mopUnlinked.authName, "Дарья");

  assert.equal(firstCabinetManagerId(roster, null), "98908");
  assert.equal(firstCabinetManagerId(roster, "3290"), "3290");
  assert.equal(firstCabinetManagerId(roster, ""), "98908");
}

assert.equal(Math.round(prorateByShifts(4000, 7, 15) * 100) / 100, 1866.67);

{
  const snapshot = {
    version: 2,
    period: "august-2026",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    factualEnd: "2026-08-31",
    createdAt: "2026-08-24T00:00:00.000Z",
    countryOptions: [],
    productOptions: [],
    leads: [
      { id: "1", dateCreate: "2026-08-02", statusId: "CONVERTED", assignedById: "98908", managerName: "Надежда", country: "", utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, landingPage: null, formName: null, sourceId: null },
      { id: "2", dateCreate: "2026-08-03", statusId: "1", assignedById: "98908", managerName: "Надежда", country: "", utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, landingPage: null, formName: null, sourceId: null },
      { id: "3", dateCreate: "2026-08-20", statusId: "IN_PROCESS", assignedById: "98908", managerName: "Надежда", country: "", utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, landingPage: null, formName: null, sourceId: null },
      { id: "4", dateCreate: "2026-08-04", statusId: "NEW", assignedById: "3290", managerName: "Анастасия", country: "", utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, landingPage: null, formName: null, sourceId: null }
    ],
    recentLeads: [],
    deals: [
      { id: "d1", title: "Счёт 1", leadId: null, contactId: null, dateCreate: "2026-08-05", closeDate: "2026-08-05", invoiceDate: "2026-08-05", opportunity: 80, currencyId: "EUR", invoiceAmount: 80, stageId: "1", stageSemanticId: "S", sourceId: null, assignedById: "98908", managerName: "Надежда", country: "", utmCampaign: null, landingPage: null, phone: null, email: null, products: [] }
    ],
    paidDeals: [
      { id: "p1", title: "Оплата 1", leadId: null, contactId: null, dateCreate: "2026-08-05", closeDate: "2026-08-06", invoiceDate: "2026-08-05", paymentDate: "2026-08-06", opportunity: 80, currencyId: "EUR", invoiceAmount: 80, stageId: "P", stageSemanticId: "S", sourceId: null, assignedById: "98908", managerName: "Надежда", country: "", utmCampaign: null, landingPage: null, phone: null, email: null, products: [] }
    ]
  } as BitrixSnapshot;

  const h1 = aggregateManagerCabinetFacts({
    snapshot,
    bitrixUserId: "98908",
    managerName: "Надежда Веклич",
    start: "2026-08-01",
    end: "2026-08-15"
  });
  assert.equal(h1.leads, 1);
  assert.equal(h1.qualifiedLeads, 1);
  assert.equal(h1.payments, 1);
  assert.equal(h1.revenueEur, 80);
  assert.equal(h1.avgCheckEur, 80);

  const month = aggregateManagerCabinetFacts({
    snapshot,
    bitrixUserId: "98908",
    managerName: "Надежда Веклич",
    start: "2026-08-01",
    end: "2026-08-31"
  });
  assert.equal(month.leads, 2);
}

console.log("manager-cabinet.test.ts: ok");
