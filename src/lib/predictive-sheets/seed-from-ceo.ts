import {
  findSvodPlanColumn,
  getMonthlyPlanSpreadsheetId,
  getMonthlyPlanTabTitle,
  parseSvodPlanNumber
} from "@/lib/sales-os/svod-plans";
import { readSheetValues } from "@/lib/google/sheets-client";
import type { BitrixMonthFacts, WeeklyFacts } from "@/lib/predictive-sheets/seed-from-bitrix";

export type SeedValue = {
  plan: number | null;
  fact: number | null;
  planNote?: string;
  /** Weekly facts W1–W5; plans stay empty unless a real weekly plan exists. */
  weekFact?: Array<number | null>;
};

export type CeoSeedBundle = {
  month: string;
  general: Record<string, SeedValue>;
  paid: Record<string, SeedValue>;
  organic: Record<string, SeedValue>;
  source: string;
};

function findFactColumn(values: string[][], month: string, planCol: number): number {
  const want = month.slice(5, 7);
  // CEO layout: Plan then Fact (+2) within month block
  void want;
  return planCol + 2;
}

function sectionBounds(values: string[][]): { general: [number, number]; paid: [number, number]; organic: [number, number] } {
  let generalStart = -1;
  let paidStart = -1;
  let organicStart = -1;
  for (let i = 0; i < values.length; i += 1) {
    const label = String(values[i]?.[0] || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (label.startsWith("общие")) generalStart = i;
    if (label.includes("facebook") || label === "платный" || label.includes("платн")) paidStart = i;
    if (label.includes("органик")) organicStart = i;
  }
  // Fallback by known row layout from audit: ОБЩИЕ ~3, paid ~27, organic ~69
  if (generalStart < 0) generalStart = 2;
  if (paidStart < 0) paidStart = 26;
  if (organicStart < 0) organicStart = 68;
  return {
    general: [generalStart, paidStart],
    paid: [paidStart, organicStart],
    organic: [organicStart, values.length]
  };
}

function pickInRange(
  values: string[][],
  start: number,
  end: number,
  planCol: number,
  factCol: number,
  matchers: RegExp[]
): SeedValue {
  for (let i = start; i < end; i += 1) {
    const label = String(values[i]?.[0] || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!label) continue;
    if (!matchers.some((re) => re.test(label))) continue;
    return {
      plan: parseSvodPlanNumber(values[i][planCol]),
      fact: parseSvodPlanNumber(values[i][factCol])
    };
  }
  return { plan: null, fact: null };
}

function mapSection(
  values: string[][],
  start: number,
  end: number,
  planCol: number,
  factCol: number
): Record<string, SeedValue> {
  const p = (matchers: RegExp[]) => pickInRange(values, start, end, planCol, factCol, matchers);
  return {
    revenue: p([/^выручка$/]),
    budget: p([/^бюджет$/]),
    spend: p([/^бюджет$/]),
    roas: p([/^roas$/]),
    leads: p([/^лиды$/]),
    cpl: p([/^cpl$/]),
    qualified_leads: p([/^квал/]),
    qualification_rate: p([/% квал/, /квал.*%/]),
    invoices: p([/^счета/]),
    payments: p([/^оплаты/]),
    lead_to_invoice_cr: p([/лид в счет/]),
    lead_to_payment_cr: p([/лид в оплату/]),
    average_check_invoice: p([/средний чек счет/]),
    average_check: p([/средний чек оплат/]),
    invoice_to_payment_cr: p([/счет в оплату/]),
    cac: p([/^cac$/]),
    roi: p([/^roi$/]),
    romi: p([/^romi$/])
  };
}

/** Load real plan/fact from CEO monthly workbook — never invent numbers. */
export async function loadCeoSeed(month: string): Promise<CeoSeedBundle> {
  const spreadsheetId = getMonthlyPlanSpreadsheetId();
  const tab = getMonthlyPlanTabTitle();
  const values = await readSheetValues({
    spreadsheetId,
    range: `'${tab.replace(/'/g, "''")}'!A1:AZ120`
  });
  const planCol = findSvodPlanColumn(values, month);
  if (planCol == null) {
    return {
      month,
      general: {},
      paid: {},
      organic: {},
      source: `${spreadsheetId} / ${tab} (plan column not found for ${month})`
    };
  }
  const factCol = findFactColumn(values, month, planCol);
  const bounds = sectionBounds(values);
  return {
    month,
    general: mapSection(values, bounds.general[0], bounds.general[1], planCol, factCol),
    paid: mapSection(values, bounds.paid[0], bounds.paid[1], planCol, factCol),
    organic: mapSection(values, bounds.organic[0], bounds.organic[1], planCol, factCol),
    source: `https://docs.google.com/spreadsheets/d/${spreadsheetId} tab ${tab}`
  };
}

function ratePct(num: number | null | undefined, den: number | null | undefined): number | null {
  if (num == null || den == null || !Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return Number(((num / den) * 100).toFixed(1));
}

function weeklyRate(num: Array<number | null> | undefined, den: Array<number | null> | undefined): WeeklyFacts {
  const out: WeeklyFacts = [null, null, null, null, null];
  for (let i = 0; i < 5; i += 1) {
    out[i] = ratePct(num?.[i] ?? null, den?.[i] ?? null);
  }
  return out;
}

/** Overlay live Bitrix counts onto CEO plans. Does not invent weekly plans. */
export function applyBitrixFacts(seed: CeoSeedBundle, bitrix: BitrixMonthFacts): CeoSeedBundle {
  const general = { ...seed.general };
  general.revenue = {
    plan: general.revenue?.plan ?? null,
    fact: bitrix.revenue,
    planNote: general.revenue?.planNote,
    weekFact: [...bitrix.revenueByWeek]
  };
  general.payments = {
    plan: general.payments?.plan ?? null,
    fact: bitrix.payments,
    planNote: general.payments?.planNote,
    weekFact: [...bitrix.paymentsByWeek]
  };
  general.invoices = {
    plan: general.invoices?.plan ?? null,
    fact: bitrix.invoices,
    planNote: general.invoices?.planNote,
    weekFact: [...bitrix.invoicesByWeek]
  };
  if (bitrix.payments > 0) {
    general.average_check = {
      plan: general.average_check?.plan ?? null,
      fact: Number((bitrix.revenue / bitrix.payments).toFixed(2)),
      planNote: general.average_check?.planNote
    };
  }
  general.invoice_to_payment_cr = {
    plan: general.invoice_to_payment_cr?.plan ?? null,
    fact: ratePct(bitrix.payments, bitrix.invoices),
    planNote: general.invoice_to_payment_cr?.planNote,
    weekFact: weeklyRate(bitrix.paymentsByWeek, bitrix.invoicesByWeek)
  };
  return {
    ...seed,
    general,
    source: `${seed.source} + ${bitrix.source}`
  };
}

/** Map catalog metric_id → seed value from CEO bundle. */
export function seedForMetricId(
  metricId: string,
  seed: CeoSeedBundle
): SeedValue & { derived?: boolean } {
  const g = seed.general;
  const p = seed.paid;
  const o = seed.organic;
  const map: Record<string, SeedValue> = {
    mg_revenue: g.revenue || { plan: null, fact: null },
    mg_payments: g.payments || { plan: null, fact: null },
    mg_average_check: g.average_check || { plan: null, fact: null },
    mg_leads: g.leads || { plan: null, fact: null },
    mg_qualified_leads: g.qualified_leads || { plan: null, fact: null },
    mg_qualification_rate: g.qualification_rate || { plan: null, fact: null },
    mg_paid_leads: p.leads || { plan: null, fact: null },
    mg_organic_leads: o.leads || { plan: null, fact: null },
    mg_invoices: g.invoices || { plan: null, fact: null },
    mg_cpl: g.cpl || { plan: null, fact: null },
    mg_cac: g.cac || { plan: null, fact: null },
    mg_roas: g.roas || { plan: null, fact: null },
    mg_budget: g.budget || { plan: null, fact: null },

    mp_revenue: p.revenue || { plan: null, fact: null },
    mp_payments: p.payments || { plan: null, fact: null },
    mp_qualified_leads: p.qualified_leads || { plan: null, fact: null },
    mp_leads: p.leads || { plan: null, fact: null },
    mp_qualification_rate: p.qualification_rate || { plan: null, fact: null },
    mp_spend: p.budget || { plan: null, fact: null },
    mp_cpl: p.cpl || { plan: null, fact: null },
    mp_cpql: { plan: null, fact: null },
    mp_cac: p.cac || { plan: null, fact: null },
    mp_roas: p.roas || { plan: null, fact: null },

    mo_revenue: o.revenue || { plan: null, fact: null },
    mo_payments: o.payments || { plan: null, fact: null },
    mo_qualified_leads: o.qualified_leads || { plan: null, fact: null },
    mo_leads: o.leads || { plan: null, fact: null },
    mo_qualification_rate: o.qualification_rate || { plan: null, fact: null },
    mo_lead_payment_cr: o.lead_to_payment_cr || { plan: null, fact: null },

    sg_revenue: g.revenue || { plan: null, fact: null },
    sg_payments: g.payments || { plan: null, fact: null },
    sg_average_check: g.average_check || { plan: null, fact: null },
    sg_leads: g.leads || { plan: null, fact: null },
    sg_qualification_rate: g.qualification_rate || { plan: null, fact: null },
    sg_qualified_leads: g.qualified_leads || { plan: null, fact: null },
    sg_invoices: g.invoices || { plan: null, fact: null },
    sg_cr_invoice_payment: g.invoice_to_payment_cr || { plan: null, fact: null }
  };

  let value = map[metricId] || { plan: null, fact: null };

  // Derived plans when numerator/denominator exist
  if (metricId === "mg_average_check" || metricId === "sg_average_check") {
    if (value.plan == null && g.revenue?.plan != null && g.payments?.plan != null && g.payments.plan > 0) {
      value = {
        plan: g.revenue.plan / g.payments.plan,
        fact:
          value.fact ??
          (g.revenue?.fact != null && g.payments?.fact != null && g.payments.fact > 0
            ? g.revenue.fact / g.payments.fact
            : null),
        planNote: "расчётный план"
      };
      return { ...value, derived: true };
    }
  }
  if (metricId === "mg_cpl" || metricId === "mp_cpl") {
    const src = metricId === "mp_cpl" ? p : g;
    if (value.plan == null && src.budget?.plan != null && src.leads?.plan != null && src.leads.plan > 0) {
      value = {
        plan: src.budget.plan / src.leads.plan,
        fact: value.fact,
        planNote: "расчётный план"
      };
      return { ...value, derived: true };
    }
  }
  if (metricId === "mp_cpql") {
    if (p.budget?.plan != null && p.qualified_leads?.plan != null && p.qualified_leads.plan > 0) {
      return {
        plan: p.budget.plan / p.qualified_leads.plan,
        fact:
          p.budget?.fact != null && p.qualified_leads?.fact != null && p.qualified_leads.fact > 0
            ? p.budget.fact / p.qualified_leads.fact
            : null,
        planNote: "расчётный план",
        derived: true
      };
    }
  }
  if (metricId === "sg_qualification_rate" || metricId === "mg_qualification_rate") {
    if (value.plan == null && g.qualified_leads?.plan != null && g.leads?.plan != null && g.leads.plan > 0) {
      return {
        plan: (g.qualified_leads.plan / g.leads.plan) * 100,
        fact:
          g.qualified_leads?.fact != null && g.leads?.fact != null && g.leads.fact > 0
            ? (g.qualified_leads.fact / g.leads.fact) * 100
            : null,
        planNote: "расчётный план",
        derived: true
      };
    }
  }
  if (metricId === "sg_cr_invoice_payment") {
    const plan =
      value.plan ??
      (g.payments?.plan != null && g.invoices?.plan != null && g.invoices.plan > 0
        ? Number(((g.payments.plan / g.invoices.plan) * 100).toFixed(1))
        : null);
    const fact = value.fact ?? ratePct(g.payments?.fact, g.invoices?.fact);
    if (plan != null || fact != null) {
      return {
        plan,
        fact,
        weekFact: value.weekFact ?? weeklyRate(g.payments?.weekFact, g.invoices?.weekFact),
        planNote: value.planNote || "факт: оплаты / счета Bitrix",
        derived: true
      };
    }
  }
  if (metricId === "mo_lead_payment_cr") {
    if (value.plan == null && o.payments?.plan != null && o.leads?.plan != null && o.leads.plan > 0) {
      return {
        plan: (o.payments.plan / o.leads.plan) * 100,
        fact:
          o.payments?.fact != null && o.leads?.fact != null && o.leads.fact > 0
            ? (o.payments.fact / o.leads.fact) * 100
            : null,
        planNote: "расчётный план",
        derived: true
      };
    }
  }

  return value;
}
