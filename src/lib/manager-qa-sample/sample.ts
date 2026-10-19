/** Weekly QA sample: 3 dialogs × 4 outcomes per manager. Scoring stays with the ROP. */

export const QA_SAMPLE_PER_CATEGORY = 3;

export const QA_CATEGORIES = ["paid", "refusal", "invoice_unpaid", "client_silent"] as const;

export type QaCategory = (typeof QA_CATEGORIES)[number];

export const QA_CATEGORY_LABEL: Record<QaCategory, string> = {
  paid: "Успешная продажа",
  refusal: "Полный отказ",
  invoice_unpaid: "Счёт без оплаты",
  client_silent: "Клиент перестал отвечать"
};

/** Lost stages where the client explicitly declined. */
export const REFUSAL_STAGE_IDS = new Set([
  "3", // Конкуренты
  "UC_Y8VBZZ", // Не подошел формат
  "UC_JRV0IE", // Выбрал другой подарок
  "5", // Дорого
  "7", // Не актуально
  "UC_IN8ZIK" // Другое
]);

/** Lost stages where the client went quiet. */
export const SILENT_LOST_STAGE_IDS = new Set([
  "LOSE", // Не отвечает 3 раза
  "UC_OBDAQS" // Клиент пропал
]);

/** Open stages where silence is still a live dialog, not a production pause. */
export const SILENT_OPEN_STAGE_IDS = new Set([
  "NEW",
  "UC_8ZC4BD", // В диалоге
  "PREPARATION", // Клиент думает
  "UC_1RD8LB" // Контроль
]);

/** Closed as "later", not a refusal and not silence. */
export const DEFER_STAGE_ID = "UC_18ZQLE";

const TZ = "Europe/Moscow";
const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export type QaWeek = {
  startDay: string;
  endDay: string;
  startIso: string;
  endIso: string;
  label: string;
};

export type QaSampleCandidate = {
  managerId: string;
  category: QaCategory;
  richness: number;
  lastAt: string;
  reviewable: boolean;
};

export function moscowYmd(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function moscowWeekday(date: Date) {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(date);
  return WEEKDAY[short] ?? 1;
}

export function addMoscowDays(day: string, delta: number) {
  const date = new Date(`${day}T12:00:00+03:00`);
  date.setUTCDate(date.getUTCDate() + delta);
  return moscowYmd(date);
}

function weekLabel(startDay: string, endDay: string) {
  const [, startMonth, startDate] = startDay.split("-");
  const [endYear, endMonth, endDate] = endDay.split("-");
  return `${startDate}.${startMonth}–${endDate}.${endMonth}.${endYear}`;
}

/**
 * Sunday run covers the week in progress (Mon–Sun).
 * Any other day covers the previous completed Mon–Sun.
 * `weekOf` forces the calendar week that contains that date.
 */
export function qaSampleWeek(now = new Date(), weekOf?: string): QaWeek {
  const anchor = weekOf ? new Date(`${weekOf.slice(0, 10)}T12:00:00+03:00`) : now;
  const day = moscowYmd(anchor);
  const weekday = moscowWeekday(anchor);
  let monday = addMoscowDays(day, 1 - weekday);
  let sunday = addMoscowDays(monday, 6);
  if (!weekOf && weekday !== 7) {
    sunday = addMoscowDays(monday, -1);
    monday = addMoscowDays(sunday, -6);
  }
  return {
    startDay: monday,
    endDay: sunday,
    startIso: `${monday}T00:00:00+03:00`,
    endIso: `${sunday}T23:59:59+03:00`,
    label: weekLabel(monday, sunday)
  };
}

export function categoryForClosedDeal(stageId: string): QaCategory | null {
  if (stageId === DEFER_STAGE_ID) return null;
  if (REFUSAL_STAGE_IDS.has(stageId)) return "refusal";
  if (SILENT_LOST_STAGE_IDS.has(stageId)) return "client_silent";
  return null;
}

/** Paid wins, then an explicit refusal, then an unpaid invoice, then silence. */
export function resolveQaCategory(input: {
  paid: boolean;
  refusal: boolean;
  invoiceUnpaid: boolean;
  silent: boolean;
}): QaCategory | null {
  if (input.paid) return "paid";
  if (input.refusal) return "refusal";
  if (input.invoiceUnpaid) return "invoice_unpaid";
  if (input.silent) return "client_silent";
  return null;
}

export function pickQaSamples<T extends QaSampleCandidate>(rows: T[], limit = QA_SAMPLE_PER_CATEGORY): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = `${row.managerId}|${row.category}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const picked: T[] = [];
  for (const list of groups.values()) {
    list.sort((left, right) => {
      if (left.reviewable !== right.reviewable) return left.reviewable ? -1 : 1;
      return right.richness - left.richness || right.lastAt.localeCompare(left.lastAt);
    });
    picked.push(...list.slice(0, limit));
  }
  return picked;
}

export function indexRopNotes(rows: string[][], weekLabel: string) {
  const notes = new Map<string, { score: string; note: string }>();
  const headerIndex = rows.findIndex((row) => row.includes("Диалог") && row.includes("Сделка"));
  if (headerIndex < 0) return notes;
  const header = rows[headerIndex] || [];
  const weekCol = header.indexOf("Неделя");
  const dialogCol = header.indexOf("Диалог");
  const dealCol = header.indexOf("Сделка");
  const scoreCol = header.indexOf("Оценка");
  const noteCol = header.indexOf("Комментарий");
  if (scoreCol < 0 && noteCol < 0) return notes;
  for (const row of rows.slice(headerIndex + 1)) {
    if (weekCol >= 0 && row[weekCol] && row[weekCol] !== weekLabel) continue;
    const score = scoreCol >= 0 ? String(row[scoreCol] || "") : "";
    const note = noteCol >= 0 ? String(row[noteCol] || "") : "";
    if (!score && !note) continue;
    for (const key of [dialogCol >= 0 ? row[dialogCol] : "", dealCol >= 0 ? row[dealCol] : ""]) {
      const id = String(key || "").trim();
      if (id) notes.set(id, { score, note });
    }
  }
  return notes;
}
