import type { FinancialContext, FinancialTreeNode } from "./types";
import type { PnLStatement } from "./types";
import { safeDiv } from "./math";

export function buildFinancialTree(ctx: FinancialContext, pnl: PnLStatement): FinancialTreeNode {
  const conversion = safeDiv(ctx.salesCount, Math.max(1, ctx.totalLeads));

  return {
    id: "profit-root",
    label: "Чистая прибыль",
    value: pnl.netProfit.value,
    unit: "currency",
    source: "computed",
    available: true,
    children: [
      {
        id: "operating-profit",
        label: "Операционная прибыль",
        value: pnl.operatingProfit.value,
        unit: "currency",
        source: "computed",
        available: true,
        children: [
          {
            id: "gross-profit",
            label: "Валовая прибыль",
            value: pnl.grossProfit.value,
            unit: "currency",
            source: "computed",
            available: true,
            children: [
              {
                id: "revenue-tree",
                label: "Выручка",
                value: ctx.revenue,
                unit: "currency",
                source: ctx.sources.revenue?.source ?? "bitrix",
                available: ctx.sources.revenue?.available ?? false,
                children: [
                  {
                    id: "avg-check-tree",
                    label: "Средний чек",
                    value: ctx.avgCheck,
                    unit: "currency",
                    source: "bitrix",
                    available: true,
                    children: []
                  },
                  {
                    id: "sales-tree",
                    label: "Продажи",
                    value: ctx.salesCount,
                    unit: "count",
                    source: "bitrix",
                    available: true,
                    children: [
                      {
                        id: "conversion-tree",
                        label: "Конверсия",
                        value: conversion,
                        unit: "percent",
                        source: "computed",
                        available: true,
                        children: [
                          {
                            id: "leads-tree",
                            label: "Лиды",
                            value: ctx.totalLeads,
                            unit: "count",
                            source: "google_marketing",
                            available: true,
                            children: []
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                id: "cogs-tree",
                label: "Себестоимость",
                value: ctx.cogs,
                unit: "currency",
                source: ctx.sources.unitCost?.source ?? "google_production",
                available: ctx.sources.unitCost?.available ?? false,
                children: []
              }
            ]
          },
          {
            id: "opex-tree",
            label: "Операционные расходы",
            value: pnl.operatingExpenses.value,
            unit: "currency",
            source: "computed",
            available: true,
            children: [
              { id: "payroll-tree", label: "ФОТ", value: ctx.payroll, unit: "currency", source: ctx.sources.payroll?.source ?? "google_payroll", available: ctx.sources.payroll?.available ?? false, children: [] },
              { id: "marketing-tree", label: "Маркетинг", value: ctx.marketingSpend, unit: "currency", source: ctx.sources.marketingSpend?.source ?? "google_marketing", available: ctx.sources.marketingSpend?.available ?? false, children: [] }
            ]
          }
        ]
      },
      {
        id: "taxes-tree",
        label: "Налоги",
        value: pnl.taxes.value,
        unit: "currency",
        source: "google_finance",
        available: true,
        children: []
      }
    ]
  };
}
