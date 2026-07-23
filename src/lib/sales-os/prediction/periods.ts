/**
 * Calendar periods for Sales Prediction — Bitrix day-as-returned, no UTC day shift.
 */

import {
  countCalendarWeeksInMonth,
  daysInCalendarMonth,
  isoAddDays,
  mondayOnOrBefore
} from "@/lib/sales-os/predictive-model";

export type WeekSlice = {
  weekIndex: number;
  weekId: string;
  days: string[];
  daysInMonth: string[];
};

/** ISO dates in month YYYY-MM (calendar, noon UTC anchor — same as predictive-model). */
export function datesInMonth(month: string): string[] {
  const dim = daysInCalendarMonth(month);
  const out: string[] = [];
  for (let d = 1; d <= dim; d += 1) {
    out.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

export function buildWeekSlices(month: string): WeekSlice[] {
  const weekCount = countCalendarWeeksInMonth(month);
  const start = mondayOnOrBefore(`${month}-01`);
  const slices: WeekSlice[] = [];
  for (let w = 0; w < weekCount; w += 1) {
    const days: string[] = [];
    for (let d = 0; d < 7; d += 1) days.push(isoAddDays(start, w * 7 + d));
    const daysInMonth = days.filter((iso) => iso.startsWith(month));
    if (!daysInMonth.length) continue;
    slices.push({
      weekIndex: w,
      weekId: `${month}-W${w + 1}`,
      days,
      daysInMonth
    });
  }
  return slices;
}

/**
 * Last fully closed calendar day for forecast.
 * If `today` is in month and incomplete → use yesterday.
 * If `today` before month → empty / before start.
 * If `today` after month end → last day of month.
 */
export function resolveForecastAsOf(input: {
  month: string;
  today: string;
  includeToday?: boolean;
}): string | null {
  const days = datesInMonth(input.month);
  if (!days.length) return null;
  const first = days[0];
  const last = days[days.length - 1];
  if (input.today < first) return null;
  if (input.today > last) return last;
  if (input.includeToday) return input.today;
  if (input.today === first) return null;
  return isoAddDays(input.today, -1);
}

/** Completed days in month up to and including asOf (inclusive). */
export function completedDaysThrough(month: string, asOf: string | null): string[] {
  if (!asOf) return [];
  return datesInMonth(month).filter((d) => d <= asOf);
}

export function remainingDaysAfter(month: string, asOf: string | null): string[] {
  if (!asOf) return datesInMonth(month);
  return datesInMonth(month).filter((d) => d > asOf);
}

export function weekCompleteness(input: {
  week: WeekSlice;
  asOf: string | null;
  today: string;
}): "future" | "complete" | "partial" {
  const inMonth = input.week.daysInMonth;
  if (!inMonth.length) return "future";
  if (!input.asOf || input.asOf < inMonth[0]) return "future";
  if (input.asOf >= inMonth[inMonth.length - 1]) return "complete";
  return "partial";
}

export function dayCompleteness(input: {
  day: string;
  asOf: string | null;
  today: string;
  hasFact: boolean;
}): "complete" | "partial" | "future" | "missing_data" {
  if (input.day > input.today) return "future";
  if (input.asOf && input.day <= input.asOf) {
    return input.hasFact ? "complete" : "missing_data";
  }
  if (input.day === input.today) return "partial";
  return input.hasFact ? "complete" : "missing_data";
}

export { daysInCalendarMonth, isoAddDays, mondayOnOrBefore, countCalendarWeeksInMonth };
