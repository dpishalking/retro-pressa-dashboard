import assert from "node:assert/strict";
import {
  DEPARTMENT_SCOPE_ID,
  SALES_PREDICTION_CONTRACT_VERSION,
  activeManagerIds,
  approvedPlansOnly,
  buildAllFactRows,
  buildPredictionLayer,
  buildPredictionView,
  buildWeekSlices,
  calendarRunRate,
  classifyModelStatus,
  countCalendarWeeksInMonth,
  daysInCalendarMonth,
  defaultScopes,
  emptyPlanRow,
  findDuplicatePlanKeys,
  gapToPlan,
  mergePreservePlans,
  mergeSvodDepartmentPlans,
  plansFromSvodDepartment,
  SVOD_DEPARTMENT_PLAN_SOURCE,
  ratioFromParts,
  reconcileLegacyVsSalesOs,
  requiredPerRemainingUnit,
  requiredValue,
  resolveForecastAsOf,
  runRateForKind,
  type PlanRow
} from "@/lib/sales-os/prediction";

const month = "2026-07";
const today = "2026-07-15";

function plan(input: Partial<PlanRow> & { metric_id: string; plan_value: string; status?: string }): PlanRow {
  const row = emptyPlanRow();
  row.plan_id = input.plan_id || `p|${input.metric_id}`;
  row.period_type = input.period_type || "month";
  row.period = input.period || month;
  row.scope_type = input.scope_type || "department";
  row.scope_id = input.scope_id || DEPARTMENT_SCOPE_ID;
  row.metric_id = input.metric_id;
  row.plan_value = input.plan_value;
  row.status = input.status || "approved";
  row.plan_source = input.plan_source || "test";
  row.updated_at = "2026-07-15T00:00:00.000Z";
  return row;
}

const dailyFact = [
  {
    date: "2026-07-01",
    manager_id: "m1",
    leads: "10",
    deals_created: "4",
    invoices: "2",
    payments: "1",
    revenue: "100",
    active_pipeline_deals: "5",
    active_pipeline_amount: "500",
    sync_updated_at: "t"
  },
  {
    date: "2026-07-02",
    manager_id: "m1",
    leads: "10",
    deals_created: "4",
    invoices: "2",
    payments: "1",
    revenue: "100",
    active_pipeline_deals: "6",
    active_pipeline_amount: "600",
    sync_updated_at: "t"
  },
  {
    date: "2026-07-01",
    manager_id: "m2",
    leads: "5",
    deals_created: "1",
    invoices: "1",
    payments: "0",
    revenue: "0",
    sync_updated_at: "t"
  }
];

// --- periods ---
assert.equal(daysInCalendarMonth(month), 31);
assert.ok(countCalendarWeeksInMonth(month) >= 4);
assert.equal(resolveForecastAsOf({ month, today }), "2026-07-14");
assert.equal(resolveForecastAsOf({ month, today: "2026-07-01" }), null);
assert.equal(resolveForecastAsOf({ month, today: "2026-08-01" }), "2026-07-31");
assert.equal(buildWeekSlices(month).length, countCalendarWeeksInMonth(month));
assert.ok(buildWeekSlices(month).some((w) => w.weekIndex === 4) || countCalendarWeeksInMonth(month) < 5);

// --- run rate ---
assert.equal(calendarRunRate({ factToDate: 10, elapsedUnits: 10, totalUnits: 31, method: "calendar_run_rate" }), 31);
assert.equal(calendarRunRate({ factToDate: 10, elapsedUnits: 0, totalUnits: 31, method: "calendar_run_rate" }), null);
assert.equal(calendarRunRate({ factToDate: 10, elapsedUnits: 10, totalUnits: 31, method: "unsupported" }), null);
assert.equal(gapToPlan(120, 100), 20);
assert.equal(gapToPlan(null, 100), null);
assert.equal(requiredValue(100, 40), 60);
assert.equal(requiredPerRemainingUnit(60, 0), null);
assert.equal(ratioFromParts(10, 0), null);
assert.equal(ratioFromParts(10, 5), 2);
assert.equal(classifyModelStatus({ plan: null, runRate: 10 }), "NO_PLAN");
assert.equal(classifyModelStatus({ plan: 100, runRate: 120 }), "ABOVE_PLAN");
assert.equal(classifyModelStatus({ plan: 100, runRate: 80 }), "BELOW_PLAN");
assert.equal(classifyModelStatus({ plan: 100, runRate: null, blocked: true }), "BLOCKED");

assert.equal(
  runRateForKind({
    kind: "additive",
    periodState: "complete",
    fact: 50,
    factToDate: 50,
    elapsedUnits: 7,
    totalUnits: 7,
    method: "calendar_run_rate"
  }),
  50
);
assert.equal(
  runRateForKind({
    kind: "additive",
    periodState: "future",
    fact: null,
    factToDate: null,
    elapsedUnits: 0,
    totalUnits: 7,
    method: "weekly_pace"
  }),
  null
);
assert.equal(
  runRateForKind({
    kind: "average",
    periodState: "month",
    fact: null,
    factToDate: null,
    elapsedUnits: 10,
    totalUnits: 31,
    method: "calendar_run_rate",
    projectedNumerator: 310,
    projectedDenominator: 10
  }),
  31
);

// --- plans ---
const draft = plan({ metric_id: "paid_revenue", plan_value: "999", status: "draft" });
const approved = plan({ metric_id: "paid_revenue", plan_value: "10000", status: "approved" });
assert.equal(approvedPlansOnly([draft, approved]).length, 1);
assert.deepEqual(findDuplicatePlanKeys([approved, { ...approved, plan_id: "other" }]), [
  `month|${month}|department|${DEPARTMENT_SCOPE_ID}|paid_revenue`
]);
const preserved = mergePreservePlans({
  existing: [approved],
  incomingSeed: [plan({ metric_id: "payments", plan_value: "50", status: "draft" })]
});
assert.equal(preserved.length, 2);
assert.equal(preserved.find((p) => p.metric_id === "paid_revenue")?.plan_value, "10000");

const fromSvod = plansFromSvodDepartment({
  svod: { month, revenue: 36274, sale: 533, leads: 3334, invoices: 733, aov: 68 },
  syncedAt: "2026-07-22T00:00:00.000Z"
});
assert.equal(fromSvod.length, 5);
assert.ok(fromSvod.every((r) => r.status === "approved" && r.plan_source === SVOD_DEPARTMENT_PLAN_SOURCE));
assert.equal(fromSvod.find((r) => r.metric_id === "paid_revenue")?.plan_value, "36274");
assert.equal(fromSvod.find((r) => r.metric_id === "payments")?.plan_value, "533");
const manualOverride = plan({
  metric_id: "paid_revenue",
  plan_value: "99999",
  status: "approved",
  plan_source: "manual_rop"
});
const mergedSvod = mergeSvodDepartmentPlans({ existing: [manualOverride], svodPlans: fromSvod });
assert.equal(mergedSvod.find((r) => r.metric_id === "paid_revenue")?.plan_value, "99999");
assert.equal(mergedSvod.find((r) => r.metric_id === "leads")?.plan_value, "3334");

// --- facts / managers ---
const managers = activeManagerIds({ rows: dailyFact, month });
assert.ok(managers.includes("m1"));
assert.ok(managers.includes("m2"));
const asOf = resolveForecastAsOf({ month, today });
const facts = buildAllFactRows({
  month,
  dailyFact,
  managerIds: managers,
  factAsOf: asOf,
  syncedAt: "t",
  includeWeeks: true,
  includeDays: true
});
const deptRevenue = facts.find(
  (f) =>
    f.period_type === "month" &&
    f.scope_type === "department" &&
    f.metric_id === "paid_revenue"
);
assert.equal(deptRevenue?.fact_value, "200");
const aov = facts.find(
  (f) => f.period_type === "month" && f.scope_type === "department" && f.metric_id === "average_check"
);
assert.equal(aov?.fact_value, "100");
const m2Pay = facts.find(
  (f) => f.scope_type === "manager" && f.scope_id === "m2" && f.metric_id === "payments" && f.period_type === "month"
);
assert.equal(m2Pay?.fact_value, "0");
const m2Aov = facts.find(
  (f) => f.scope_type === "manager" && f.scope_id === "m2" && f.metric_id === "average_check" && f.period_type === "month"
);
assert.equal(m2Aov?.fact_value, "");

// snapshot not summed across days — latest only
const snap = facts.find(
  (f) => f.period_type === "month" && f.scope_type === "department" && f.metric_id === "active_deals"
);
assert.equal(snap?.fact_value, "6");

// --- model ---
const layer = buildPredictionLayer({
  month,
  today,
  plans: [approved, plan({ metric_id: "payments", plan_value: "20" })],
  facts,
  forecastMethod: "calendar_run_rate",
  syncedAt: "t",
  scopes: defaultScopes(managers)
});
assert.equal(layer.forecastAsOf, "2026-07-14");
const revMonth = layer.models.find(
  (m) => m.period_type === "month" && m.scope_type === "department" && m.metric_id === "paid_revenue"
);
assert.ok(revMonth);
assert.equal(revMonth!.plan_value, "10000");
assert.equal(revMonth!.fact_value, "200");
assert.ok(Number(revMonth!.run_rate_value) > 200);
assert.equal(revMonth!.forecast_method, "calendar_run_rate");
assert.equal(revMonth!.contract_version, SALES_PREDICTION_CONTRACT_VERSION);
assert.ok(revMonth!.gap_to_plan !== "");
assert.ok(Number(revMonth!.required_value) > 0);

const m2Rev = layer.models.find(
  (m) => m.period_type === "month" && m.scope_id === "m2" && m.metric_id === "paid_revenue"
);
assert.equal(m2Rev?.status, "NO_PLAN");

const futureWeek = layer.models.find(
  (m) => m.period_type === "week" && m.comment === "future" && m.metric_id === "paid_revenue"
);
if (futureWeek) {
  assert.equal(futureWeek.run_rate_value, "");
}

const completeWeek = layer.models.find(
  (m) =>
    m.period_type === "week" &&
    m.comment === "complete" &&
    m.scope_type === "department" &&
    m.metric_id === "leads"
);
if (completeWeek) {
  assert.equal(completeWeek.run_rate_value, completeWeek.fact_value);
}

// draft ignored
const layerDraftOnly = buildPredictionLayer({
  month,
  today,
  plans: [draft],
  facts,
  forecastMethod: "calendar_run_rate",
  syncedAt: "t",
  scopes: [{ scopeType: "department", scopeId: DEPARTMENT_SCOPE_ID }]
});
assert.equal(
  layerDraftOnly.models.find((m) => m.period_type === "month" && m.metric_id === "paid_revenue")?.status,
  "NO_PLAN"
);

// drivers blocked without baseline
assert.ok(layer.drivers.some((d) => d.status === "BLOCKED" || d.status === "NO_PLAN" || d.baseline_approval_status === "missing"));

const layerWithBaseline = buildPredictionLayer({
  month,
  today,
  plans: [approved],
  facts,
  forecastMethod: "calendar_run_rate",
  syncedAt: "t",
  scopes: [{ scopeType: "department", scopeId: DEPARTMENT_SCOPE_ID }],
  approvedBaselines: {
    average_check: { value: 100, source: "approved_manual", approval_status: "approved" },
    invoice_to_payment_cr: { value: 0.5, source: "approved_manual", approval_status: "approved" },
    deal_to_invoice_cr: { value: 0.5, source: "approved_manual", approval_status: "approved" },
    lead_to_deal_cr: { value: 0.4, source: "approved_manual", approval_status: "approved" }
  }
});
assert.ok(
  layerWithBaseline.drivers.some(
    (d) => d.driver_metric_id === "payments" && d.status === "OK" && d.required_driver_value !== ""
  )
);

// unsupported method → empty run rate
const unsupported = buildPredictionLayer({
  month,
  today,
  plans: [approved],
  facts,
  forecastMethod: "unsupported",
  syncedAt: "t",
  scopes: [{ scopeType: "department", scopeId: DEPARTMENT_SCOPE_ID }]
});
assert.equal(
  unsupported.models.find((m) => m.period_type === "month" && m.metric_id === "paid_revenue")?.run_rate_value,
  ""
);

// view from model only
const view = buildPredictionView({
  month,
  scopeType: "department",
  scopeId: DEPARTMENT_SCOPE_ID,
  models: layer.models
});
assert.ok(view.some((r) => r.row_type === "section" && r.section === "Lagging"));
assert.ok(view.some((r) => r.metric_id === "paid_revenue" && r.line_role === "plan"));
assert.ok(view.some((r) => r.row_type === "day"));

// recon
const recon = reconcileLegacyVsSalesOs({
  periodType: "month",
  period: month,
  legacy: { paid_revenue: 250, payments: 2, leads: 30 },
  facts,
  syncedAt: "t"
});
assert.ok(recon.find((r) => r.metric_id === "paid_revenue")?.status === "expected_difference");
assert.ok(recon.find((r) => r.metric_id === "leads")?.status === "expected_difference");

// early-created paid current month encoded as daily fact on paid day only — fact uses day bucket
assert.ok(facts.some((f) => f.period_type === "day" && f.period === "2026-07-01"));

console.log("sales-prediction-layer.test.ts: ok");
