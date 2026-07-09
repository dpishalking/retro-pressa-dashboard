import { safeDiv } from "./math";
import type { FinancialStatement, UnitEconomics } from "@/lib/digital-twin/types";
import type { FinancialReport } from "./types";

/** Adapter: FOS report → legacy Digital Twin FinancialStatement (backward compat). */
export function toFinancialStatement(report: FinancialReport): FinancialStatement {
  const { pnl, cashFlow } = report;
  return {
    revenue: pnl.revenue.value,
    cogs: pnl.cogs.value,
    grossProfit: pnl.grossProfit.value,
    grossMargin: pnl.grossMargin.value,
    marketingSpend: pnl.marketingSpend.value,
    payroll: pnl.payroll.value,
    productionCost: pnl.productionCost.value,
    logisticsCost: pnl.logisticsCost.value,
    overhead: pnl.overhead.value,
    operatingExpenses: pnl.operatingExpenses.value,
    ebitda: pnl.ebitda.value,
    operatingProfit: pnl.operatingProfit.value,
    operatingMargin: pnl.operatingMargin.value,
    taxes: pnl.taxes.value,
    netProfit: pnl.netProfit.value,
    netMargin: pnl.netMargin.value,
    cashFlow: cashFlow.netCashFlow.value
  };
}

export function toUnitEconomics(report: FinancialReport): UnitEconomics[] {
  return report.unitEconomics.map((item) => {
    const share = safeDiv(item.revenue.value, Math.max(1, report.pnl.revenue.value));
    const allocatedOverhead = report.pnl.overhead.value * share;
    const breakEvenUnits = item.contributionMargin.value > 0
      ? Math.ceil(safeDiv(allocatedOverhead, item.contributionMargin.value))
      : 0;

    return {
      productId: item.sliceId,
      productName: item.sliceLabel,
      price: item.price.value,
      discount: item.discount.value,
      avgSellingPrice: item.avgSellingPrice.value,
      unitCost: item.unitCost.value,
      contributionMargin: item.contributionMargin.value,
      grossMargin: item.grossMargin.value,
      operatingMargin: item.operatingMargin.value,
      netProfit: item.profitPerOrder.value,
      maxCac: item.maxCac.value,
      minSellingPrice: item.unitCost.value * 1.15,
      breakEvenUnits,
      roi: item.roi.value
    };
  });
}
