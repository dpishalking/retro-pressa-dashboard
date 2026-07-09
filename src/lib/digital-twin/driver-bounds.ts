import type { DriverInput, DriverState } from "./types";
import { safeDiv } from "./math";

export type DriverBounds = {
  min: number;
  max: number;
  step: number;
};

/** Stable slider bounds anchored to plan — never derived from current actual. */
export function getDriverBounds(driver: Pick<DriverInput, "id" | "unit" | "plan" | "actual">): DriverBounds {
  const anchor = driver.plan > 0 ? driver.plan : Math.max(Math.abs(driver.actual), 1);

  switch (driver.unit) {
    case "percent":
      if (driver.id.includes("Rate") || driver.id.includes("Conversion")) {
        return { min: 0, max: 1, step: 0.005 };
      }
      return { min: 0, max: 0.5, step: 0.005 };
    case "count":
      return {
        min: 1,
        max: Math.max(Math.round(anchor * 2.5), anchor + 5),
        step: 1
      };
    case "hours":
      return {
        min: Math.max(0.5, anchor * 0.5),
        max: anchor * 2.5,
        step: 0.5
      };
    case "currency":
    default:
      if (anchor < 10) {
        return { min: Math.max(0, anchor * 0.25), max: anchor * 3, step: 0.1 };
      }
      if (anchor < 100) {
        return { min: Math.max(0, anchor * 0.25), max: anchor * 3, step: 0.5 };
      }
      return { min: Math.max(0, anchor * 0.25), max: anchor * 3, step: Math.max(1, Math.round(anchor / 100)) };
  }
}

export function clampDriverValue(driver: Pick<DriverInput, "id" | "unit" | "plan" | "actual">, value: number): number {
  const { min, max } = getDriverBounds(driver);
  return Math.min(max, Math.max(min, value));
}

export function applyOverrides(drivers: DriverInput[], overrides: Partial<Record<string, number>>): DriverInput[] {
  return drivers.map((d) => ({
    ...d,
    actual:
      overrides[d.id] !== undefined
        ? clampDriverValue(d, overrides[d.id]!)
        : d.actual
  }));
}

export function enrichDrivers(drivers: DriverInput[]): DriverState[] {
  const now = new Date().toISOString();
  return drivers.map((d) => {
    const boundedActual = clampDriverValue(d, d.actual);
    const delta = safeDiv(boundedActual - d.plan, d.plan);
    const trend: import("./types").Trend = delta > 0.02 ? "up" : delta < -0.02 ? "down" : "flat";
    return { ...d, actual: boundedActual, forecast: boundedActual, delta, trend, lastUpdated: now };
  });
}
