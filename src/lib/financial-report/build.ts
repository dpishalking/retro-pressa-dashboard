import { getCompanySnapshot } from "@/lib/company-snapshot/build-snapshot";
import { computeFinancialReport } from "@/lib/financial-engine/compute";
import {
  buildDeltaView,
  enrichExplainabilityWithPlanning,
  parsePlanningMode,
  resolvePlanningContext,
  type PlanningContext,
  type ScenarioChange
} from "@/lib/planning-layer";
import {
  getScenarioById,
  readPlanDocument
} from "@/lib/planning-layer/server";
import type { PeriodKey } from "@/types/metrics";
import { buildFinancialReportSummary, serializeFinancialReport } from "./serialize";
import type { CanonicalFinancialReport } from "./types";

export type BuildFinancialReportOptions = {
  period: PeriodKey;
  refresh?: boolean;
  mode?: string;
  planning?: Partial<PlanningContext>;
  overrides?: Partial<Record<string, number>>;
  changes?: ScenarioChange[];
  scenarioId?: string;
  includeDelta?: boolean;
};

export async function buildCanonicalFinancialReport(
  options: BuildFinancialReportOptions
): Promise<CanonicalFinancialReport> {
  const payload = await getCompanySnapshot({
    period: options.period,
    refresh: options.refresh === true,
    forceRebuild: options.refresh === true
  });

  const mode = parsePlanningMode(options.mode ?? options.planning?.mode);
  const planDocument = mode === "PLAN" ? await readPlanDocument(options.period) : null;
  const savedScenario =
    mode === "SCENARIO" && options.scenarioId ? await getScenarioById(options.scenarioId) : null;

  const planningContext: PlanningContext = {
    mode,
    period: options.period,
    plan: options.planning?.plan,
    overrides: options.overrides ?? options.planning?.overrides,
    changes: options.changes ?? options.planning?.changes,
    metadata: options.planning?.metadata
  };

  const resolved = resolvePlanningContext(payload.snapshot, planningContext, {
    planDocument,
    savedScenario
  });

  const report = computeFinancialReport(resolved.computation);

  let canonical = serializeFinancialReport(report, {
    builtAt: payload.builtAt,
    fromCache: payload.fromCache,
    planning: resolved.metadata,
    explain: enrichExplainabilityWithPlanning(report.explain, resolved.metadata)
  });

  if (options.includeDelta && mode !== "FACT") {
    const factResolved = resolvePlanningContext(payload.snapshot, {
      mode: "FACT",
      period: options.period
    });
    const factReport = computeFinancialReport(factResolved.computation);
    const factSummary = buildFinancialReportSummary(factReport);

    let planSummary = null;
    if (mode === "SCENARIO") {
      const planResolved = resolvePlanningContext(payload.snapshot, {
        mode: "PLAN",
        period: options.period
      }, { planDocument: planDocument ?? await readPlanDocument(options.period) });
      planSummary = buildFinancialReportSummary(computeFinancialReport(planResolved.computation));
    }

    canonical = {
      ...canonical,
      delta: buildDeltaView({
        fact: factSummary,
        plan: mode === "PLAN" ? canonical.summary : planSummary,
        scenario: mode === "SCENARIO" ? canonical.summary : null
      })
    };
  }

  return canonical;
}
