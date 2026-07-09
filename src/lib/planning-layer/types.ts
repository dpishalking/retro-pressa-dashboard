import type { FinancialComputationContext } from "@/lib/financial-engine/types";
import type { CompanySnapshot } from "@/lib/company-snapshot/types";
import type { PeriodKey } from "@/types/metrics";

export type PlanningMode = "FACT" | "PLAN" | "SCENARIO";

/** Driver-level plan targets. Stored separately from Company Snapshot. */
export type PlanTargets = Partial<Record<string, number>> & {
  revenue?: number;
};

export type PlanDocument = {
  period: PeriodKey;
  name: string;
  targets: PlanTargets;
  updatedAt: string;
};

export type ScenarioChange = {
  driverId: string;
  /** Absolute target value */
  value?: number;
  /** Relative change, e.g. 0.07 = +7% */
  deltaPercent?: number;
  /** Absolute percentage points for percent drivers, e.g. 0.02 = +2 п.п. */
  deltaPoints?: number;
};

export type SavedScenario = {
  id: string;
  name: string;
  description?: string;
  changes: ScenarioChange[];
  createdAt: string;
  updatedAt: string;
};

export type ScenarioLibrary = {
  version: 1;
  scenarios: SavedScenario[];
};

export type PlanningMetadata = {
  mode: PlanningMode;
  label: string;
  scenarioId?: string;
  scenarioName?: string;
  planName?: string;
  appliedChanges?: ScenarioChange[];
};

/**
 * Planning Context — defines how FACT snapshot is transformed before FOS.
 * FOS never reads this object; Planning Layer resolves it first.
 */
export type PlanningContext = {
  mode: PlanningMode;
  period: PeriodKey;
  /** PLAN mode: inline targets (optional if loaded from plan store) */
  plan?: PlanTargets;
  /** SCENARIO mode: absolute driver overrides */
  overrides?: Partial<Record<string, number>>;
  /** SCENARIO mode: declarative changes resolved against FACT */
  changes?: ScenarioChange[];
  metadata?: Omit<PlanningMetadata, "mode" | "label">;
};

/** Input for Financial Engine — mode-agnostic resolved snapshot. */
export type { FinancialComputationContext } from "@/lib/financial-engine/types";

export type ResolvedPlanningInput = {
  computation: FinancialComputationContext;
  metadata: PlanningMetadata;
  factSnapshot: CompanySnapshot;
};
