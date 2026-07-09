import { targetScenario } from "@/data/demo-data";
import type { PeriodKey } from "@/types/metrics";
import type { PlanDocument, PlanTargets } from "./types";

export function defaultPlanTargets(): PlanTargets {
  return {
    revenue: targetScenario.targetRevenue,
    salesConversion: targetScenario.salesConversion,
    avgCheck: targetScenario.averagePaidCheck,
    adBudget: targetScenario.monthlyAdSpendMax,
    organicLeads: targetScenario.organicLeads,
    cpl: targetScenario.maxPaidCpl,
    qualRate: 0.72
  };
}

export function buildDefaultPlanDocument(period: PeriodKey): PlanDocument {
  return {
    period,
    name: "План месяца",
    targets: defaultPlanTargets(),
    updatedAt: new Date().toISOString()
  };
}
