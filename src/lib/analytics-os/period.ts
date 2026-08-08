import { currentPeriodKey } from "@/lib/conversation-periods";
import type { PeriodKey } from "@/types/metrics";
import type { AnalyticsPeriod } from "@/types/analytics-os";

const LEGACY_TO_ISO: Record<PeriodKey, AnalyticsPeriod> = {
  "may-2026": "2026-05",
  "june-2026": "2026-06",
  "july-2026": "2026-07"
};

const ISO_TO_LEGACY: Record<string, PeriodKey> = {
  "2026-05": "may-2026",
  "2026-06": "june-2026",
  "2026-07": "july-2026"
};

export function isAnalyticsPeriod(value: string): value is AnalyticsPeriod {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function currentAnalyticsPeriod(now = new Date()): AnalyticsPeriod {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Parse query period; accepts YYYY-MM and legacy PeriodKey. */
export function parseAnalyticsPeriod(input: string | null | undefined, now = new Date()): AnalyticsPeriod {
  if (!input) return currentAnalyticsPeriod(now);
  if (isAnalyticsPeriod(input)) return input;
  if (input in LEGACY_TO_ISO) return LEGACY_TO_ISO[input as PeriodKey];
  return currentAnalyticsPeriod(now);
}

export function analyticsPeriodToLegacy(period: AnalyticsPeriod): PeriodKey | null {
  return ISO_TO_LEGACY[period] ?? null;
}

export function legacyPeriodToAnalytics(period: PeriodKey): AnalyticsPeriod {
  return LEGACY_TO_ISO[period];
}

export function periodCalendarBounds(period: AnalyticsPeriod): {
  start: string;
  end: string;
  calendarDays: number;
} {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return {
    start: `${period}-01`,
    end: `${period}-${String(end.getUTCDate()).padStart(2, "0")}`,
    calendarDays: end.getUTCDate()
  };
}

export function daysElapsedInPeriod(period: AnalyticsPeriod, now = new Date()): number {
  const { calendarDays } = periodCalendarBounds(period);
  const [y, m] = period.split("-").map(Number);
  const current = currentAnalyticsPeriod(now);
  if (period < current) return calendarDays;
  if (period > current) return 0;
  return Math.min(calendarDays, Math.max(1, now.getDate()));
}

/** Prefer current month; if caller wants a data-backed default they pass availablePeriods. */
export function defaultAnalyticsPeriod(availablePeriods: AnalyticsPeriod[] = [], now = new Date()): AnalyticsPeriod {
  const current = currentAnalyticsPeriod(now);
  if (availablePeriods.includes(current)) return current;
  if (availablePeriods.length > 0) {
    return [...availablePeriods].sort().at(-1) as AnalyticsPeriod;
  }
  const legacy = currentPeriodKey(now);
  return legacyPeriodToAnalytics(legacy);
}

export function knownLegacyAnalyticsPeriods(): AnalyticsPeriod[] {
  return Object.values(LEGACY_TO_ISO);
}
