"use client";

import type { AnalyticsMetricValue, CeoControlCenterSnapshot } from "@/types/analytics-os";
import { formatMetricDisplay, StatusBadge } from "@/components/analytics-os/format-metric";
import { DecisionBrief } from "@/components/analytics-os/decision-brief";
import { decisionKpis } from "@/lib/analytics-os/block-decisions";
import { pct } from "@/lib/format";

const KPI_ORDER: Array<{ id: string; label: string; priority?: boolean }> = [
  { id: "revenue", label: "Выручка", priority: true },
  { id: "gross_profit", label: "Валовая прибыль" },
  { id: "leads", label: "Лиды", priority: true },
  { id: "paid_orders", label: "Оплаты", priority: true },
  { id: "conversion_rate", label: "Конверсия", priority: true },
  { id: "aov", label: "Средний чек", priority: true },
  { id: "cac", label: "CAC" },
  { id: "repeat_rate", label: "Повтор" },
  { id: "pipeline_amount", label: "Воронка €" },
  { id: "production_load", label: "Производство" },
  { id: "overdue", label: "Просрочка" },
  { id: "cash", label: "Касса" }
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

function KpiCard({ metric, label, priority }: { metric?: AnalyticsMetricValue; label: string; priority?: boolean }) {
  if (!metric) return null;
  const showPartial = metric.confidence === "low" && metric.status === "calculated";
  const meta = kpiMeta(metric);
  return (
    <article className={`aos-kpi ${priority ? "aos-kpi--priority" : ""}`}>
      <div className="aos-kpi__head">
        <span className="aos-kpi__label">{label}</span>
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
          <KpiCard key={item.id} metric={snapshot.metrics[item.id]} label={item.label} priority={item.priority} />
        ))}
      </div>
      <DecisionBrief title="Решение по KPI" body={decisionKpis(snapshot)} />
    </section>
  );
}
