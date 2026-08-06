import assert from "node:assert/strict";
import {
  accrueOnPaid,
  markCancelled,
  resolvePartnerForDeal,
  reverseOnRefund,
  syncPartnerAccrualsFromBitrix
} from "@/lib/partners/bitrix-attribution";
import { promoCodeFromSlug, slugifyPartnerName } from "@/lib/partners/promo";
import { recalculatePartnerAggregates } from "@/lib/partners/store";
import type { Partner, PartnerSale } from "@/types/partners";

function makePartner(overrides: Partial<Partner> = {}): Partner {
  const now = new Date().toISOString();
  return {
    id: "partner-1",
    userId: "user-1",
    name: "Даниил",
    email: "d@example.com",
    phone: "+37120000000",
    country: "LV",
    promoCode: "RETRO-DANIIL",
    referralSlug: "retro-daniil",
    commissionRate: 0.1,
    status: "active",
    payoutMethod: "",
    payoutDetails: "",
    clicks: 0,
    leads: 0,
    paidOrders: 0,
    salesTotal: 0,
    accrued: 0,
    paidOut: 0,
    available: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

const partnerA = makePartner();
const partnerB = makePartner({
  id: "partner-2",
  userId: "user-2",
  promoCode: "RETRO-OTHER",
  referralSlug: "retro-other",
  email: "o@example.com"
});

{
  const slug = slugifyPartnerName("Даниил Тест");
  assert.equal(slug, "daniil-test");
  assert.equal(promoCodeFromSlug(slug), "RETRO-DANIIL-TEST");
}

{
  const resolved = resolvePartnerForDeal(
    { id: "d1", opportunity: 100, promoCode: "retro-daniil", stageSemanticId: "S" },
    [partnerA, partnerB]
  );
  assert.equal(resolved?.partner.id, "partner-1");
  assert.equal(resolved?.attribution, "promo");
}

{
  const resolved = resolvePartnerForDeal(
    { id: "d2", opportunity: 100, utmCampaign: "retro-other", utmSource: "partner", stageSemanticId: "S" },
    [partnerA, partnerB]
  );
  assert.equal(resolved?.partner.id, "partner-2");
  assert.equal(resolved?.attribution, "referral");
}

{
  const resolved = resolvePartnerForDeal(
    { id: "d3", opportunity: 100, partnerUfId: "partner-1", stageSemanticId: "S" },
    [partnerA, partnerB]
  );
  assert.equal(resolved?.partner.id, "partner-1");
  assert.equal(resolved?.attribution, "manual");
}

{
  const result = accrueOnPaid({
    deal: { id: "deal-1", opportunity: 200, stageSemanticId: "S", promoCode: "RETRO-DANIIL", productTitle: "Газета" },
    partners: [partnerA, partnerB],
    existingSales: []
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.sale.commission, 20);
    assert.equal(result.sale.status, "paid");
  }
}

{
  const result = accrueOnPaid({
    deal: { id: "deal-open", opportunity: 200, stageSemanticId: "P", promoCode: "RETRO-DANIIL" },
    partners: [partnerA],
    existingSales: []
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "not_paid");
}

{
  const existing: PartnerSale[] = [
    {
      id: "sale-1",
      partnerId: "partner-1",
      dealId: "deal-owned",
      date: "2026-08-01",
      product: "Журнал",
      amount: 100,
      status: "paid",
      commission: 10,
      attribution: "promo",
      createdAt: "",
      updatedAt: ""
    }
  ];
  const again = accrueOnPaid({
    deal: { id: "deal-owned", opportunity: 100, stageSemanticId: "S", promoCode: "RETRO-DANIIL" },
    partners: [partnerA],
    existingSales: existing
  });
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.reason, "already_owned");
}

{
  const sales: PartnerSale[] = [
    {
      id: "sale-2",
      partnerId: "partner-1",
      dealId: "deal-refund",
      date: "2026-08-02",
      product: "Книга",
      amount: 150,
      status: "paid",
      commission: 15,
      attribution: "manual",
      createdAt: "",
      updatedAt: ""
    }
  ];
  const refunded = reverseOnRefund({ dealId: "deal-refund", existingSales: sales });
  assert.ok(refunded);
  assert.equal(refunded?.status, "refunded");
  assert.equal(refunded?.commission, 0);

  const updatedSales = sales.map((sale) => (sale.id === refunded!.id ? refunded! : sale));
  const aggregates = recalculatePartnerAggregates(partnerA, updatedSales, []);
  assert.equal(aggregates.accrued, 0);
  assert.equal(aggregates.available, 0);
}

{
  const sales: PartnerSale[] = [
    {
      id: "sale-3",
      partnerId: "partner-1",
      dealId: "deal-cancel",
      date: "2026-08-03",
      product: "Песня",
      amount: 40,
      status: "pending",
      commission: 4,
      attribution: "promo",
      createdAt: "",
      updatedAt: ""
    }
  ];
  const cancelled = markCancelled({ dealId: "deal-cancel", existingSales: sales });
  assert.equal(cancelled?.status, "cancelled");
  assert.equal(cancelled?.commission, 0);
  const aggregates = recalculatePartnerAggregates(partnerA, [cancelled!], []);
  assert.equal(aggregates.paidOrders, 0);
  assert.equal(aggregates.accrued, 0);
}

void (async () => {
  const sync = await syncPartnerAccrualsFromBitrix();
  assert.equal(sync.ok, false);
  assert.equal(sync.reason, "not_implemented");
  console.log("partners-attribution.test.ts: ok");
})();
