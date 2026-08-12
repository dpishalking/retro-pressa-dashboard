import { DEFAULT_WORKING_DAYS } from "@/lib/payroll/defaults";
import type {
  ManagerPayrollInput,
  ManagerPayrollResult,
  PayrollBoardTotals,
  PayrollParams
} from "@/lib/payroll/types";

function n(value: number | null | undefined): number {
  return value == null || !Number.isFinite(value) ? 0 : value;
}

/**
 * Sheet formula (Мотивация МОП!E11):
 * salary + revenue * IF(revenue <= plan, salesBonus, planBonus)
 *   + IF(paymentCr >= conversionPlan, conversionBonus, 0)
 *   + IF(check >= checkPlan, checkBonus, 0)
 *
 * When salesPlanEur is null/empty → always salesBonusPct (plan branch off).
 */
export function calculateManagerPayroll(
  params: PayrollParams,
  input: ManagerPayrollInput
): ManagerPayrollResult {
  const revenueEur = n(input.revenueEur);
  const leads = n(input.leads);
  const paymentCrPct = input.paymentCrPct;
  const avgCheckEur = input.avgCheckEur;
  const invoiceCrPct = input.invoiceCrPct;
  const workingDays = input.workingDays != null && input.workingDays > 0 ? input.workingDays : DEFAULT_WORKING_DAYS;

  const plan = params.salesPlanEur;
  const planActive = plan != null && Number.isFinite(plan) && plan > 0;
  const usedPlanRate = planActive && revenueEur > plan;
  const commissionPct = usedPlanRate ? params.planBonusPct : params.salesBonusPct;

  const conversionBonusApplied =
    paymentCrPct != null && Number.isFinite(paymentCrPct) && paymentCrPct >= params.conversionPlanPct;
  const checkBonusApplied =
    avgCheckEur != null && Number.isFinite(avgCheckEur) && avgCheckEur >= params.checkPlanEur;

  const mopPayEur =
    params.salaryEur +
    revenueEur * commissionPct +
    (conversionBonusApplied ? params.conversionBonusEur : 0) +
    (checkBonusApplied ? params.checkBonusEur : 0);

  const ropEur = revenueEur * params.ropPct;
  const totalEur = mopPayEur + ropEur;

  const payments =
    input.payments != null && Number.isFinite(input.payments)
      ? input.payments
      : paymentCrPct != null && leads > 0
        ? leads * paymentCrPct
        : null;

  const invoices =
    invoiceCrPct != null && leads > 0 ? leads * invoiceCrPct : null;

  const leadsPerDay = leads > 0 ? leads / workingDays : null;

  return {
    id: input.id,
    name: input.name,
    revenueEur,
    leads,
    leadsPerDay,
    invoiceCrPct,
    invoices,
    paymentCrPct,
    payments,
    avgCheckEur,
    mopPayEur,
    mopShareOfRevenue: revenueEur > 0 ? mopPayEur / revenueEur : null,
    ropEur,
    totalEur,
    totalShareOfRevenue: revenueEur > 0 ? totalEur / revenueEur : null,
    usedPlanRate,
    conversionBonusApplied,
    checkBonusApplied,
    commissionPct
  };
}

export function calculatePayrollBoard(
  params: PayrollParams,
  managers: ManagerPayrollInput[]
): { managers: ManagerPayrollResult[]; totals: PayrollBoardTotals } {
  const rows = managers.map((manager) => calculateManagerPayroll(params, manager));
  const incomeEur = rows.reduce((sum, row) => sum + row.revenueEur, 0);
  const expenseEur = rows.reduce((sum, row) => sum + row.totalEur, 0) + params.ropSalaryEur;
  return {
    managers: rows,
    totals: {
      incomeEur,
      expenseEur,
      fotShare: incomeEur > 0 ? expenseEur / incomeEur : null
    }
  };
}

/** Derive revenue from payments × check when revenue is empty but both are set. */
export function deriveRevenueFromPayments(
  payments: number | null,
  avgCheckEur: number | null
): number | null {
  if (payments == null || avgCheckEur == null) return null;
  if (!Number.isFinite(payments) || !Number.isFinite(avgCheckEur)) return null;
  return payments * avgCheckEur;
}
