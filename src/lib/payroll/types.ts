export type PayrollParams = {
  salaryEur: number;
  /** Commission when revenue is at or below sales plan (or plan is empty). */
  salesBonusPct: number;
  /** Commission when revenue is above sales plan. Replaces salesBonusPct, does not stack. */
  planBonusPct: number;
  conversionBonusEur: number;
  checkBonusEur: number;
  /** Empty/null = plan branch off; always use salesBonusPct. */
  salesPlanEur: number | null;
  conversionPlanPct: number;
  checkPlanEur: number;
  ropPct: number;
  ropSalaryEur: number;
};

export type ManagerPayrollInput = {
  id: string;
  name: string;
  revenueEur: number | null;
  leads: number | null;
  /** Working days for leads/day; default applied in calculator if null. */
  workingDays: number | null;
  invoiceCrPct: number | null;
  paymentCrPct: number | null;
  avgCheckEur: number | null;
  /** Optional override; otherwise derived from leads × payment CR. */
  payments: number | null;
};

export type ManagerPayrollResult = {
  id: string;
  name: string;
  revenueEur: number;
  leads: number;
  leadsPerDay: number | null;
  invoiceCrPct: number | null;
  invoices: number | null;
  paymentCrPct: number | null;
  payments: number | null;
  avgCheckEur: number | null;
  mopPayEur: number;
  mopShareOfRevenue: number | null;
  ropEur: number;
  totalEur: number;
  totalShareOfRevenue: number | null;
  usedPlanRate: boolean;
  conversionBonusApplied: boolean;
  checkBonusApplied: boolean;
  commissionPct: number;
};

export type PayrollBoardTotals = {
  incomeEur: number;
  expenseEur: number;
  fotShare: number | null;
};

export type PayrollManagerFact = {
  id: string;
  name: string;
  revenueEur: number;
  leads: number;
  paidOrders: number;
  paymentCrPct: number | null;
  avgCheckEur: number | null;
};
