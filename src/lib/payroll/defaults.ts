import type { PayrollParams } from "@/lib/payroll/types";

/** Defaults from Google sheet «Мотивация МОП» / Первый месяц. Sales plan left empty on purpose. */
export const DEFAULT_PAYROLL_PARAMS: PayrollParams = {
  salaryEur: 222,
  salesBonusPct: 0.07,
  planBonusPct: 0.1,
  conversionBonusEur: 111,
  checkBonusEur: 55,
  salesPlanEur: null,
  conversionPlanPct: 0.2,
  checkPlanEur: 80,
  ropPct: 0.01,
  ropSalaryEur: 549
};

export const DEFAULT_WORKING_DAYS = 22;
