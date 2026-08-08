"use client";

import type { AnalyticsMetricValue, CeoControlCenterSnapshot } from "@/types/analytics-os";
import { formatMetricDisplay, StatusBadge } from "@/components/analytics-os/format-metric";
import { pct } from "@/lib/format";

const KPI_ORDER: Array<{ id: string; label: string; priority?: boolean }> = [
  { id: "revenue", label: "Revenue", priority: true },
  { id: "gross_profit", label: "Gross Profit" },
  { id: "leads", label: "Leads", priority: true },
  { id: "paid_orders", label: "Paid Orders", priority: true },
  { id: "conversion_rate", label: "Conversion", priority: true },
  { id: "aov", label: "AOV", priority: true },
  { id: "cac", label: "CAC" },
  { id: "repeat_rate", label: "Repeat" },
  { id: "pipeline_amount", label: "Pipeline" },
  { id: "production_load", label: "Production Load" },
  { id: "overdue", label: "Overdue" },
  { id: "cash", label: "Cash" }
];

function KpiCard({ metric, label, priority }: { metric?: AnalyticsMetricValue; label: string; priority?: boolean }) {
  if (!metric) return null;
  const showPartial = metric.confidence === "low" && metric.status === "calculated";
  return (
    <article className={`aos-kpi ${priority ? "aos-kpi--priority" : ""}`} title={`${metric.source}${metric.asOf ? ` · ${metric.asOf}` : ""}`}>
      <div className="aos-kpi__head">
        <span className="aos-kpi__label">{label}</span>
        <StatusBadge status={showPartial ? "partial" : metric.status} />
      </div>
      <div className="aos-kpi__value">{formatMetricDisplay(metric)}</div>
      <div className="aos-kpi__meta">
        {metric.plan != null && metric.value != null && metric.status !== "no_data" ? (
          <span>
            PLAN {metric.unit === "eur" ? formatMetricDisplay({ ...metric, value: metric.plan }) : metric.plan} ·{" "}
            {pct(metric.value / metric.plan)}
          </span>
        ) : metric.decisionHint ? (
          <span>{metric.decisionHint}</span>
        ) : (
          <span>{metric.source}</span>
        )}
      </div>
    </article>
  );
}

export function AnalyticsKpiRow({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  return (
    <section className="aos-kpi-row">
      {KPI_ORDER.map((item) => (
        <KpiCard key={item.id} metric={snapshot.metrics[item.id]} label={item.label} priority={item.priority} />
      ))}
    </section>
  );
}
