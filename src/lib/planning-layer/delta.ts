import type { LineageNode } from "@/lib/financial-engine/types";
import type { FinancialReportSummary } from "@/lib/financial-report/types";
import type { PlanningMetadata, PlanningMode } from "./types";

export type DeltaMetricRow = {
  metricId: string;
  label: string;
  unit: "currency" | "percent";
  fact: number;
  plan: number | null;
  scenario: number | null;
  deltaPlan: number | null;
  deltaFact: number | null;
};

const deltaMetrics: Array<{ id: keyof FinancialReportSummary; label: string; unit: "currency" | "percent" }> = [
  { id: "revenue", label: "Выручка", unit: "currency" },
  { id: "grossProfit", label: "Валовая прибыль", unit: "currency" },
  { id: "operatingProfit", label: "Операционная прибыль", unit: "currency" },
  { id: "netProfit", label: "Чистая прибыль", unit: "currency" },
  { id: "ebitda", label: "EBITDA", unit: "currency" },
  { id: "cash", label: "Cash", unit: "currency" }
];

export function buildDeltaView(input: {
  fact: FinancialReportSummary;
  plan?: FinancialReportSummary | null;
  scenario?: FinancialReportSummary | null;
}): DeltaMetricRow[] {
  return deltaMetrics.map((metric) => {
    const fact = input.fact[metric.id];
    const plan = input.plan?.[metric.id] ?? null;
    const scenario = input.scenario?.[metric.id] ?? null;
    const active = scenario ?? plan;

    return {
      metricId: metric.id,
      label: metric.label,
      unit: metric.unit,
      fact,
      plan,
      scenario,
      deltaPlan: plan === null ? null : plan - fact,
      deltaFact: active === null ? null : active - fact
    };
  });
}

export function enrichExplainabilityWithPlanning(
  explain: Record<string, LineageNode>,
  metadata: PlanningMetadata
): Record<string, LineageNode> {
  if (metadata.mode === "FACT") return explain;

  const modeNode: LineageNode = {
    id: "planningMode",
    label: metadata.mode === "PLAN" ? "План" : "Сценарий",
    value: 0,
    unit: "count",
    source: "computed",
    available: true,
    formula:
      metadata.mode === "PLAN"
        ? `PLAN: ${metadata.planName ?? "целевые показатели"}`
        : `SCENARIO: ${metadata.scenarioName ?? metadata.label}`,
    children: (metadata.appliedChanges ?? []).map((change) => ({
      id: change.driverId,
      label: change.driverId,
      value: change.value ?? change.deltaPercent ?? change.deltaPoints ?? 0,
      unit: change.deltaPoints !== undefined || change.deltaPercent !== undefined ? "percent" : "currency",
      source: "computed" as const,
      available: true,
      children: []
    }))
  };

  const enriched: Record<string, LineageNode> = {};
  for (const [key, node] of Object.entries(explain)) {
    enriched[key] = {
      ...node,
      children: [
        {
          ...modeNode,
          children: [
            ...modeNode.children,
            {
              id: "factBaseline",
              label: "Остальные данные — FACT",
              value: 0,
              unit: "count",
              source: "bitrix",
              available: true,
              children: node.children
            }
          ]
        }
      ]
    };
  }

  return enriched;
}

export function parsePlanningMode(value: string | null | undefined): PlanningMode {
  const normalized = (value ?? "FACT").toUpperCase();
  if (normalized === "PLAN" || normalized === "SCENARIO") return normalized;
  return "FACT";
}
