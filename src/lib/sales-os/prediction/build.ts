/**
 * Build Prediction Model + Quality + Drivers from facts + approved plans.
 */

import type { ForecastMethod } from "@/types/business-os-standard";
import {
  DEPARTMENT_SCOPE_ID,
  SALES_PREDICTION_CONTRACT_VERSION,
  SALES_PREDICTION_METRIC_BY_ID,
  SALES_PREDICTION_METRICS,
  type PlanRow,
  type PredictionDriverRow,
  type PredictionFactRow,
  type PredictionModelRow,
  type PredictionQualityRow,
  type PredictionScopeType
} from "./contract";
import { findApprovedPlan, planValueOf } from "./plans";
import {
  buildWeekSlices,
  completedDaysThrough,
  daysInCalendarMonth,
  remainingDaysAfter,
  resolveForecastAsOf,
  weekCompleteness
} from "./periods";
import {
  classifyModelStatus,
  formatNumber,
  gapToPlan,
  parseNumber,
  requiredPerRemainingUnit,
  requiredValue,
  runRateForKind
} from "./run-rate";

function factLookup(facts: PredictionFactRow[]): Map<string, PredictionFactRow> {
  const map = new Map<string, PredictionFactRow>();
  for (const row of facts) {
    map.set(
      [row.period_type, row.period, row.scope_type, row.scope_id, row.metric_id].join("|"),
      row
    );
  }
  return map;
}

function getFact(
  map: Map<string, PredictionFactRow>,
  periodType: string,
  period: string,
  scopeType: string,
  scopeId: string,
  metricId: string
): PredictionFactRow | undefined {
  return map.get([periodType, period, scopeType, scopeId, metricId].join("|"));
}

export type PredictionBuildInput = {
  month: string;
  today: string;
  plans: PlanRow[];
  facts: PredictionFactRow[];
  forecastMethod: ForecastMethod;
  syncedAt: string;
  scopes: Array<{ scopeType: PredictionScopeType; scopeId: string }>;
  /** Approved conversion / AOV baselines keyed metric_id → value (optional). */
  approvedBaselines?: Record<string, { value: number; source: string; approval_status: string }>;
  yellowTolerancePct?: number | null;
  redTolerancePct?: number | null;
};

export type PredictionBuildResult = {
  models: PredictionModelRow[];
  quality: PredictionQualityRow[];
  drivers: PredictionDriverRow[];
  forecastAsOf: string | null;
  modelsBuilt: number;
  modelsBlocked: number;
};

export function buildPredictionLayer(input: PredictionBuildInput): PredictionBuildResult {
  const forecastAsOf = resolveForecastAsOf({ month: input.month, today: input.today });
  const facts = factLookup(input.facts);
  const totalDays = daysInCalendarMonth(input.month);
  const elapsedDays = completedDaysThrough(input.month, forecastAsOf).length;
  const remaining = remainingDaysAfter(input.month, forecastAsOf).length;
  const weeks = buildWeekSlices(input.month);
  const models: PredictionModelRow[] = [];
  const quality: PredictionQualityRow[] = [];
  const drivers: PredictionDriverRow[] = [];
  let modelsBlocked = 0;

  for (const scope of input.scopes) {
    for (const def of SALES_PREDICTION_METRICS) {
      const monthFact = getFact(
        facts,
        "month",
        input.month,
        scope.scopeType,
        scope.scopeId,
        def.metric_id
      );
      const planRow = findApprovedPlan({
        plans: input.plans,
        periodType: "month",
        period: input.month,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        metricId: def.metric_id
      });
      const plan = planValueOf(planRow);
      const fact = parseNumber(monthFact?.fact_value);
      const factSource = monthFact?.fact_source || "12_Daily_Fact";
      const sourceUpdated = monthFact?.source_updated_at || "";

      const weekPlan = findApprovedPlan({
        plans: input.plans,
        periodType: "week",
        period: weeks[0]?.weekId || "",
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        metricId: def.metric_id
      });

      const forecastAllowed =
        Boolean(monthFact) &&
        input.forecastMethod !== "unsupported" &&
        (def.kind !== "snapshot" || fact != null);

      let blockedReason = "";
      if (!monthFact) blockedReason = "missing_fact";
      else if (input.forecastMethod === "unsupported") blockedReason = "unsupported_method";

      const projectedParts = (() => {
        if (def.kind !== "ratio" && def.kind !== "average") return {};
        const numId = def.numerator_id!;
        const denId = def.denominator_id!;
        const numFact = parseNumber(
          getFact(facts, "month", input.month, scope.scopeType, scope.scopeId, numId)?.fact_value
        );
        const denFact = parseNumber(
          getFact(facts, "month", input.month, scope.scopeType, scope.scopeId, denId)?.fact_value
        );
        const numRr = runRateForKind({
          kind: "additive",
          periodState: "month",
          fact: numFact,
          factToDate: numFact,
          elapsedUnits: elapsedDays,
          totalUnits: totalDays,
          method: input.forecastMethod
        });
        const denRr = runRateForKind({
          kind: "additive",
          periodState: "month",
          fact: denFact,
          factToDate: denFact,
          elapsedUnits: elapsedDays,
          totalUnits: totalDays,
          method: input.forecastMethod
        });
        return { projectedNumerator: numRr, projectedDenominator: denRr };
      })();

      const runRate = forecastAllowed
        ? runRateForKind({
            kind: def.kind,
            periodState: "month",
            fact,
            factToDate: fact,
            elapsedUnits: elapsedDays,
            totalUnits: totalDays,
            method: input.forecastMethod,
            ...projectedParts
          })
        : null;

      const status = classifyModelStatus({
        plan,
        runRate,
        blocked: Boolean(blockedReason) && def.kind !== "snapshot",
        forecastAllowed: forecastAllowed || def.kind === "snapshot"
      });
      if (status === "BLOCKED") modelsBlocked += 1;

      const req =
        plan != null && (def.kind === "additive" || def.kind === "event")
          ? requiredValue(plan, fact)
          : null;
      const reqPer =
        plan != null && (def.kind === "additive" || def.kind === "event")
          ? requiredPerRemainingUnit(req, remaining)
          : null;

      quality.push({
        period: input.month,
        scope_type: scope.scopeType,
        scope_id: scope.scopeId,
        metric_id: def.metric_id,
        plan_available: plan != null ? "true" : "false",
        fact_freshness: monthFact ? "ok" : "missing",
        fact_completeness: monthFact ? "ok" : "missing",
        conversion_baseline_available: input.approvedBaselines?.[def.metric_id] ? "true" : "false",
        aov_baseline_available: input.approvedBaselines?.average_check ? "true" : "false",
        week_plan_available: weekPlan ? "true" : "false",
        manager_plan_available:
          scope.scopeType === "manager" && plan != null
            ? "true"
            : scope.scopeType === "manager"
              ? "false"
              : "n/a",
        forecast_allowed: forecastAllowed && !blockedReason ? "true" : "false",
        blocked_reason: blockedReason,
        sync_updated_at: input.syncedAt
      });

      models.push({
        model_id: `${scope.scopeType}|${scope.scopeId}|${input.month}|${def.metric_id}`,
        model_name: "sales_prediction_v1",
        period_type: "month",
        period: input.month,
        scope_type: scope.scopeType,
        scope_id: scope.scopeId,
        metric_id: def.metric_id,
        metric_name: def.metric_name,
        metric_group: def.metric_group,
        metric_role: def.metric_role,
        plan_value: formatNumber(plan),
        fact_value: formatNumber(fact),
        run_rate_value: formatNumber(runRate),
        gap_to_plan: formatNumber(gapToPlan(runRate, plan)),
        required_value: formatNumber(req),
        required_per_remaining_unit: formatNumber(reqPer),
        forecast_method: input.forecastMethod,
        forecast_as_of: forecastAsOf || "",
        plan_source: planRow?.plan_source || (plan != null ? "40_Sales_Plans" : "NO_PLAN"),
        fact_source: factSource,
        confidence: blockedReason ? "low" : plan != null ? "medium" : "unknown",
        status,
        comment: blockedReason || (plan == null ? "NO_PLAN" : ""),
        source_updated_at: sourceUpdated,
        sync_updated_at: input.syncedAt,
        contract_version: SALES_PREDICTION_CONTRACT_VERSION
      });

      // Week models
      for (const week of weeks) {
        const state = weekCompleteness({ week, asOf: forecastAsOf, today: input.today });
        const weekFactRow = getFact(
          facts,
          "week",
          week.weekId,
          scope.scopeType,
          scope.scopeId,
          def.metric_id
        );
        const weekFact = parseNumber(weekFactRow?.fact_value);
        const weekPlanRow = findApprovedPlan({
          plans: input.plans,
          periodType: "week",
          period: week.weekId,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          metricId: def.metric_id
        });
        const wPlan = planValueOf(weekPlanRow);
        const weekElapsed = week.daysInMonth.filter((d) => forecastAsOf && d <= forecastAsOf).length;
        const weekTotal = week.daysInMonth.length;

        let wProjected: { projectedNumerator?: number | null; projectedDenominator?: number | null } =
          {};
        if (def.kind === "ratio" || def.kind === "average") {
          const numId = def.numerator_id!;
          const denId = def.denominator_id!;
          const numF = parseNumber(
            getFact(facts, "week", week.weekId, scope.scopeType, scope.scopeId, numId)?.fact_value
          );
          const denF = parseNumber(
            getFact(facts, "week", week.weekId, scope.scopeType, scope.scopeId, denId)?.fact_value
          );
          wProjected = {
            projectedNumerator: runRateForKind({
              kind: "additive",
              periodState: state === "complete" ? "complete" : state === "future" ? "future" : "partial",
              fact: numF,
              factToDate: numF,
              elapsedUnits: weekElapsed,
              totalUnits: weekTotal,
              method: "weekly_pace"
            }),
            projectedDenominator: runRateForKind({
              kind: "additive",
              periodState: state === "complete" ? "complete" : state === "future" ? "future" : "partial",
              fact: denF,
              factToDate: denF,
              elapsedUnits: weekElapsed,
              totalUnits: weekTotal,
              method: "weekly_pace"
            })
          };
        }

        const wRr = runRateForKind({
          kind: def.kind,
          periodState: state === "complete" ? "complete" : state === "future" ? "future" : "partial",
          fact: weekFact,
          factToDate: weekFact,
          elapsedUnits: weekElapsed,
          totalUnits: weekTotal,
          method: state === "partial" ? "weekly_pace" : input.forecastMethod,
          ...wProjected
        });

        const wStatus = classifyModelStatus({
          plan: wPlan,
          runRate: wRr,
          forecastAllowed: state !== "future"
        });

        models.push({
          model_id: `${scope.scopeType}|${scope.scopeId}|${week.weekId}|${def.metric_id}`,
          model_name: "sales_prediction_v1",
          period_type: "week",
          period: week.weekId,
          scope_type: scope.scopeType,
          scope_id: scope.scopeId,
          metric_id: def.metric_id,
          metric_name: def.metric_name,
          metric_group: def.metric_group,
          metric_role: def.metric_role,
          plan_value: formatNumber(wPlan),
          fact_value: formatNumber(weekFact),
          run_rate_value: formatNumber(wRr),
          gap_to_plan: formatNumber(gapToPlan(wRr, wPlan)),
          required_value: "",
          required_per_remaining_unit: "",
          forecast_method: state === "partial" ? "weekly_pace" : input.forecastMethod,
          forecast_as_of: forecastAsOf || "",
          plan_source: weekPlanRow?.plan_source || (wPlan != null ? "40_Sales_Plans" : "NO_PLAN"),
          fact_source: weekFactRow?.fact_source || "12_Daily_Fact",
          confidence: state === "future" ? "unknown" : "medium",
          status: state === "future" ? "UNKNOWN" : wStatus,
          comment: state,
          source_updated_at: weekFactRow?.source_updated_at || "",
          sync_updated_at: input.syncedAt,
          contract_version: SALES_PREDICTION_CONTRACT_VERSION
        });
      }

      // Day facts in model (fact only; no day run rate)
      for (const day of weeks.flatMap((w) => w.daysInMonth)) {
        if (forecastAsOf && day > forecastAsOf && day !== input.today) {
          if (day > input.today) continue;
        }
        const dayFactRow = getFact(
          facts,
          "day",
          day,
          scope.scopeType,
          scope.scopeId,
          def.metric_id
        );
        if (!dayFactRow && day > (forecastAsOf || "")) continue;
        const dayFact = parseNumber(dayFactRow?.fact_value);
        const dayPlanRow = findApprovedPlan({
          plans: input.plans,
          periodType: "day",
          period: day,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          metricId: def.metric_id
        });
        const dPlan = planValueOf(dayPlanRow);
        models.push({
          model_id: `${scope.scopeType}|${scope.scopeId}|${day}|${def.metric_id}`,
          model_name: "sales_prediction_v1",
          period_type: "day",
          period: day,
          scope_type: scope.scopeType,
          scope_id: scope.scopeId,
          metric_id: def.metric_id,
          metric_name: def.metric_name,
          metric_group: def.metric_group,
          metric_role: def.metric_role,
          plan_value: formatNumber(dPlan),
          fact_value: formatNumber(dayFact),
          run_rate_value: "",
          gap_to_plan: "",
          required_value: "",
          required_per_remaining_unit: "",
          forecast_method: "unsupported",
          forecast_as_of: forecastAsOf || "",
          plan_source: dayPlanRow ? "40_Sales_Plans" : "NO_PLAN",
          fact_source: dayFactRow?.fact_source || "12_Daily_Fact",
          confidence: "medium",
          status: dPlan == null ? "NO_PLAN" : "UNKNOWN",
          comment: day > input.today ? "future" : day === input.today ? "partial" : "complete",
          source_updated_at: dayFactRow?.source_updated_at || "",
          sync_updated_at: input.syncedAt,
          contract_version: SALES_PREDICTION_CONTRACT_VERSION
        });
      }
    }

    // Driver cascade for department + managers (revenue only)
    drivers.push(
      ...buildDriverRows({
        period: input.month,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        models,
        baselines: input.approvedBaselines || {},
        syncedAt: input.syncedAt
      })
    );
  }

  return {
    models,
    quality,
    drivers,
    forecastAsOf,
    modelsBuilt: models.filter((m) => m.period_type === "month").length,
    modelsBlocked
  };
}

function buildDriverRows(input: {
  period: string;
  scopeType: PredictionScopeType;
  scopeId: string;
  models: PredictionModelRow[];
  baselines: Record<string, { value: number; source: string; approval_status: string }>;
  syncedAt: string;
}): PredictionDriverRow[] {
  const month = input.models.filter(
    (m) =>
      m.period_type === "month" &&
      m.period === input.period &&
      m.scope_type === input.scopeType &&
      m.scope_id === input.scopeId
  );
  const byId = Object.fromEntries(month.map((m) => [m.metric_id, m]));
  const revenue = byId.paid_revenue;
  if (!revenue) return [];

  const targetPlan = parseNumber(revenue.plan_value);
  const targetFact = parseNumber(revenue.fact_value);
  const targetRr = parseNumber(revenue.run_rate_value);

  const chain: Array<{ driver: string; baselineKey: string; formula: string }> = [
    { driver: "payments", baselineKey: "average_check", formula: "revenue / aov" },
    { driver: "invoice_events", baselineKey: "invoice_to_payment_cr", formula: "payments / inv_pay_cr" },
    { driver: "deals", baselineKey: "deal_to_invoice_cr", formula: "invoices / deal_inv_cr" },
    { driver: "leads", baselineKey: "lead_to_deal_cr", formula: "deals / lead_deal_cr" }
  ];

  const out: PredictionDriverRow[] = [];
  let requiredUpstream: number | null = targetPlan;

  for (const step of chain) {
    const baseline = input.baselines[step.baselineKey];
    const current = parseNumber(byId[step.driver]?.fact_value);
    let required: number | null = null;
    let status = "UNKNOWN";
    let comment = "";

    if (targetPlan == null) {
      status = "NO_PLAN";
      comment = "no revenue plan";
    } else if (!baseline || baseline.approval_status !== "approved") {
      status = "BLOCKED";
      comment = "baseline not approved";
      required = null;
    } else if (!(baseline.value > 0) || requiredUpstream == null) {
      status = "BLOCKED";
      comment = "invalid baseline";
    } else {
      if (step.driver === "payments") {
        required = Number((requiredUpstream / baseline.value).toFixed(4));
      } else {
        required = Number((requiredUpstream / baseline.value).toFixed(4));
      }
      status = "OK";
      requiredUpstream = required;
    }

    out.push({
      period: input.period,
      scope_type: input.scopeType,
      scope_id: input.scopeId,
      target_metric_id: "paid_revenue",
      driver_metric_id: step.driver,
      target_plan: formatNumber(targetPlan),
      target_fact: formatNumber(targetFact),
      target_run_rate: formatNumber(targetRr),
      required_driver_value: formatNumber(required),
      current_driver_value: formatNumber(current),
      driver_gap: formatNumber(
        required != null && current != null ? Number((required - current).toFixed(4)) : null
      ),
      baseline_value: baseline ? formatNumber(baseline.value) : "",
      baseline_source: baseline?.source || "",
      baseline_approval_status: baseline?.approval_status || "missing",
      confidence: status === "OK" ? "medium" : "low",
      status,
      comment: comment || step.formula,
      sync_updated_at: input.syncedAt
    });
  }

  return out;
}

export function defaultScopes(managerIds: string[]): Array<{
  scopeType: PredictionScopeType;
  scopeId: string;
}> {
  return [
    { scopeType: "department", scopeId: DEPARTMENT_SCOPE_ID },
    ...managerIds.map((id) => ({ scopeType: "manager" as const, scopeId: id }))
  ];
}

export function metricDef(metricId: string) {
  return SALES_PREDICTION_METRIC_BY_ID[metricId];
}
