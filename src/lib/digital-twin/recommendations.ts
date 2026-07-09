import { buildFallbackCompanySnapshot } from "@/lib/company-snapshot/fallback";
import type { CompanySnapshot } from "@/lib/company-snapshot/types";
import type { Recommendation, DriverInput } from "./types";
import { DRIVER_CATALOG } from "./drivers";
import { runPipeline } from "./engines";

const SENSITIVITY_STEPS: Record<string, number> = {
  cpl: -0.10,
  salesConversion: 0.02,
  avgCheck: 0.07,
  adBudget: 0.15,
  qualRate: 0.03,
  managerCount: 1,
  organicLeads: 0.10,
  upsellRate: 0.03,
  defectRate: -0.01,
  unitCost: -0.05,
  repeatSalesRate: 0.05
};

function simulateChange(
  drivers: DriverInput[],
  snapshot: CompanySnapshot,
  driverId: string,
  changePct: number
) {
  const base = runPipeline({ snapshot });
  const baseProfit = base.financials.netProfit;

  const driver = drivers.find((d) => d.id === driverId);
  if (!driver) return null;

  let newValue: number;
  if (driver.unit === "count" && (driverId === "managerCount" || changePct >= 1)) {
    newValue = driver.actual + changePct;
  } else {
    newValue = driver.actual * (1 + changePct);
  }

  const result = runPipeline({ snapshot, overrides: { [driverId]: newValue } });
  const profitImpact = result.financials.netProfit - baseProfit;
  const revenueImpact = result.financials.revenue - base.financials.revenue;

  return { profitImpact, revenueImpact, newValue };
}

export function generateRecommendations(
  drivers: DriverInput[],
  snapshot: CompanySnapshot = buildFallbackCompanySnapshot()
): Recommendation[] {
  const candidates: Recommendation[] = [];

  for (const driver of DRIVER_CATALOG.filter((d) => d.editable)) {
    const step = SENSITIVITY_STEPS[driver.id];
    if (step === undefined) continue;

    const sim = simulateChange(drivers, snapshot, driver.id, step);
    if (!sim || Math.abs(sim.profitImpact) < 50) continue;

    const changePct = driver.unit === "count" && driver.id === "managerCount"
      ? step
      : step * 100;

    const actionLabel = step > 0 || driver.id === "managerCount" ? "Увеличить" : "Снизить";

    const unitLabel = driver.unit === "percent"
      ? `${Math.abs(changePct).toFixed(0)} п.п.`
      : driver.unit === "count" && driver.id === "managerCount"
        ? `на ${Math.abs(step)}`
        : `${Math.abs(changePct).toFixed(0)}%`;

    candidates.push({
      rank: 0,
      driverId: driver.id,
      driverLabel: driver.label,
      action: `${actionLabel} «${driver.label}» ${unitLabel}`,
      changePct: step,
      profitImpact: sim.profitImpact,
      revenueImpact: sim.revenueImpact,
      confidence: Math.abs(sim.profitImpact) > 3000 ? "high" : Math.abs(sim.profitImpact) > 1000 ? "medium" : "low"
    });
  }

  return candidates
    .sort((a, b) => b.profitImpact - a.profitImpact)
    .slice(0, 10)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
