/**
 * Marketing predictive month + day series from Marketing Planning ROM.
 * Plans: «Лист2» (gid 470078609) + МЕС on «Маркетинг общий».
 * Facts: 06_Marketing_Daily (traffic_type=all).
 * Forecast: calendar_run_rate on completed days (Europe/Riga).
 */

import {
  getMarketingPlanningSpreadsheetId,
  MARKETING_DAILY_COLUMNS,
  MARKETING_PLANNING_SHEETS
} from "@/config/marketing-planning";
import { PREDICTIVE_UI } from "@/config/predictive-ui";
import { readSheetValues } from "@/lib/google/sheets-client";
import { parseFrontNumber, readPredictiveFrontGrid } from "@/lib/predictive/read-front-grid";
import { quoteTab } from "@/lib/sales-os/predictive-model";
import {
  completedDaysThrough,
  datesInMonth,
  resolveForecastAsOf
} from "@/lib/sales-os/prediction/periods";

export type MarketingPredictiveMetric = {
  id: string;
  label: string;
  unit: "eur" | "count" | "ratio";
  plan: number | null;
  fact: number | null;
  forecast: number | null;
  gapToPlan: number | null;
  status: string;
};

export type MarketingPredictiveDay = {
  date: string;
  leads: number | null;
  deals: number | null;
  invoiceEvents: number | null;
  payments: number | null;
  paidRevenue: number | null;
  spend: number | null;
  averageCheck: number | null;
  cpl: number | null;
  cac: number | null;
  roas: number | null;
  leadToPaymentCr: number | null;
  dataQualityStatus: string | null;
  completeness: "complete" | "partial" | "future" | "missing_data";
};

export type MarketingPredictiveModel = {
  isoMonth: string;
  monthLabel: string;
  asOf: string | null;
  today: string;
  status: "ok" | "partial" | "blocked" | "error";
  message: string;
  method: string;
  metrics: MarketingPredictiveMetric[];
  days: MarketingPredictiveDay[];
  notes: string[];
  sources: {
    plansTab: string;
    plansGid: number;
    frontTab: string;
    frontGid: number;
    dailyTab: string;
  };
};

const LIST2_TAB = "Лист2";
const LIST2_GID = 470078609;

const PLAN_METRIC_MAP: Array<{
  match: RegExp;
  id: string;
  label: string;
  unit: MarketingPredictiveMetric["unit"];
}> = [
  { match: /выручк/i, id: "paid_revenue", label: "Выручка", unit: "eur" },
  { match: /facebook.*roas/i, id: "facebook_roas", label: "Facebook ROAS", unit: "ratio" },
  { match: /roas/i, id: "roas", label: "Blended ROAS", unit: "ratio" },
  { match: /квалифицированн.*лид/i, id: "qualified_leads", label: "Квалифицированные лиды", unit: "count" },
  { match: /доля\s*квалифицированн/i, id: "qualified_share", label: "Доля квалифицированных", unit: "ratio" },
  { match: /facebook.*квал/i, id: "facebook_qualified_leads", label: "Facebook — квал. лиды", unit: "count" },
  { match: /facebook.*cpl/i, id: "facebook_cpl", label: "Facebook CPL", unit: "eur" },
  { match: /facebook.*лид/i, id: "facebook_leads", label: "Facebook — лиды", unit: "count" },
  { match: /органик.*лид/i, id: "organic_leads", label: "Органика — лиды", unit: "count" },
  { match: /paid\s*media|budget|бюджет/i, id: "spend", label: "Paid media budget", unit: "eur" },
  { match: /лиды/i, id: "leads", label: "Лиды", unit: "count" }
];

function todayIsoRiga(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

function parseNum(raw: string | null | undefined): number | null {
  return parseFrontNumber(raw);
}

function mapPlanMetric(label: string): { id: string; label: string; unit: MarketingPredictiveMetric["unit"] } | null {
  const text = label.trim();
  if (!text) return null;
  for (const rule of PLAN_METRIC_MAP) {
    if (rule.match.test(text)) return { id: rule.id, label: rule.label, unit: rule.unit };
  }
  return null;
}

function statusFrom(plan: number | null, fact: number | null, forecast: number | null): string {
  if (plan == null) return forecast != null || fact != null ? "NO_PLAN" : "UNKNOWN";
  const compare = forecast ?? fact;
  if (compare == null) return "NO_PLAN";
  if (compare >= plan * 0.98) return compare > plan * 1.02 ? "ABOVE_PLAN" : "ON_PLAN";
  return "BELOW_PLAN";
}

/** Parse «Лист2» plan board: metric rows with План / Факт / % PtF. */
export function parseList2Plans(values: string[][]): Map<string, { label: string; unit: MarketingPredictiveMetric["unit"]; plan: number | null }> {
  const out = new Map<string, { label: string; unit: MarketingPredictiveMetric["unit"]; plan: number | null }>();
  let currentMetric = "";
  for (const row of values.slice(1)) {
    const metricCell = String(row[1] ?? "").trim();
    const role = String(row[2] ?? "").trim().toLowerCase();
    if (metricCell) currentMetric = metricCell;
    if (!currentMetric) continue;
    if (role !== "план" && role !== "plan") continue;
    const meta = mapPlanMetric(currentMetric);
    if (!meta) continue;
    const plan =
      parseNum(String(row[4] ?? "").replace(/\*/g, "")) ??
      parseNum(String(row[10] ?? "").replace(/\*/g, "")) ??
      null;
    if (!out.has(meta.id) || out.get(meta.id)?.plan == null) {
      out.set(meta.id, { label: meta.label, unit: meta.unit, plan });
    }
  }
  return out;
}

type DailyFact = {
  date: string;
  leads: number | null;
  deals: number | null;
  invoiceEvents: number | null;
  payments: number | null;
  paidRevenue: number | null;
  spend: number | null;
  averageCheck: number | null;
  cpl: number | null;
  cac: number | null;
  roas: number | null;
  leadToPaymentCr: number | null;
  dataQualityStatus: string | null;
};

function parseDailySheet(values: string[][], isoMonth: string): DailyFact[] {
  if (!values.length) return [];
  const header = values[0].map((c) => String(c ?? "").trim());
  const idx = Object.fromEntries(MARKETING_DAILY_COLUMNS.map((col) => [col, header.indexOf(col)]));
  if ((idx.date ?? -1) < 0 || (idx.traffic_type ?? -1) < 0) return [];

  const out: DailyFact[] = [];
  for (const raw of values.slice(1)) {
    const date = String(raw[idx.date!] ?? "").trim();
    const traffic = String(raw[idx.traffic_type!] ?? "").trim().toLowerCase();
    if (!date.startsWith(isoMonth) || traffic !== "all") continue;
    const num = (col: (typeof MARKETING_DAILY_COLUMNS)[number]) => {
      const i = idx[col];
      return i == null || i < 0 ? null : parseNum(raw[i]);
    };
    out.push({
      date,
      leads: num("leads"),
      deals: num("deals"),
      invoiceEvents: num("invoice_events"),
      payments: num("payments"),
      paidRevenue: num("paid_revenue"),
      spend: num("spend"),
      averageCheck: num("average_check"),
      cpl: num("cpl"),
      cac: num("cac"),
      roas: num("roas"),
      leadToPaymentCr: num("lead_to_payment_cr"),
      dataQualityStatus: idx.data_quality_status >= 0 ? String(raw[idx.data_quality_status] ?? "").trim() || null : null
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function sum(values: Array<number | null | undefined>): number | null {
  let total = 0;
  let any = false;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    total += v;
    any = true;
  }
  return any ? total : null;
}

function runRate(factToDate: number | null, elapsedDays: number, monthDays: number): number | null {
  if (factToDate == null || elapsedDays <= 0 || monthDays <= 0) return null;
  return (factToDate / elapsedDays) * monthDays;
}

export async function loadMarketingPredictiveModel(input: {
  isoMonth: string;
  now?: Date;
}): Promise<MarketingPredictiveModel> {
  const spreadsheetId = getMarketingPlanningSpreadsheetId();
  const today = todayIsoRiga(input.now);
  const asOf = resolveForecastAsOf({ month: input.isoMonth, today });
  const monthDays = datesInMonth(input.isoMonth);
  const completed = completedDaysThrough(input.isoMonth, asOf);
  const sources = {
    plansTab: LIST2_TAB,
    plansGid: LIST2_GID,
    frontTab: PREDICTIVE_UI.marketing.tabTitle,
    frontGid: PREDICTIVE_UI.marketing.sheetGid,
    dailyTab: MARKETING_PLANNING_SHEETS.marketingDaily
  };

  try {
    const [list2Values, dailyValues, front] = await Promise.all([
      readSheetValues({
        spreadsheetId,
        range: `${quoteTab(LIST2_TAB)}!A1:K80`
      }),
      readSheetValues({
        spreadsheetId,
        range: `${quoteTab(MARKETING_PLANNING_SHEETS.marketingDaily)}!A1:Z`
      }),
      readPredictiveFrontGrid({
        spreadsheetId: PREDICTIVE_UI.marketing.spreadsheetId(),
        tabTitle: PREDICTIVE_UI.marketing.tabTitle
      })
    ]);

    const plans = parseList2Plans(list2Values);
    const daily = parseDailySheet(dailyValues, input.isoMonth);
    const byDate = new Map(daily.map((d) => [d.date, d]));

    const days: MarketingPredictiveDay[] = monthDays.map((date) => {
      const fact = byDate.get(date);
      let completeness: MarketingPredictiveDay["completeness"] = "future";
      if (date > today) completeness = "future";
      else if (asOf && date <= asOf) completeness = fact ? "complete" : "missing_data";
      else if (date === today) completeness = fact ? "partial" : "partial";
      else completeness = fact ? "complete" : "missing_data";

      return {
        date,
        leads: fact?.leads ?? null,
        deals: fact?.deals ?? null,
        invoiceEvents: fact?.invoiceEvents ?? null,
        payments: fact?.payments ?? null,
        paidRevenue: fact?.paidRevenue ?? null,
        spend: fact?.spend ?? null,
        averageCheck: fact?.averageCheck ?? null,
        cpl: fact?.cpl ?? null,
        cac: fact?.cac ?? null,
        roas: fact?.roas ?? null,
        leadToPaymentCr: fact?.leadToPaymentCr ?? null,
        dataQualityStatus: fact?.dataQualityStatus ?? null,
        completeness
      };
    });

    const completedFacts = days.filter((d) => asOf && d.date <= asOf);
    const elapsed = completed.length;

    const factLeads = sum(completedFacts.map((d) => d.leads));
    const factPayments = sum(completedFacts.map((d) => d.payments));
    const factRevenue = sum(completedFacts.map((d) => d.paidRevenue));
    const factSpend = sum(completedFacts.map((d) => d.spend));
    const factDeals = sum(completedFacts.map((d) => d.deals));
    const factInvoices = sum(completedFacts.map((d) => d.invoiceEvents));

    const frontByKey = new Map(front.metrics.map((m) => [m.key, m]));

    const metricDefs: Array<{
      id: string;
      label: string;
      unit: MarketingPredictiveMetric["unit"];
      fact: number | null;
      forecast: number | null;
      additive: boolean;
    }> = [
      {
        id: "paid_revenue",
        label: "Выручка",
        unit: "eur",
        fact: factRevenue ?? frontByKey.get("paid_revenue")?.fact ?? null,
        forecast: runRate(factRevenue, elapsed, monthDays.length),
        additive: true
      },
      {
        id: "payments",
        label: "Оплаты",
        unit: "count",
        fact: factPayments ?? frontByKey.get("payments")?.fact ?? null,
        forecast: runRate(factPayments, elapsed, monthDays.length),
        additive: true
      },
      {
        id: "leads",
        label: "Лиды",
        unit: "count",
        fact: factLeads ?? frontByKey.get("leads")?.fact ?? null,
        forecast: runRate(factLeads, elapsed, monthDays.length),
        additive: true
      },
      {
        id: "deals",
        label: "Сделки",
        unit: "count",
        fact: factDeals ?? frontByKey.get("deals")?.fact ?? null,
        forecast: runRate(factDeals, elapsed, monthDays.length),
        additive: true
      },
      {
        id: "invoice_events",
        label: "Счета",
        unit: "count",
        fact: factInvoices ?? frontByKey.get("invoice_events")?.fact ?? null,
        forecast: runRate(factInvoices, elapsed, monthDays.length),
        additive: true
      },
      {
        id: "spend",
        label: "Paid media budget",
        unit: "eur",
        fact: factSpend,
        forecast: runRate(factSpend, elapsed, monthDays.length),
        additive: true
      }
    ];

    const forecastPayments = runRate(factPayments, elapsed, monthDays.length);
    const forecastRevenue = runRate(factRevenue, elapsed, monthDays.length);
    const forecastLeads = runRate(factLeads, elapsed, monthDays.length);
    const aovForecast =
      forecastPayments != null && forecastPayments > 0 && forecastRevenue != null
        ? forecastRevenue / forecastPayments
        : null;
    const aovFact =
      factPayments != null && factPayments > 0 && factRevenue != null ? factRevenue / factPayments : null;
    const cplFact =
      factSpend != null && factLeads != null && factLeads > 0 ? factSpend / factLeads : null;
    const cplForecast =
      factSpend != null && forecastLeads != null && forecastLeads > 0
        ? (runRate(factSpend, elapsed, monthDays.length) ?? factSpend) / forecastLeads
        : null;
    const crFact =
      factLeads != null && factLeads > 0 && factPayments != null ? factPayments / factLeads : null;
    const crForecast =
      forecastLeads != null && forecastLeads > 0 && forecastPayments != null
        ? forecastPayments / forecastLeads
        : null;

    metricDefs.push(
      {
        id: "average_check",
        label: "Средний чек",
        unit: "eur",
        fact: aovFact ?? frontByKey.get("average_check")?.fact ?? null,
        forecast: aovForecast,
        additive: false
      },
      {
        id: "cpl",
        label: "CPL",
        unit: "eur",
        fact: cplFact ?? frontByKey.get("cpl")?.fact ?? null,
        forecast: cplForecast,
        additive: false
      },
      {
        id: "lead_to_payment_cr",
        label: "CR лид → оплата",
        unit: "ratio",
        fact: crFact ?? frontByKey.get("lead_to_payment_cr")?.fact ?? null,
        forecast: crForecast,
        additive: false
      }
    );

    const metrics: MarketingPredictiveMetric[] = [];
    const seen = new Set<string>();

    for (const def of metricDefs) {
      const planFromList = plans.get(def.id)?.plan ?? null;
      const planFromFront = frontByKey.get(def.id)?.plan ?? null;
      const plan = planFromList ?? planFromFront;
      const fact = def.fact;
      const forecast = def.forecast ?? frontByKey.get(def.id)?.forecast ?? null;
      if (plan == null && fact == null && forecast == null) continue;
      metrics.push({
        id: def.id,
        label: def.label,
        unit: def.unit,
        plan,
        fact,
        forecast,
        gapToPlan: plan != null && forecast != null ? forecast - plan : null,
        status: statusFrom(plan, fact, forecast)
      });
      seen.add(def.id);
    }

    // Extra plan-only rows from Лист2 (Facebook / organic / ROAS…)
    for (const [id, row] of plans.entries()) {
      if (seen.has(id)) continue;
      metrics.push({
        id,
        label: row.label,
        unit: row.unit,
        plan: row.plan,
        fact: null,
        forecast: null,
        gapToPlan: null,
        status: row.plan == null ? "UNKNOWN" : "NO_PLAN"
      });
    }

    const hasFacts = days.some((d) => d.payments != null || d.leads != null || d.paidRevenue != null);
    const hasPlans = metrics.some((m) => m.plan != null);

    return {
      isoMonth: input.isoMonth,
      monthLabel: front.monthLabel || input.isoMonth,
      asOf,
      today,
      status: hasFacts ? (hasPlans ? "ok" : "partial") : hasPlans ? "partial" : "blocked",
      message: hasFacts
        ? `Месяц ${input.isoMonth}: факт по дням из ${sources.dailyTab}, план из «${LIST2_TAB}» / МЕС «${sources.frontTab}», прогноз = run-rate.`
        : hasPlans
          ? `Есть план в «${LIST2_TAB}», но дневных фактов за ${input.isoMonth} ещё нет.`
          : `Нет плана и факта маркетинга за ${input.isoMonth}.`,
      method: "calendar_run_rate",
      metrics,
      days,
      notes: [
        `План-доска: ${LIST2_TAB} (gid=${LIST2_GID})`,
        `Фронт: ${sources.frontTab} (gid=${sources.frontGid})`,
        `Дни: ${sources.dailyTab} · traffic_type=all`,
        asOf ? `As of (закрытый день): ${asOf}` : "As of: нет завершённых дней месяца",
        ...front.errors.slice(0, 2)
      ],
      sources
    };
  } catch (error) {
    return {
      isoMonth: input.isoMonth,
      monthLabel: input.isoMonth,
      asOf,
      today,
      status: "error",
      message: error instanceof Error ? error.message : "Не удалось загрузить маркетинг",
      method: "calendar_run_rate",
      metrics: [],
      days: [],
      notes: [],
      sources
    };
  }
}
