import type { CompanySnapshot } from "@/lib/company-snapshot/types";
import type { FinancialContext, CashFlowStatement, FinancialMetric } from "./types";
import type { PnLStatement } from "./types";
import { lineageNode } from "./explainability";
import { safeDiv, trailingDailyAverage } from "./math";

function fm(id: string, label: string, value: number, unit: FinancialMetric["unit"] = "currency"): FinancialMetric {
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

export function computeCashFlow(
  snapshot: CompanySnapshot,
  ctx: FinancialContext,
  pnl: PnLStatement
): CashFlowStatement {
  const dailyRevenue = snapshot.daily.map((d) => d.revenue);
  const dailySpend = snapshot.daily.map((d) => d.adSpend);
  const dailyProfit = snapshot.daily.map((d) => {
    const orders = d.salesCount;
    const cogs = orders * ctx.unitCost;
    return d.revenue - cogs - d.adSpend;
  });

  const inflowRate = trailingDailyAverage(dailyRevenue, 7) || safeDiv(ctx.revenue, Math.max(1, ctx.elapsedDays));
  const outflowRate = trailingDailyAverage(dailySpend, 7) + safeDiv(ctx.payroll + ctx.overhead, Math.max(1, ctx.calendarDays));
  const profitRate = trailingDailyAverage(dailyProfit, 7) || safeDiv(pnl.netProfit.value, Math.max(1, ctx.elapsedDays));

  const cashInflows = ctx.revenue;
  const cashOutflows = ctx.cogs + ctx.defectCost + ctx.marketingSpend + ctx.payroll + ctx.logisticsCost + ctx.overhead + pnl.taxes.value;
  const netCashFlow = cashInflows - cashOutflows;
  const openingBalance = ctx.cashBalance;
  const closingBalance = openingBalance + netCashFlow;

  return {
    cashInflows: fm("cashInflows", "Поступления", cashInflows),
    cashOutflows: fm("cashOutflows", "Выплаты", cashOutflows),
    netCashFlow: fm("netCashFlow", "Чистый денежный поток", netCashFlow),
    openingBalance: fm("openingBalance", "Остаток на начало", openingBalance),
    closingBalance: fm("closingBalance", "Остаток на конец", closingBalance),
    forecast7d: fm("forecast7d", "Прогноз 7 дней", closingBalance + profitRate * 7),
    forecast30d: fm("forecast30d", "Прогноз 30 дней", closingBalance + profitRate * 30),
    forecast90d: fm("forecast90d", "Прогноз 90 дней", closingBalance + profitRate * 90)
  };
}
