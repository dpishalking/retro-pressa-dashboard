/**
 * Run rate + gap helpers for sales_prediction_v1.
 */

import type { ForecastMethod } from "@/types/business-os-standard";
import type { PredictionMetricKind, PredictionModelStatus } from "./contract";

export function parseNumber(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

/** Additive calendar run rate: fact / elapsed × total. Empty if unsupported. */
export function calendarRunRate(input: {
  factToDate: number | null;
  elapsedUnits: number;
  totalUnits: number;
  method: ForecastMethod;
}): number | null {
  if (input.method === "unsupported") return null;
  if (input.method !== "calendar_run_rate" && input.method !== "working_day_run_rate" && input.method !== "weekly_pace") {
    return null;
  }
  if (input.factToDate == null || !Number.isFinite(input.factToDate)) return null;
  if (!(input.elapsedUnits > 0) || !(input.totalUnits > 0)) return null;
  return Number(((input.factToDate / input.elapsedUnits) * input.totalUnits).toFixed(4));
}

export function gapToPlan(runRate: number | null, plan: number | null): number | null {
  if (runRate == null || plan == null) return null;
  return Number((runRate - plan).toFixed(4));
}

export function requiredValue(plan: number | null, fact: number | null): number | null {
  if (plan == null || fact == null) return null;
  return Math.max(plan - fact, 0);
}

export function requiredPerRemainingUnit(
  required: number | null,
  remainingUnits: number
): number | null {
  if (required == null || !(remainingUnits > 0)) return null;
  return Number((required / remainingUnits).toFixed(4));
}

export function ratioFromParts(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || !(denominator > 0)) return null;
  return Number((numerator / denominator).toFixed(6));
}

export function classifyModelStatus(input: {
  plan: number | null;
  runRate: number | null;
  blocked?: boolean;
  lowConfidence?: boolean;
  forecastAllowed?: boolean;
}): PredictionModelStatus {
  if (input.blocked || input.forecastAllowed === false) return "BLOCKED";
  if (input.plan == null) return "NO_PLAN";
  if (input.runRate == null) return input.lowConfidence ? "LOW_CONFIDENCE" : "UNKNOWN";
  if (input.lowConfidence) return "LOW_CONFIDENCE";
  if (input.runRate > input.plan) return "ABOVE_PLAN";
  if (input.runRate === input.plan) return "ON_PLAN";
  return "BELOW_PLAN";
}

/**
 * Traffic light for View. Without approved tolerance → no yellow/red business colors
 * (status still BELOW_PLAN; color gray/neutral).
 */
export function classifyViewColor(input: {
  status: PredictionModelStatus;
  runRate: number | null;
  plan: number | null;
  yellowTolerancePct: number | null;
  redTolerancePct: number | null;
}): "green" | "yellow" | "red" | "gray" {
  const { status, runRate, plan } = input;
  if (
    status === "NO_PLAN" ||
    status === "UNKNOWN" ||
    status === "BLOCKED" ||
    status === "LOW_CONFIDENCE" ||
    runRate == null ||
    plan == null ||
    plan === 0
  ) {
    return "gray";
  }
  if (status === "ABOVE_PLAN" || status === "ON_PLAN") return "green";
  if (input.yellowTolerancePct == null || input.redTolerancePct == null) {
    return "gray";
  }
  const pct = ((runRate - plan) / plan) * 100;
  if (pct <= input.redTolerancePct) return "red";
  if (pct <= input.yellowTolerancePct) return "yellow";
  return "gray";
}

export function runRateForKind(input: {
  kind: PredictionMetricKind;
  periodState: "future" | "complete" | "partial" | "month";
  fact: number | null;
  factToDate: number | null;
  elapsedUnits: number;
  totalUnits: number;
  method: ForecastMethod;
  projectedNumerator?: number | null;
  projectedDenominator?: number | null;
}): number | null {
  if (input.kind === "snapshot") {
    return input.periodState === "month" || input.periodState === "partial" || input.periodState === "complete"
      ? input.fact
      : null;
  }
  if (input.periodState === "future") return null;
  if (input.periodState === "complete") return input.fact;
  if (input.kind === "ratio" || input.kind === "average") {
    return ratioFromParts(input.projectedNumerator ?? null, input.projectedDenominator ?? null);
  }
  if (input.kind === "additive" || input.kind === "event") {
    if (input.periodState === "month" || input.periodState === "partial") {
      return calendarRunRate({
        factToDate: input.factToDate,
        elapsedUnits: input.elapsedUnits,
        totalUnits: input.totalUnits,
        method: input.method
      });
    }
  }
  return input.fact;
}
