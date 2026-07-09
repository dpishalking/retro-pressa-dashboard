import { applyDriverOverridesToSnapshot } from "@/lib/financial-engine/context";
import type { CompanySnapshot } from "@/lib/company-snapshot/types";
import { applyPlanTargetsToSnapshot } from "./apply-plan";
import { buildDefaultPlanDocument } from "./default-plan";
import { mergeScenarioInputs } from "./scenario-builder";
import type {
  FinancialComputationContext,
  PlanDocument,
  PlanningContext,
  PlanningMetadata,
  PlanningMode,
  ResolvedPlanningInput,
  SavedScenario
} from "./types";

function modeLabel(mode: PlanningMode) {
  switch (mode) {
    case "FACT":
      return "Факт";
    case "PLAN":
      return "План";
    case "SCENARIO":
      return "Сценарий";
  }
}

export function resolvePlanningContext(
  factSnapshot: CompanySnapshot,
  planning: PlanningContext,
  options?: {
    planDocument?: PlanDocument | null;
    savedScenario?: SavedScenario | null;
  }
): ResolvedPlanningInput {
  const metadata: PlanningMetadata = {
    mode: planning.mode,
    label: modeLabel(planning.mode),
    ...planning.metadata
  };

  switch (planning.mode) {
    case "FACT":
      return {
        factSnapshot,
        computation: { snapshot: factSnapshot },
        metadata
      };

    case "PLAN": {
      const planDoc = options?.planDocument ?? buildDefaultPlanDocument(planning.period);
      const targets = { ...planDoc.targets, ...planning.plan };
      metadata.planName = planDoc.name;
      return {
        factSnapshot,
        computation: {
          snapshot: applyPlanTargetsToSnapshot(factSnapshot, targets)
        },
        metadata
      };
    }

    case "SCENARIO": {
      const saved = options?.savedScenario;
      const mergedChanges = [...(saved?.changes ?? []), ...(planning.changes ?? [])];
      const overrides = mergeScenarioInputs(factSnapshot, {
        changes: mergedChanges,
        overrides: planning.overrides
      });

      if (saved) {
        metadata.scenarioId = saved.id;
        metadata.scenarioName = saved.name;
      }

      metadata.appliedChanges = mergedChanges;

      return {
        factSnapshot,
        computation: {
          snapshot:
            Object.keys(overrides).length > 0
              ? applyDriverOverridesToSnapshot(factSnapshot, overrides)
              : factSnapshot
        },
        metadata: {
          ...metadata,
          label: saved?.name ?? metadata.label
        }
      };
    }
  }
}

export function toFinancialComputationContext(resolved: ResolvedPlanningInput): FinancialComputationContext {
  return resolved.computation;
}
