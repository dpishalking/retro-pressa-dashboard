import type { BitrixSnapshotDeal, BitrixSnapshotLead } from "@/lib/bitrix/snapshot-store";
import { hydrateDealProducts, isMissingProductLabel, resolveDealProductName } from "@/lib/bitrix/gift-type-resolver";
import {
  computeDealMargin,
  dealProductRevenue,
  type ProductHubMarginCatalog
} from "@/lib/product-hub/sku-margin-catalog";
import type { UnitEconomicsKind, UnitEconomicsUnit } from "@/types/analytics-os";

type BuildInput = {
  paidDeals: BitrixSnapshotDeal[];
  leads: BitrixSnapshotLead[];
  catalog: ProductHubMarginCatalog | null;
  adSpend: number | null;
  cpl: number | null;
  cac: number | null;
};

type Bucket = {
  id: string;
  name: string;
  orders: number;
  leads: number | null;
  revenue: number;
  cogs: number;
  cogsOrders: number;
  closeDate: string | null;
};

function emptyBucket(id: string, name: string, leads: number | null = null): Bucket {
  return {
    id,
    name,
    orders: 0,
    leads,
    revenue: 0,
    cogs: 0,
    cogsOrders: 0,
    closeDate: null
  };
}

function addDeal(bucket: Bucket, deal: BitrixSnapshotDeal, catalog: ProductHubMarginCatalog | null) {
  bucket.orders += 1;
  bucket.revenue += dealProductRevenue(deal);
  if (deal.closeDate && (!bucket.closeDate || deal.closeDate > bucket.closeDate)) {
    bucket.closeDate = deal.closeDate;
  }
  if (!catalog) return;
  const margin = computeDealMargin(deal, catalog);
  if (margin.cogs != null) {
    bucket.cogs += margin.cogs;
    bucket.cogsOrders += 1;
  }
}

function primaryProduct(deal: BitrixSnapshotDeal): { id: string; name: string } {
  const hydrated = hydrateDealProducts(deal);
  const line = hydrated.products.find(
    (item) =>
      (item.productName && !isMissingProductLabel(item.productName)) ||
      (item.productId && !isMissingProductLabel(item.productId))
  );
  const inferred = resolveDealProductName(hydrated);
  const name = line?.productName || line?.productId || inferred || "Не заполнен в CRM";
  if (isMissingProductLabel(name)) return { id: "crm_missing_product", name: "Не заполнен в CRM" };
  return {
    id: (line?.productId && !isMissingProductLabel(line.productId) ? line.productId : name) || name,
    name
  };
}

function saleCostForBucket(
  bucket: Bucket,
  input: BuildInput,
  mode: "average" | "by_leads" | "by_revenue" | "deal"
): { saleCost: number | null; note: string } {
  const { adSpend, cpl, cac, paidDeals } = input;
  const totalRevenue = paidDeals.reduce((sum, deal) => sum + dealProductRevenue(deal), 0);
  const totalLeads = input.leads.length;

  if (mode === "average") {
    if (cac != null) return { saleCost: cac, note: "Реклама / новые покупатели" };
    if (cpl != null && bucket.orders > 0 && totalLeads > 0) {
      return { saleCost: (cpl * totalLeads) / bucket.orders, note: "Реклама / оплаты (через цену лида)" };
    }
    return { saleCost: null, note: "Нет рекламного бюджета для стоимости продажи" };
  }

  if (mode === "deal") {
    if (cac != null) return { saleCost: cac, note: "Порог окупаемости = стоимость нового покупателя" };
    return { saleCost: null, note: "Нет CAC для сравнения одной продажи" };
  }

  if (mode === "by_leads") {
    if (cpl != null && bucket.leads != null && bucket.leads > 0 && bucket.orders > 0) {
      return {
        saleCost: (cpl * bucket.leads) / bucket.orders,
        note: "Цена лида × лиды юнита / оплаты юнита"
      };
    }
    if (cac != null) return { saleCost: cac, note: "Ориентир компании: стоимость нового покупателя" };
    return { saleCost: null, note: "Мало лидов или нет рекламы для оценки" };
  }

  // by_revenue — product / country / gift
  if (adSpend != null && adSpend > 0 && totalRevenue > 0 && bucket.orders > 0 && bucket.revenue > 0) {
    const allocated = adSpend * (bucket.revenue / totalRevenue);
    return {
      saleCost: allocated / bucket.orders,
      note: "Реклама разнесена по доле выручки юнита"
    };
  }
  if (cac != null) return { saleCost: cac, note: "Ориентир компании: стоимость нового покупателя" };
  return { saleCost: null, note: "Нет рекламы для разнесения по юниту" };
}

function toUnit(
  kind: UnitEconomicsKind,
  bucket: Bucket,
  cost: { saleCost: number | null; note: string }
): UnitEconomicsUnit {
  const mapped = bucket.cogsOrders > 0;
  const cogs = mapped ? bucket.cogs : null;
  const grossProfit = mapped ? bucket.revenue - bucket.cogs : null;
  const marginRate = mapped && bucket.revenue > 0 ? (bucket.revenue - bucket.cogs) / bucket.revenue : null;
  const aov = bucket.orders > 0 ? bucket.revenue / bucket.orders : 0;
  const profitAfterSaleCost =
    grossProfit == null || cost.saleCost == null ? null : grossProfit - cost.saleCost * bucket.orders;

  return {
    kind,
    id: bucket.id,
    name: bucket.name,
    orders: bucket.orders,
    leads: bucket.leads,
    revenue: bucket.revenue,
    aov,
    cogs,
    grossProfit,
    marginRate,
    saleCost: cost.saleCost,
    saleCostNote: cost.note,
    profitAfterSaleCost,
    mapped,
    closeDate: bucket.closeDate
  };
}

export function buildUnitEconomicsUnits(input: BuildInput): UnitEconomicsUnit[] {
  const { paidDeals, leads, catalog } = input;
  const units: UnitEconomicsUnit[] = [];

  const average = emptyBucket("average", "Средняя оплата", leads.length);
  for (const deal of paidDeals) addDeal(average, deal, catalog);
  units.push(toUnit("average", average, saleCostForBucket(average, input, "average")));

  const byProduct = new Map<string, Bucket>();
  const byManager = new Map<string, Bucket>();
  const byCountry = new Map<string, Bucket>();
  const byGift = new Map<string, Bucket>();

  for (const deal of paidDeals) {
    const product = primaryProduct(deal);
    const productBucket = byProduct.get(product.id) || emptyBucket(product.id, product.name);
    addDeal(productBucket, deal, catalog);
    byProduct.set(product.id, productBucket);

    const managerId = deal.assignedById || "unknown";
    const managerBucket =
      byManager.get(managerId) || emptyBucket(managerId, deal.managerName || "Без менеджера", 0);
    addDeal(managerBucket, deal, catalog);
    byManager.set(managerId, managerBucket);

    const country = deal.country?.trim() || "Не указана";
    const countryBucket = byCountry.get(country) || emptyBucket(country, country);
    addDeal(countryBucket, deal, catalog);
    byCountry.set(country, countryBucket);

    const gift = deal.giftTypes?.find((item) => item.trim()) || "Не указан";
    const giftBucket = byGift.get(gift) || emptyBucket(gift, gift);
    addDeal(giftBucket, deal, catalog);
    byGift.set(gift, giftBucket);
  }

  const leadsByManager = new Map<string, number>();
  for (const lead of leads) {
    const id = lead.assignedById || "unknown";
    leadsByManager.set(id, (leadsByManager.get(id) || 0) + 1);
  }
  for (const [id, bucket] of byManager) {
    bucket.leads = leadsByManager.get(id) || 0;
  }

  const sortByRevenue = (a: Bucket, b: Bucket) => b.revenue - a.revenue;

  for (const bucket of [...byProduct.values()].sort(sortByRevenue)) {
    units.push(toUnit("product", bucket, saleCostForBucket(bucket, input, "by_revenue")));
  }
  for (const bucket of [...byManager.values()].sort(sortByRevenue)) {
    units.push(toUnit("manager", bucket, saleCostForBucket(bucket, input, "by_leads")));
  }
  for (const bucket of [...byCountry.values()].sort(sortByRevenue)) {
    units.push(toUnit("country", bucket, saleCostForBucket(bucket, input, "by_revenue")));
  }
  for (const bucket of [...byGift.values()].sort(sortByRevenue)) {
    units.push(toUnit("gift_type", bucket, saleCostForBucket(bucket, input, "by_revenue")));
  }

  const dealBuckets = paidDeals
    .map((deal) => {
      const product = primaryProduct(deal);
      const bucket = emptyBucket(
        deal.id,
        deal.title?.trim() || `${product.name} · #${deal.id}`,
        null
      );
      addDeal(bucket, deal, catalog);
      bucket.closeDate = deal.closeDate;
      return bucket;
    })
    .sort((a, b) => String(b.closeDate || "").localeCompare(String(a.closeDate || "")))
    .slice(0, 80);

  for (const bucket of dealBuckets) {
    units.push(toUnit("deal", bucket, saleCostForBucket(bucket, input, "deal")));
  }

  return units;
}
