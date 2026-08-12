/**
 * Load landing payback / efficiency metrics from ALX contractor sheet tabs.
 */

import {
  ALX_ACTIVE_LANDINGS,
  ALX_LANDINGS_SPREADSHEET_ID,
  getAlxLandingById,
  type AlxLandingDef
} from "@/config/alx-landings";
import { readSheetValues } from "@/lib/google/sheets-client";
import { quoteTab } from "@/lib/sales-os/predictive-model";
import type { LandingEfficiencySummary } from "@/lib/landings/types";

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

function aggregateDays(days: LandingEfficiencyDay[]): LandingEfficiencyTotals {
  const spend = sum(days.map((d) => d.spend));
  const revenue = sum(days.map((d) => d.revenue));
  const clicks = sum(days.map((d) => d.clicks));
  const leads = sum(days.map((d) => d.leads));
  const qualifiedLeads = sum(days.map((d) => d.qualifiedLeads));
  const orders = sum(days.map((d) => d.orders));
  return {
    spend,
    revenue,
    roas: ratio(revenue, spend),
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
      sheetTotals = { ...rowToMetrics(row) };
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
}): Promise<LandingEfficiencyModel> {
  const landing = getAlxLandingById(input.landingId);
  if (!landing) {
    throw new Error(`Неизвестный лендинг: ${input.landingId}`);
  }

  const values = await readSheetValues({
    spreadsheetId: ALX_LANDINGS_SPREADSHEET_ID,
    range: `${quoteTab(landing.sheetTitle)}!A1:L400`
  });

  const { sheetTotals, days } = parseLandingEfficiencySheet(values, input.isoMonth);
  const monthTotals = aggregateDays(days);

  return {
    landing,
    isoMonth: input.isoMonth,
    sheetTotals,
    monthTotals,
    days,
    notes: [
      `Источник: ALX · лист «${landing.sheetTitle}»`,
      `Месяц ${input.isoMonth}: ${days.filter((d) => d.spend != null || d.leads != null).length} дней с данными`,
      "ROAS / CPL / CPQL за месяц пересчитаны из сумм дня (не среднее дневных %).",
      "Итог «День» в Sheets — накопительный срез листа, не обязательно выбранный месяц."
    ]
  };
}

function hasMonthData(days: LandingEfficiencyDay[]): boolean {
  return days.some((d) => d.spend != null || d.leads != null || d.revenue != null);
}

export async function loadLandingEfficiencySummaries(isoMonth: string): Promise<LandingEfficiencySummary[]> {
  const models = await Promise.all(
    ALX_ACTIVE_LANDINGS.map((landing) =>
      loadLandingEfficiency({ landingId: landing.id, isoMonth }).catch(() => null)
    )
  );

  return ALX_ACTIVE_LANDINGS.flatMap((landing, index) => {
    const model = models[index];
    const days = model?.days ?? [];
    const totals = model?.monthTotals;
    const hasData = model ? hasMonthData(days) : false;
    if (!hasData) return [];
    return [
      {
        id: landing.id,
        siteName: landing.siteName,
        address: landing.address,
        tag: landing.tag,
        href: `/marketing/landings/${landing.id}`,
        hasData,
        daysWithData: days.filter((d) => d.spend != null || d.leads != null || d.revenue != null).length,
        monthlyBudget: totals?.spend ?? null,
        cpl: totals?.cpl ?? null,
        roas: totals?.roas ?? null,
        landingCr: totals?.landingCr ?? null,
        saleCr: totals?.saleCr ?? null
      }
    ];
  });
}
