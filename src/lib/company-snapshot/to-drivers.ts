import { targetScenario } from "@/data/demo-data";
import { DRIVER_CATALOG } from "@/lib/digital-twin/drivers";
import type { DriverInput } from "@/lib/digital-twin/types";
import type { CompanySnapshot } from "./types";

const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);

/**
 * Maps Company Snapshot to editable driver inputs for Driver / Financial / Constraint engines.
 */
export function snapshotToDriverInputs(snapshot: CompanySnapshot): DriverInput[] {
  const { canonical, marketing, sales, finance, production, hr } = snapshot;
  const leads = canonical.paidLeads + canonical.organicLeads;

  const actuals: Record<string, number> = {
    cpl: marketing.cpl.value,
    cpm: DRIVER_CATALOG.find((d) => d.id === "cpm")?.actual ?? 4.2,
    ctr: DRIVER_CATALOG.find((d) => d.id === "ctr")?.actual ?? 0.032,
    adBudget: marketing.adSpend.value,
    paidLeads: marketing.paidLeads.value,
    organicLeads: marketing.organicLeads.value,
    qualRate: safeDiv(canonical.qualifiedLeads, leads),
    salesConversion: sales.salesConversion.value,
    avgCheck: sales.averagePaidCheck.value,
    upsellRate: DRIVER_CATALOG.find((d) => d.id === "upsellRate")?.actual ?? 0.12,
    crossSellRate: DRIVER_CATALOG.find((d) => d.id === "crossSellRate")?.actual ?? 0.08,
    managerCount: hr.managerCount.value,
    leadsPerManager: hr.leadsPerManager.value,
    unitCost: finance.unitCost.value,
    productionHours: production.productionHours.value,
    hoursPerOrder: production.hoursPerOrder.value,
    defectRate: production.defectRate.value,
    deliveryCost: finance.deliveryCost.value,
    avgSalary: hr.avgSalary.value,
    productionStaff: hr.productionStaff.value,
    supportStaff: hr.supportStaff.value,
    managerProductivity: hr.managerProductivity.value,
    taxRate: finance.taxRate.value,
    overheadFixed: finance.overheadFixed.value,
    discountRate: finance.discountRate.value,
    repeatSalesRate: DRIVER_CATALOG.find((d) => d.id === "repeatSalesRate")?.actual ?? 0.15
  };

  return DRIVER_CATALOG.map((driver) => ({
    ...driver,
    actual: actuals[driver.id] ?? driver.actual,
    plan: planValue(driver.id)
  }));
}

function planValue(driverId: string): number {
  switch (driverId) {
    case "cpl":
      return targetScenario.maxPaidCpl;
    case "adBudget":
      return targetScenario.monthlyAdSpendMax;
    case "paidLeads":
      return targetScenario.paidLeads;
    case "organicLeads":
      return targetScenario.organicLeads;
    case "qualRate":
      return 0.72;
    case "salesConversion":
      return targetScenario.salesConversion;
    case "avgCheck":
      return targetScenario.averagePaidCheck;
    default:
      return DRIVER_CATALOG.find((d) => d.id === driverId)?.plan ?? 0;
  }
}

export function snapshotMetricValue(snapshot: CompanySnapshot, driverId: string): number {
  const drivers = snapshotToDriverInputs(snapshot);
  return drivers.find((d) => d.id === driverId)?.actual ?? 0;
}
