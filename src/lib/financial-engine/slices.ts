import type { CompanySnapshot } from "@/lib/company-snapshot/types";
import type { FinancialContext, FinancialSlice, SliceDimension, UnitEconomicsItem, FinancialUnit } from "./types";
import type { PnLStatement } from "./types";
import { lineageNode } from "./explainability";
import { margin, safeDiv } from "./math";

export type SliceBuilder = {
  dimension: SliceDimension;
  build: (snapshot: CompanySnapshot, ctx: FinancialContext, pnl: PnLStatement) => FinancialSlice[];
};

function productSliceBuilder(): SliceBuilder {
  return {
    dimension: "product",
    build(snapshot, ctx, pnl) {
      const totalRevenue = Math.max(1, snapshot.sales.invoiceProducts.reduce((s, p) => s + p.revenue, 0) || ctx.revenue);
      return snapshot.sales.invoiceProducts.map((product) => {
        const orders = product.salesCount;
        const revenue = product.revenue || orders * ctx.avgCheck;
        const cogs = orders * ctx.unitCost;
        const grossProfit = revenue - cogs;
        return {
          dimension: "product" as const,
          id: product.product,
          label: product.product,
          revenue,
          orders,
          cogs,
          grossProfit,
          grossMargin: margin(grossProfit, revenue),
          contributionMargin: margin(revenue - cogs - ctx.deliveryCost * orders, revenue),
          shareOfRevenue: safeDiv(revenue, totalRevenue),
          source: "bitrix" as const
        };
      });
    }
  };
}

function countrySliceBuilder(): SliceBuilder {
  return {
    dimension: "country",
    build(snapshot, ctx) {
      const totalRevenue = Math.max(1, snapshot.sales.invoiceCountries.reduce((s, c) => s + c.revenue, 0) || ctx.revenue);
      return snapshot.sales.invoiceCountries.map((country) => {
        const orders = country.salesCount;
        const revenue = country.revenue;
        const cogs = orders * ctx.unitCost;
        const grossProfit = revenue - cogs;
        return {
          dimension: "country" as const,
          id: country.country,
          label: country.country,
          revenue,
          orders,
          cogs,
          grossProfit,
          grossMargin: margin(grossProfit, revenue),
          contributionMargin: margin(grossProfit - ctx.deliveryCost * orders, revenue),
          shareOfRevenue: safeDiv(revenue, totalRevenue),
          source: "bitrix" as const
        };
      });
    }
  };
}

function managerSliceBuilder(): SliceBuilder {
  return {
    dimension: "manager",
    build(snapshot, ctx) {
      const totalRevenue = Math.max(1, snapshot.sales.invoiceManagers.reduce((s, m) => s + m.revenue, 0) || ctx.revenue);
      return snapshot.sales.invoiceManagers.map((manager) => {
        const orders = manager.salesCount;
        const revenue = manager.revenue;
        const cogs = orders * ctx.unitCost;
        const grossProfit = revenue - cogs;
        return {
          dimension: "manager" as const,
          id: manager.managerId,
          label: manager.manager,
          revenue,
          orders,
          cogs,
          grossProfit,
          grossMargin: margin(grossProfit, revenue),
          contributionMargin: margin(grossProfit, revenue),
          shareOfRevenue: safeDiv(revenue, totalRevenue),
          source: "bitrix" as const
        };
      });
    }
  };
}

function channelSliceBuilder(): SliceBuilder {
  return {
    dimension: "channel",
    build(snapshot, ctx) {
      const channels = snapshot.marketing.channels.length > 0 ? snapshot.marketing.channels : ["paid", "organic"];
      const totalLeads = Math.max(1, ctx.totalLeads);
      return channels.map((channel, index) => {
        const share = channel.toLowerCase().includes("org") ? safeDiv(ctx.organicLeads, totalLeads) : safeDiv(ctx.paidLeads, totalLeads);
        const revenue = ctx.revenue * share;
        const orders = Math.round(ctx.salesCount * share);
        const cogs = orders * ctx.unitCost;
        const grossProfit = revenue - cogs;
        return {
          dimension: "channel" as const,
          id: `channel-${index}`,
          label: channel,
          revenue,
          orders,
          cogs,
          grossProfit,
          grossMargin: margin(grossProfit, revenue),
          contributionMargin: margin(grossProfit, revenue),
          shareOfRevenue: share,
          source: "google_marketing" as const
        };
      });
    }
  };
}

function segmentSliceBuilder(): SliceBuilder {
  return {
    dimension: "segment",
    build(snapshot, ctx) {
      const products = snapshot.sales.invoiceProducts.slice(0, 3);
      const countries = snapshot.sales.invoiceCountries.slice(0, 3);
      const segments: FinancialSlice[] = [];

      for (const product of products) {
        for (const country of countries) {
          const share = safeDiv(product.revenue, Math.max(1, ctx.revenue)) * safeDiv(country.revenue, Math.max(1, ctx.revenue));
          const revenue = ctx.revenue * Math.min(share, 1);
          const orders = Math.round(ctx.salesCount * Math.min(share, 1));
          const cogs = orders * ctx.unitCost;
          segments.push({
            dimension: "segment",
            id: `${product.product}::${country.country}`,
            label: `${product.product} · ${country.country}`,
            revenue,
            orders,
            cogs,
            grossProfit: revenue - cogs,
            grossMargin: margin(revenue - cogs, revenue),
            contributionMargin: margin(revenue - cogs, revenue),
            shareOfRevenue: Math.min(share, 1),
            source: "computed"
          });
        }
      }

      return segments;
    }
  };
}

export const SLICE_BUILDERS: SliceBuilder[] = [
  productSliceBuilder(),
  countrySliceBuilder(),
  managerSliceBuilder(),
  channelSliceBuilder(),
  segmentSliceBuilder()
];

export function computeSlices(
  snapshot: CompanySnapshot,
  ctx: FinancialContext,
  pnl: PnLStatement
): Record<SliceDimension, FinancialSlice[]> {
  const result = {} as Record<SliceDimension, FinancialSlice[]>;
  for (const builder of SLICE_BUILDERS) {
    result[builder.dimension] = builder.build(snapshot, ctx, pnl);
  }
  return result;
}

export function computeUnitEconomics(
  slices: Record<SliceDimension, FinancialSlice[]>,
  ctx: FinancialContext,
  pnl: PnLStatement,
  discountRate: number
): UnitEconomicsItem[] {
  const productSlices = slices.product.length > 0
    ? slices.product
    : [{ dimension: "product" as const, id: "default", label: "Основной продукт", revenue: ctx.revenue, orders: ctx.orders, cogs: ctx.cogs, grossProfit: ctx.revenue - ctx.cogs, grossMargin: margin(ctx.revenue - ctx.cogs, ctx.revenue), contributionMargin: 0, shareOfRevenue: 1, source: "computed" as const }];

  return productSlices.map((slice) => {
    const price = slice.orders > 0 ? slice.revenue / slice.orders : ctx.avgCheck;
    const avgSellingPrice = price * (1 - discountRate);
    const unitCost = ctx.unitCost + ctx.deliveryCost * 0.6;
    const contribution = avgSellingPrice - unitCost;
    const allocatedOverhead = pnl.overhead.value * slice.shareOfRevenue;
    const operating = contribution - safeDiv(allocatedOverhead, Math.max(1, slice.orders));
    const netPerUnit = operating * (1 - ctx.taxRate);

    const metric = (id: string, label: string, value: number, unit: FinancialUnit = "currency") => ({
      id,
      label,
      value,
      unit,
      source: slice.source,
      available: true,
      lineage: lineageNode({ id, label, value, unit, source: slice.source })
    });

    return {
      sliceId: slice.id,
      sliceLabel: slice.label,
      dimension: "product" as const,
      price: metric("price", "Цена", price),
      discount: metric("discount", "Скидка", discountRate, "percent"),
      avgSellingPrice: metric("avgSellingPrice", "Фактическая цена", avgSellingPrice),
      unitCost: metric("unitCost", "Себестоимость", unitCost),
      contributionMargin: metric("contributionMargin", "Contribution Margin", contribution),
      grossMargin: metric("grossMargin", "Gross Margin", margin(contribution, avgSellingPrice), "percent"),
      operatingMargin: metric("operatingMargin", "Operating Margin", margin(operating, avgSellingPrice), "percent"),
      netMargin: metric("netMargin", "Net Margin", margin(netPerUnit, avgSellingPrice), "percent"),
      maxCac: metric("maxCac", "Макс. CAC", contribution * 0.4),
      profitPerOrder: metric("profitPerOrder", "Прибыль с заказа", netPerUnit),
      orders: metric("orders", "Заказы", slice.orders, "count"),
      revenue: metric("revenue", "Выручка", slice.revenue),
      roi: metric("roi", "ROI", safeDiv(netPerUnit, unitCost), "ratio")
    };
  });
}
