import { buildSignals } from "@/lib/signal-rules";
import type { TargetScenario } from "@/types/metrics";
import { targetScenario } from "./fallback";
import type { CompanySnapshot } from "./types";

/**
 * KPI Engine facade — all KPI reads go through Company Snapshot.
 */
export function getCanonicalMonthly(snapshot: CompanySnapshot) {
  return snapshot.canonical;
}

export function getCanonicalDaily(snapshot: CompanySnapshot) {
  return snapshot.daily;
}

export function getDialogueQuality(snapshot: CompanySnapshot) {
  return snapshot.quality.dialogue;
}

export function getConversationDashboard(snapshot: CompanySnapshot) {
  return snapshot.quality.conversation;
}

export function buildKpiSignals(
  snapshot: CompanySnapshot,
  previous: CompanySnapshot | null,
  target: TargetScenario = targetScenario,
  elapsedDays = 20
) {
  const prev = previous?.canonical ?? snapshot.canonical;
  return buildSignals(snapshot.canonical, prev, snapshot.quality.dialogue, target, elapsedDays);
}

export function snapshotHasLiveData(snapshot: CompanySnapshot) {
  return snapshot.meta.dataMode !== "fallback";
}
