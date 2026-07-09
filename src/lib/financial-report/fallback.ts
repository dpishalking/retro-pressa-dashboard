import { buildFallbackCompanySnapshot } from "@/lib/company-snapshot/fallback";
import { computeFinancialReport } from "@/lib/financial-engine/compute";
import {
  buildDefaultPlanDocument,
  enrichExplainabilityWithPlanning,
  getSeedScenarioById,
  parsePlanningMode,
  resolvePlanningContext,
  type PlanningContext,
  type ScenarioChange
} from "@/lib/planning-layer";
import type { PeriodKey } from "@/types/metrics";
import { serializeFinancialReport } from "./serialize";
import type { CanonicalFinancialReport } from "./types";

/** Client-safe fallback when API недоступен. */
export function buildFallbackFinancialReport(
  period: PeriodKey = "june-2026",
  options?: {
    mode?: string;
    overrides?: Partial<Record<string, number>>;
    changes?: ScenarioChange[];
    scenarioId?: string;
  }
): CanonicalFinancialReport {
  const factSnapshot = buildFallbackCompanySnapshot(period);
  const mode = parsePlanningMode(options?.mode);

  const savedScenario =
    mode === "SCENARIO" && options?.scenarioId
      ? getSeedScenarioById(options.scenarioId)
      : null;

  const planning: PlanningContext = {
    mode,
    period,
    overrides: options?.overrides,
    changes: options?.changes
  };

  const resolved = resolvePlanningContext(factSnapshot, planning, {
    planDocument: mode === "PLAN" ? buildDefaultPlanDocument(period) : null,
    savedScenario
  });

  const report = computeFinancialReport(resolved.computation);

  return serializeFinancialReport(report, {
    builtAt: new Date().toISOString(),
    fromCache: false,
    planning: resolved.metadata,
    explain: enrichExplainabilityWithPlanning(report.explain, resolved.metadata)
  });
}
