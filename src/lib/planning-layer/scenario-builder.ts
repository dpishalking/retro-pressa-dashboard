import { snapshotToDriverInputs } from "@/lib/company-snapshot/to-drivers";
import type { CompanySnapshot } from "@/lib/company-snapshot/types";
import type { ScenarioChange } from "./types";

export function resolveScenarioChanges(
  factSnapshot: CompanySnapshot,
  changes: ScenarioChange[]
): Partial<Record<string, number>> {
  if (changes.length === 0) return {};

  const baseline = snapshotToDriverInputs(factSnapshot);
  const overrides: Partial<Record<string, number>> = {};

  for (const change of changes) {
    const driver = baseline.find((item) => item.id === change.driverId);
    if (!driver) continue;

    const factValue = driver.actual;
    let next: number | undefined;

    if (change.value !== undefined) {
      next = change.value;
    } else if (change.deltaPoints !== undefined) {
      next = factValue + change.deltaPoints;
    } else if (change.deltaPercent !== undefined) {
      next = factValue * (1 + change.deltaPercent);
    }

    if (next !== undefined && Number.isFinite(next)) {
      overrides[change.driverId] = next;
    }
  }

  return overrides;
}

/** Slider values → only drivers that differ from FACT. */
export function scenarioOverridesFromValues(
  factSnapshot: CompanySnapshot,
  values: Partial<Record<string, number>>
): Partial<Record<string, number>> {
  const baseline = snapshotToDriverInputs(factSnapshot);
  const overrides: Partial<Record<string, number>> = {};

  for (const [driverId, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const factValue = baseline.find((driver) => driver.id === driverId)?.actual;
    if (factValue === undefined) continue;
    if (Math.abs(value - factValue) > 0.0001) {
      overrides[driverId] = value;
    }
  }

  return overrides;
}

export function mergeScenarioInputs(
  factSnapshot: CompanySnapshot,
  input: {
    overrides?: Partial<Record<string, number>>;
    changes?: ScenarioChange[];
  }
): Partial<Record<string, number>> {
  const fromChanges = input.changes?.length ? resolveScenarioChanges(factSnapshot, input.changes) : {};
  const fromOverrides = input.overrides ?? {};
  return { ...fromChanges, ...fromOverrides };
}

export function describeScenarioChanges(
  factSnapshot: CompanySnapshot,
  overrides: Partial<Record<string, number>>
): ScenarioChange[] {
  const baseline = snapshotToDriverInputs(factSnapshot);
  const changes: ScenarioChange[] = [];

  for (const [driverId, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    const factValue = baseline.find((driver) => driver.id === driverId)?.actual;
    if (factValue === undefined || Math.abs(value - factValue) < 0.0001) continue;
    changes.push({ driverId, value });
  }

  return changes;
}
