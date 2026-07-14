import assert from "node:assert/strict";
import { monthlyMetrics } from "@/data/demo-data";
import { buildFallbackCompanySnapshot } from "@/lib/company-snapshot/fallback";
import { buildCanonicalMonthly } from "@/lib/company-snapshot/fallback";
import { buildKpiSignals, getCanonicalMonthly } from "@/lib/company-snapshot/kpi-engine";
import { reconcileMetric, collectReconciliations } from "@/lib/company-snapshot/reconciliation";
import { ssotRule } from "@/lib/company-snapshot/ssot-rules";
import { snapshotToDriverInputs } from "@/lib/company-snapshot/to-drivers";
import { computeTwin } from "@/lib/digital-twin/compute";

const canonical = buildCanonicalMonthly({
  period: "june-2026",
  bitrix: { ...monthlyMetrics[1]!, paidLeads: 1000 },
  google: { paidLeads: 2260, organicLeads: 450, qualifiedLeads: 1810, adSpend: 4548 },
  workingDays: 21,
  calendarDays: 30
});

assert.equal(canonical.paidLeads, 1000);
assert.equal(canonical.revenue, monthlyMetrics[1]!.revenue);
assert.equal(canonical.adSpend, 4548);

const entry = reconcileMetric(ssotRule("paidLeads")!, 1000, 2260, "google_marketing");
const reconciliations = collectReconciliations([entry]);
assert.equal(reconciliations.length, 1);
assert.equal(reconciliations[0]?.primaryValue, 1000);
assert.equal(reconciliations[0]?.resolution, "primary_wins");

const snapshot = buildFallbackCompanySnapshot("june-2026");
const drivers = snapshotToDriverInputs(snapshot);
assert.ok((drivers.find((d) => d.id === "cpl")?.actual ?? 0) > 0);
assert.ok((drivers.find((d) => d.id === "avgCheck")?.actual ?? 0) > 0);

const signals = buildKpiSignals(snapshot, snapshot);
const twin = computeTwin({ snapshot });

assert.equal(getCanonicalMonthly(snapshot).revenue, snapshot.canonical.revenue);
assert.ok(signals.length > 0);
assert.ok(twin.financials.revenue > 0);
assert.ok(twin.recommendations.length > 0);

console.log("company-snapshot tests passed");
