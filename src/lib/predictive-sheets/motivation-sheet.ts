import { DEFAULT_PAYROLL_PARAMS } from "@/lib/payroll/defaults";
import { managerPayrollSeedValues, type PayrollCalendar } from "@/lib/predictive-sheets/payroll-seed";
import type { BitrixManagerFacts } from "@/lib/predictive-sheets/seed-from-bitrix";
import { PM_SALES_MANAGERS } from "@/lib/predictive-sheets/managers";
import { quoteTab } from "@/lib/predictive-sheets/formulas";

type CellValue = string | number | boolean | null;

const CHECK_BONUS = DEFAULT_PAYROLL_PARAMS.checkBonusEur;
const CR_BONUS = DEFAULT_PAYROLL_PARAMS.conversionBonusEur;
const CHECK_PLAN = DEFAULT_PAYROLL_PARAMS.checkPlanEur;
const CR_PLAN_PCT = Math.round(DEFAULT_PAYROLL_PARAMS.conversionPlanPct * 100);
const SALES_PCT = Math.round(DEFAULT_PAYROLL_PARAMS.salesBonusPct * 100);
const PLAN_PCT = Math.round(DEFAULT_PAYROLL_PARAMS.planBonusPct * 100);

function round1(n: number): number {
  return Number(n.toFixed(1));
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function statusLabel(ok: boolean, hasFact: boolean): string {
  if (!hasFact) return "● Нет данных";
  return ok ? "● В норме" : "● Срыв";
}

/** Summary: bonus thresholds from «Мотивация МОП», facts from Bitrix manager sheets. */
export function buildMotivationSheet(
  settingsTab: string,
  byManager: Record<string, BitrixManagerFacts>,
  calendar?: PayrollCalendar
): CellValue[][] {
  const S = quoteTab(settingsTab);
  const rows: CellValue[][] = [
    ["Мотивация менеджеров"],
    [
      "Период:",
      `=${S}!B3`,
      `Пороги: чек ${CHECK_PLAN} € → +${CHECK_BONUS} € · лид→оплата ${CR_PLAN_PCT} % → +${CR_BONUS} € · оклад ${DEFAULT_PAYROLL_PARAMS.salaryEur} € + ${SALES_PCT}% кассы (${PLAN_PCT}% выше плана)`
    ],
    [
      "Менеджер",
      "План выручки",
      "Факт кассы",
      "Чек факт",
      `Чек ≥${CHECK_PLAN}`,
      "Лид→оплата",
      `CR ≥${CR_PLAN_PCT}%`,
      "Начислено",
      "В день",
      "Бонусы",
      "Статус чек",
      "Статус CR",
      "Лист",
      "Комментарий"
    ]
  ];

  for (const m of PM_SALES_MANAGERS) {
    const facts = byManager[m.bitrixId];
    const check = facts && facts.payments > 0 ? round2(facts.revenue / facts.payments) : null;
    const crPct = facts && facts.leads > 0 ? round1((facts.payments / facts.leads) * 100) : null;
    const checkOk = check != null && check >= CHECK_PLAN;
    const crOk = crPct != null && crPct + 1e-9 >= CR_PLAN_PCT;
    const accrued =
      facts && calendar ? managerPayrollSeedValues(facts, m.revenuePlan, calendar) : null;
    const bonuses = (checkOk ? CHECK_BONUS : 0) + (crOk ? CR_BONUS : 0);
    rows.push([
      m.firstName,
      m.revenuePlan ?? "",
      facts ? round2(facts.revenue) : "",
      check ?? "",
      check == null ? "" : checkOk ? "да" : "нет",
      crPct == null ? "" : crPct,
      crPct == null ? "" : crOk ? "да" : "нет",
      accrued?.payroll.fact ?? "",
      accrued?.payroll_per_day.fact ?? "",
      bonuses || "",
      statusLabel(checkOk, check != null),
      statusLabel(crOk, crPct != null),
      m.sheet,
      facts
        ? `Bitrix ${m.fullName} [${m.bitrixId}]. Отзывы и ср. позиций в заказе — нет SSOT.`
        : "Нет фактов Bitrix"
    ]);
  }

  rows.push([]);
  rows.push([
    "Правила",
    "Лист «Мотивация МОП» / payroll defaults. Не банк и не демо-каталог /motivation.",
    "Позиции в заказе и отзывы не тянем: нет разреза по менеджеру в кассе SPA."
  ]);
  rows.push([
    "ФОТ",
    `оклад пропорционально дням + комиссия ${SALES_PCT}% кассы (выше плана ${PLAN_PCT}%) + бонусы на дату`,
    "План выручки менеджера включает ветку комиссии, если задан."
  ]);
  return rows;
}
