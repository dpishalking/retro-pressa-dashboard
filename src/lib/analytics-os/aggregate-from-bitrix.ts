import type { BitrixSnapshot, BitrixSnapshotDeal, BitrixSnapshotLead } from "@/lib/bitrix/snapshot-store";
import { hydrateDealProducts, isMissingProductLabel, resolveDealProductName } from "@/lib/bitrix/gift-type-resolver";
import { resolveCustomerIdentity } from "@/lib/os-sheets/customer-identity";
import { averagePaidCheck, salesConversion } from "@/lib/metrics-engine";
import type { MonthlyMetrics } from "@/types/metrics";
import type {
  AnalyticsCountryRow,
  AnalyticsFunnelStage,
  AnalyticsManagerRow,
  AnalyticsNamedAmount,
  AnalyticsProductRow
} from "@/types/analytics-os";
import { safeDiv, safeShare } from "@/lib/analytics-os/metric-value";

export type AnalyticsFilters = {
  country?: string | null;
  managerId?: string | null;
  productId?: string | null;
};

function dealMatchesFilters(deal: BitrixSnapshotDeal, filters: AnalyticsFilters): boolean {
  if (filters.country && (deal.country || "") !== filters.country) return false;
  if (filters.managerId && deal.assignedById !== filters.managerId) return false;
  if (filters.productId) {
    const primary = deal.products.find((p) => p.productId || p.productName);
    const id = primary?.productId || primary?.productName || "";
    if (id !== filters.productId) return false;
  }
  return true;
}

function leadMatchesFilters(lead: BitrixSnapshotLead, filters: AnalyticsFilters): boolean {
  if (filters.country && (lead.country || "") !== filters.country) return false;
  if (filters.managerId && lead.assignedById !== filters.managerId) return false;
  return true;
}

function primaryProduct(deal: BitrixSnapshotDeal) {
  const hydrated = hydrateDealProducts(deal);
  const product = hydrated.products.find(
    (item) =>
      (item.productName && !isMissingProductLabel(item.productName)) ||
      (item.productId && !isMissingProductLabel(item.productId))
  );
  const inferred = resolveDealProductName(hydrated);
  const rawName = product?.productName || product?.productId || inferred || "Не заполнен в CRM";
  const name = isMissingProductLabel(rawName) ? "Не заполнен в CRM" : rawName;
  const id = product?.productId && !isMissingProductLabel(product.productId) ? product.productId : name;
  return {
    id,
    name,
    rows: hydrated.products.length,
    missing: isMissingProductLabel(name)
  };
}

function toNamedAmounts(
  rows: Array<{ id: string; name: string; revenue: number; orders: number }>,
  totalRevenue: number
): AnalyticsNamedAmount[] {
  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      revenue: row.revenue,
      orders: row.orders,
      share: safeShare(row.revenue, totalRevenue),
      aov: row.orders ? row.revenue / row.orders : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function filterSnapshot(snapshot: BitrixSnapshot, filters: AnalyticsFilters = {}) {
  const paidDeals = snapshot.paidDeals.filter((d) => dealMatchesFilters(d, filters));
  const invoiceDeals = snapshot.deals.filter((d) => dealMatchesFilters(d, filters));
  const leads = snapshot.leads.filter((l) => leadMatchesFilters(l, filters));
  const openPipeline = (snapshot.openPipeline || []).filter((d) => dealMatchesFilters(d, filters));
  return { paidDeals, invoiceDeals, leads, openPipeline };
}

export function sumPaidRevenue(paidDeals: BitrixSnapshotDeal[]): number {
  return paidDeals.reduce((sum, deal) => sum + (Number(deal.opportunity) || 0), 0);
}

export function buildMonthlyFromBitrix(input: {
  paidDeals: BitrixSnapshotDeal[];
  invoiceDeals: BitrixSnapshotDeal[];
  leads: BitrixSnapshotLead[];
  adSpend?: number;
  periodLabel: string;
}): MonthlyMetrics {
  const revenue = sumPaidRevenue(input.paidDeals);
  const invoicesAmount = input.invoiceDeals.reduce(
    (sum, deal) => sum + (deal.invoiceAmount > 0 ? deal.invoiceAmount : deal.opportunity || 0),
    0
  );
  return {
    month: input.periodLabel as MonthlyMetrics["month"],
    paidLeads: 0,
    organicLeads: input.leads.length,
    qualifiedLeads: 0,
    invoicesCount: input.invoiceDeals.length,
    invoicesAmount,
    cancelledInvoicesCount: 0,
    cancelledInvoicesAmount: 0,
    salesCount: input.paidDeals.length,
    revenue,
    adSpend: input.adSpend ?? 0,
    paidSalesCount: input.paidDeals.length,
    workingDays: 22,
    calendarDays: 30
  };
}

export function aggregateRevenueTree(
  paidDeals: BitrixSnapshotDeal[]
): {
  revenue: number;
  orders: number;
  aov: number | null;
  countries: AnalyticsNamedAmount[];
  products: AnalyticsNamedAmount[];
  managers: AnalyticsNamedAmount[];
} {
  const revenue = sumPaidRevenue(paidDeals);
  const orders = paidDeals.length;
  const byCountry = new Map<string, { revenue: number; orders: number }>();
  const byProduct = new Map<string, { name: string; revenue: number; orders: number }>();
  const byManager = new Map<string, { name: string; revenue: number; orders: number }>();

  for (const deal of paidDeals) {
    const amount = Number(deal.opportunity) || 0;
    const country = deal.country?.trim() || "Не указана";
    const countryAgg = byCountry.get(country) || { revenue: 0, orders: 0 };
    countryAgg.revenue += amount;
    countryAgg.orders += 1;
    byCountry.set(country, countryAgg);

    const product = primaryProduct(deal);
    if (!product.missing) {
      const productAgg = byProduct.get(product.id) || { name: product.name, revenue: 0, orders: 0 };
      productAgg.revenue += amount;
      productAgg.orders += 1;
      byProduct.set(product.id, productAgg);
    }

    const managerAgg = byManager.get(deal.assignedById) || {
      name: deal.managerName || deal.assignedById || "Без менеджера",
      revenue: 0,
      orders: 0
    };
    managerAgg.revenue += amount;
    managerAgg.orders += 1;
    byManager.set(deal.assignedById, managerAgg);
  }

  return {
    revenue,
    orders,
    aov: safeDiv(revenue, orders),
    countries: toNamedAmounts(
      [...byCountry.entries()].map(([name, v]) => ({ id: name, name, ...v })),
      revenue
    ),
    products: toNamedAmounts(
      [...byProduct.entries()].map(([id, v]) => ({ id, name: v.name, revenue: v.revenue, orders: v.orders })),
      revenue
    ),
    managers: toNamedAmounts(
      [...byManager.entries()].map(([id, v]) => ({ id, name: v.name, revenue: v.revenue, orders: v.orders })),
      revenue
    )
  };
}

export function aggregateFunnel(input: {
  leads: BitrixSnapshotLead[];
  invoiceDeals: BitrixSnapshotDeal[];
  paidDeals: BitrixSnapshotDeal[];
}): AnalyticsFunnelStage[] {
  const leadsCount = input.leads.length;
  // Unique deals created in period approximation: union of invoice deals + paid by id from snapshot deals lists.
  // Bitrix snapshot `deals` = invoices; for deal-created count use paid+invoice unique IDs as proxy when full deal list absent.
  const dealIds = new Set<string>();
  for (const deal of input.invoiceDeals) dealIds.add(deal.id);
  for (const deal of input.paidDeals) dealIds.add(deal.id);
  const dealsCount = dealIds.size;
  const invoicesCount = input.invoiceDeals.length;
  const paidCount = input.paidDeals.length;

  const stages: Array<{ id: string; label: string; count: number; status: AnalyticsFunnelStage["status"]; note?: string }> = [
    {
      id: "leads",
      label: "Карточки CRM",
      count: leadsCount,
      status: "live",
      note: "Все карточки Bitrix; верифицированные лиды показаны в KPI выше."
    },
    {
      id: "deals",
      label: "Сделки",
      count: dealsCount,
      status: "calculated",
      note: "Оценка: счета + оплаты из Bitrix."
    },
    { id: "invoices", label: "Счета", count: invoicesCount, status: "live" },
    { id: "paid", label: "Оплаты", count: paidCount, status: "live" }
  ];

  return stages.map((stage, index) => {
    const previous = index === 0 ? null : stages[index - 1].count;
    const conversionFromPrevious = previous && previous > 0 ? stage.count / previous : null;
    const dropOffFromPrevious = previous != null ? previous - stage.count : null;
    return {
      id: stage.id,
      label: stage.label,
      count: stage.count,
      status: stage.status,
      conversionFromPrevious,
      dropOffFromPrevious,
      medianDaysInStage: null,
      note: stage.note
    };
  });
}

export function aggregateManagers(input: {
  leads: BitrixSnapshotLead[];
  paidDeals: BitrixSnapshotDeal[];
}): AnalyticsManagerRow[] {
  const leadCounts = new Map<string, number>();
  for (const lead of input.leads) {
    leadCounts.set(lead.assignedById, (leadCounts.get(lead.assignedById) || 0) + 1);
  }

  const byManager = new Map<
    string,
    { name: string; paidOrders: number; revenue: number; productRows: number }
  >();

  for (const deal of input.paidDeals) {
    const existing = byManager.get(deal.assignedById) || {
      name: deal.managerName || deal.assignedById || "Без менеджера",
      paidOrders: 0,
      revenue: 0,
      productRows: 0
    };
    existing.paidOrders += 1;
    existing.revenue += Number(deal.opportunity) || 0;
    existing.productRows += Math.max(1, deal.products.length);
    byManager.set(deal.assignedById, existing);
  }

  const managerIds = new Set([...leadCounts.keys(), ...byManager.keys()]);
  const rows: AnalyticsManagerRow[] = [...managerIds].map((managerId) => {
    const paid = byManager.get(managerId);
    const leads = leadCounts.get(managerId) || 0;
    const paidOrders = paid?.paidOrders || 0;
    const revenue = paid?.revenue || 0;
    return {
      managerId,
      managerName: paid?.name || input.leads.find((l) => l.assignedById === managerId)?.managerName || managerId,
      leads,
      paidOrders,
      revenue,
      conversionRate: leads > 0 ? paidOrders / leads : null,
      aov: paidOrders > 0 ? revenue / paidOrders : null,
      revenuePerLead: leads > 0 ? revenue / leads : null,
      productsPerOrder: paidOrders > 0 ? (paid?.productRows || 0) / paidOrders : null,
      responseMinutes: null,
      responseConfidence: "low" as const,
      isTopPerformer: false
    };
  });

  rows.sort((a, b) => b.revenue - a.revenue);
  const eligible = rows.filter((r) => r.leads >= 10 && (r.revenuePerLead || 0) > 0);
  const ranked = (eligible.length ? eligible : rows.filter((r) => r.revenue > 0)).sort(
    (a, b) =>
      eligible.length
        ? (b.revenuePerLead || 0) - (a.revenuePerLead || 0)
        : b.revenue - a.revenue
  );
  const topCount = Math.max(1, Math.ceil(ranked.length * 0.2));
  const topIds = new Set(ranked.slice(0, topCount).map((r) => r.managerId));
  rows.forEach((row) => {
    row.isTopPerformer = topIds.has(row.managerId);
  });
  return rows;
}

export function aggregateProducts(
  paidDeals: BitrixSnapshotDeal[],
  marginByProduct?: Map<string, { cogs: number; revenue: number; orders: number; mapped: boolean }>
): {
  rows: AnalyticsProductRow[];
  missingOrders: number;
  missingRevenue: number;
  multiProductOrdersPct: number | null;
} {
  const byProduct = new Map<string, { name: string; orders: number; revenue: number; rowsSum: number }>();
  let multi = 0;
  let missingOrders = 0;
  let missingRevenue = 0;
  for (const deal of paidDeals) {
    if (deal.products.length > 1) multi += 1;
    const product = primaryProduct(deal);
    const amount = Number(deal.opportunity) || 0;
    if (product.missing) {
      missingOrders += 1;
      missingRevenue += amount;
      continue;
    }
    const agg = byProduct.get(product.id) || { name: product.name, orders: 0, revenue: 0, rowsSum: 0 };
    agg.orders += 1;
    agg.revenue += amount;
    agg.rowsSum += Math.max(1, deal.products.length);
    byProduct.set(product.id, agg);
  }
  const totalRevenue = sumPaidRevenue(paidDeals);
  const rows = [...byProduct.entries()]
    .map(([productId, v]) => {
      const margin = marginByProduct?.get(productId);
      const cogs = margin?.mapped ? margin.cogs : null;
      const grossProfit = cogs == null ? null : v.revenue - cogs;
      return {
        productId,
        productName: v.name,
        orders: v.orders,
        revenue: v.revenue,
        aov: v.orders ? v.revenue / v.orders : 0,
        share: safeShare(v.revenue, totalRevenue),
        productsPerOrder: v.orders ? v.rowsSum / v.orders : 0,
        cogs,
        grossProfit,
        marginRate: grossProfit == null || v.revenue <= 0 ? null : grossProfit / v.revenue
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return {
    rows,
    missingOrders,
    missingRevenue,
    multiProductOrdersPct: paidDeals.length ? multi / paidDeals.length : null
  };
}

export function aggregateCountries(input: {
  paidDeals: BitrixSnapshotDeal[];
  leads: BitrixSnapshotLead[];
}): AnalyticsCountryRow[] {
  const revenueByCountry = new Map<string, { revenue: number; orders: number }>();
  for (const deal of input.paidDeals) {
    const country = deal.country?.trim() || "Не указана";
    const agg = revenueByCountry.get(country) || { revenue: 0, orders: 0 };
    agg.revenue += Number(deal.opportunity) || 0;
    agg.orders += 1;
    revenueByCountry.set(country, agg);
  }

  const leadsByCountry = new Map<string, number>();
  const paidByLeadCountry = new Map<string, number>();
  const leadById = new Map(input.leads.map((lead) => [lead.id, lead]));

  for (const lead of input.leads) {
    const country = lead.country?.trim() || "Не указана";
    leadsByCountry.set(country, (leadsByCountry.get(country) || 0) + 1);
  }
  for (const deal of input.paidDeals) {
    const lead = deal.leadId ? leadById.get(deal.leadId) : undefined;
    const country = lead?.country?.trim() || "Не указана";
    paidByLeadCountry.set(country, (paidByLeadCountry.get(country) || 0) + 1);
  }

  const totalRevenue = sumPaidRevenue(input.paidDeals);
  const countries = new Set([...revenueByCountry.keys(), ...leadsByCountry.keys()]);

  return [...countries]
    .map((country) => {
      const money = revenueByCountry.get(country) || { revenue: 0, orders: 0 };
      const leads = leadsByCountry.get(country) ?? null;
      const paidFromLeadCountry = paidByLeadCountry.get(country) || 0;
      return {
        country,
        revenue: money.revenue,
        orders: money.orders,
        aov: money.orders ? money.revenue / money.orders : 0,
        share: safeShare(money.revenue, totalRevenue),
        leads,
        leadConversionRate: leads && leads > 0 ? paidFromLeadCountry / leads : null
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export function aggregateCustomers(paidDeals: BitrixSnapshotDeal[]) {
  const byKey = new Map<string, { paid: number; revenue: number }>();
  for (const deal of paidDeals) {
    const identity = resolveCustomerIdentity({
      contactId: deal.contactId,
      phone: deal.phone,
      email: deal.email,
      leadId: deal.leadId,
      dealId: deal.id,
      orderId: deal.id
    });
    if (!identity.customer_key) continue;
    const existing = byKey.get(identity.customer_key) || { paid: 0, revenue: 0 };
    existing.paid += 1;
    existing.revenue += Number(deal.opportunity) || 0;
    byKey.set(identity.customer_key, existing);
  }
  const customers = byKey.size;
  let repeatCustomers = 0;
  let totalRevenue = 0;
  for (const value of byKey.values()) {
    totalRevenue += value.revenue;
    if (value.paid > 1) repeatCustomers += 1;
  }
  const newCustomers = customers - repeatCustomers;
  return {
    customers,
    newCustomers,
    repeatCustomers,
    repeatRate: customers > 0 ? repeatCustomers / customers : null,
    avgCustomerRevenue: customers > 0 ? totalRevenue / customers : null
  };
}

export function conversionFromBitrix(leads: number, paidOrders: number): number | null {
  return safeDiv(paidOrders, leads);
}

export function aovFromBitrix(revenue: number, paidOrders: number): number | null {
  return safeDiv(revenue, paidOrders);
}

/** Thin wrapper keeping metrics-engine as formula source when MonthlyMetrics available. */
export function aovViaMetricsEngine(monthly: MonthlyMetrics): number {
  return averagePaidCheck(monthly);
}

export function salesConversionViaMetricsEngine(monthly: MonthlyMetrics): number {
  return salesConversion(monthly);
}
