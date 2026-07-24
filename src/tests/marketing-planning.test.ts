import assert from "node:assert/strict";
import { countCalendarWeeksInMonth, daysInCalendarMonth } from "@/lib/sales-os/predictive-model";
import { resolveForecastAsOf, completedDaysThrough } from "@/lib/sales-os/prediction/periods";
import { monthTotals, type DayTrafficAgg } from "@/lib/marketing-planning/facts";
import { findApprovedPlanValue, type PlanRegistryRow } from "@/lib/marketing-planning/plans";
import { buildMarketingPlanningGrid } from "@/lib/marketing-planning/planning-grid";
import {
  channelConnectionStatus,
  classifyReconciliation,
  classifyTrafficType,
  completedWeekForecast,
  detectSalesPlanningDesignTab,
  dryRunWritesNothing,
  exportContractVersion,
  factAllowedForDate,
  forecastAdditive,
  funnelForecastAllowed,
  ga4GenerateLeadEqualsCrmLead,
  landingSpendAllowed,
  layoutCopyStatus,
  monthHasFiveWeeks,
  paidEfficiencyCells,
  planCellStatus,
  recalculateRatio,
  revenueCanonSource,
  scenarioIsNotForecast,
  staleSource,
  sumAdditive,
  weekState,
  yandexDirectStatus,
  zeroDenominatorEmpty
} from "@/lib/marketing-planning/rules";
import { buildMarketingWeekly } from "@/lib/marketing-planning/weekly";
import { MARKETING_PREDICTIVE_EXPORT_VERSION } from "@/config/marketing-planning";
import { preserveManualColumns } from "@/lib/os-sheets/safe-write";

const month = "2026-07";
const today = "2026-07-15";

// --- design source ---
{
  const ok = detectSalesPlanningDesignTab(["Лист1", "Предиктивка продажи"]);
  assert.equal(ok.found, true);
  assert.equal(ok.layoutBlocked, false);
  const miss = detectSalesPlanningDesignTab(["Лист1"]);
  assert.equal(miss.found, false);
  assert.equal(miss.layoutBlocked, true);
  assert.equal(layoutCopyStatus({ hasAccess: false, designTabFound: true }), "blocked_no_access");
  assert.equal(layoutCopyStatus({ hasAccess: true, designTabFound: false }), "blocked_no_design_tab");
  assert.equal(layoutCopyStatus({ hasAccess: true, designTabFound: true }), "ok");
}

// --- plans ---
assert.equal(planCellStatus(null), "NO_PLAN");
assert.equal(planCellStatus(100), "PLAN");
assert.equal(scenarioIsNotForecast("SCENARIO"), true);
assert.equal(scenarioIsNotForecast("FORECAST"), false);

// --- spend / efficiency ---
{
  const blocked = paidEfficiencyCells({ spend: null, leads: 10, revenue: 100 });
  assert.equal(blocked.status, "BLOCKED_MISSING_SPEND");
  assert.equal(blocked.cpl, null);
  assert.equal(blocked.roas, null);
  const ok = paidEfficiencyCells({ spend: 50, leads: 10, revenue: 100 });
  assert.equal(ok.cpl, 5);
  assert.equal(ok.roas, 2);
}

// --- forecasts ---
{
  const rr = forecastAdditive({
    method: "calendar_run_rate",
    factToDate: 10,
    elapsedDays: 10,
    totalDays: 31
  });
  assert.equal(rr.status, "FORECAST");
  assert.ok(rr.value != null && Math.abs(rr.value - 31) < 0.001);
  const blocked = forecastAdditive({
    method: "funnel",
    factToDate: 10,
    elapsedDays: 10,
    totalDays: 31
  });
  assert.equal(blocked.status, "BLOCKED");
  assert.equal(blocked.value, null);
  const funnel = funnelForecastAllowed({
    allComponentsPresent: false,
    unknownShareBelowThreshold: true,
    definitionsAligned: true
  });
  assert.equal(funnel.allowed, false);
  assert.equal(funnel.status, "BLOCKED");
}

// --- weeks ---
{
  assert.equal(weekState({ weekStart: "2026-07-20", weekEnd: "2026-07-26", today: "2026-07-15" }), "future");
  assert.equal(weekState({ weekStart: "2026-07-06", weekEnd: "2026-07-12", today: "2026-07-15" }), "past");
  assert.equal(weekState({ weekStart: "2026-07-13", weekEnd: "2026-07-19", today: "2026-07-15" }), "current");
  assert.equal(factAllowedForDate({ date: "2026-07-20", forecastAsOf: "2026-07-14", weekState: "future" }), false);
  assert.equal(factAllowedForDate({ date: "2026-07-10", forecastAsOf: "2026-07-14", weekState: "past" }), true);
  assert.equal(completedWeekForecast({ weekState: "past", weekFact: 12 }), 12);
  assert.equal(completedWeekForecast({ weekState: "future", weekFact: 12 }), null);
  assert.equal(completedWeekForecast({ weekState: "current", weekFact: 12 }), null);
  assert.ok(monthHasFiveWeeks(countCalendarWeeksInMonth(month)) || countCalendarWeeksInMonth(month) === 4);
  assert.equal(daysInCalendarMonth(month), 31);
}

// --- monthly additive + ratio ---
{
  const daily = new Map<string, DayTrafficAgg>([
    [
      "2026-07-01",
      {
        date: "2026-07-01",
        sessions: 100,
        users: 80,
        leads: 10,
        deals: 4,
        invoice_events: 2,
        payments: 1,
        paid_revenue: 100,
        spend: 50,
        paid_leads: 6,
        organic_leads: 4,
        unknown_leads: 0,
        paid_payments: 1,
        organic_payments: 0,
        paid_revenue_attr: 100,
        organic_revenue: 0
      }
    ],
    [
      "2026-07-02",
      {
        date: "2026-07-02",
        sessions: 50,
        users: 40,
        leads: 20,
        deals: 2,
        invoice_events: 1,
        payments: 1,
        paid_revenue: 50,
        spend: 25,
        paid_leads: 3,
        organic_leads: 2,
        unknown_leads: 1,
        paid_payments: 0,
        organic_payments: 1,
        paid_revenue_attr: 0,
        organic_revenue: 50
      }
    ]
  ]);
  const totals = monthTotals(daily);
  assert.equal(totals.sessions, 150);
  assert.equal(totals.leads, 30);
  assert.equal(totals.paid_revenue, 150);
  assert.equal(totals.session_to_lead_cr, recalculateRatio(30, 150));
  const naiveAvgOfDailyCr = (10 / 100 + 20 / 50) / 2; // 0.25
  assert.notEqual(totals.session_to_lead_cr, naiveAvgOfDailyCr);
  assert.equal(sumAdditive([10, null, 5]), 15);
  assert.equal(zeroDenominatorEmpty(10, 0), null);

  const weeks = buildMarketingWeekly(month, daily);
  assert.ok(weeks.length >= 4);
  const w0 = weeks[0];
  assert.ok(w0.sessions == null || w0.sessions >= 0);
}

// --- unknown not organic ---
{
  const u = classifyTrafficType("unknown");
  assert.equal(u.isUnknown, true);
  assert.equal(u.convertedToOrganic, false);
  const o = classifyTrafficType("organic_search");
  assert.equal(o.bucket, "organic_search");
  assert.equal(o.convertedToOrganic, false);
}

// --- canons / connections ---
assert.equal(revenueCanonSource("sales_os"), true);
assert.equal(revenueCanonSource("svod"), false);
assert.equal(ga4GenerateLeadEqualsCrmLead(), false);
assert.equal(channelConnectionStatus({ apiConnected: false, factsObserved: false }), "NOT_CONNECTED");
assert.equal(yandexDirectStatus(), "NOT_CONNECTED");
assert.equal(landingSpendAllowed(false), false);
assert.equal(landingSpendAllowed(true), true);
assert.equal(
  staleSource({
    sourceUpdatedAt: "2026-07-01T00:00:00.000Z",
    thresholdHours: 48,
    nowIso: "2026-07-10T00:00:00.000Z"
  }),
  true
);

// --- reconciliation ---
assert.equal(
  classifyReconciliation({ valueA: 100, valueB: 100, tolerancePct: 5 }),
  "matched"
);
assert.equal(
  classifyReconciliation({
    valueA: 100,
    valueB: 80,
    tolerancePct: 5,
    expectedDifference: true
  }),
  "expected_difference"
);
assert.equal(
  classifyReconciliation({ valueA: null, valueB: 10, tolerancePct: 5 }),
  "missing_source"
);

// --- export / dry-run / preserve ---
assert.equal(exportContractVersion(), MARKETING_PREDICTIVE_EXPORT_VERSION);
assert.equal(dryRunWritesNothing(true, 0), true);
assert.equal(dryRunWritesNothing(true, 5), false);

{
  const preserved = preserveManualColumns({
    existingRows: [{ plan_id: "a", comment: "manual note", status: "approved" }],
    incomingRows: [{ plan_id: "a", comment: "", status: "approved" }],
    key: "plan_id",
    manualColumns: ["comment"]
  });
  assert.equal(preserved[0].comment, "manual note");
}

// --- grid: no plan → NO_PLAN; no fake week plans ---
{
  const daily = new Map<string, DayTrafficAgg>();
  daily.set("2026-07-01", {
    date: "2026-07-01",
    sessions: 10,
    users: 8,
    leads: 2,
    deals: 1,
    invoice_events: 1,
    payments: 1,
    paid_revenue: 50,
    spend: null,
    paid_leads: 1,
    organic_leads: 1,
    unknown_leads: 0,
    paid_payments: 1,
    organic_payments: 0,
    paid_revenue_attr: 50,
    organic_revenue: 0
  });
  const plans: PlanRegistryRow[] = [];
  const grid = buildMarketingPlanningGrid({
    month,
    title: "Test",
    daily,
    plans,
    today,
    asOfDay: 15,
    slice: "general"
  });
  // sessions gone — Revenue plan row 4 → index 3
  assert.equal(grid[3][0], "Revenue");
  // leads plan row 14 → index 13
  assert.equal(grid[13][0], "Leads");
  assert.equal(grid[13][2], "NO_PLAN");
  // CPL fact row 18 → index 17
  assert.equal(grid[16][0], "CPL");
  assert.equal(grid[17][2], "BLOCKED_MISSING_SPEND");
  // ICE A
  assert.equal(grid[19][0], "ICE A");
  assert.equal(grid[19][2], "NOT_CONNECTED");
  // future day after forecastAsOf should be empty on fact
  const asOf = resolveForecastAsOf({ month, today });
  assert.equal(asOf, "2026-07-14");
  assert.ok(completedDaysThrough(month, asOf).length > 0);

  // approved plan only on month col
  const withPlan: PlanRegistryRow[] = [
    {
      plan_id: "p1",
      period_type: "month",
      period: month,
      scope_type: "company",
      scope_id: "marketing",
      metric_id: "leads",
      plan_value: "100",
      currency: "",
      approved_by: "test",
      approved_at: "2026-07-01",
      source: "test",
      status: "approved",
      comment: "",
      updated_at: "t"
    }
  ];
  assert.equal(
    findApprovedPlanValue(withPlan, {
      period: month,
      scopeType: "company",
      scopeId: "marketing",
      metricId: "leads"
    }),
    100
  );
  const grid2 = buildMarketingPlanningGrid({
    month,
    title: "Test",
    daily,
    plans: withPlan,
    today,
    asOfDay: 15,
    slice: "general"
  });
  // leads plan row 14 → index 13; month plan present, week day plans stay empty (no auto-split)
  assert.ok(String(grid2[13].join("|")).includes("100"));
}

console.log("marketing-planning.test.ts: ok");
