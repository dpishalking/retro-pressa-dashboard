export type ScenarioReadiness = "live" | "guided" | "blocked";

export type ScenarioStatus = "healthy" | "attention" | "problem" | "opportunity" | "no_data";

export type ScenarioStep = {
  title: string;
  check: string;
  href?: string;
};

export type ScenarioFinding = {
  label: string;
  value: string;
  note?: string;
};

export type ScenarioAction = {
  title: string;
  why: string;
  href: string;
};

export type AnalysisScenarioDef = {
  id: string;
  number: number;
  title: string;
  question: string;
  trigger: string;
  readiness: ScenarioReadiness;
  requiredMetrics: string[];
  dimensions: string[];
  steps: ScenarioStep[];
  blockedReason?: string;
  reuse: string;
};

export type ScenarioRun = {
  id: string;
  readiness: ScenarioReadiness;
  status: ScenarioStatus;
  confidence: "high" | "medium" | "low";
  headline: string;
  diagnosis: string;
  findings: ScenarioFinding[];
  actions: ScenarioAction[];
  sampleNote?: string;
};

/** Minimum volumes before a live scenario may claim a hard cause. */
export const SCENARIO_SAMPLE_THRESHOLDS = {
  minLeadsForManagerCompare: 10,
  minSalesForConfidentRate: 5,
  minLeadsForVolumeCall: 30
};

export const KPI_SCENARIO_LINKS: Record<string, { scenarioId: string; label: string }> = {
  revenue: { scenarioId: "revenue-plan", label: "Разобрать Gap" },
  paid_orders: { scenarioId: "sales-drop", label: "Разобрать продажи" },
  conversion_rate: { scenarioId: "leads-no-sales", label: "Разобрать конверсию" },
  cac: { scenarioId: "cac-up", label: "Разобрать причину" },
  cpl: { scenarioId: "cpl-up", label: "Разобрать CPL" }
};
