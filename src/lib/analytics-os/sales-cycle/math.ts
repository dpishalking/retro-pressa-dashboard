import { CYCLE_BUCKETS, MATURITY_CHECKPOINTS, SALES_CYCLE_TIMEZONE } from "./config";
import type { CycleBucketRow, MaturityPoint } from "./types";

export function hoursBetween(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3_600_000;
}

export function daysFromHours(hours: number): number {
  return hours / 24;
}

/** Exact percentile on sorted copy; linear interpolation. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  const weight = rank - low;
  return sorted[low] * (1 - weight) + sorted[high] * weight;
}

export function median(values: number[]): number | null {
  return percentile(values, 50);
}

export function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function roundDays(hours: number | null, digits = 1): number | null {
  if (hours == null || !Number.isFinite(hours)) return null;
  const factor = 10 ** digits;
  return Math.round(daysFromHours(hours) * factor) / factor;
}

export function roundPct(part: number, whole: number, digits = 1): number | null {
  if (!whole) return null;
  const factor = 10 ** digits;
  return Math.round((part / whole) * 100 * factor) / factor;
}

export function formatInTz(iso: string, timeZone = SALES_CYCLE_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(iso));
}

export function monthKeyInTz(iso: string, timeZone = SALES_CYCLE_TIMEZONE): string {
  return formatInTz(iso, timeZone).slice(0, 7);
}

export function cohortKeyForGrain(
  iso: string,
  grain: "day" | "week" | "month",
  timeZone = SALES_CYCLE_TIMEZONE
): { key: string; start: string; end: string } {
  const day = formatInTz(iso, timeZone);
  if (grain === "day") {
    return { key: day, start: day, end: day };
  }
  if (grain === "month") {
    const month = day.slice(0, 7);
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { key: month, start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
  }
  // ISO week (Mon-start) in business TZ via Thursday trick on calendar day
  const [y, mo, d] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(y, mo - 1, d));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  const weekYear = utc.getUTCFullYear();
  const key = `${weekYear}-W${String(weekNo).padStart(2, "0")}`;
  const monday = new Date(Date.UTC(y, mo - 1, d));
  const mondayOffset = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - mondayOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return { key, start: fmt(monday), end: fmt(sunday) };
}

export function bucketForHours(hours: number): (typeof CYCLE_BUCKETS)[number]["id"] {
  for (const bucket of CYCLE_BUCKETS) {
    if (hours >= bucket.minHours && hours < bucket.maxHours) return bucket.id;
  }
  return "D60+";
}

export function buildCycleDistribution(
  hoursList: Array<{ hours: number; revenue: number }>
): CycleBucketRow[] {
  const total = hoursList.length;
  const totalRev = hoursList.reduce((a, r) => a + r.revenue, 0);
  return CYCLE_BUCKETS.map((bucket) => {
    const rows = hoursList.filter((r) => r.hours >= bucket.minHours && r.hours < bucket.maxHours);
    const revenue = rows.reduce((a, r) => a + r.revenue, 0);
    return {
      id: bucket.id,
      label: bucket.label,
      count: rows.length,
      sharePct: roundPct(rows.length, total),
      revenue: Math.round(revenue * 100) / 100,
      revenueSharePct: roundPct(revenue, totalRev)
    };
  });
}

export function emptyMaturityPoints(maturedThroughHours: number): MaturityPoint[] {
  return MATURITY_CHECKPOINTS.map((cp) => ({
    id: cp.id,
    value: null,
    matured: maturedThroughHours >= cp.hours
  }));
}

/**
 * Age of the youngest member of the cohort:
 * analysis_date − min(cohort_end, analysis_date).
 * Open (current) cohorts use analysis_date as effective end.
 */
export function cohortAgeDays(cohortEndDate: string, asOf: Date, timeZone = SALES_CYCLE_TIMEZONE): number {
  const asOfDay = formatInTz(asOf.toISOString(), timeZone);
  const effectiveEnd = cohortEndDate <= asOfDay ? cohortEndDate : asOfDay;
  const end = new Date(`${effectiveEnd}T12:00:00Z`).getTime();
  const now = new Date(`${asOfDay}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((now - end) / 86_400_000));
}

export function maturityHoursAvailable(cohortEndDate: string, asOf: Date, timeZone = SALES_CYCLE_TIMEZONE): number {
  return cohortAgeDays(cohortEndDate, asOf, timeZone) * 24;
}
