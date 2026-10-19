/** Weekly QA sample: 3 dialogs × 4 outcomes per manager. Scoring stays with the ROP. */

export const QA_SAMPLE_PER_CATEGORY = 3;

export const QA_CATEGORIES = ["paid", "refusal", "invoice_unpaid", "client_silent"] as const;

export type QaCategory = (typeof QA_CATEGORIES)[number];

export const QA_CATEGORY_LABEL: Record<QaCategory, string> = {
  paid: "A. Успешная оплата",
  refusal: "B. Полный отказ",
  invoice_unpaid: "C. Счёт без оплаты",
  client_silent: "D. Клиент пропал"
};

export const QA_FOCUS: Record<QaCategory, string> = {
  paid: "кросс-продукты",
  refusal: "отказ",
  invoice_unpaid: "доведение до оплаты",
  client_silent: "возврат клиента"
};

export const MIN_LIVE_MESSAGES = 5;
export const SILENCE_HOURS = 48;
export const INVOICE_SENT_STAGE_ID = "DT31_2:S";
export const INVOICE_PAID_STAGE_ID = "DT31_2:P";
export const INVOICE_CANCELLED_STAGE_ID = "DT31_2:D";

/** Lost stages where the client explicitly declined. */
export const REFUSAL_STAGE_IDS = new Set([
  "3", // Конкуренты
  "UC_Y8VBZZ", // Не подошел формат
  "UC_JRV0IE", // Выбрал другой подарок
  "5", // Дорого
  "7" // Не актуально
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
  key: string;
  day: string;
  eligible: boolean;
  repeat: boolean;
};

export type ManualCheck = {
  checked: string;
  score: string;
  comment: string;
  checkedAt: string;
};

export type DialogueLine = {
  role: "client" | "manager";
  text: string;
  system?: boolean;
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
    endIso: `${sunday}T20:00:00+03:00`,
    label: weekLabel(monday, sunday)
  };
}

export function isSystemLine(text: string) {
  return /^(Enquiry |A new lead was created|Диалог закреплен|Conversation |Contact information saved|Data received:)/i.test(text)
    || /начал работу с диалогом|завершил работу с диалогом|transferred to|session closed automatically|обращение перенаправлено|диалог заверш/i.test(text);
}

export function isHardRefusalText(text: string) {
  return /не буду покупать|не буду брать|отказываюсь|не надо|не актуально|передумал/i.test(text);
}

export function isHesitationText(text: string) {
  return /подумаю|позже|дорого/i.test(text);
}

/** CRM close-reason confirms a refusal. Hesitation alone does not. «Другое» is too vague. */
export function refusalFromStage(stageId: string, clientText = ""): "refusal" | "needs_review" | null {
  if (stageId === DEFER_STAGE_ID) return null;
  if (stageId === "UC_IN8ZIK") return isHardRefusalText(clientText) ? "refusal" : "needs_review";
  if (REFUSAL_STAGE_IDS.has(stageId)) return "refusal";
  if (isHardRefusalText(clientText) && !REFUSAL_STAGE_IDS.has(stageId) && !SILENT_LOST_STAGE_IDS.has(stageId)) {
    return "needs_review";
  }
  return null;
}

export function isPaidInvoiceStage(stageId: string) {
  return stageId === INVOICE_PAID_STAGE_ID;
}

export function isUnpaidIssuedInvoice(stageId: string) {
  return stageId === INVOICE_SENT_STAGE_ID;
}

export function liveMessages(lines: DialogueLine[]) {
  const real = lines.filter((line) => !line.system && !isSystemLine(line.text) && line.text.trim().length > 0);
  const firstClient = real.findIndex((line) => line.role === "client");
  if (firstClient < 0) return [];
  return real.slice(firstClient);
}

export function isEligibleDialogue(lines: DialogueLine[], minimum = MIN_LIVE_MESSAGES) {
  const episode = liveMessages(lines);
  const hasClient = episode.some((line) => line.role === "client");
  const hasManager = episode.some((line) => line.role === "manager");
  return hasClient && hasManager && episode.length >= minimum;
}

export function endedWithGoodbye(lines: DialogueLine[]) {
  const episode = liveMessages(lines);
  const tail = episode.slice(-3).map((line) => line.text).join("\n");
  return /спасибо[^\n]{0,40}до свидания|до свидания/i.test(tail);
}

export function silenceQualifies(input: {
  lastRole: "client" | "manager" | null;
  hours: number;
  goodbye: boolean;
  threshold?: number;
}) {
  if (input.goodbye || input.lastRole !== "manager") return false;
  return input.hours >= (input.threshold ?? SILENCE_HOURS);
}

export function episodeKey(input: { weekLabel: string; managerId: string; dealId: string; sessionId: string }) {
  return [input.weekLabel, input.managerId, "deal", input.dealId || "-", input.sessionId || "-"].join("|");
}

function hashSeed(input: string) {
  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: T[], seed: string) {
  const copy = [...items];
  let state = hashSeed(seed) || 1;
  const random = () => {
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap] as T;
    copy[swap] = current as T;
  }
  return copy;
}

function spreadByDay<T extends { day: string }>(rows: T[]) {
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const list = buckets.get(row.day) || [];
    list.push(row);
    buckets.set(row.day, list);
  }
  const out: T[] = [];
  let moved = true;
  while (moved) {
    moved = false;
    for (const bucket of buckets.values()) {
      const next = bucket.shift();
      if (!next) continue;
      out.push(next);
      moved = true;
    }
  }
  return out;
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

export function pickQaSamples<T extends QaSampleCandidate>(
  rows: T[],
  limit = QA_SAMPLE_PER_CATEGORY,
  seed = "week"
): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.eligible) continue;
    const key = `${row.managerId}|${row.category}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const picked: T[] = [];
  for (const [key, list] of groups) {
    const fresh = spreadByDay(seededShuffle(list.filter((row) => !row.repeat), `${seed}|${key}|fresh`));
    const repeats = spreadByDay(seededShuffle(list.filter((row) => row.repeat), `${seed}|${key}|repeat`));
    picked.push(...[...fresh, ...repeats].slice(0, limit));
  }
  return picked;
}

export function readManualChecks(rows: string[][]) {
  const checks = new Map<string, ManualCheck>();
  const headerIndex = rows.findIndex((row) => row.includes("Ключ") && row.includes("Проверено"));
  if (headerIndex < 0) return checks;
  const header = rows[headerIndex] || [];
  const keyCol = header.indexOf("Ключ");
  const checkedCol = header.indexOf("Проверено");
  const scoreCol = header.indexOf("Оценка по чек-листу");
  const commentCol = header.indexOf("Комментарий руководителя");
  const dateCol = header.indexOf("Дата проверки");
  for (const row of rows.slice(headerIndex + 1)) {
    const key = String(row[keyCol] || "").trim();
    if (!key) continue;
    const checked = checkedCol >= 0 ? String(row[checkedCol] || "") : "";
    const score = scoreCol >= 0 ? String(row[scoreCol] || "") : "";
    const comment = commentCol >= 0 ? String(row[commentCol] || "") : "";
    const checkedAt = dateCol >= 0 ? String(row[dateCol] || "") : "";
    if (!checked && !score && !comment && !checkedAt) continue;
    checks.set(key, { checked, score, comment, checkedAt });
  }
  return checks;
}

export function primaryManagerId(counts: Array<{ managerId: string; messages: number }>, assigneeId: string) {
  const ranked = counts
    .filter((row) => row.managerId && row.messages > 0)
    .sort((left, right) => right.messages - left.messages || left.managerId.localeCompare(right.managerId));
  return ranked[0]?.managerId || assigneeId;
}
