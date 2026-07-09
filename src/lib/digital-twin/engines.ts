import { buildFallbackCompanySnapshot } from "@/lib/company-snapshot/fallback";
import { snapshotToDriverInputs } from "@/lib/company-snapshot/to-drivers";
import type { CompanySnapshot } from "@/lib/company-snapshot/types";
import { computeFinancialReport } from "@/lib/financial-engine/compute";
import { resolvePlanningContext } from "@/lib/planning-layer";
import { toFinancialStatement, toUnitEconomics } from "@/lib/financial-engine/adapter";
import { DRIVER_CATALOG, applyOverrides, getDriverValue } from "./drivers";
import type { DriverInput } from "./types";
import { safeDiv } from "./drivers";

export function buildBaselineDrivers(snapshot?: CompanySnapshot): DriverInput[] {
  const source = snapshot ?? buildFallbackCompanySnapshot();
  return snapshotToDriverInputs(source);
}

type EngineInput = {
  drivers: DriverInput[];
  overrides?: Partial<Record<string, number>>;
};

export function runMarketingEngine({ drivers, overrides }: EngineInput) {
  const adBudget = getDriverValue(drivers, "adBudget");
  const cpl = Math.max(0.01, getDriverValue(drivers, "cpl"));
  const organicLeads = getDriverValue(drivers, "organicLeads");
  const paidLeads = overrides?.paidLeads !== undefined
    ? Math.round(getDriverValue(drivers, "paidLeads"))
    : Math.floor(safeDiv(adBudget, cpl));
  const effectiveAdBudget = overrides?.paidLeads !== undefined && overrides.adBudget === undefined
    ? paidLeads * cpl
    : adBudget;
  const totalLeadsCount = paidLeads + organicLeads;
  const cpa = safeDiv(effectiveAdBudget, totalLeadsCount);
  const romi = 0;

  return { adBudget: effectiveAdBudget, cpl, paidLeads, organicLeads, totalLeads: totalLeadsCount, cpa, romi };
}

export function runSalesEngine(marketing: ReturnType<typeof runMarketingEngine>, { drivers }: EngineInput) {
  const qualRate = getDriverValue(drivers, "qualRate");
  const conversion = getDriverValue(drivers, "salesConversion");
  const avgCheck = getDriverValue(drivers, "avgCheck");
  const upsellRate = getDriverValue(drivers, "upsellRate");
  const crossSellRate = getDriverValue(drivers, "crossSellRate");
  const managerCount = getDriverValue(drivers, "managerCount");
  const leadsPerManager = getDriverValue(drivers, "leadsPerManager");

  const qualLeads = Math.round(marketing.totalLeads * qualRate);
  const salesCapacity = Math.floor(managerCount * leadsPerManager * conversion);
  const qualLeadsConstrained = Math.min(qualLeads, Math.floor(managerCount * leadsPerManager));
  const sales = Math.min(Math.round(qualLeadsConstrained * conversion), salesCapacity);
  const effectiveCheck = avgCheck * (1 + upsellRate * 0.15 + crossSellRate * 0.1);
  const revenue = sales * effectiveCheck;

  return {
    qualLeads,
    qualLeadsConstrained,
    sales,
    salesCapacity,
    revenue,
    effectiveCheck,
    conversion,
    managerCount,
    leadsPerManager
  };
}

export function runProductionEngine(sales: ReturnType<typeof runSalesEngine>, { drivers }: EngineInput) {
  const unitCost = getDriverValue(drivers, "unitCost");
  const productionHours = getDriverValue(drivers, "productionHours");
  const hoursPerOrder = getDriverValue(drivers, "hoursPerOrder");
  const defectRate = getDriverValue(drivers, "defectRate");
  const deliveryCost = getDriverValue(drivers, "deliveryCost");

  const maxOrders = Math.floor(safeDiv(productionHours, hoursPerOrder));
  const orders = Math.min(sales.sales, maxOrders);
  const cogs = orders * unitCost;
  const defectCost = cogs * defectRate;
  const logisticsCost = orders * deliveryCost;
  const utilization = safeDiv(orders, maxOrders);

  return { orders, maxOrders, cogs, defectCost, logisticsCost, utilization, unitCost, deliveryCost };
}

export function runHrEngine({ drivers }: EngineInput) {
  const managerCount = getDriverValue(drivers, "managerCount");
  const avgSalary = getDriverValue(drivers, "avgSalary");
  const productionStaff = getDriverValue(drivers, "productionStaff");
  const supportStaff = getDriverValue(drivers, "supportStaff");

  const payroll = (managerCount + productionStaff + supportStaff) * avgSalary;
  const totalHeadcount = managerCount + productionStaff + supportStaff;

  return { payroll, totalHeadcount, managerCount, productionStaff, supportStaff, avgSalary };
}

export type PipelineOptions = {
  snapshot?: CompanySnapshot;
  overrides?: Partial<Record<string, number>>;
};

export function runPipeline(options?: PipelineOptions | Partial<Record<string, number>>) {
  const normalized: PipelineOptions = options && ("snapshot" in options || "overrides" in options)
    ? (options as PipelineOptions)
    : { overrides: options as Partial<Record<string, number>> | undefined };

  const snapshot = normalized.snapshot ?? buildFallbackCompanySnapshot();
  const base = buildBaselineDrivers(snapshot);
  const drivers = normalized.overrides ? applyOverrides(base, normalized.overrides) : base;
  const input = { drivers, overrides: normalized.overrides };

  const marketing = runMarketingEngine(input);
  const sales = runSalesEngine(marketing, input);
  const production = runProductionEngine(sales, input);
  const hr = runHrEngine(input);

  const financialReport = computeFinancialReport(
    resolvePlanningContext(snapshot, {
      mode: normalized.overrides && Object.keys(normalized.overrides).length > 0 ? "SCENARIO" : "FACT",
      period: snapshot.meta.period,
      overrides: normalized.overrides
    }).computation
  );
  const financials = toFinancialStatement(financialReport);
  const unitEconomics = toUnitEconomics(financialReport);

  return {
    drivers,
    marketing,
    sales,
    production,
    hr,
    financials,
    unitEconomics,
    financialReport,
    snapshot
  };
}
