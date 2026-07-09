import { buildFallbackCompanySnapshot } from "@/lib/company-snapshot/fallback";
import type { CompanySnapshot } from "@/lib/company-snapshot/types";
import type { Recommendation, DriverInput } from "./types";
import { DRIVER_CATALOG } from "./drivers";
import { clampDriverValue } from "./driver-bounds";
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

function nextDriverValue(driver: DriverInput, step: number): number {
  if (driver.unit === "percent" || (driver.unit === "count" && driver.id === "managerCount")) {
    return clampDriverValue(driver, driver.actual + step);
  }
  return clampDriverValue(driver, driver.actual * (1 + step));
}

function simulateChange(
  drivers: DriverInput[],
  snapshot: CompanySnapshot,
  currentOverrides: Partial<Record<string, number>>,
  driverId: string,
  step: number
) {
  const base = runPipeline({ snapshot, overrides: currentOverrides });
  const baseProfit = base.financials.netProfit;

  const driver = drivers.find((d) => d.id === driverId);
  if (!driver) return null;

  const newValue = nextDriverValue(driver, step);
  if (Math.abs(newValue - driver.actual) < 0.0001) return null;

  const result = runPipeline({
    snapshot,
    overrides: { ...currentOverrides, [driverId]: newValue }
  });
  const profitImpact = result.financials.netProfit - baseProfit;
  const revenueImpact = result.financials.revenue - base.financials.revenue;

  return { profitImpact, revenueImpact, newValue };
}

export function generateRecommendations(
  drivers: DriverInput[],
  snapshot: CompanySnapshot = buildFallbackCompanySnapshot(),
  currentOverrides: Partial<Record<string, number>> = {}
): Recommendation[] {
  const effectiveOverrides = Object.keys(currentOverrides).length > 0
    ? currentOverrides
    : Object.fromEntries(drivers.map((driver) => [driver.id, driver.actual]));

  const candidates: Recommendation[] = [];

  for (const driver of DRIVER_CATALOG.filter((d) => d.editable)) {
    const step = SENSITIVITY_STEPS[driver.id];
    if (step === undefined) continue;

    const current = drivers.find((d) => d.id === driver.id);
    if (!current) continue;

    const sim = simulateChange(drivers, snapshot, effectiveOverrides, driver.id, step);
    if (!sim || Math.abs(sim.profitImpact) < 50) continue;

    const changeLabel = driver.unit === "percent"
      ? `${Math.abs(step * 100).toFixed(0)} п.п.`
      : driver.unit === "count" && driver.id === "managerCount"
        ? `на ${Math.abs(step)}`
        : `${Math.abs(step * 100).toFixed(0)}%`;

    const actionLabel = step > 0 || driver.id === "managerCount" ? "Увеличить" : "Снизить";

    candidates.push({
      rank: 0,
      driverId: driver.id,
      driverLabel: driver.label,
      action: `${actionLabel} «${driver.label}» ${changeLabel}`,
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
