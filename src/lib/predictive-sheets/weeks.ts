import { formatDisplayDate, isoAddDays, mondayOnOrBefore } from "@/lib/sales-os/predictive-model";

export const PM_WEEK_COLUMNS = 5;

export type MondayWeek = {
  index: number;
  monday: string;
  sunday: string;
  firstInMonth: string;
  lastInMonth: string;
  daysInMonth: number;
  share: number;
  label: string;
};

function daysInCalendarMonth(month: string): number {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** All Mon–Sun weeks that touch the calendar month. */
export function mondayWeeksInMonth(month: string): MondayWeek[] {
  const total = daysInCalendarMonth(month);
  const weeks: Omit<MondayWeek, "share" | "label" | "index">[] = [];
  let cursor = mondayOnOrBefore(`${month}-01`);
  for (let guard = 0; guard < 8; guard += 1) {
    const days: string[] = [];
    for (let d = 0; d < 7; d += 1) {
      const iso = isoAddDays(cursor, d);
      if (iso.startsWith(month)) days.push(iso);
    }
    if (!days.length) break;
    weeks.push({
      monday: cursor,
      sunday: isoAddDays(cursor, 6),
      firstInMonth: days[0],
      lastInMonth: days[days.length - 1],
      daysInMonth: days.length
    });
    cursor = isoAddDays(cursor, 7);
  }

  return weeks.map((w, i) => ({
    ...w,
    index: i + 1,
    share: total > 0 ? w.daysInMonth / total : 0,
    label: `${formatDisplayDate(w.firstInMonth)}–${formatDisplayDate(w.lastInMonth)}`
  }));
}

/** Fit into W1–W5: leftover Monday-weeks (e.g. 31.08) merge into the last column. */
export function displayMondayWeeks(month: string, maxCols = PM_WEEK_COLUMNS): MondayWeek[] {
  const raw = mondayWeeksInMonth(month);
  if (raw.length <= maxCols) return raw;
  const head = raw.slice(0, maxCols - 1);
  const tail = raw.slice(maxCols - 1);
  const days = tail.reduce((s, w) => s + w.daysInMonth, 0);
  const total = daysInCalendarMonth(month);
  const merged: MondayWeek = {
    index: maxCols,
    monday: tail[0].monday,
    sunday: tail[tail.length - 1].sunday,
    firstInMonth: tail[0].firstInMonth,
    lastInMonth: tail[tail.length - 1].lastInMonth,
    daysInMonth: days,
    share: total > 0 ? days / total : 0,
    label: `${formatDisplayDate(tail[0].firstInMonth)}–${formatDisplayDate(tail[tail.length - 1].lastInMonth)}`
  };
  return [...head, merged];
}

/** 1-based W1–W5 index for a date in the month; dates after last displayed week fold into W5. */
export function mondayWeekIndex(isoDate: string, month: string): number | null {
  if (!isoDate.startsWith(month)) return null;
  const weeks = displayMondayWeeks(month);
  for (let i = 0; i < weeks.length; i += 1) {
    if (isoDate >= weeks[i].firstInMonth && isoDate <= weeks[i].lastInMonth) return i + 1;
  }
  return weeks.length || null;
}

export function currentMondayWeek(month: string, asOf: string): number {
  const idx = mondayWeekIndex(asOf.startsWith(month) ? asOf : `${month}-01`, month);
  return idx ?? 1;
}

/** Settings rows F23:F27 — weekly share of monthly plan (days in week / days in month). */
export const WEEK_SHARE_ROWS = [23, 24, 25, 26, 27] as const;
export function weekShareCell(week1to5: number): string {
  return `F${WEEK_SHARE_ROWS[week1to5 - 1]}`;
}
