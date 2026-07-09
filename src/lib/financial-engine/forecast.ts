import type { CompanySnapshot } from "@/lib/company-snapshot/types";
import type { FinancialContext, FinancialForecast, ForecastPoint } from "./types";
import type { PnLStatement } from "./types";
import { safeDiv, trailingDailyAverage } from "./math";

export function computeForecast(
  snapshot: CompanySnapshot,
  ctx: FinancialContext,
  pnl: PnLStatement
): FinancialForecast {
  const dailyRevenue = snapshot.daily.map((d) => d.revenue);
  const dailyLeads = snapshot.daily.map((d) => d.paidLeads + d.organicLeads);
  const dailySales = snapshot.daily.map((d) => d.salesCount);
  const dailySpend = snapshot.daily.map((d) => d.adSpend);

  const revenueRate7 = trailingDailyAverage(dailyRevenue, 7);
  const revenueRate14 = trailingDailyAverage(dailyRevenue, 14);
  const revenueRate = revenueRate7 > 0 ? revenueRate7 * 0.6 + revenueRate14 * 0.4 : safeDiv(ctx.revenue, Math.max(1, ctx.elapsedDays));

  const leadsRate = trailingDailyAverage(dailyLeads, 7) || safeDiv(ctx.totalLeads, Math.max(1, ctx.elapsedDays));
  const salesRate = trailingDailyAverage(dailySales, 7) || safeDiv(ctx.salesCount, Math.max(1, ctx.elapsedDays));
  const spendRate = trailingDailyAverage(dailySpend, 7) || safeDiv(ctx.marketingSpend, Math.max(1, ctx.elapsedDays));
  const conversion = safeDiv(salesRate, Math.max(0.01, leadsRate));
  const profitRate = safeDiv(pnl.netProfit.value, Math.max(1, ctx.elapsedDays));
  const cashRate = profitRate;

  const horizons = [7, 30, 90];
  const points: ForecastPoint[] = horizons.map((horizonDays) => {
    const projectedRevenue = revenueRate * horizonDays;
    const projectedSales = salesRate * horizonDays;
    const projectedSpend = spendRate * horizonDays;
    const projectedProfit = profitRate * horizonDays;
    const projectedCash = ctx.cashBalance + cashRate * horizonDays;

    return {
      horizonDays,
      revenue: projectedRevenue,
      netProfit: projectedProfit,
      cashBalance: projectedCash,
      method: "trailing_daily_run_rate",
      drivers: {
        dailyRevenue: revenueRate,
        dailyLeads: leadsRate,
        dailySales: salesRate,
        dailySpend: spendRate,
        conversion,
        avgCheck: ctx.avgCheck
      }
    };
  });

  return {
    points,
    dailyRunRateRevenue: revenueRate,
    dailyRunRateProfit: profitRate,
    dailyRunRateCash: cashRate
  };
}
