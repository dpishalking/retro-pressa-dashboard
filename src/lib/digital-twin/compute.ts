import { buildFallbackCompanySnapshot } from "@/lib/company-snapshot/fallback";
import type { CompanySnapshot } from "@/lib/company-snapshot/types";
import { enrichDrivers, STRATEGIC_GOAL, applyOverrides } from "./drivers";
import { buildBaselineDrivers, runPipeline } from "./engines";
import { detectConstraints, suggestConstraintRelief } from "./constraints";
import { generateRecommendations } from "./recommendations";
import { buildDriverTree } from "./driver-tree";
import type { ComputedMetric, TwinSnapshot } from "./types";

export type ComputeTwinOptions = {
  snapshot?: CompanySnapshot;
  overrides?: Partial<Record<string, number>>;
};

export function computeTwin(options?: ComputeTwinOptions | Partial<Record<string, number>>): TwinSnapshot {
  const normalized: ComputeTwinOptions = options && ("snapshot" in options || "overrides" in options)
    ? (options as ComputeTwinOptions)
    : { overrides: options as Partial<Record<string, number>> | undefined };

  const snapshot = normalized.snapshot ?? buildFallbackCompanySnapshot("june-2026");
  const start = performance.now();

  const pipeline = runPipeline({ snapshot, overrides: normalized.overrides });
  const { marketing, sales, production, hr, financials, unitEconomics, financialReport } = pipeline;
  const baseDrivers = buildBaselineDrivers(snapshot);
  const drivers = enrichDrivers(
    syncDerivedDriverValues(
      normalized.overrides ? applyOverrides(baseDrivers, normalized.overrides) : baseDrivers,
      marketing,
      normalized.overrides
    )
  );

  const constraints = detectConstraints({ drivers: pipeline.drivers, marketing, sales, production });
  const bottleneck = constraints.find((c) => c.isBottleneck) ?? constraints[1];
  const recommendations = generateRecommendations(
    pipeline.drivers,
    snapshot,
    Object.fromEntries(pipeline.drivers.map((driver) => [driver.id, driver.actual]))
  );

  const driverTree = buildDriverTree({
    marketing,
    sales,
    production,
    financials,
    bottleneckLabel: bottleneck?.department ?? "—"
  });

  const ltv = sales.effectiveCheck * 1.8;
  const cac = sales.sales > 0 ? marketing.adBudget / sales.sales : 0;
  const cpql = sales.qualLeads > 0 ? marketing.adBudget / sales.qualLeads : 0;
  const planRevenue = snapshot.sales.revenue.available ? snapshot.sales.revenue.value : 100_000;

  const ceoMetrics: ComputedMetric[] = [
    metric("revenue", "Выручка", financials.revenue, planRevenue, "currency", "CEO", ["sales", "avgCheck"]),
    metric("netProfit", "Прибыль", financials.netProfit, planRevenue * 0.3, "currency", "CEO", ["revenue", "operatingExpenses"]),
    metric("ebitda", "EBITDA", financials.ebitda, planRevenue * 0.35, "currency", "Финансы", ["operatingProfit"]),
    metric("cashFlow", "Cash Flow", financials.cashFlow, planRevenue * 0.25, "currency", "Финансы", ["netProfit"]),
    metric("netMargin", "Рентабельность", financials.netMargin, STRATEGIC_GOAL.targetNetMargin, "percent", "Финансы", ["netProfit", "revenue"]),
    metric("ltv", "LTV", ltv, 150, "currency", "Маркетинг", ["avgCheck", "repeatSalesRate"]),
    metric("cac", "CAC", cac, 25, "currency", "Маркетинг", ["adBudget", "sales"]),
    metric("paidLeads", "Платные лиды", marketing.paidLeads, snapshot.marketing.paidLeads.value || 3900, "count", "Маркетинг", ["adBudget", "cpl"]),
    metric("cpl", "CPL", marketing.cpl, snapshot.marketing.cpl.value || 3, "currency", "Маркетинг", ["adBudget", "paidLeads"]),
    metric("cpql", "CPQL", cpql, snapshot.marketing.cpql.value || 4, "currency", "Маркетинг", ["adBudget", "qualLeads"]),
    metric("avgCheck", "Средний чек", sales.effectiveCheck, snapshot.sales.averagePaidCheck.value || 80, "currency", "РОП", ["avgCheck", "upsellRate"]),
    metric("conversion", "Конверсия", sales.conversion, snapshot.sales.salesConversion.value || 0.28, "percent", "РОП", ["salesConversion"]),
    metric("payroll", "ФОТ", hr.payroll, snapshot.finance.payroll.value || 20_000, "currency", "HR", ["managerCount", "avgSalary"]),
    metric("grossMargin", "Маржа", financials.grossMargin, 0.55, "percent", "Производство", ["cogs", "revenue"]),
    metric("bottleneck", "Главное ограничение", bottleneck?.utilization ?? 0, 0.85, "ratio", bottleneck?.owner ?? "—", [bottleneck?.id ?? ""]),
    metric("forecast", "Прогноз месяца", financialReport.forecast.points.find((p) => p.horizonDays === 30)?.revenue ?? financials.revenue, planRevenue, "currency", "CEO", ["revenue"])
  ];

  const gap = STRATEGIC_GOAL.targetRevenue - financials.revenue;
  const achievable = financials.revenue >= STRATEGIC_GOAL.targetRevenue * 0.95 && financials.netMargin >= STRATEGIC_GOAL.targetNetMargin * 0.8;

  return {
    drivers,
    financials,
    unitEconomics,
    constraints,
    recommendations,
    driverTree,
    ceoMetrics,
    strategicGoal: {
      targetRevenue: STRATEGIC_GOAL.targetRevenue,
      targetNetMargin: STRATEGIC_GOAL.targetNetMargin,
      achievable,
      gap,
      limitingFactor: bottleneck?.department ?? "Нет данных"
    },
    computedAt: new Date().toISOString(),
    computeMs: performance.now() - start
  };
}

function metric(
  id: string,
  label: string,
  value: number,
  plan: number,
  unit: import("./types").DriverUnit,
  owner: string,
  lineage: string[]
): ComputedMetric {
  const delta = plan === 0 ? 0 : (value - plan) / plan;
  const trend = delta > 0.02 ? "up" : delta < -0.02 ? "down" : "flat";
  return { id, label, value, plan, forecast: value, delta, trend, unit, owner, lineage };
}

function syncDerivedDriverValues(
  drivers: import("./types").DriverInput[],
  marketing: ReturnType<typeof import("./engines").runMarketingEngine>,
  overrides?: Partial<Record<string, number>>
) {
  return drivers.map((driver) => {
    if (driver.id === "paidLeads" && overrides?.paidLeads === undefined) {
      return { ...driver, actual: marketing.paidLeads };
    }
    if (driver.id === "adBudget" && overrides?.paidLeads !== undefined && overrides.adBudget === undefined) {
      return { ...driver, actual: marketing.adBudget };
    }
    return driver;
  });
}

export { suggestConstraintRelief } from "./constraints";
