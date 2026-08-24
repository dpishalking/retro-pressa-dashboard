import { eur } from "@/lib/format";
import type { CabinetPayTip, ManagerCabinetFacts, ManagerCabinetShifts } from "@/lib/manager-cabinet/types";
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
