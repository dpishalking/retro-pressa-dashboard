/**
 * Marketing General PM — Lag Revenue driver tree + metric results.
 *
 * Spend (capacity) → Leads → Invoices → Payments × AOV → Revenue
 * Guardrails: CPL, Lead→Payment CR
 * Qualified leads: included when plan/fact exist, else NO_DATA.
 */

import {
  computePmMetric,
  diagnoseDriverChain,
  type PmDiagnosis,
  type PmMetricDefinition,
  type PmMetricResult
} from "@/lib/marketing-planning/pm-engine";

/** Causal tree: child.parentId → parent. Display order capacity → lag. */
export const MARKETING_GENERAL_DRIVER_DEFS: readonly PmMetricDefinition[] = [
  {
    id: "spend",
    label: "Paid media budget",
    unit: "eur",
    metricType: "CAPACITY",
    direction: "HIGHER_IS_BETTER",
    kind: "additive",
    parentId: "leads",
    primary: true
  },
  {
    id: "leads",
    label: "Лиды",
    unit: "count",
    metricType: "LEAD_2",
    direction: "HIGHER_IS_BETTER",
    kind: "additive",
    parentId: "invoice_events",
    primary: true
  },
  {
    id: "qualified_leads",
    label: "Квалифицированные лиды",
    unit: "count",
    metricType: "LEAD_2",
    direction: "HIGHER_IS_BETTER",
    kind: "additive",
    parentId: "invoice_events",
    primary: true
  },
  {
    id: "invoice_events",
    label: "Счета",
    unit: "count",
    metricType: "LEAD_1",
    direction: "HIGHER_IS_BETTER",
    kind: "additive",
    parentId: "payments",
    primary: true
  },
  {
    id: "payments",
    label: "Оплаты",
    unit: "count",
    metricType: "LEAD_1",
    direction: "HIGHER_IS_BETTER",
    kind: "additive",
    parentId: "paid_revenue",
    primary: true
  },
  {
    id: "average_check",
    label: "Средний чек",
    unit: "eur",
    metricType: "LEAD_1",
    direction: "HIGHER_IS_BETTER",
    kind: "rate",
    parentId: "paid_revenue",
    primary: true
  },
  {
    id: "paid_revenue",
    label: "Выручка",
    unit: "eur",
    metricType: "LAG",
    direction: "HIGHER_IS_BETTER",
    kind: "additive",
    parentId: null,
    primary: true
  },
  {
    id: "cpl",
    label: "CPL",
    unit: "eur",
    metricType: "GUARDRAIL",
    direction: "LOWER_IS_BETTER",
    kind: "rate",
    parentId: "leads",
    primary: true
  },
  {
    id: "lead_to_payment_cr",
    label: "CR лид → оплата",
    unit: "ratio",
    metricType: "GUARDRAIL",
    direction: "HIGHER_IS_BETTER",
    kind: "rate",
    parentId: "payments",
    primary: true
  }
] as const;

export type MarketingGeneralFacts = {
  paid_revenue: number | null;
  payments: number | null;
  invoice_events: number | null;
  leads: number | null;
  spend: number | null;
  average_check: number | null;
  cpl: number | null;
  lead_to_payment_cr: number | null;
  qualified_leads: number | null;
};

export type MarketingGeneralPlans = Partial<Record<keyof MarketingGeneralFacts, number | null>>;

export type MarketingGeneralPm = {
  metrics: PmMetricResult[];
  driverChain: PmMetricResult[];
  diagnosis: PmDiagnosis;
  elapsedDays: number;
  remainingDays: number;
  totalDays: number;
  planDistributionMethod: "LINEAR_FALLBACK";
};

function derivedAverageCheckPlan(plans: MarketingGeneralPlans): number | null {
  const rev = plans.paid_revenue;
  const pay = plans.payments;
  if (rev == null || pay == null || !(pay > 0)) return null;
  return rev / pay;
}

function derivedCplPlan(plans: MarketingGeneralPlans): number | null {
  const spend = plans.spend;
  const leads = plans.leads;
  if (spend == null || leads == null || !(leads > 0)) return null;
  return spend / leads;
}

function derivedCrPlan(plans: MarketingGeneralPlans): number | null {
  const pay = plans.payments;
  const leads = plans.leads;
  if (pay == null || leads == null || !(leads > 0)) return null;
  return pay / leads;
}

export function buildMarketingGeneralPm(input: {
  facts: MarketingGeneralFacts;
  plans: MarketingGeneralPlans;
  elapsedDays: number;
  remainingDays: number;
  totalDays: number;
}): MarketingGeneralPm {
  const planSources: Partial<Record<string, "USER_PLAN" | "DERIVED" | "NONE">> = {};
  const plans: MarketingGeneralPlans = { ...input.plans };

  if (plans.average_check == null) {
    const derived = derivedAverageCheckPlan(plans);
    if (derived != null) {
      plans.average_check = derived;
      planSources.average_check = "DERIVED";
    }
  }
  if (plans.cpl == null) {
    const derived = derivedCplPlan(plans);
    if (derived != null) {
      plans.cpl = derived;
      planSources.cpl = "DERIVED";
    }
  }
  if (plans.lead_to_payment_cr == null) {
    const derived = derivedCrPlan(plans);
    if (derived != null) {
      plans.lead_to_payment_cr = derived;
      planSources.lead_to_payment_cr = "DERIVED";
    }
  }

  // Leading risk: invoices/payments badly off while lag looks ok
  const invoicePacePreview =
    plans.invoice_events != null &&
    input.facts.invoice_events != null &&
    input.elapsedDays > 0 &&
    input.totalDays > 0
      ? input.facts.invoice_events /
        ((plans.invoice_events * input.elapsedDays) / input.totalDays)
      : null;
  const leadingRisk = invoicePacePreview != null && invoicePacePreview < 0.85;

  const metrics = MARKETING_GENERAL_DRIVER_DEFS.map((def) => {
    const key = def.id as keyof MarketingGeneralFacts;
    return computePmMetric({
      def,
      plan: plans[key] ?? null,
      factToDate: input.facts[key] ?? null,
      planSource: planSources[def.id] ?? ((plans[key] ?? null) != null ? "USER_PLAN" : "NONE"),
      elapsed: input.elapsedDays,
      remaining: input.remainingDays,
      total: input.totalDays,
      leadingRisk: def.id === "paid_revenue" ? leadingRisk : false
    });
  });

  const chainOrder = [
    "spend",
    "leads",
    "qualified_leads",
    "invoice_events",
    "payments",
    "average_check",
    "paid_revenue"
  ];
  const byId = new Map(metrics.map((m) => [m.id, m]));
  const driverChain = chainOrder.map((id) => byId.get(id)).filter(Boolean) as PmMetricResult[];

  return {
    metrics,
    driverChain,
    diagnosis: diagnoseDriverChain(metrics, "paid_revenue"),
    elapsedDays: input.elapsedDays,
    remainingDays: input.remainingDays,
    totalDays: input.totalDays,
    planDistributionMethod: "LINEAR_FALLBACK"
  };
}
