import { DEFAULT_PAYROLL_PARAMS } from "@/lib/payroll/defaults";
import type { BitrixManagerFacts, WeeklyFacts } from "@/lib/predictive-sheets/seed-from-bitrix";
import { payrollForManager } from "@/lib/predictive-sheets/seed-from-finance";
import { displayMondayWeeks } from "@/lib/predictive-sheets/weeks";

export type PayrollCalendar = {
  month: string;
  elapsed: number;
  totalDays: number;
};

type PayrollSeedValue = {
  plan: number | null;
  fact: number | null;
  planNote?: string;
  factNote?: string;
  weekFact?: Array<number | null>;
};

function emptyWeeks(): WeeklyFacts {
  return [null, null, null, null, null];
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

/** Accrued manager pay on as-of date: pro-rated salary + commission on cash + earned bonuses. */
export function managerPayrollSeedValues(
  facts: BitrixManagerFacts,
  revenuePlan: number | null | undefined,
  cal: PayrollCalendar
): Record<string, PayrollSeedValue> {
  const pay = payrollForManager(facts, revenuePlan);
  const salaryPlan = DEFAULT_PAYROLL_PARAMS.salaryEur;
  const elapsed = Math.max(cal.elapsed, 0);
  const total = Math.max(cal.totalDays, 1);
  const salaryAccrued = round2((salaryPlan * Math.min(elapsed, total)) / total);
  const commissionPct = pay.commissionPct;
  const commissionPlan =
    revenuePlan != null && revenuePlan > 0
      ? round2(revenuePlan * DEFAULT_PAYROLL_PARAMS.salesBonusPct)
      : null;
  const commissionFact = round2(facts.revenue * commissionPct);
  const bonusesFact = round2(
    (pay.checkBonusApplied ? DEFAULT_PAYROLL_PARAMS.checkBonusEur : 0) +
      (pay.conversionBonusApplied ? DEFAULT_PAYROLL_PARAMS.conversionBonusEur : 0)
  );
  const payrollPlan = commissionPlan != null ? round2(salaryPlan + commissionPlan) : salaryPlan;
  const payrollFact = round2(salaryAccrued + commissionFact + bonusesFact);
  const perDayPlan = round2(payrollPlan / total);
  const perDayFact = elapsed > 0 ? round2(payrollFact / elapsed) : null;

  const weeks = displayMondayWeeks(cal.month);
  const salaryWeeks: WeeklyFacts = emptyWeeks();
  const commissionWeeks: WeeklyFacts = emptyWeeks();
  const payrollWeeks: WeeklyFacts = emptyWeeks();
  for (let i = 0; i < 5; i += 1) {
    const share = weeks[i]?.share ?? 0;
    const salaryW = share > 0 ? round2(salaryPlan * share) : null;
    const revW = facts.revenueByWeek[i];
    const commissionW = revW != null ? round2(revW * commissionPct) : null;
    salaryWeeks[i] = salaryW;
    commissionWeeks[i] = commissionW;
    if (salaryW != null || commissionW != null) {
      payrollWeeks[i] = round2((salaryW ?? 0) + (commissionW ?? 0));
    }
  }

  return {
    salary: {
      plan: salaryPlan,
      fact: salaryAccrued,
      weekFact: [...salaryWeeks],
      planNote: `оклад ${salaryPlan} € / месяц`,
      factNote: `начислено ${elapsed}/${total} дн.`
    },
    commission: {
      plan: commissionPlan,
      fact: commissionFact,
      weekFact: [...commissionWeeks],
      planNote:
        commissionPlan != null
          ? `${DEFAULT_PAYROLL_PARAMS.salesBonusPct * 100}% плана выручки`
          : "нет плана выручки → нет плана комиссии",
      factNote: `${round2(commissionPct * 100)}% × касса${pay.usedPlanRate ? " (ставка выше плана)" : ""}`
    },
    bonuses: {
      plan: null,
      fact: bonusesFact,
      planNote: "пороги: чек 80 € / лид→оплата 20%",
      factNote: "формула Мотивация МОП"
    },
    payroll: {
      plan: payrollPlan,
      fact: payrollFact,
      weekFact: [...payrollWeeks],
      planNote: "оклад + комиссия с плана выручки (без бонусов)",
      factNote: "оклад на дату + комиссия + бонусы"
    },
    payroll_per_day: {
      plan: perDayPlan,
      fact: perDayFact,
      planNote: "ФОТ план / дни месяца",
      factNote: "ФОТ начислено / прошедшие дни"
    }
  };
}
