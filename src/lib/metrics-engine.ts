import type { DailyMetrics, MonthlyMetrics, TargetScenario } from "@/types/metrics";

const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);

export const totalLeads = (m: Pick<MonthlyMetrics, "paidLeads" | "organicLeads">) => m.paidLeads + m.organicLeads;
export const invoiceConversion = (m: MonthlyMetrics) => safeDiv(m.invoicesCount, totalLeads(m));
export const salesConversion = (m: MonthlyMetrics) => safeDiv(m.salesCount, totalLeads(m));
export const averageInvoice = (m: MonthlyMetrics) => safeDiv(m.invoicesAmount, m.invoicesCount);
export const averagePaidCheck = (m: MonthlyMetrics) => safeDiv(m.revenue, m.salesCount);
export const invoiceRoas = (m: MonthlyMetrics) => safeDiv(m.invoicesAmount, m.adSpend);
export const cashRoas = (m: MonthlyMetrics) => safeDiv(m.revenue, m.adSpend);
export const paidCpl = (m: MonthlyMetrics) => safeDiv(m.adSpend, m.paidLeads);
export const revenuePerLead = (m: MonthlyMetrics) => safeDiv(m.revenue, totalLeads(m));
export const cancelledInvoiceRate = (m: MonthlyMetrics) => safeDiv(m.cancelledInvoicesCount, m.invoicesCount);
export const cancelledAmountRate = (m: MonthlyMetrics) => safeDiv(m.cancelledInvoicesAmount, m.invoicesAmount);
export const revenuePlanCompletion = (revenue: number, targetRevenue: number) => safeDiv(revenue, targetRevenue);

export const delta = (current: number, previous: number) => safeDiv(current - previous, previous);
export const deltaPp = (current: number, previous: number) => current - previous;

export const scenarioForecast = (scenario: Pick<TargetScenario, "totalLeads" | "salesConversion" | "averagePaidCheck" | "paidLeads" | "organicLeads" | "monthlyAdSpendMax" | "targetRevenue">) => {
  const sales = Math.round(scenario.totalLeads * scenario.salesConversion);
  const revenue = sales * scenario.averagePaidCheck;
  const requiredBudget = scenario.paidLeads * safeDiv(scenario.monthlyAdSpendMax, scenario.paidLeads);
  return {
    sales,
    revenue,
    cashRoas: safeDiv(revenue, scenario.monthlyAdSpendMax),
    requiredBudget,
    leadGap: scenario.totalLeads - 4500,
    salesGap: sales - 1260,
    revenueGap: revenue - scenario.targetRevenue
  };
};

export const dailyPlan = (target: TargetScenario, daily: DailyMetrics[], elapsedDays: number) => {
  const actual = daily.slice(0, elapsedDays).reduce(
    (acc, day) => ({
      paidLeads: acc.paidLeads + day.paidLeads,
      organicLeads: acc.organicLeads + day.organicLeads,
      sales: acc.sales + day.salesCount,
      revenue: acc.revenue + day.revenue,
      adSpend: acc.adSpend + day.adSpend,
      activeManagers: day.activeManagers
    }),
    { paidLeads: 0, organicLeads: 0, sales: 0, revenue: 0, adSpend: 0, activeManagers: 0 }
  );

  const remainingDays = Math.max(1, target.calendarDays - elapsedDays);
  const revenueLeft = Math.max(0, target.targetRevenue - actual.revenue);
  const leadsLeft = Math.max(0, target.totalLeads - actual.paidLeads - actual.organicLeads);
  const salesLeft = Math.max(0, target.salesCount - actual.sales);

  return {
    elapsedDays,
    remainingDays,
    todayLeadsPlan: Math.ceil(leadsLeft / remainingDays),
    todayPaidLeadsPlan: Math.ceil(Math.max(0, target.paidLeads - actual.paidLeads) / remainingDays),
    todayOrganicLeadsPlan: Math.ceil(Math.max(0, target.organicLeads - actual.organicLeads) / remainingDays),
    todaySalesPlan: Math.ceil(salesLeft / remainingDays),
    todayRevenuePlan: Math.ceil(revenueLeft / remainingDays),
    todayBudgetPlanMin: Math.ceil(target.monthlyAdSpendMin / target.calendarDays),
    todayBudgetPlanMax: Math.ceil(target.monthlyAdSpendMax / target.calendarDays),
    perManagerLeads: Math.ceil(leadsLeft / remainingDays / Math.max(1, actual.activeManagers)),
    perManagerSales: Math.ceil(salesLeft / remainingDays / Math.max(1, actual.activeManagers)),
    perManagerRevenue: Math.ceil(revenueLeft / remainingDays / Math.max(1, actual.activeManagers)),
    actual
  };
};

export const pacingRatio = (actual: number, target: number, elapsedDays: number, totalDays: number) => safeDiv(safeDiv(actual, target), safeDiv(elapsedDays, totalDays));
