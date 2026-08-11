/**
 * Centralized predictive metric math for Marketing PM.
 * UI must only render results from this layer.
 */

export type PmMetricType = "LAG" | "LEAD_1" | "LEAD_2" | "ACTIVITY" | "CAPACITY" | "GUARDRAIL";
export type PmDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
export type PmKind = "additive" | "rate";
export type PmStatus =
  | "OUTPERFORMING"
  | "ON_TRACK"
  | "RISK"
  | "OFF_TRACK"
  | "NO_PLAN"
  | "NO_DATA"
  | "DATA_ISSUE";
export type PmDataStatus = "OK" | "NO_PLAN" | "NO_DATA" | "DATA_ISSUE";
export type PmForecastConfidence = "HIGH" | "MEDIUM" | "LOW";
export type PmPlanSource = "USER_PLAN" | "DERIVED" | "NONE";

export type PmMetricDefinition = {
  id: string;
  label: string;
  unit: "eur" | "count" | "ratio";
  metricType: PmMetricType;
  direction: PmDirection;
  kind: PmKind;
  parentId: string | null;
  primary: boolean;
};

export type PmMetricInput = {
  def: PmMetricDefinition;
  plan: number | null;
  factToDate: number | null;
  planSource?: PmPlanSource;
};

export type PmMetricResult = {
  id: string;
  label: string;
  unit: "eur" | "count" | "ratio";
  metricType: PmMetricType;
  direction: PmDirection;
  kind: PmKind;
  parentId: string | null;
  primary: boolean;
  plan: number | null;
  planToDate: number | null;
  factToDate: number | null;
  pace: number | null;
  forecast: number | null;
  gapToPlan: number | null;
  requiredResult: number | null;
  currentPace: number | null;
  requiredPace: number | null;
  requiredPaceMultiplier: number | null;
  status: PmStatus;
  dataStatus: PmDataStatus;
  planSource: PmPlanSource;
  forecastMethod: string;
  planDistributionMethod: string | null;
  forecastConfidence: PmForecastConfidence;
  owner: string;
};

export type PmDiagnosis = {
  overallStatus: PmStatus;
  lagMetricId: string;
  lagLabel: string;
  forecast: number | null;
  plan: number | null;
  gap: number | null;
  firstBrokenDriverId: string | null;
  firstBrokenDriverLabel: string | null;
  positiveCompensatorId: string | null;
  positiveCompensatorLabel: string | null;
  requiredPaceMultiplier: number | null;
  summary: string;
  evidence: string[];
  missingData: string[];
  recommendedDrilldown: string;
};

/** Linear Plan To Date for cumulative metrics. */
export function planToDateLinear(plan: number | null, elapsed: number, total: number): number | null {
  if (plan == null || !(elapsed > 0) || !(total > 0)) return null;
  return (plan * elapsed) / total;
}

export function calendarRunRateForecast(
  factToDate: number | null,
  elapsed: number,
  total: number
): number | null {
  if (factToDate == null || !(elapsed > 0) || !(total > 0)) return null;
  return (factToDate / elapsed) * total;
}

export function paceCumulative(factToDate: number | null, planToDate: number | null): number | null {
  if (factToDate == null || planToDate == null || !(planToDate > 0)) return null;
  return factToDate / planToDate;
}

/** Rate pace: 1 = on target. Higher-is-better: fact/plan. Lower-is-better: plan/fact. */
export function paceRate(
  fact: number | null,
  plan: number | null,
  direction: PmDirection
): number | null {
  if (fact == null || plan == null || !(plan > 0) || !(fact > 0)) return null;
  return direction === "HIGHER_IS_BETTER" ? fact / plan : plan / fact;
}

export function classifyPmStatus(input: {
  kind: PmKind;
  direction: PmDirection;
  plan: number | null;
  factToDate: number | null;
  forecast: number | null;
  leadingRisk?: boolean;
}): PmStatus {
  if (input.plan == null && input.factToDate == null && input.forecast == null) return "NO_DATA";
  if (input.plan == null) return "NO_PLAN";
  if (input.forecast == null && input.factToDate == null) return "NO_DATA";

  const compare = input.forecast ?? input.factToDate;
  if (compare == null || !(input.plan > 0)) return "NO_DATA";

  const ratio =
    input.direction === "HIGHER_IS_BETTER" ? compare / input.plan : input.plan / compare;

  let status: PmStatus;
  if (ratio >= 1.05) status = "OUTPERFORMING";
  else if (ratio >= 0.95) status = "ON_TRACK";
  else if (ratio >= 0.85) status = "RISK";
  else status = "OFF_TRACK";

  if (input.leadingRisk && (status === "ON_TRACK" || status === "OUTPERFORMING")) {
    return "RISK";
  }
  return status;
}

export function requiredPaceFields(input: {
  kind: PmKind;
  plan: number | null;
  factToDate: number | null;
  elapsed: number;
  remaining: number;
}): {
  requiredResult: number | null;
  currentPace: number | null;
  requiredPace: number | null;
  requiredPaceMultiplier: number | null;
} {
  if (input.kind !== "additive") {
    return {
      requiredResult: null,
      currentPace: null,
      requiredPace: null,
      requiredPaceMultiplier: null
    };
  }
  if (input.plan == null || input.factToDate == null) {
    return {
      requiredResult: null,
      currentPace: null,
      requiredPace: null,
      requiredPaceMultiplier: null
    };
  }
  const requiredResult = Math.max(input.plan - input.factToDate, 0);
  const currentPace = input.elapsed > 0 ? input.factToDate / input.elapsed : null;
  const requiredPace = input.remaining > 0 ? requiredResult / input.remaining : null;
  const requiredPaceMultiplier =
    currentPace != null && currentPace > 0 && requiredPace != null
      ? requiredPace / currentPace
      : null;
  return { requiredResult, currentPace, requiredPace, requiredPaceMultiplier };
}

export function forecastConfidence(elapsedDays: number, hasPlan: boolean): PmForecastConfidence {
  if (elapsedDays < 7) return "LOW";
  if (!hasPlan || elapsedDays < 14) return "MEDIUM";
  return "HIGH";
}

export function computePmMetric(
  input: PmMetricInput & {
    elapsed: number;
    remaining: number;
    total: number;
    leadingRisk?: boolean;
  }
): PmMetricResult {
  const { def, plan, factToDate, elapsed, remaining, total } = input;
  const planSource = input.planSource ?? (plan != null ? "USER_PLAN" : "NONE");

  let planToDate: number | null = null;
  let planDistributionMethod: string | null = null;
  let forecast: number | null = null;
  let pace: number | null = null;
  let forecastMethod = "none";

  if (def.kind === "additive") {
    planToDate = planToDateLinear(plan, elapsed, total);
    planDistributionMethod = plan != null ? "LINEAR_FALLBACK" : null;
    forecast = calendarRunRateForecast(factToDate, elapsed, total);
    forecastMethod = forecast != null ? "LINEAR" : "none";
    pace = paceCumulative(factToDate, planToDate);
  } else {
    // Rate: no linear PlanToDate / no time extrapolation of %.
    planToDate = plan;
    planDistributionMethod = null;
    forecast = factToDate;
    forecastMethod = factToDate != null ? "ROLLING" : "none";
    pace = paceRate(factToDate, plan, def.direction);
  }

  const req = requiredPaceFields({
    kind: def.kind,
    plan,
    factToDate,
    elapsed,
    remaining
  });

  let dataStatus: PmDataStatus = "OK";
  if (plan == null && factToDate == null) dataStatus = "NO_DATA";
  else if (plan == null) dataStatus = "NO_PLAN";
  else if (factToDate == null) dataStatus = "NO_DATA";

  const status = classifyPmStatus({
    kind: def.kind,
    direction: def.direction,
    plan,
    factToDate,
    forecast,
    leadingRisk: input.leadingRisk
  });

  return {
    id: def.id,
    label: def.label,
    unit: def.unit,
    metricType: def.metricType,
    direction: def.direction,
    kind: def.kind,
    parentId: def.parentId,
    primary: def.primary,
    plan,
    planToDate,
    factToDate,
    pace,
    forecast,
    gapToPlan: forecast != null && plan != null ? forecast - plan : null,
    requiredResult: req.requiredResult,
    currentPace: req.currentPace,
    requiredPace: req.requiredPace,
    requiredPaceMultiplier: req.requiredPaceMultiplier,
    status,
    dataStatus,
    planSource,
    forecastMethod,
    planDistributionMethod,
    forecastConfidence: forecastConfidence(elapsed, plan != null),
    owner: "NO_DATA"
  };
}

function statusSeverity(status: PmStatus): number {
  switch (status) {
    case "OFF_TRACK":
      return 4;
    case "RISK":
      return 3;
    case "NO_DATA":
    case "DATA_ISSUE":
      return 2;
    case "NO_PLAN":
      return 1;
    default:
      return 0;
  }
}

/** Walk Lag → children; pick first broken / worst driver. */
export function diagnoseDriverChain(metrics: PmMetricResult[], lagId: string): PmDiagnosis {
  const byId = new Map(metrics.map((m) => [m.id, m]));
  const lag = byId.get(lagId) ?? metrics.find((m) => m.metricType === "LAG") ?? null;
  const missingData = metrics
    .filter((m) => m.primary && m.dataStatus === "NO_DATA")
    .map((m) => m.label);

  if (!lag) {
    return {
      overallStatus: "NO_DATA",
      lagMetricId: lagId,
      lagLabel: "Выручка",
      forecast: null,
      plan: null,
      gap: null,
      firstBrokenDriverId: null,
      firstBrokenDriverLabel: null,
      positiveCompensatorId: null,
      positiveCompensatorLabel: null,
      requiredPaceMultiplier: null,
      summary: "Нет Lag-метрики для диагностики.",
      evidence: [],
      missingData,
      recommendedDrilldown: "Marketing → Paid / Organic"
    };
  }

  // Chain from lag down via parent links (children point to parent).
  const childrenOf = (parentId: string) =>
    metrics.filter((m) => m.parentId === parentId && m.primary);

  let cursor: PmMetricResult = lag;
  let firstBroken: PmMetricResult | null = null;
  const path: PmMetricResult[] = [lag];

  for (let depth = 0; depth < 6; depth += 1) {
    const kids = childrenOf(cursor.id);
    if (!kids.length) break;
    const scored = [...kids].sort((a, b) => {
      const sev = statusSeverity(b.status) - statusSeverity(a.status);
      if (sev !== 0) return sev;
      const aPace = a.pace ?? 1;
      const bPace = b.pace ?? 1;
      return aPace - bPace;
    });
    const worst = scored[0];
    path.push(worst);
    if (statusSeverity(worst.status) >= 3 && !firstBroken) {
      firstBroken = worst;
    }
    cursor = worst;
  }

  if (!firstBroken && statusSeverity(lag.status) >= 3) {
    firstBroken = path.find((m) => m.id !== lag.id && statusSeverity(m.status) >= 2) ?? null;
  }

  const positive = metrics
    .filter(
      (m) =>
        m.primary &&
        m.id !== lag.id &&
        (m.status === "OUTPERFORMING" || m.status === "ON_TRACK") &&
        m.pace != null &&
        m.pace >= 1
    )
    .sort((a, b) => (b.pace ?? 0) - (a.pace ?? 0))[0] ?? null;

  const evidence: string[] = [];
  for (const m of path.slice(0, 4)) {
    if (m.forecast != null && m.plan != null) {
      const pct = m.plan !== 0 ? Math.round((m.forecast / m.plan) * 100) : null;
      evidence.push(
        `${m.label}: прогноз ${pct != null ? `${pct}%` : "—"} плана` +
          (m.pace != null ? `, pace ${(m.pace * 100).toFixed(0)}%` : "")
      );
    } else if (m.dataStatus === "NO_DATA") {
      evidence.push(`${m.label}: NO_DATA`);
    } else if (m.dataStatus === "NO_PLAN") {
      evidence.push(`${m.label}: NO_PLAN`);
    }
  }

  const gap = lag.gapToPlan;
  const mult = lag.requiredPaceMultiplier;
  let summary: string;
  if (lag.status === "NO_PLAN") {
    summary = `${lag.label}: есть факт, но план не задан (NO_PLAN).`;
  } else if (lag.status === "NO_DATA") {
    summary = `${lag.label}: недостаточно данных для прогноза.`;
  } else if (statusSeverity(lag.status) >= 3) {
    const driver = firstBroken?.label ?? "не определён";
    summary =
      `${lag.label}: прогноз ниже плана` +
      (gap != null ? ` (GAP ${gap.toFixed(0)})` : "") +
      `. Первое проблемное звено: ${driver}.` +
      (mult != null && mult > 1.05
        ? ` Для выхода на план нужен темп ×${mult.toFixed(1)}.`
        : "");
  } else {
    summary =
      `${lag.label}: ${lag.status === "OUTPERFORMING" ? "выше плана" : "в пределах плана"}.` +
      (positive ? ` Компенсатор: ${positive.label}.` : "");
  }

  return {
    overallStatus: lag.status,
    lagMetricId: lag.id,
    lagLabel: lag.label,
    forecast: lag.forecast,
    plan: lag.plan,
    gap,
    firstBrokenDriverId: firstBroken?.id ?? null,
    firstBrokenDriverLabel: firstBroken?.label ?? null,
    positiveCompensatorId: positive?.id ?? null,
    positiveCompensatorLabel: positive?.label ?? null,
    requiredPaceMultiplier: mult,
    summary,
    evidence,
    missingData,
    recommendedDrilldown:
      firstBroken?.id === "leads" || firstBroken?.id === "spend"
        ? "Marketing → Paid / Organic"
        : "Sales → Managers / Sources"
  };
}
