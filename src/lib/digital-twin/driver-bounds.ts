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
        return { min: Math.max(0, anchor * 0.25), max: anchor * 3, step: 0.1 };
      }
      return { min: Math.max(0, anchor * 0.25), max: anchor * 3, step: Math.max(1, Math.round(anchor / 100)) };
  }
}

export function clampDriverValue(driver: Pick<DriverInput, "id" | "unit" | "plan" | "actual">, value: number): number {
  const { min, max } = getDriverBounds(driver);
  return Math.min(max, Math.max(min, value));
}

/** Decimal places for manual driver input (tenths where it matters, e.g. CPL 1,3 €). */
export function getDriverInputPrecision(driver: Pick<DriverInput, "unit" | "plan" | "actual">): number {
  switch (driver.unit) {
    case "count":
      return 0;
    case "percent":
    case "ratio":
      return 1;
    case "hours":
      return 1;
    case "currency": {
      const anchor = driver.plan > 0 ? driver.plan : Math.max(Math.abs(driver.actual), 1);
      if (anchor < 100) return 1;
      return 0;
    }
    default:
      return 1;
  }
}

export function getDriverInputStep(driver: Pick<DriverInput, "unit" | "plan" | "actual">): number {
  const precision = getDriverInputPrecision(driver);
  return precision === 0 ? 1 : 10 ** -precision;
}

export function roundDriverValue(driver: Pick<DriverInput, "unit" | "plan" | "actual">, value: number): number {
  const precision = getDriverInputPrecision(driver);
  if (driver.unit === "percent" || driver.unit === "ratio") {
    const roundedPercent = Math.round(value * 100 * 10 ** precision) / 10 ** precision;
    return roundedPercent / 100;
  }
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

/** Internal driver value → text for the number field. */
export function driverValueToInput(
  driver: Pick<DriverInput, "unit" | "plan" | "actual">,
  value: number,
  formatNumber: (value: number, digits: number) => string
): string {
  const precision = getDriverInputPrecision(driver);
  if (driver.unit === "percent" || driver.unit === "ratio") {
    return formatNumber(value * 100, precision);
  }
  return formatNumber(value, precision);
}

/** Parse manual input; percents are entered as 16,8 not 0,168. */
export function driverValueFromInput(
  driver: Pick<DriverInput, "unit">,
  raw: string
): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  if (driver.unit === "percent" || driver.unit === "ratio") {
    return parsed / 100;
  }
  return parsed;
}

export function normalizeDriverInput(
  driver: Pick<DriverInput, "id" | "unit" | "plan" | "actual">,
  raw: string
): number | null {
  const parsed = driverValueFromInput(driver, raw);
  if (parsed === null) return null;
  return clampDriverValue(driver, roundDriverValue(driver, parsed));
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
