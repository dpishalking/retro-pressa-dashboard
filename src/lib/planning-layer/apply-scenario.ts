import { applyDriverOverridesToSnapshot } from "@/lib/financial-engine/context";
import type { CompanySnapshot, SnapshotMetric } from "@/lib/company-snapshot/types";
import { snapshotToDriverInputs } from "@/lib/company-snapshot/to-drivers";

const REVENUE_DRIVER_IDS = new Set([
  "adBudget",
  "cpl",
  "organicLeads",
  "qualRate",
  "salesConversion",
  "avgCheck",
  "upsellRate",
  "crossSellRate",
  "managerCount",
  "leadsPerManager"
]);

function setMetric(metric: SnapshotMetric, value: number) {
  metric.value = value;
  metric.source = "computed";
  metric.available = true;
}

function reconcileScenarioRevenue(
  snapshot: CompanySnapshot,
  overrides: Partial<Record<string, number>>
) {
  const drivers = snapshotToDriverInputs(snapshot);
  const valueOf = (id: string) => {
    if (overrides[id] !== undefined) return overrides[id]!;
    return drivers.find((driver) => driver.id === id)?.actual ?? 0;
  };

  const adBudget = valueOf("adBudget");
  const cpl = Math.max(0.01, valueOf("cpl"));
  const organicLeads = Math.round(valueOf("organicLeads"));
  const paidLeads = Math.floor(adBudget / cpl);
  const totalLeads = paidLeads + organicLeads;

  const qualRate = valueOf("qualRate");
  const salesConversion = valueOf("salesConversion");
  const avgCheck = valueOf("avgCheck");
  const upsellRate = valueOf("upsellRate");
  const crossSellRate = valueOf("crossSellRate");

  const qualifiedLeads = Math.round(totalLeads * qualRate);
  const salesCount = Math.round(totalLeads * salesConversion);
  const effectiveCheck = avgCheck * (1 + upsellRate * 0.15 + crossSellRate * 0.1);
  const revenue = salesCount * effectiveCheck;

  snapshot.canonical.paidLeads = paidLeads;
  snapshot.canonical.organicLeads = organicLeads;
  snapshot.canonical.qualifiedLeads = qualifiedLeads;
  snapshot.canonical.salesCount = salesCount;
  snapshot.canonical.revenue = revenue;

  setMetric(snapshot.marketing.adSpend, adBudget);
  setMetric(snapshot.marketing.cpl, cpl);
  setMetric(snapshot.marketing.paidLeads, paidLeads);
  setMetric(snapshot.marketing.organicLeads, organicLeads);
  setMetric(snapshot.marketing.qualifiedLeads, qualifiedLeads);
  setMetric(snapshot.sales.salesCount, salesCount);
  setMetric(snapshot.sales.averagePaidCheck, avgCheck);
  setMetric(snapshot.sales.salesConversion, salesConversion);
  setMetric(snapshot.sales.revenue, revenue);
}

/** Apply scenario overrides and reconcile derived revenue metrics. */
export function applyScenarioToSnapshot(
  factSnapshot: CompanySnapshot,
  overrides: Partial<Record<string, number>>
): CompanySnapshot {
  if (!overrides || Object.keys(overrides).length === 0) {
    return factSnapshot;
  }

  const clone = applyDriverOverridesToSnapshot(factSnapshot, overrides);
  const touchesRevenue = Object.keys(overrides).some((id) => REVENUE_DRIVER_IDS.has(id));

  if (touchesRevenue) {
    reconcileScenarioRevenue(clone, overrides);
  }

  return clone;
}
