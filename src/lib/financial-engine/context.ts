import { snapshotToDriverInputs } from "@/lib/company-snapshot/to-drivers";
import type { CompanySnapshot, SnapshotMetric, SnapshotSourceId } from "@/lib/company-snapshot/types";
import type { DataQualityIssue, FinancialContext } from "./types";

const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);

function readMetric(
  metric: SnapshotMetric,
  metricId: string,
  label: string,
  issues: DataQualityIssue[],
  allowFallback: boolean
): number {
  if (metric.available) return metric.value;
  if (allowFallback && metric.source === "demo_fallback") return metric.value;
  issues.push({
    metricId,
    label,
    reason: "Источник недоступен",
    source: metric.source,
    fallbackUsed: allowFallback
  });
  return allowFallback ? metric.value : 0;
}

export function buildFinancialContext(
  snapshot: CompanySnapshot,
  elapsedDays?: number
): FinancialContext {
  const issues: DataQualityIssue[] = [];
  const allowFallback = snapshot.meta.dataMode === "fallback" || snapshot.meta.dataMode === "partial";
  const { canonical, marketing, sales, finance, production, hr } = snapshot;
  const drivers = snapshotToDriverInputs(snapshot);

  const paidLeads = readMetric(marketing.paidLeads, "paidLeads", "Платные лиды", issues, allowFallback);
  const organicLeads = readMetric(marketing.organicLeads, "organicLeads", "Органические лиды", issues, allowFallback);
  const qualifiedLeads = readMetric(marketing.qualifiedLeads, "qualifiedLeads", "Квал-лиды", issues, allowFallback);
  const totalLeads = paidLeads + organicLeads;

  const salesCount = readMetric(sales.salesCount, "salesCount", "Продажи", issues, allowFallback);
  const baseRevenue = readMetric(sales.revenue, "revenue", "Выручка", issues, allowFallback);
  const avgCheck = readMetric(sales.averagePaidCheck, "avgCheck", "Средний чек", issues, allowFallback);

  const unitCost = readMetric(finance.unitCost, "unitCost", "Себестоимость", issues, allowFallback);
  const defectRate = readMetric(production.defectRate, "defectRate", "Брак", issues, allowFallback);
  const deliveryCost = readMetric(finance.deliveryCost, "deliveryCost", "Доставка", issues, allowFallback);
  const marketingSpend = readMetric(marketing.adSpend, "adSpend", "Маркетинг", issues, allowFallback);
  const payroll = readMetric(finance.payroll, "payroll", "ФОТ", issues, allowFallback);
  const overhead = readMetric(finance.overheadFixed, "overheadFixed", "Постоянные расходы", issues, allowFallback);
  const taxRate = readMetric(finance.taxRate, "taxRate", "Налоги", issues, allowFallback);
  const cashBalance = finance.cashBalance.available
    ? finance.cashBalance.value
    : (issues.push({
        metricId: "cashBalance",
        label: "Остаток денежных средств",
        reason: "Банковский источник не подключён",
        source: "bank",
        fallbackUsed: false
      }), 0);

  const repeatDriver = drivers.find((d) => d.id === "repeatSalesRate");
  const repeatSalesRate = repeatDriver?.actual ?? 0;
  if (!repeatDriver) {
    issues.push({
      metricId: "repeatSalesRate",
      label: "Повторные продажи",
      reason: "Операционный драйвер не найден в snapshot",
      source: "computed",
      fallbackUsed: false
    });
  }

  const orders = Math.min(
    salesCount,
    Math.floor(safeDiv(production.productionHours.value, Math.max(0.01, production.hoursPerOrder.value)))
  );

  const cogs = orders * unitCost;
  const defectCost = cogs * defectRate;
  const logisticsCost = orders * deliveryCost;
  const repeatRevenue = baseRevenue * repeatSalesRate;
  const revenue = baseRevenue + repeatRevenue;

  const calendarDays = canonical.calendarDays || 30;
  const resolvedElapsed = elapsedDays ?? Math.min(snapshot.daily.length, calendarDays);

  const sources: Record<string, { source: SnapshotSourceId; available: boolean }> = {
    revenue: { source: sales.revenue.source, available: sales.revenue.available },
    payroll: { source: finance.payroll.source, available: finance.payroll.available },
    marketingSpend: { source: marketing.adSpend.source, available: marketing.adSpend.available },
    unitCost: { source: finance.unitCost.source, available: finance.unitCost.available }
  };

  return {
    period: snapshot.meta.period,
    dataMode: snapshot.meta.dataMode,
    calendarDays,
    elapsedDays: resolvedElapsed,
    paidLeads,
    organicLeads,
    qualifiedLeads,
    totalLeads,
    salesCount,
    orders,
    avgCheck,
    baseRevenue,
    repeatSalesRate,
    revenue,
    unitCost,
    defectRate,
    deliveryCost,
    cogs,
    defectCost,
    logisticsCost,
    marketingSpend,
    payroll,
    overhead,
    taxRate,
    cashBalance,
    sources,
    issues
  };
}

export function applyDriverOverridesToSnapshot(
  snapshot: CompanySnapshot,
  overrides: Partial<Record<string, number>>
): CompanySnapshot {
  if (!overrides || Object.keys(overrides).length === 0) return snapshot;

  const clone: CompanySnapshot = structuredClone(snapshot);
  const set = (metric: SnapshotMetric, value: number) => {
    metric.value = value;
    metric.source = "computed";
    metric.available = true;
  };

  if (overrides.cpl !== undefined) set(clone.marketing.cpl, overrides.cpl);
  if (overrides.adBudget !== undefined) set(clone.marketing.adSpend, overrides.adBudget);
  if (overrides.organicLeads !== undefined) set(clone.marketing.organicLeads, overrides.organicLeads);
  if (overrides.salesConversion !== undefined) set(clone.sales.salesConversion, overrides.salesConversion);
  if (overrides.avgCheck !== undefined) set(clone.sales.averagePaidCheck, overrides.avgCheck);
  if (overrides.unitCost !== undefined) set(clone.finance.unitCost, overrides.unitCost);
  if (overrides.defectRate !== undefined) set(clone.production.defectRate, overrides.defectRate);
  if (overrides.deliveryCost !== undefined) set(clone.finance.deliveryCost, overrides.deliveryCost);
  if (overrides.taxRate !== undefined) set(clone.finance.taxRate, overrides.taxRate);
  if (overrides.overheadFixed !== undefined) set(clone.finance.overheadFixed, overrides.overheadFixed);
  if (overrides.avgSalary !== undefined) set(clone.hr.avgSalary, overrides.avgSalary);
  if (overrides.managerCount !== undefined) set(clone.hr.managerCount, overrides.managerCount);
  if (overrides.productionStaff !== undefined) set(clone.hr.productionStaff, overrides.productionStaff);
  if (overrides.supportStaff !== undefined) set(clone.hr.supportStaff, overrides.supportStaff);
  if (overrides.productionHours !== undefined) set(clone.production.productionHours, overrides.productionHours);
  if (overrides.hoursPerOrder !== undefined) set(clone.production.hoursPerOrder, overrides.hoursPerOrder);

  const leads = clone.canonical.paidLeads + clone.canonical.organicLeads;
  if (overrides.qualRate !== undefined) clone.canonical.qualifiedLeads = Math.round(leads * overrides.qualRate);
  if (overrides.salesConversion !== undefined) {
    clone.canonical.salesCount = Math.round(leads * overrides.salesConversion);
  }
  if (overrides.avgCheck !== undefined && clone.canonical.salesCount > 0) {
    clone.canonical.revenue = clone.canonical.salesCount * overrides.avgCheck;
    set(clone.sales.revenue, clone.canonical.revenue);
  }

  return clone;
}
