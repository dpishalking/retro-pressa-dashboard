/** Birthday of the gift recipient («именинник» / «виновник») on a Bitrix deal. */

export const DEAL_CELEBRANT_BIRTH_TEXT = "UF_CRM_6864EE0D588CF";
export const DEAL_NEWSPAPER_FIELD = "UF_CRM_1740386917723";
export const LEAD_CELEBRANT_BIRTH_TEXT = "UF_CRM_1751442353";

const RECENTLY_PASSED_DAYS = 21;
const RIGA = "Europe/Riga";

const MONTH_BY_NAME: Record<string, number> = {
  января: 1,
  февраля: 2,
  марта: 3,
  апреля: 4,
  мая: 5,
  июня: 6,
  июля: 7,
  августа: 8,
  сентября: 9,
  октября: 10,
  ноября: 11,
  декабря: 12,
  январь: 1,
  февраль: 2,
  март: 3,
  апрель: 4,
  июнь: 6,
  июль: 7,
  август: 8,
  сентябрь: 9,
  октябрь: 10,
  ноябрь: 11,
  декабрь: 12,
  янв: 1,
  фев: 2,
  мар: 3,
  апр: 4,
  май: 5,
  июн: 6,
  июл: 7,
  авг: 8,
  сен: 9,
  окт: 10,
  ноя: 11,
  дек: 12
};

export type CelebrantBirthday = {
  day: number | null;
  month: number;
  year: number | null;
};

export type CelebrantBirthdayColumns = {
  dates: string;
  days: number | null;
  when: string;
  queue: number;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function celebrantBirthdayLabel(birthday: CelebrantBirthday) {
  if (birthday.day == null) return birthday.year ? `${pad(birthday.month)}.${birthday.year}` : pad(birthday.month);
  const core = `${pad(birthday.day)}.${pad(birthday.month)}`;
  return birthday.year ? `${core}.${birthday.year}` : core;
}

function asText(value: unknown): string {
  if (value == null || value === false) return "";
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(" ");
  return String(value);
}

function expandYear(raw: string): number | null {
  if (raw.length === 4) {
    const year = Number(raw);
    return year >= 1900 && year <= 2026 ? year : null;
  }
  if (raw.length !== 2) return null;
  const yy = Number(raw);
  if (!Number.isFinite(yy)) return null;
  return yy <= 26 ? 2000 + yy : 1900 + yy;
}

function isValidDay(day: number, month: number, year: number | null) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = year ?? 2024;
  const date = new Date(Date.UTC(probe, month - 1, day));
  return date.getUTCFullYear() === probe && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function makeBirthday(day: number | null, month: number, year: number | null): CelebrantBirthday | null {
  if (day == null) {
    if (month < 1 || month > 12) return null;
    return { day: null, month, year };
  }
  if (!isValidDay(day, month, year)) return null;
  return { day, month, year };
}

function consume(
  text: string,
  regex: RegExp,
  parse: (match: RegExpExecArray) => CelebrantBirthday | null
) {
  const found: CelebrantBirthday[] = [];
  let rest = "";
  let cursor = 0;
  regex.lastIndex = 0;
  let match = regex.exec(text);
  while (match) {
    const birthday = parse(match);
    if (!birthday) {
      regex.lastIndex = match.index + 1;
      match = regex.exec(text);
      continue;
    }
    rest += text.slice(cursor, match.index);
    rest += " ".repeat(match[0].length);
    cursor = match.index + match[0].length;
    found.push(birthday);
    match = regex.exec(text);
  }
  rest += text.slice(cursor);
  return { found, rest };
}

function dedupe(items: CelebrantBirthday[]) {
  const dated = new Set(items.filter((item) => item.day != null && item.year != null).map((item) => `${item.day}|${item.month}`));
  const seen = new Set<string>();
  const out: CelebrantBirthday[] = [];
  for (const item of items) {
    if (item.day != null && item.year == null && dated.has(`${item.day}|${item.month}`)) continue;
    const key = `${item.day ?? ""}|${item.month}|${item.year ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function parseCelebrantBirthdays(value: unknown, options?: { allowCompact?: boolean }): CelebrantBirthday[] {
  let text = asText(value).replace(/\s+/g, " ").trim();
  if (!text) return [];

  const found: CelebrantBirthday[] = [];
  const russian = consume(
    text,
    /(?<!\d)(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря|янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек)(?![а-яёa-z])\.?(?:\s+(\d{4}))?/gi,
    (match) => {
      const month = MONTH_BY_NAME[match[2].toLowerCase().replace(/\.$/, "")];
      if (!month) return null;
      const year = match[3] ? expandYear(match[3]) : null;
      if (match[3] && year == null) return null;
      return makeBirthday(Number(match[1]), month, year);
    }
  );
  found.push(...russian.found);
  text = russian.rest;

  const numeric = consume(
    text,
    /(?<!\d)(\d{1,2})\s*[./:-]\s*(\d{1,2})\s*[./:-]\s*(\d{2,4})(?!\d)/g,
    (match) => {
      const year = expandYear(match[3]);
      if (year == null) return null;
      return makeBirthday(Number(match[1]), Number(match[2]), year);
    }
  );
  found.push(...numeric.found);
  text = numeric.rest;

  const spaced = consume(text, /(?<!\d)(\d{1,2})\s+(\d{1,2})\s*[./]\s*(\d{2,4})(?!\d)/g, (match) => {
    const year = expandYear(match[3]);
    if (year == null) return null;
    return makeBirthday(Number(match[1]), Number(match[2]), year);
  });
  found.push(...spaced.found);
  text = spaced.rest;

  if (options?.allowCompact) {
    const compact = consume(text, /(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)/g, (match) => {
      const year = expandYear(match[3]);
      if (year == null) return null;
      return makeBirthday(Number(match[1]), Number(match[2]), year);
    });
    found.push(...compact.found);
    text = compact.rest;
  }

  const monthNameYear = consume(
    text,
    /(?<![а-яёa-z])(январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь)(?![а-яёa-z])\.?\s+(\d{4})(?!\d)/gi,
    (match) => {
      const month = MONTH_BY_NAME[match[1].toLowerCase()];
      const year = expandYear(match[2]);
      if (!month || year == null) return null;
      return makeBirthday(null, month, year);
    }
  );
  found.push(...monthNameYear.found);
  text = monthNameYear.rest;

  const monthYear = consume(text, /(?<!\d)(\d{1,2})\.(19\d{2}|20\d{2})(?!\d)/g, (match) => {
    const year = expandYear(match[2]);
    if (year == null) return null;
    return makeBirthday(null, Number(match[1]), year);
  });
  found.push(...monthYear.found);
  text = monthYear.rest;

  const dayMonth = consume(text, /(?<!\d)(\d{1,2})[./](\d{1,2})(?!\d)/g, (match) =>
    makeBirthday(Number(match[1]), Number(match[2]), null)
  );
  found.push(...dayMonth.found);

  return dedupe(found);
}

export function celebrantBirthdaysFromDeal(input: {
  birthText?: unknown;
  title?: unknown;
  newspaper?: unknown;
}): CelebrantBirthday[] {
  const fromField = parseCelebrantBirthdays(input.birthText, { allowCompact: true });
  if (fromField.length) return fromField;
  return dedupe([
    ...parseCelebrantBirthdays(input.title),
    ...parseCelebrantBirthdays(input.newspaper)
  ]);
}

export function rigaDateParts(today: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RIGA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(today);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Days until the next birthday. Negative means it passed within the last 21 days. */
export function daysUntilCelebrantBirthday(birthday: CelebrantBirthday, today: Date) {
  const { year, month, day } = rigaDateParts(today);
  const todayUtc = Date.UTC(year, month - 1, day);
  const targetDay = birthday.day ?? 15;
  const diffFor = (targetYear: number) =>
    Math.round((Date.UTC(targetYear, birthday.month - 1, targetDay) - todayUtc) / 86_400_000);
  const diff = diffFor(year);
  if (diff < -RECENTLY_PASSED_DAYS) return diffFor(year + 1);
  return diff;
}

function whenLabel(days: number, monthOnly: boolean) {
  const suffix = monthOnly ? ", день не указан" : "";
  if (days === 0) return monthOnly ? `в этом месяце${suffix}` : "сегодня";
  if (days > 0) return `через ${days} дн.${suffix}`;
  return `${-days} дн. назад${suffix}`;
}

export function describeCelebrantBirthdays(birthdays: CelebrantBirthday[], today: Date) {
  if (!birthdays.length) return { dates: "", days: null as number | null, when: "нет даты" };
  let best = birthdays[0];
  let bestDays = daysUntilCelebrantBirthday(best, today);
  for (const birthday of birthdays.slice(1)) {
    const days = daysUntilCelebrantBirthday(birthday, today);
    if (days < bestDays) {
      best = birthday;
      bestDays = days;
    }
  }
  return {
    dates: birthdays.map(celebrantBirthdayLabel).join(", "),
    days: bestDays,
    when: whenLabel(bestDays, best.day == null)
  };
}

export function birthdayColumnsForDeals(birthdays: CelebrantBirthday[][], today: Date): CelebrantBirthdayColumns[] {
  const described = birthdays.map((row) => describeCelebrantBirthdays(row, today));
  const order = described
    .map((row, index) => ({ index, days: row.days }))
    .sort((left, right) => {
      if (left.days == null && right.days == null) return left.index - right.index;
      if (left.days == null) return 1;
      if (right.days == null) return -1;
      return left.days - right.days || left.index - right.index;
    });
  const queue = new Array<number>(described.length);
  order.forEach((item, rank) => {
    queue[item.index] = rank + 1;
  });
  return described.map((row, index) => ({ ...row, queue: queue[index] }));
}
