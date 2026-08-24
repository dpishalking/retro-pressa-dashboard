import { eur } from "@/lib/format";
import type { CabinetPayTip, ManagerCabinetFacts, ManagerCabinetShifts, ManagerOnboardingPay } from "@/lib/manager-cabinet/types";
import { DEFAULT_PAYROLL_PARAMS } from "@/lib/payroll/defaults";
import type { ManagerPayrollResult, PayrollParams } from "@/lib/payroll/types";

function money(value: number): string {
  return eur(Math.round(value));
}

export function buildPayTips(input: {
  facts: ManagerCabinetFacts;
  payroll: ManagerPayrollResult;
  shifts: ManagerCabinetShifts;
  salaryProratedEur: number | null;
  softBonusesOnFullMonth: boolean;
  params?: PayrollParams;
}): CabinetPayTip[] {
  const params = input.params ?? DEFAULT_PAYROLL_PARAMS;
  const tips: CabinetPayTip[] = [];
  const salary = input.salaryProratedEur ?? params.salaryEur;
  const worked = input.shifts.worked;
  const norm = input.shifts.norm;

  if (worked != null && norm > 0 && worked < norm) {
    tips.push({
      title: "Оклад",
      text: `Норма ${norm} смен, закрыто ${worked}. Оклад режется: ${money(salary)} вместо ${money(params.salaryEur)}.`
    });
  } else if (worked != null && worked >= norm) {
    tips.push({
      title: "Оклад",
      text: `Смены закрыты (${worked} из ${norm}). Оклад полный: ${money(salary)}.`
    });
  } else {
    tips.push({
      title: "Оклад",
      text: `Базовый оклад ${money(salary)}. Смены в графике не нашлись — считаем как есть.`
    });
  }

  const commission = input.facts.revenueEur * input.payroll.commissionPct;
  const pctLabel = Math.round(input.payroll.commissionPct * 100);
  tips.push({
    title: "Процент с кассы",
    text: `Люди оплатили на ${money(input.facts.revenueEur)}. Тебе ${pctLabel}% — это ${money(commission)}.`
  });

  if (!input.softBonusesOnFullMonth) {
    tips.push({
      title: "Бонусы",
      text: "Бонус за покупки и за чек смотрим в конце месяца, не за полмесяца."
    });
    return tips;
  }

  const needBuys = Math.ceil(input.facts.leads * params.conversionPlanPct);
  const haveBuys = input.facts.payments;
  if (input.payroll.conversionBonusApplied) {
    tips.push({
      title: "Бонус «много покупок»",
      text: `Есть: ${money(params.conversionBonusEur)}. Из ${input.facts.leads} заявок купили ${haveBuys} — этого хватило.`
    });
  } else if (input.facts.leads > 0) {
    const more = Math.max(0, needBuys - haveBuys);
    tips.push({
      title: "Бонус «много покупок»",
      text:
        more > 0
          ? `Пока нет (${money(params.conversionBonusEur)}). Купили ${haveBuys} из ${input.facts.leads}. Нужно ещё примерно ${more} покупок — и бонус твой.`
          : `Пока нет (${money(params.conversionBonusEur)}). Покупок мало относительно заявок.`
    });
  }

  const check = input.facts.avgCheckEur;
  if (input.payroll.checkBonusApplied && check != null) {
    tips.push({
      title: "Бонус «толстый чек»",
      text: `Есть: ${money(params.checkBonusEur)}. Средний чек ${money(check)} — выше ${money(params.checkPlanEur)}.`
    });
  } else if (check != null) {
    const gap = Math.max(0, Math.round(params.checkPlanEur - check));
    tips.push({
      title: "Бонус «толстый чек»",
      text:
        gap > 0
          ? `Пока нет (${money(params.checkBonusEur)}). Средний чек ${money(check)}, нужно ${money(params.checkPlanEur)}. К газете предлагай рамку, открытку или второй экземпляр — примерно +${money(gap)} в чек.`
          : `Пока нет (${money(params.checkBonusEur)}). Чек ещё не дотягивает до ${money(params.checkPlanEur)}.`
    });
  }

  tips.push({
    title: "Итого",
    text: `К выплате сейчас ${money(input.payroll.mopPayEur)}.`
  });

  return tips;
}

export function buildOnboardingPayTips(onboarding: ManagerOnboardingPay): CabinetPayTip[] {
  const tips: CabinetPayTip[] = [
    {
      title: onboarding.stage === "internship" ? "Сейчас стажировка" : "Сейчас тест",
      text:
        onboarding.stage === "internship"
          ? `День ${onboarding.internship.day} из ${onboarding.internship.days}. За эти 3 дня тебе 11% с оплаченных сделок. Оклада пока нет.`
          : `День ${Math.max(1, onboarding.trial.day)} из ${onboarding.trial.days}. За эти 5 дней подряд — 10% с оплаченных сделок.`
    },
    {
      title: "Стажировка 11%",
      text: `С ${onboarding.internship.start} по ${onboarding.internship.end}: купили ${onboarding.internship.payments}, касса ${money(onboarding.internship.revenueEur)}. Тебе ${money(onboarding.internship.payEur)}.`
    }
  ];

  if (onboarding.trial.day > 0 || onboarding.stage === "trial") {
    const left = Math.max(0, onboarding.salesTarget - onboarding.trial.payments);
    tips.push({
      title: "Тест 10%",
      text: `С ${onboarding.trial.start} по ${onboarding.trial.end}: купили ${onboarding.trial.payments} из ${onboarding.salesTarget}, касса ${money(onboarding.trial.revenueEur)}. Тебе ${money(onboarding.trial.payEur)}.`
    });
    tips.push({
      title: "Бонус 8 000 ₽",
      text: onboarding.trialBonusApplied
        ? `Пять продаж за пять дней есть. Бонус ≈ ${money(onboarding.trialBonusEur)} (курс ${onboarding.rubPerEur.toFixed(2)} ₽ за 1 €).`
        : `Ещё нет. Нужно ${onboarding.salesTarget} продаж за 5 дней подряд. Сейчас ${onboarding.trial.payments}, осталось ${left}.`
    });
  }

  if (onboarding.waitingApproval) {
    tips.push({
      title: "Дальше",
      text: "Тестовые 5 дней прошли. Общие условия (оклад и бонусы) включатся, когда РОП одобрит в «Доступах»."
    });
  }

  tips.push({
    title: "Итого",
    text: `К выплате сейчас ${money(onboarding.totalEur)}.`
  });
  return tips;
}
