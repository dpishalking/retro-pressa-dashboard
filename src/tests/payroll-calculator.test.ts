import assert from "node:assert/strict";
import { calculateManagerPayroll, calculatePayrollBoard, prorateByShifts } from "@/lib/payroll/calculator";
import type { PayrollParams } from "@/lib/payroll/types";

const month1Params: PayrollParams = {
  salaryEur: 222,
  salesBonusPct: 0.07,
  planBonusPct: 0.1,
  conversionBonusEur: 111,
  checkBonusEur: 55,
  salesPlanEur: 3600,
  conversionPlanPct: 0.2,
  checkPlanEur: 80,
  ropPct: 0.01,
  ropSalaryEur: 549
};

{
  const row = calculateManagerPayroll(month1Params, {
    id: "m1",
    name: "Менеджер №1",
    revenueEur: 2800,
    leads: 250,
    workingDays: 15,
    invoiceCrPct: 0.25,
    paymentCrPct: 0.16,
    avgCheckEur: 70,
    payments: 40
  });
  assert.equal(Math.round(row.mopPayEur), 418);
  assert.equal(row.usedPlanRate, false);
  assert.equal(row.conversionBonusApplied, false);
  assert.equal(row.checkBonusApplied, false);
  assert.equal(Math.round(row.ropEur), 28);
  assert.equal(Math.round(row.totalEur), 446);
  assert.ok(row.leadsPerDay != null && Math.abs(row.leadsPerDay - 250 / 15) < 1e-9);
}

{
  const row = calculateManagerPayroll(month1Params, {
    id: "nastya",
    name: "Настя",
    revenueEur: 12800,
    leads: 800,
    workingDays: 22,
    invoiceCrPct: 0.25,
    paymentCrPct: 0.2,
    avgCheckEur: 80,
    payments: 160
  });
  assert.equal(Math.round(row.mopPayEur), 1668);
  assert.equal(row.usedPlanRate, true);
  assert.equal(row.conversionBonusApplied, true);
  assert.equal(row.checkBonusApplied, true);
  assert.equal(Math.round(row.ropEur), 128);
  assert.equal(Math.round(row.totalEur), 1796);
}

{
  const row = calculateManagerPayroll(month1Params, {
    id: "m3",
    name: "Менеджер №3",
    revenueEur: 9600,
    leads: 600,
    workingDays: 15,
    invoiceCrPct: 0.25,
    paymentCrPct: 0.2,
    avgCheckEur: 80,
    payments: 120
  });
  assert.equal(Math.round(row.mopPayEur), 1348);
}

{
  // Empty sales plan → always 7%, never switch to 10%.
  const params: PayrollParams = { ...month1Params, salesPlanEur: null };
  const row = calculateManagerPayroll(params, {
    id: "nastya",
    name: "Настя",
    revenueEur: 12800,
    leads: 800,
    workingDays: 22,
    invoiceCrPct: 0.25,
    paymentCrPct: 0.2,
    avgCheckEur: 80,
    payments: 160
  });
  // 222 + 12800*0.07 + 111 + 55 = 1284
  assert.equal(Math.round(row.mopPayEur), 1284);
  assert.equal(row.usedPlanRate, false);
}

{
  const board = calculatePayrollBoard(month1Params, [
    {
      id: "m1",
      name: "Менеджер №1",
      revenueEur: 2800,
      leads: 250,
      workingDays: 15,
      invoiceCrPct: 0.25,
      paymentCrPct: 0.16,
      avgCheckEur: 70,
      payments: 40
    },
    {
      id: "nastya",
      name: "Настя",
      revenueEur: 12800,
      leads: 800,
      workingDays: 22,
      invoiceCrPct: 0.25,
      paymentCrPct: 0.2,
      avgCheckEur: 80,
      payments: 160
    },
    {
      id: "m3",
      name: "Менеджер №3",
      revenueEur: 9600,
      leads: 600,
      workingDays: 15,
      invoiceCrPct: 0.25,
      paymentCrPct: 0.2,
      avgCheckEur: 80,
      payments: 120
    },
    {
      id: "m4",
      name: "Менеджер №4",
      revenueEur: 9600,
      leads: 600,
      workingDays: 15,
      invoiceCrPct: 0.25,
      paymentCrPct: 0.2,
      avgCheckEur: 80,
      payments: 120
    }
  ]);
  assert.equal(board.totals.incomeEur, 34800);
  assert.equal(Math.round(board.totals.expenseEur), 5679);
  assert.ok(board.totals.fotShare != null && Math.abs(board.totals.fotShare - 5679 / 34800) < 1e-9);
}

assert.equal(Number(prorateByShifts(4000, 7, 15).toFixed(2)), 1866.67);

console.log("payroll-calculator.test.ts: ok");
