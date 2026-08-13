import { calculateManagerPayroll } from "@/lib/payroll/calculator";
import { DEFAULT_PAYROLL_PARAMS } from "@/lib/payroll/defaults";
import type { BitrixManagerFacts, WeeklyFacts } from "@/lib/predictive-sheets/seed-from-bitrix";
import type { CeoSeedBundle, SeedValue } from "@/lib/predictive-sheets/seed-from-ceo";
import { PM_SALES_MANAGERS } from "@/lib/predictive-sheets/managers";

function emptyWeeks(): WeeklyFacts {
  return [null, null, null, null, null];
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function weekMinus(a: WeeklyFacts | undefined, b: WeeklyFacts | undefined): WeeklyFacts {
  const out = emptyWeeks();
  for (let i = 0; i < 5; i += 1) {
    const x = a?.[i];
    const y = b?.[i];
    if (x == null && y == null) continue;
    out[i] = round2((x ?? 0) - (y ?? 0));
  }
  return out;
}

function leadToPaidFraction(facts: BitrixManagerFacts): number | null {
  if (!(facts.leads > 0)) return null;
  return facts.payments / facts.leads;
}

export function payrollForManager(facts: BitrixManagerFacts, revenuePlan?: number | null) {
  const check = facts.payments > 0 ? facts.revenue / facts.payments : null;
  return calculateManagerPayroll(
    { ...DEFAULT_PAYROLL_PARAMS, salesPlanEur: revenuePlan ?? null },
    {
      id: facts.assignedById,
      name: facts.managerName,
      revenueEur: facts.revenue,
      leads: facts.leads,
      workingDays: null,
      invoiceCrPct: facts.leads > 0 ? facts.invoices / facts.leads : null,
      paymentCrPct: leadToPaidFraction(facts),
      avgCheckEur: check,
      payments: facts.payments
    }
  );
}

export function companyPayrollEur(
  companyRevenue: number,
  byManager: Record<string, BitrixManagerFacts>
): number | null {
  let mop = 0;
  let counted = 0;
  for (const mgr of PM_SALES_MANAGERS) {
    const facts = byManager[mgr.bitrixId];
    if (!facts) continue;
    mop += payrollForManager(facts, mgr.revenuePlan).mopPayEur;
    counted += 1;
  }
  if (!counted) return null;
  return round2(
    mop + DEFAULT_PAYROLL_PARAMS.ropSalaryEur + companyRevenue * DEFAULT_PAYROLL_PARAMS.ropPct
  );
}

/** Overlay finance P&L onto CEO seed. Does not invent bank/overhead. */
export function applyFinanceFacts(
  seed: CeoSeedBundle,
  byManager: Record<string, BitrixManagerFacts>
): CeoSeedBundle {
  const g = seed.general;
  const revenue = g.revenue?.fact ?? null;
  const revenuePlan = g.revenue?.plan ?? null;
  const spend = g.budget?.fact ?? null;
  const spendPlan = g.budget?.plan ?? null;
  const revenueWeeks = (g.revenue?.weekFact ?? emptyWeeks()) as WeeklyFacts;
  const spendWeeks = (g.budget?.weekFact ?? emptyWeeks()) as WeeklyFacts;

  const payrollFact = revenue != null ? companyPayrollEur(revenue, byManager) : null;
  const afterAdsFact =
    revenue != null && spend != null ? round2(revenue - spend) : revenue != null ? revenue : null;
  const afterAdsPlan =
    revenuePlan != null && spendPlan != null ? round2(revenuePlan - spendPlan) : null;
  const afterFotFact =
    afterAdsFact != null && payrollFact != null ? round2(afterAdsFact - payrollFact) : null;
  const roasFact = revenue != null && spend != null && spend > 0 ? round2((revenue / spend) * 100) : null;
  const roasPlan =
    revenuePlan != null && spendPlan != null && spendPlan > 0
      ? round2((revenuePlan / spendPlan) * 100)
      : g.roas?.plan ?? null;
  const fotShare =
    payrollFact != null && revenue != null && revenue > 0 ? round2((payrollFact / revenue) * 100) : null;

  const finance: Record<string, SeedValue> = {
    revenue: {
      plan: revenuePlan,
      fact: revenue,
      weekFact: [...revenueWeeks],
      planNote: g.revenue?.planNote || "план выручки CEO",
      factNote: g.revenue?.factNote || "SPA Счета Оплачено + дата завершения"
    },
    ad_spend: {
      plan: spendPlan,
      fact: spend,
      weekFact: [...spendWeeks],
      planNote: "бюджет CEO",
      factNote: "СВОД day / Органика"
    },
    contribution_ads: {
      plan: afterAdsPlan,
      fact: afterAdsFact,
      weekFact: weekMinus(revenueWeeks, spendWeeks),
      planNote: afterAdsPlan != null ? "касса − реклама" : "нет плана",
      factNote: "касса − реклама"
    },
    payroll: {
      plan: null,
      fact: payrollFact,
      planNote: "нет утверждённого плана ФОТ",
      factNote:
        "оценка: оклад×менеджеры + % с кассы (Мотивация МОП) + оклад РОП + 1% кассы. Не банк."
    },
    after_payroll: {
      plan: null,
      fact: afterFotFact,
      planNote: "нет плана (нужен план ФОТ)",
      factNote: "после рекламы − ФОТ ОП"
    },
    roas: {
      plan: roasPlan,
      fact: roasFact,
      planNote: roasPlan != null ? "план кассы / план бюджета" : "нет плана",
      factNote: "касса / реклама"
    },
    fot_share: {
      plan: null,
      fact: fotShare,
      planNote: "нет плана",
      factNote: "ФОТ / касса"
    }
  };

  return {
    ...seed,
    finance,
    source: `${seed.source} + ФОТ по формуле Мотивация МОП`
  };
}
