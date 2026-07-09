import type { ReconciliationEntry, ReconciliationSeverity, SnapshotSourceId } from "./types";
import type { MetricSsotRule } from "./ssot-rules";

const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);

export function reconcileMetric(
  rule: MetricSsotRule,
  primaryValue: number,
  secondaryValue: number | null,
  secondarySource?: SnapshotSourceId
): ReconciliationEntry | null {
  if (secondaryValue === null || secondarySource === undefined) return null;
  if (primaryValue === secondaryValue) return null;

  const delta = primaryValue - secondaryValue;
  const deltaPct = safeDiv(Math.abs(delta), Math.max(Math.abs(secondaryValue), 1));

  let severity: ReconciliationSeverity = "info";
  if (rule.criticalDeltaPct !== undefined && deltaPct >= rule.criticalDeltaPct) {
    severity = "critical";
  } else if (rule.warningDeltaPct !== undefined && deltaPct >= rule.warningDeltaPct) {
    severity = "warning";
  }

  return {
    metricId: rule.metricId,
    label: rule.label,
    primarySource: rule.primarySource,
    primaryValue,
    secondarySource,
    secondaryValue,
    delta,
    deltaPct,
    severity,
    resolution: "primary_wins"
  };
}

export function collectReconciliations(
  entries: Array<ReconciliationEntry | null>
): ReconciliationEntry[] {
  return entries.filter((entry): entry is ReconciliationEntry => entry !== null);
}
