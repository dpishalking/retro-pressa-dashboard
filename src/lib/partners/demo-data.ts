import { generateId } from "@/lib/training/id";
import type { Partner, PartnerPayout, PartnerSale, PartnersCatalog } from "@/types/partners";

export const DEFAULT_COMMISSION_RATE = 0.1;

export function emptyPartnerAggregates() {
  return {
    clicks: 0,
    leads: 0,
    paidOrders: 0,
    salesTotal: 0,
    accrued: 0,
    paidOut: 0,
    available: 0
  };
}

export function createDemoPartnerSeed(): PartnersCatalog {
  const now = new Date().toISOString();
  const partnerId = "partner-demo-daniil";
  const userId = "user-partner-demo";

  const partner: Partner = {
    id: partnerId,
    userId,
    name: "Даниил Демо",
    email: "partner.demo@retro-pressa.com",
    phone: "+37120000000",
    country: "Latvia",
    promoCode: "RETRO-DANIIL",
    referralSlug: "retro-daniil",
    commissionRate: DEFAULT_COMMISSION_RATE,
    status: "active",
    payoutMethod: "Банковский перевод",
    payoutDetails: "LV00BANK0000000000000",
    clicks: 248,
    leads: 36,
    paidOrders: 12,
    salesTotal: 1860,
    accrued: 186,
    paidOut: 80,
    available: 106,
    tier: "standard",
    createdAt: now,
    updatedAt: now
  };

  const sales: PartnerSale[] = [
    {
      id: generateId("sale"),
      partnerId,
      dealId: "demo-1001",
      date: "2026-07-28",
      product: "Газета",
      amount: 59,
      status: "paid",
      commission: 5.9,
      attribution: "promo",
      createdAt: now,
      updatedAt: now
    },
    {
      id: generateId("sale"),
      partnerId,
      dealId: "demo-1002",
      date: "2026-07-30",
      product: "Журнал",
      amount: 89,
      status: "paid",
      commission: 8.9,
      attribution: "referral",
      createdAt: now,
      updatedAt: now
    },
    {
      id: generateId("sale"),
      partnerId,
      dealId: "demo-1003",
      date: "2026-08-01",
      product: "Книга жизни",
      amount: 169,
      status: "paid",
      commission: 16.9,
      attribution: "manual",
      createdAt: now,
      updatedAt: now
    },
    {
      id: generateId("sale"),
      partnerId,
      dealId: "demo-1004",
      date: "2026-08-02",
      product: "Видеооживление",
      amount: 39,
      status: "pending",
      commission: 3.9,
      attribution: "promo",
      createdAt: now,
      updatedAt: now
    },
    {
      id: generateId("sale"),
      partnerId,
      dealId: "demo-1005",
      date: "2026-08-03",
      product: "Поздравительная песня",
      amount: 49,
      status: "paid",
      commission: 4.9,
      attribution: "referral",
      createdAt: now,
      updatedAt: now
    },
    {
      id: generateId("sale"),
      partnerId,
      dealId: "demo-1006",
      date: "2026-08-04",
      product: "Открытки",
      amount: 29,
      status: "cancelled",
      commission: 0,
      attribution: "promo",
      createdAt: now,
      updatedAt: now
    }
  ];

  const payouts: PartnerPayout[] = [
    {
      id: generateId("payout"),
      partnerId,
      date: "2026-07-15",
      amount: 40,
      status: "paid",
      method: "Банковский перевод",
      createdAt: now,
      updatedAt: now
    },
    {
      id: generateId("payout"),
      partnerId,
      date: "2026-08-01",
      amount: 40,
      status: "paid",
      method: "Банковский перевод",
      createdAt: now,
      updatedAt: now
    }
  ];

  return {
    version: 1,
    partners: [partner],
    sales,
    payouts,
    updatedAt: now
  };
}
