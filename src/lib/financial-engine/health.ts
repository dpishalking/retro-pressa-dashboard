import type { CashFlowStatement, FinancialContext, FinancialHealth, FinancialMetric, PnLStatement } from "./types";
import { lineageNode } from "./explainability";
import { margin, safeDiv } from "./math";

function fm(id: string, label: string, value: number, unit: FinancialMetric["unit"] = "percent"): FinancialMetric {
  return {
    id,
    label,
    value,
    unit,
    source: "computed",
    available: true,
    lineage: lineageNode({ id, label, value, unit, source: "computed" })
  };
}

export function computeHealth(ctx: FinancialContext, pnl: PnLStatement, cashFlow: CashFlowStatement): FinancialHealth {
  const contribution = safeDiv(pnl.grossProfit.value - pnl.logisticsCost.value, ctx.revenue);
  const burnRate = Math.max(0, safeDiv(cashFlow.cashOutflows.value, Math.max(1, ctx.elapsedDays)));
  const runwayDays = burnRate > 0 ? safeDiv(cashFlow.closingBalance.value, burnRate) : 0;

  const variableCostPerOrder = ctx.unitCost + ctx.deliveryCost;
  const contributionPerOrder = ctx.avgCheck - variableCostPerOrder;
  const fixedCosts = pnl.overhead.value + pnl.payroll.value;
  const breakEvenOrders = contributionPerOrder > 0 ? Math.ceil(safeDiv(fixedCosts, contributionPerOrder)) : 0;
  const breakEvenRevenue = breakEvenOrders * ctx.avgCheck;

  return {
    grossMargin: pnl.grossMargin,
    operatingMargin: pnl.operatingMargin,
    netMargin: pnl.netMargin,
    contributionMargin: fm("contributionMargin", "Contribution Margin", contribution),
    ebitdaMargin: fm("ebitdaMargin", "EBITDA Margin", margin(pnl.ebitda.value, ctx.revenue)),
    burnRate: fm("burnRate", "Burn Rate", burnRate, "currency"),
    runwayDays: fm("runwayDays", "Runway", runwayDays, "days"),
    breakEvenRevenue: fm("breakEvenRevenue", "Точка безубыточности (выручка)", breakEvenRevenue, "currency"),
    breakEvenOrders: fm("breakEvenOrders", "Точка безубыточности (заказы)", breakEvenOrders, "count")
  };
}
