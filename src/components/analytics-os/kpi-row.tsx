"use client";

import type { AnalyticsMetricValue, CeoControlCenterSnapshot } from "@/types/analytics-os";
import { formatMetricDisplay } from "@/components/analytics-os/format-metric";
import { DecisionBrief } from "@/components/analytics-os/decision-brief";
import { decisionKpis } from "@/lib/analytics-os/block-decisions";
import { metricDefinition, metricLabel } from "@/lib/analytics-os/metric-glossary";
import { pct } from "@/lib/format";

const KPI_ORDER: Array<{ id: string; priority?: boolean }> = [
  { id: "revenue", priority: true },
  { id: "gross_profit" },
  { id: "leads", priority: true },
  { id: "paid_leads", priority: true },
  { id: "organic_leads", priority: true },
  { id: "unique_leads", priority: true },
  { id: "paid_orders", priority: true },
  { id: "conversion_rate", priority: true },
  { id: "unique_conversion_rate", priority: true },
  { id: "aov", priority: true },
  { id: "product_aov", priority: true },
  { id: "product_revenue_net", priority: true },
  { id: "delivery_revenue" },
  { id: "cac" },
  { id: "repeat_rate" },
  { id: "pipeline_amount" },
  { id: "pipeline_stuck_amount", priority: true },
  { id: "overdue" }
];

export type PlanTrafficLight = "scarlet" | "yellow" | "green";

/** Pace to month-end plan: cumulative metrics vs expected MTD; rates vs plan as-is. */
export function planPaceRatio(
  metric: AnalyticsMetricValue,
  daysElapsed: number,
  calendarDays: number
): number | null {
  if (metric.value == null || metric.plan == null || metric.plan === 0) return null;
  if (metric.status === "no_data") return null;
  const isRate = metric.unit === "pct" || metric.unit === "ratio";
  if (isRate) return metric.value / metric.plan;
  if (calendarDays <= 0 || daysElapsed <= 0) return metric.value / metric.plan;
  const expectedMtd = metric.plan * (Math.min(daysElapsed, calendarDays) / calendarDays);
  if (expectedMtd === 0) return null;
  return metric.value / expectedMtd;
}

export function trafficLightFromRatio(ratio: number | null): PlanTrafficLight | null {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  if (ratio < 0.9) return "scarlet";
  if (ratio <= 1) return "yellow";
  return "green";
}

function formatPlanValue(metric: AnalyticsMetricValue): string {
  return formatMetricDisplay({ ...metric, value: metric.plan ?? null, status: "live" });
}

function KpiCard({
  metric,
  metricId,
  priority,
  daysElapsed,
  calendarDays
}: {
  metric?: AnalyticsMetricValue;
  metricId: string;
  priority?: boolean;
  daysElapsed: number;
  calendarDays: number;
}) {
  if (!metric) return null;
  const definition = metricDefinition(metricId);
  const ratio = planPaceRatio(metric, daysElapsed, calendarDays);
  const light = trafficLightFromRatio(ratio);
  const hasPlan = metric.plan != null && metric.status !== "no_data";

  return (
    <article
      className={[
        "aos-kpi",
        priority ? "aos-kpi--priority" : "",
        light ? `aos-kpi--pace-${light}` : ""
      ]
        .filter(Boolean)
        .join(" ")}
      title={definition ?? undefined}
    >
      <div className="aos-kpi__head">
        <span className="aos-kpi__label">{metricLabel(metricId)}</span>
        {light && ratio != null ? (
          <span className={`aos-kpi__pace aos-kpi__pace--${light}`}>{pct(ratio)}</span>
        ) : null}
      </div>
      <div className="aos-kpi__value">{formatMetricDisplay(metric)}</div>
      {hasPlan ? <div className="aos-kpi__plan">План {formatPlanValue(metric)}</div> : null}
    </article>
  );
}

export function AnalyticsKpiRow({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const { daysElapsed, calendarDays } = snapshot.plan;
  return (
    <section className="aos-kpi-wrap">
      <div className="aos-kpi-row">
        {KPI_ORDER.map((item) => (
          <KpiCard
            key={item.id}
            metric={snapshot.metrics[item.id]}
            metricId={item.id}
            priority={item.priority}
            daysElapsed={daysElapsed}
            calendarDays={calendarDays}
          />
        ))}
      </div>
      <DecisionBrief title="Решение по KPI" body={decisionKpis(snapshot)} />
    </section>
  );
}
