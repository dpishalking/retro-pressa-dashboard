"use client";

import type { AnalyticsMetricValue, CeoControlCenterSnapshot } from "@/types/analytics-os";
import { formatMetricDisplay, StatusBadge } from "@/components/analytics-os/format-metric";
import { DecisionBrief } from "@/components/analytics-os/decision-brief";
import { decisionKpis } from "@/lib/analytics-os/block-decisions";
import { metricDefinition, metricLabel } from "@/lib/analytics-os/metric-glossary";
import { pct } from "@/lib/format";

const KPI_ORDER: Array<{ id: string; priority?: boolean }> = [
  { id: "revenue", priority: true },
  { id: "gross_profit" },
  { id: "leads", priority: true },
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
  { id: "overdue" },
  { id: "production_load" },
  { id: "cash" }
];

function kpiMeta(metric: AnalyticsMetricValue): string | null {
  const parts: string[] = [];
  if (metric.plan != null && metric.value != null && metric.status !== "no_data") {
    const planLabel =
      metric.unit === "eur" ? formatMetricDisplay({ ...metric, value: metric.plan }) : String(metric.plan);
    parts.push(`План ${planLabel} · ${pct(metric.value / metric.plan)}`);
  }
  if (metric.decisionHint) parts.push(metric.decisionHint);
  return parts.length ? parts.join(" · ") : null;
}

function KpiCard({
  metric,
  metricId,
  priority
}: {
  metric?: AnalyticsMetricValue;
  metricId: string;
  priority?: boolean;
}) {
  if (!metric) return null;
  const showPartial = metric.confidence === "low" && metric.status === "calculated";
  const meta = kpiMeta(metric);
  const definition = metricDefinition(metricId);
  return (
    <article className={`aos-kpi ${priority ? "aos-kpi--priority" : ""}`} title={definition ?? undefined}>
      <div className="aos-kpi__head">
        <span className="aos-kpi__label">{metricLabel(metricId)}</span>
        <StatusBadge status={showPartial ? "partial" : metric.status} />
      </div>
      <div className="aos-kpi__value">{formatMetricDisplay(metric)}</div>
      {meta ? <div className="aos-kpi__meta">{meta}</div> : null}
    </article>
  );
}

export function AnalyticsKpiRow({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  return (
    <section className="aos-kpi-wrap">
      <div className="aos-kpi-row">
        {KPI_ORDER.map((item) => (
          <KpiCard
            key={item.id}
            metric={snapshot.metrics[item.id]}
            metricId={item.id}
            priority={item.priority}
          />
        ))}
      </div>
      <DecisionBrief title="Решение по KPI" body={decisionKpis(snapshot)} />
    </section>
  );
}
