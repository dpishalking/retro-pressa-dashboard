const WEEKDAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;

const WEEKDAY_ALIASES: Record<string, (typeof WEEKDAY_SHORT)[number]> = {
  пн: "пн",
  понедельник: "пн",
  вт: "вт",
  вторник: "вт",
  ср: "ср",
  среда: "ср",
  чт: "чт",
  четверг: "чт",
  пт: "пт",
  пятница: "пт",
  сб: "сб",
  суббота: "сб",
  вс: "вс",
  воскресенье: "вс",
  воскр: "вс"
};

const MONTH_ALIASES: Array<{ month: number; tokens: string[] }> = [
  { month: 1, tokens: ["январ"] },
  { month: 2, tokens: ["феврал"] },
  { month: 3, tokens: ["март"] },
  { month: 4, tokens: ["апрел"] },
  { month: 5, tokens: ["май"] },
  { month: 6, tokens: ["июн"] },
  { month: 7, tokens: ["июл"] },
  { month: 8, tokens: ["август"] },
  { month: 9, tokens: ["сентябр"] },
  { month: 10, tokens: ["октябр"] },
  { month: 11, tokens: ["ноябр"] },
  { month: 12, tokens: ["декабр"] }
];

const SHIFT_RE = /^(1|да|yes|x|х|v|смена|\+|✓|✔)$/i;
const SKIP_NAME_RE =
  /^(менеджер|норма|график|выходной|рабочая\s*смена|людей.*смене|см|итого)$/i;

export type ManagerScheduleDay = {
  day: number;
  weekday: string;
  date: string;
};

export type ManagerScheduleRow = {
  name: string;
  shifts: boolean[];
  shiftCount: number;
};

export type ManagerScheduleMonthOption = {
  isoMonth: string;
  tabTitle: string;
  label: string;
};

export type ManagerScheduleMonth = {
  isoMonth: string;
  tabTitle: string;
  sheetGid: number | null;
  days: ManagerScheduleDay[];
  managers: ManagerScheduleRow[];
  coverage: Array<number | null>;
  normShifts: number | null;
  shiftHours: string | null;
};

export type ManagerSchedulePayload = {
  months: ManagerScheduleMonthOption[];
  selected: ManagerScheduleMonth;
  spreadsheetId: string;
  spreadsheetUrl: string;
};

export function rigaTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function formatIsoMonthRu(isoMonth: string): string {
  const [yearRaw, monthRaw] = isoMonth.split("-");
  const month = Number(monthRaw);
  const names = [
    "январь",
    "февраль",
    "март",
    "апрель",
    "май",
    "июнь",
    "июль",
    "август",
    "сентябрь",
    "октябрь",
    "ноябрь",
    "декабрь"
  ];
  const label = names[month - 1];
  if (!label || !yearRaw) return isoMonth;
  return `${label} ${yearRaw}`;
}

export function parseScheduleTabTitle(
  title: string,
  fallbackYear: number
): { isoMonth: string; hasYear: boolean } | null {
  const normalized = title.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return null;
  let month: number | null = null;
  for (const entry of MONTH_ALIASES) {
    if (entry.tokens.some((token) => normalized.includes(token))) {
      month = entry.month;
      break;
    }
  }
  if (!month) return null;

  const fullYear = normalized.match(/(20\d{2})/);
  const shortYear = normalized.match(/(?:^|[^\d])(\d{2})(?:[^\d]|$)/);
  let year = fallbackYear;
  let hasYear = false;
  if (fullYear) {
    year = Number(fullYear[1]);
    hasYear = true;
  } else if (shortYear) {
    year = 2000 + Number(shortYear[1]);
    hasYear = true;
  }
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return null;
  return { isoMonth: `${year}-${String(month).padStart(2, "0")}`, hasYear };
}

export function pickScheduleMonth(
  months: Array<{ isoMonth: string }>,
  requested: string | null,
  todayIso: string
): string | null {
  if (!months.length) return null;
  if (requested && months.some((month) => month.isoMonth === requested)) return requested;
  const current = todayIso.slice(0, 7);
  if (months.some((month) => month.isoMonth === current)) return current;
  return [...months].sort((a, b) => b.isoMonth.localeCompare(a.isoMonth))[0]?.isoMonth ?? null;
}

function cell(row: string[] | undefined, index: number): string {
  return String(row?.[index] ?? "").trim();
}

function normalizeWeekday(value: string): (typeof WEEKDAY_SHORT)[number] | null {
  const key = value.trim().toLowerCase().replace(/\./g, "");
  return WEEKDAY_ALIASES[key] ?? null;
}

function looksLikeName(value: string): boolean {
  if (!value || value.length < 2 || value.length > 80) return false;
  if (SKIP_NAME_RE.test(value.trim().toLowerCase())) return false;
  if (/раб\.?\s*смен/.test(value.toLowerCase())) return false;
  return /[а-яёa-z]/i.test(value);
}

function managerNameFromRow(row: string[]): string | null {
  const a = cell(row, 0);
  const b = cell(row, 1);
  if (/^\d{1,3}$/.test(a) && looksLikeName(b)) return b;
  if (looksLikeName(a)) return a;
  if (looksLikeName(b)) return b;
  return null;
}

function isShiftCell(value: string): boolean {
  return SHIFT_RE.test(value.trim());
}

function rowText(row: string[]): string {
  return row.map((value) => String(value ?? "").trim().toLowerCase()).join(" ");
}

function parseDayNumber(value: string): number | null {
  if (!/^\d{1,2}$/.test(value.trim())) return null;
  const day = Number(value.trim());
  if (day < 1 || day > 31) return null;
  return day;
}

function findWeekdayRow(rows: string[][]): { rowIndex: number; startCol: number; weekdays: string[] } | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    let startCol = -1;
    const weekdays: string[] = [];
    for (let c = 0; c < row.length; c++) {
      const weekday = normalizeWeekday(cell(row, c));
      if (weekday) {
        if (startCol < 0) startCol = c;
        if (startCol >= 0 && c === startCol + weekdays.length) {
          weekdays.push(weekday);
        } else if (startCol >= 0) {
          break;
        }
      } else if (startCol >= 0) {
        break;
      }
    }
    if (weekdays.length >= 4 && startCol >= 0) {
      return { rowIndex: r, startCol, weekdays };
    }
  }
  return null;
}

function readDayNumbers(rows: string[][], weekdayRowIndex: number, dayCount: number, startCol: number): number[] {
  const sequential = Array.from({ length: dayCount }, (_, index) => index + 1);
  for (let r = 0; r < weekdayRowIndex; r++) {
    const nums = Array.from({ length: dayCount }, (_, index) => parseDayNumber(cell(rows[r], startCol + index)));
    if (nums[0] === 1 && nums.every((value, index) => value == null || value === index + 1)) {
      const filled = nums.filter((value) => value != null).length;
      if (filled >= Math.max(4, dayCount - 1)) {
        return nums.map((value, index) => value ?? index + 1);
      }
    }
  }
  return sequential;
}

function parseShiftHours(rows: string[][]): string | null {
  for (const row of rows) {
    const match = rowText(row).match(/(\d{1,2})[.:](\d{2})\s*[-–—]\s*(\d{1,2})[.:](\d{2})/);
    if (!match) continue;
    return `${Number(match[1])}:${match[2]}–${Number(match[3])}:${match[4]}`;
  }
  return null;
}

function parseNormShifts(rows: string[][]): number | null {
  for (const row of rows) {
    const match = rowText(row).match(/(\d+)\s*раб/);
    if (match) return Number(match[1]);
  }
  return null;
}

function isoDateForDay(isoMonth: string, day: number): string {
  return `${isoMonth}-${String(day).padStart(2, "0")}`;
}

export function parseManagerSchedule(rows: string[][], isoMonth: string): Omit<ManagerScheduleMonth, "tabTitle" | "sheetGid"> {
  const weekday = findWeekdayRow(rows);
  const shiftHours = parseShiftHours(rows);
  const normShifts = parseNormShifts(rows);
  if (!weekday) {
    return {
      isoMonth,
      days: [],
      managers: [],
      coverage: [],
      normShifts,
      shiftHours
    };
  }

  const dayNumbers = readDayNumbers(rows, weekday.rowIndex, weekday.weekdays.length, weekday.startCol);
  const days: ManagerScheduleDay[] = weekday.weekdays.map((label, index) => ({
    day: dayNumbers[index] ?? index + 1,
    weekday: label,
    date: isoDateForDay(isoMonth, dayNumbers[index] ?? index + 1)
  }));

  const coverage: Array<number | null> = Array.from({ length: days.length }, () => null);
  const managers: ManagerScheduleRow[] = [];

  for (let r = weekday.rowIndex + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const text = rowText(row);
    if (/людей\s*в\s*смене/.test(text)) {
      for (let i = 0; i < days.length; i++) {
        const raw = cell(row, weekday.startCol + i);
        if (!raw) continue;
        const value = Number(raw.replace(",", "."));
        coverage[i] = Number.isFinite(value) ? value : null;
      }
      continue;
    }
    if (/рабочая\s*смена/.test(text) || (/^выходной$/.test(cell(row, 0).toLowerCase()) && !managerNameFromRow(row))) {
      continue;
    }
    const name = managerNameFromRow(row);
    if (!name) continue;
    const shifts = days.map((_, index) => isShiftCell(cell(row, weekday.startCol + index)));
    managers.push({
      name,
      shifts,
      shiftCount: shifts.filter(Boolean).length
    });
  }

  const derivedCoverage = days.map((_, index) => {
    if (coverage[index] != null) return coverage[index];
    return managers.reduce((sum, row) => sum + (row.shifts[index] ? 1 : 0), 0);
  });

  return {
    isoMonth,
    days,
    managers,
    coverage: derivedCoverage,
    normShifts,
    shiftHours
  };
}

