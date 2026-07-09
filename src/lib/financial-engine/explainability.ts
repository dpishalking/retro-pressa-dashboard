import type { SnapshotSourceId } from "@/lib/company-snapshot/types";
import type { FinancialContext, FinancialUnit, LineageNode } from "./types";

export function lineageNode(input: {
  id: string;
  label: string;
  value: number;
  unit?: FinancialUnit;
  source: SnapshotSourceId;
  available?: boolean;
  formula?: string;
  children?: LineageNode[];
}): LineageNode {
  return {
    id: input.id,
    label: input.label,
    value: input.value,
    unit: input.unit ?? "currency",
    source: input.source,
    available: input.available ?? true,
    formula: input.formula,
    children: input.children ?? []
  };
}

export function buildNetProfitLineage(ctx: FinancialContext, netProfit: number): LineageNode {
  const operatingProfit = netProfit / (1 - (ctx.taxRate > 0 && netProfit > 0 ? ctx.taxRate : 0)) || netProfit;
  const taxes = Math.max(0, operatingProfit * ctx.taxRate);
  const grossProfit = ctx.revenue - ctx.cogs - ctx.defectCost;
  const operatingExpenses = ctx.marketingSpend + ctx.payroll + ctx.logisticsCost + ctx.overhead;

  return lineageNode({
    id: "netProfit",
    label: "Чистая прибыль",
    value: netProfit,
    source: "computed",
    formula: "operatingProfit - taxes",
    children: [
      lineageNode({
        id: "operatingProfit",
        label: "Операционная прибыль",
        value: operatingProfit,
        source: "computed",
        formula: "grossProfit - operatingExpenses",
        children: [
          lineageNode({
            id: "grossProfit",
            label: "Валовая прибыль",
            value: grossProfit,
            source: "computed",
            formula: "revenue - cogs - defectCost",
            children: [
              lineageNode({
                id: "revenue",
                label: "Выручка",
                value: ctx.revenue,
                source: ctx.sources.revenue?.source ?? "bitrix",
                available: ctx.sources.revenue?.available ?? false,
                children: [
                  lineageNode({
                    id: "baseRevenue",
                    label: "Базовая выручка",
                    value: ctx.baseRevenue,
                    source: ctx.sources.revenue?.source ?? "bitrix",
                    children: [
                      lineageNode({
                        id: "salesCount",
                        label: "Продажи",
                        value: ctx.salesCount,
                        unit: "count",
                        source: ctx.sources.revenue?.source ?? "bitrix"
                      }),
                      lineageNode({
                        id: "avgCheck",
                        label: "Средний чек",
                        value: ctx.avgCheck,
                        source: ctx.sources.revenue?.source ?? "bitrix"
                      })
                    ]
                  }),
                  lineageNode({
                    id: "repeatRevenue",
                    label: "Повторные продажи",
                    value: ctx.baseRevenue * ctx.repeatSalesRate,
                    source: "computed",
                    formula: "baseRevenue × repeatSalesRate"
                  })
                ]
              }),
              lineageNode({
                id: "cogs",
                label: "Себестоимость",
                value: ctx.cogs,
                source: ctx.sources.unitCost?.source ?? "google_production",
                children: [
                  lineageNode({ id: "orders", label: "Заказы", value: ctx.orders, unit: "count", source: "computed" }),
                  lineageNode({ id: "unitCost", label: "Себестоимость заказа", value: ctx.unitCost, source: ctx.sources.unitCost?.source ?? "google_production" })
                ]
              })
            ]
          }),
          lineageNode({
            id: "operatingExpenses",
            label: "Операционные расходы",
            value: operatingExpenses,
            source: "computed",
            children: [
              lineageNode({ id: "payroll", label: "ФОТ", value: ctx.payroll, source: ctx.sources.payroll?.source ?? "google_payroll", available: ctx.sources.payroll?.available }),
              lineageNode({ id: "marketingSpend", label: "Маркетинг", value: ctx.marketingSpend, source: ctx.sources.marketingSpend?.source ?? "google_marketing", available: ctx.sources.marketingSpend?.available }),
              lineageNode({ id: "logisticsCost", label: "Логистика", value: ctx.logisticsCost, source: "computed" }),
              lineageNode({ id: "overhead", label: "Постоянные расходы", value: ctx.overhead, source: "google_finance" })
            ]
          })
        ]
      }),
      lineageNode({ id: "taxes", label: "Налоги", value: taxes, source: "google_finance", formula: "operatingProfit × taxRate" })
    ]
  });
}

export function buildRevenueLineage(ctx: FinancialContext): LineageNode {
  return lineageNode({
    id: "revenue",
    label: "Выручка",
    value: ctx.revenue,
    source: ctx.sources.revenue?.source ?? "bitrix",
    children: [
      lineageNode({
        id: "leads",
        label: "Лиды",
        value: ctx.totalLeads,
        unit: "count",
        source: "google_marketing",
        children: [
          lineageNode({ id: "paidLeads", label: "Платные", value: ctx.paidLeads, unit: "count", source: "google_marketing" }),
          lineageNode({ id: "organicLeads", label: "Органика", value: ctx.organicLeads, unit: "count", source: "google_marketing" })
        ]
      }),
      lineageNode({
        id: "conversion",
        label: "Конверсия",
        value: ctx.totalLeads > 0 ? ctx.salesCount / ctx.totalLeads : 0,
        unit: "percent",
        source: "computed"
      }),
      lineageNode({ id: "salesCount", label: "Продажи", value: ctx.salesCount, unit: "count", source: "bitrix" }),
      lineageNode({ id: "avgCheck", label: "Средний чек", value: ctx.avgCheck, source: "bitrix" })
    ]
  });
}
