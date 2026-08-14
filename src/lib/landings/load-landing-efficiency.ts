/**
 * Load landing payback / efficiency metrics from ALX contractor sheet tabs.
 */

import {
  ALX_LANDINGS_SPREADSHEET_ID,
  alxLandingDisplayName,
  type AlxLandingDef
} from "@/config/alx-landings";
import { readSheetValues } from "@/lib/google/sheets-client";
import { quoteTab } from "@/lib/sales-os/predictive-model";
import type { LandingEfficiencySummary } from "@/lib/landings/types";
import { getLandingById, listLandingSheets } from "@/lib/landings/landing-registry";

export type { LandingEfficiencySummary } from "@/lib/landings/types";

export type LandingEfficiencyDay = {
  date: string;
  spend: number | null;
  revenue: number | null;
  roas: number | null;
  clicks: number | null;
  leads: number | null;
  qualifiedLeads: number | null;
  landingCr: number | null;
  cpl: number | null;
  cpql: number | null;
  saleCr: number | null;
  orders: number | null;
};

export type LandingEfficiencyTotals = {
  spend: number | null;
  revenue: number | null;
  roas: number | null;
  /** Cumulative ROAS days 1..7; null if immature or no spend. */
  roasD7: number | null;
  /** Cumulative ROAS days 1..30; null if immature or no spend. */
  roasD30: number | null;
  roasD7Mature: boolean;
  roasD30Mature: boolean;
  clicks: number | null;
  leads: number | null;
  qualifiedLeads: number | null;
  landingCr: number | null;
  cpl: number | null;
  cpql: number | null;
  saleCr: number | null;
  orders: number | null;
};

export type LandingEfficiencyModel = {
  landing: AlxLandingDef;
  isoMonth: string;
  sheetTotals: LandingEfficiencyTotals;
  monthTotals: LandingEfficiencyTotals;
  days: LandingEfficiencyDay[];
  notes: string[];
};

function parseAlxNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let text = String(raw).trim();
  if (!text || text === "-" || text === "—") return null;
  text = text.replace(/\u00a0/g, " ").replace(/\s/g, "");
  const isPct = text.includes("%");
  text = text.replace(/€/g, "").replace(/%/g, "").replace(/\*/g, "");
  // EU format: 3.761,07 or 3761,07
  if (text.includes(",") && text.includes(".")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return isPct ? n / 100 : n;
}

function parseAlxDate(raw: string): string | null {
  const text = String(raw || "").trim();
  const m = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function emptyTotals(): LandingEfficiencyTotals {
  return {
    spend: null,
    revenue: null,
    roas: null,
    roasD7: null,
    roasD30: null,
    roasD7Mature: false,
    roasD30Mature: false,
    clicks: null,
    leads: null,
    qualifiedLeads: null,
    landingCr: null,
    cpl: null,
    cpql: null,
    saleCr: null,
    orders: null
  };
}

/** Calendar YYYY-MM-DD in Europe/Riga. */
export function rigaTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

/**
 * Window is mature when Riga "today" is on or after the through-day of isoMonth
 * (or the month already ended).
 */
export function monthWindowMature(
  isoMonth: string,
  throughDay: number,
  todayIso = rigaTodayIso()
): boolean {
  const [y, m] = isoMonth.split("-").map(Number);
  if (!y || !m) return false;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const targetDay = Math.min(Math.max(1, throughDay), lastDay);
  const targetDate = `${isoMonth}-${String(targetDay).padStart(2, "0")}`;
  return todayIso >= targetDate;
}

/**
 * Cumulative ROAS for calendar days 1..throughDay of the month from daily ALX rows.
 * Not cohort CAC payback — MTD ROAS cut at day N.
 */
export function cumulativeRoasThroughDay(
  days: LandingEfficiencyDay[],
  throughDay: number
): number | null {
  const slice = days.filter((day) => {
    const dom = Number(day.date.slice(8, 10));
    return Number.isFinite(dom) && dom >= 1 && dom <= throughDay;
  });
  const spend = sum(slice.map((d) => d.spend));
  const revenue = sum(slice.map((d) => d.revenue));
  return ratio(revenue, spend);
}

function rowToMetrics(row: string[]): Omit<LandingEfficiencyDay, "date"> {
  return {
    spend: parseAlxNumber(row[1]),
    revenue: parseAlxNumber(row[2]),
    roas: parseAlxNumber(row[3]),
    clicks: parseAlxNumber(row[4]),
    leads: parseAlxNumber(row[5]),
    qualifiedLeads: parseAlxNumber(row[6]),
    landingCr: parseAlxNumber(row[7]),
    cpl: parseAlxNumber(row[8]),
    cpql: parseAlxNumber(row[9]),
    saleCr: parseAlxNumber(row[10]),
    orders: parseAlxNumber(row[11])
  };
}

function sum(values: Array<number | null>): number | null {
  let total = 0;
  let any = false;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    total += v;
    any = true;
  }
  return any ? total : null;
}

function ratio(num: number | null, den: number | null): number | null {
  if (num == null || den == null || !(den > 0)) return null;
  return num / den;
}

export function aggregateDays(
  days: LandingEfficiencyDay[],
  isoMonth?: string,
  todayIso = rigaTodayIso()
): LandingEfficiencyTotals {
  const spend = sum(days.map((d) => d.spend));
  const revenue = sum(days.map((d) => d.revenue));
  const clicks = sum(days.map((d) => d.clicks));
  const leads = sum(days.map((d) => d.leads));
  const qualifiedLeads = sum(days.map((d) => d.qualifiedLeads));
  const orders = sum(days.map((d) => d.orders));
  const month = isoMonth || days[0]?.date.slice(0, 7) || "";
  const roasD7Mature = month ? monthWindowMature(month, 7, todayIso) : false;
  const roasD30Mature = month ? monthWindowMature(month, 30, todayIso) : false;
  const roasD7Raw = cumulativeRoasThroughDay(days, 7);
  const roasD30Raw = cumulativeRoasThroughDay(days, 30);
  return {
    spend,
    revenue,
    roas: ratio(revenue, spend),
    roasD7: roasD7Mature ? roasD7Raw : null,
    roasD30: roasD30Mature ? roasD30Raw : null,
    roasD7Mature,
    roasD30Mature,
    clicks,
    leads,
    qualifiedLeads,
    landingCr: ratio(leads, clicks),
    cpl: ratio(spend, leads),
    cpql: ratio(spend, qualifiedLeads),
    saleCr: ratio(orders, leads),
    orders
  };
}

export function parseLandingEfficiencySheet(
  values: string[][],
  isoMonth: string
): { sheetTotals: LandingEfficiencyTotals; days: LandingEfficiencyDay[] } {
  if (!values.length) return { sheetTotals: emptyTotals(), days: [] };

  let sheetTotals = emptyTotals();
  const days: LandingEfficiencyDay[] = [];

  for (let i = 1; i < values.length; i += 1) {
    const row = values[i].map((c) => String(c ?? ""));
    const label = row[0]?.trim() || "";
    if (label.toLowerCase() === "день") {
      sheetTotals = { ...emptyTotals(), ...rowToMetrics(row) };
      continue;
    }
    const date = parseAlxDate(label);
    if (!date) continue;
    if (!date.startsWith(isoMonth)) continue;
    days.push({ date, ...rowToMetrics(row) });
  }

  days.sort((a, b) => a.date.localeCompare(b.date));
  return { sheetTotals, days };
}

export async function loadLandingEfficiency(input: {
  landingId: string;
  isoMonth: string;
  landing?: AlxLandingDef;
}): Promise<LandingEfficiencyModel> {
  const landing = input.landing ?? (await getLandingById(input.landingId));
  if (!landing) {
    throw new Error(`Неизвестный лендинг: ${input.landingId}`);
  }

  const spreadsheetId = landing.spreadsheetId || ALX_LANDINGS_SPREADSHEET_ID;
  const sourceLabel = landing.sourceLabel || "ALX";
  const values = await readSheetValues({
    spreadsheetId,
    range: `${quoteTab(landing.sheetTitle)}!A1:L400`
  });

  const { sheetTotals, days } = parseLandingEfficiencySheet(values, input.isoMonth);
  const todayIso = rigaTodayIso();
  const monthDays = days.filter((day) => day.date <= todayIso);
  const monthTotals = aggregateDays(monthDays, input.isoMonth, todayIso);

  return {
    landing,
    isoMonth: input.isoMonth,
    sheetTotals: {
      ...emptyTotals(),
      ...sheetTotals,
      roasD7: null,
      roasD30: null,
      roasD7Mature: false,
      roasD30Mature: false
    },
    monthTotals,
    days: monthDays,
    notes: [
      `Источник: ${sourceLabel} · лист «${landing.sheetTitle}»`,
      `Месяц ${input.isoMonth}: ${monthDays.filter((d) => (d.spend ?? 0) > 0 || (d.leads ?? 0) > 0).length} дней с трафиком`,
      "ROAS / CPL / CPQL за месяц пересчитаны из сумм дня (не среднее дневных %).",
      "ROAS D7 / D30 — накопительный ROAS за календарные дни 1–7 / 1–30 месяца (не cohort CAC payback).",
      "Итог «День» в Sheets — накопительный срез листа, не обязательно выбранный месяц."
    ]
  };
}

function hasMonthTraffic(days: LandingEfficiencyDay[]): boolean {
  return days.some(
    (d) => (d.spend ?? 0) > 0 || (d.clicks ?? 0) > 0 || (d.leads ?? 0) > 0
  );
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, () => worker()));
  return results;
}

export async function loadLandingEfficiencySummaries(isoMonth: string): Promise<LandingEfficiencySummary[]> {
  const landings = await listLandingSheets();
  const models = await mapLimit(landings, 6, (landing) =>
    loadLandingEfficiency({ landingId: landing.id, isoMonth, landing }).catch(() => null)
  );

  return landings.flatMap((landing, index) => {
    const model = models[index];
    const days = model?.days ?? [];
    const totals = model?.monthTotals;
    const hasData = model ? hasMonthTraffic(days) : false;
    if (!hasData) return [];
    return [
      {
        id: landing.id,
        title: alxLandingDisplayName(landing),
        siteName: landing.siteName,
        address: landing.address,
        tag: landing.tag,
        sourceLabel: landing.sourceLabel || "ALX",
        href: `/marketing/landings/${landing.id}`,
        hasData,
        daysWithData: days.filter((d) => d.spend != null || d.leads != null || d.revenue != null).length,
        monthlyBudget: totals?.spend ?? null,
        cpl: totals?.cpl ?? null,
        roas: totals?.roas ?? null,
        roasD7: totals?.roasD7 ?? null,
        roasD30: totals?.roasD30 ?? null,
        roasD7Mature: totals?.roasD7Mature ?? false,
        roasD30Mature: totals?.roasD30Mature ?? false,
        landingCr: totals?.landingCr ?? null,
        saleCr: totals?.saleCr ?? null
      }
    ];
  });
}
