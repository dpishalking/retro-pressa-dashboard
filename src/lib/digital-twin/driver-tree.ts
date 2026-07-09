import type { DriverTreeNode } from "./types";
import type { runMarketingEngine, runSalesEngine, runProductionEngine } from "./engines";
import { STRATEGIC_GOAL } from "./drivers";

type TreeInput = {
  marketing: ReturnType<typeof runMarketingEngine>;
  sales: ReturnType<typeof runSalesEngine>;
  production: ReturnType<typeof runProductionEngine>;
  financials: { revenue: number; netProfit: number; netMargin: number };
  bottleneckLabel: string;
};

export function buildDriverTree(input: TreeInput): DriverTreeNode {
  const { marketing, sales, production, financials, bottleneckLabel } = input;

  return {
    id: "goal",
    label: `Цель: ${STRATEGIC_GOAL.targetRevenue.toLocaleString("ru-RU")} €`,
    value: STRATEGIC_GOAL.targetRevenue,
    unit: "currency",
    owner: "CEO",
    isDriver: false,
    limitsGrowth: financials.revenue < STRATEGIC_GOAL.targetRevenue,
    children: [
      {
        id: "revenue",
        label: "Выручка",
        value: financials.revenue,
        unit: "currency",
        owner: "CEO",
        isDriver: false,
        children: [
          {
            id: "orders",
            label: "Заказы",
            value: production.orders,
            unit: "count",
            owner: "Производство",
            isDriver: false,
            limitsGrowth: production.orders < sales.sales,
            children: [
              {
                id: "sales-count",
                label: "Продажи",
                value: sales.sales,
                unit: "count",
                owner: "РОП",
                isDriver: false,
                children: [
                  {
                    id: "qual-leads",
                    label: "Квал-лиды",
                    value: sales.qualLeadsConstrained,
                    unit: "count",
                    owner: "РОП",
                    isDriver: false,
                    limitsGrowth: bottleneckLabel === "Продажи",
                    children: [
                      {
                        id: "leads",
                        label: "Лиды",
                        value: marketing.totalLeads,
                        unit: "count",
                        owner: "Маркетинг",
                        isDriver: false,
                        children: [
                          {
                            id: "paid-leads",
                            label: "Платные лиды",
                            value: marketing.paidLeads,
                            unit: "count",
                            owner: "Маркетинг",
                            isDriver: false,
                            children: [
                              {
                                id: "cpl-node",
                                label: "CPL",
                                value: marketing.cpl,
                                unit: "currency",
                                owner: "Маркетинг",
                                isDriver: true,
                                children: [
                                  {
                                    id: "ad-budget",
                                    label: "Рекламный бюджет",
                                    value: marketing.adBudget,
                                    unit: "currency",
                                    owner: "Маркетинг",
                                    isDriver: true,
                                    children: []
                                  }
                                ]
                              }
                            ]
                          },
                          {
                            id: "organic-leads-node",
                            label: "Органические лиды",
                            value: marketing.organicLeads,
                            unit: "count",
                            owner: "Маркетинг",
                            isDriver: true,
                            children: []
                          }
                        ]
                      }
                    ]
                  },
                  {
                    id: "avg-check-node",
                    label: "Средний чек",
                    value: sales.effectiveCheck,
                    unit: "currency",
                    owner: "РОП",
                    isDriver: true,
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: "net-profit",
        label: "Чистая прибыль",
        value: financials.netProfit,
        unit: "currency",
        owner: "CEO",
        isDriver: false,
        children: [
          {
            id: "net-margin",
            label: "Рентабельность",
            value: financials.netMargin,
            unit: "percent",
            owner: "Финансы",
            isDriver: false,
            limitsGrowth: financials.netMargin < STRATEGIC_GOAL.targetNetMargin,
            children: []
          }
        ]
      }
    ]
  };
}
