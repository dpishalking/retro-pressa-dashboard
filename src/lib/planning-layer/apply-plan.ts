import { applyDriverOverridesToSnapshot } from "@/lib/financial-engine/context";
import type { CompanySnapshot } from "@/lib/company-snapshot/types";
import type { PlanTargets } from "./types";

/** Apply plan targets to a cloned snapshot. Never mutates FACT. */
export function applyPlanTargetsToSnapshot(
  factSnapshot: CompanySnapshot,
  targets: PlanTargets
): CompanySnapshot {
  if (!targets || Object.keys(targets).length === 0) return factSnapshot;

  const { revenue, ...driverTargets } = targets;
  let snapshot = applyDriverOverridesToSnapshot(factSnapshot, driverTargets);

  if (revenue !== undefined) {
    snapshot = structuredClone(snapshot);
    snapshot.sales.revenue.value = revenue;
    snapshot.sales.revenue.source = "computed";
    snapshot.sales.revenue.available = true;
    snapshot.canonical.revenue = revenue;
  }

  return snapshot;
}
