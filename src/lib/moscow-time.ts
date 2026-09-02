import type { PeriodKey } from "@/types/metrics";

const periodByMonth: Record<number, PeriodKey> = {
  5: "may-2026",
  6: "june-2026",
  7: "july-2026",
  8: "august-2026",
  9: "september-2026"
};

const isoMonthByPeriod: Record<PeriodKey, string> = {
  "may-2026": "2026-05",
  "june-2026": "2026-06",
  "july-2026": "2026-07",
  "august-2026": "2026-08",
  "september-2026": "2026-09"
};

/** PeriodKey → calendar month YYYY-MM. */
export function periodKeyToIsoMonth(period: PeriodKey): string {
  return isoMonthByPeriod[period];
}

/** Current calendar month in Europe/Moscow as YYYY-MM. */
export function moscowIsoMonth(now = new Date()): string {
  return periodKeyToIsoMonth(moscowPeriodKey(now));
}

function moscowParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { year, month, day };
}

export function moscowDateIso(now = new Date()) {
  const { year, month, day } = moscowParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Yesterday in Europe/Moscow — the day we refresh every morning. */
export function moscowYesterdayIso(now = new Date()) {
  const { year, month, day } = moscowParts(now);
  const utcNoon = Date.UTC(year, month - 1, day, 9, 0, 0);
  const yesterday = new Date(utcNoon - 24 * 60 * 60 * 1000);
  return moscowDateIso(yesterday);
}

export function moscowPeriodKey(now = new Date()): PeriodKey {
  const { month } = moscowParts(now);
  return periodByMonth[month] ?? "september-2026";
}
