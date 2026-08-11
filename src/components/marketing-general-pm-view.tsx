"use client";

import { useState } from "react";
import { eur, number, pct } from "@/lib/format";
import type { PredictiveDomainBlock, PredictiveMetricRow } from "@/lib/predictive/types";

function formatValue(unit: string, value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (unit === "eur") return eur(value);
  if (unit === "ratio") return pct(value);
  return number(value);
}

function formatPace(pace: number | null | undefined): string {
  if (pace == null || !Number.isFinite(pace)) return "—";
  return `${(pace * 100).toFixed(0)}%`;
}

function formatMult(mult: number | null | undefined): string {
  if (mult == null || !Number.isFinite(mult)) return "—";
  return `×${mult.toFixed(1)}`;
}

function pmStatusTone(status: string): string {
  switch (status) {
    case "OUTPERFORMING":
    case "ON_TRACK":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "RISK":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "OFF_TRACK":
      return "bg-red-100 text-red-800 border-red-200";
    case "NO_PLAN":
    case "NO_DATA":
    case "DATA_ISSUE":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function pickCard(metrics: PredictiveMetricRow[], id: string): PredictiveMetricRow | null {
  return metrics.find((m) => m.id === id) ?? null;
}

export function MarketingGeneralPmView({ block }: { block: PredictiveDomainBlock }) {
  const [daysOpen, setDaysOpen] = useState(false);
  const days = block.days || [];
  const diagnosis = block.diagnosis;
  const chain = block.driverChain || [];
  const primaryMetrics = block.metrics.filter((m) => m.primary !== false && [
    "paid_revenue",
    "payments",
    "invoice_events",
    "leads",
    "qualified_leads",
    "spend",
    "average_check",
    "cpl",
    "lead_to_payment_cr"
  ].includes(m.id));

  const revenue = pickCard(block.metrics, "paid_revenue");
  const payments = pickCard(block.metrics, "payments");
  const leads = pickCard(block.metrics, "leads");
  const aov = pickCard(block.metrics, "average_check");

  const cards = [
    { key: "revenue", title: "Выручка", metric: revenue },
    { key: "payments", title: "Оплаты", metric: payments },
    { key: "leads", title: "Лиды", metric: leads },
    { key: "aov", title: "Средний чек", metric: aov }
  ].filter((c) => c.metric);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-slate-950">{block.title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{block.subtitle}</p>
          </div>
          {diagnosis ? (
            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${pmStatusTone(diagnosis.overallStatus)}`}>
              {diagnosis.overallStatus}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>Метод: {block.method}</span>
          {block.planDistributionMethod ? <span>Plan To Date: {block.planDistributionMethod}</span> : null}
          {block.asOf ? <span>As of: {block.asOf}</span> : null}
          {block.elapsedDays != null ? (
            <span>
              Дни: {block.elapsedDays} прошло / {block.remainingDays ?? "—"} осталось
            </span>
          ) : null}
        </div>
      </div>

      {/* Zone A — executive cards */}
      {cards.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ key, title, metric }) => (
            <article key={key} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${pmStatusTone(metric!.status)}`}>
                  {metric!.status}
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {formatValue(metric!.unit, metric!.forecast)}
              </p>
              <p className="mt-1 text-xs text-slate-500">прогноз EOM</p>
              <dl className="mt-3 space-y-1 text-xs text-slate-600">
                <div className="flex justify-between gap-2">
                  <dt>План</dt>
                  <dd className="font-semibold">{formatValue(metric!.unit, metric!.plan)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Fact MTD</dt>
                  <dd className="font-semibold">{formatValue(metric!.unit, metric!.fact)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>GAP</dt>
                  <dd className="font-semibold">{formatValue(metric!.unit, metric!.gapToPlan)}</dd>
                </div>
                {metric!.requiredPaceMultiplier != null ? (
                  <div className="flex justify-between gap-2">
                    <dt>Required pace</dt>
                    <dd className="font-semibold">{formatMult(metric!.requiredPaceMultiplier)}</dd>
                  </div>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
      ) : null}

      {/* Zone C — root cause */}
      {diagnosis ? (
        <div className="card border-l-4 border-l-blue-600 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Main Risk / Diagnosis</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{diagnosis.summary}</p>
          {diagnosis.evidence.length ? (
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              {diagnosis.evidence.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            {diagnosis.firstBrokenDriverLabel ? (
              <span>First broken: <strong className="text-slate-800">{diagnosis.firstBrokenDriverLabel}</strong></span>
            ) : null}
            {diagnosis.positiveCompensatorLabel ? (
              <span>Компенсатор: <strong className="text-slate-800">{diagnosis.positiveCompensatorLabel}</strong></span>
            ) : null}
            <span>Drill-down: {diagnosis.recommendedDrilldown}</span>
          </div>
          {diagnosis.missingData.length ? (
            <p className="mt-2 text-xs text-amber-700">NO_DATA: {diagnosis.missingData.join(", ")}</p>
          ) : null}
        </div>
      ) : null}

      {/* Zone B — driver chain */}
      {chain.length ? (
        <div className="card p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Driver chain</h3>
          <div className="mt-4 flex flex-col gap-2">
            {chain.map((node, index) => (
              <div key={node.id} className="flex items-stretch gap-2">
                <div className="flex w-6 flex-col items-center">
                  <span className={`mt-3 h-2.5 w-2.5 rounded-full border ${pmStatusTone(node.status)}`} />
                  {index < chain.length - 1 ? <span className="mt-1 w-px flex-1 bg-slate-200" /> : null}
                </div>
                <div className={`flex-1 rounded-xl border px-3 py-2 ${pmStatusTone(node.status)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">{node.label}</p>
                      <p className="text-[10px] uppercase tracking-wide opacity-80">{node.metricType}</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase">{node.status}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-5">
                    <span>Plan {formatValue(node.unit, node.plan)}</span>
                    <span>PtD {formatValue(node.unit, node.planToDate)}</span>
                    <span>Fact {formatValue(node.unit, node.fact)}</span>
                    <span>Fcst {formatValue(node.unit, node.forecast)}</span>
                    <span>Pace {formatPace(node.pace)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Metrics table */}
      <div className="card overflow-hidden">
        <div className="table-scroll">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-bold">Метрика</th>
                <th className="px-3 py-3 font-bold">План</th>
                <th className="px-3 py-3 font-bold">Plan To Date</th>
                <th className="px-3 py-3 font-bold">Fact MTD</th>
                <th className="px-3 py-3 font-bold">Pace</th>
                <th className="px-3 py-3 font-bold">Forecast</th>
                <th className="px-3 py-3 font-bold">GAP</th>
                <th className="px-3 py-3 font-bold">Req. pace</th>
                <th className="px-3 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {(primaryMetrics.length ? primaryMetrics : block.metrics).map((metric) => (
                <tr key={metric.id} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2.5 font-semibold text-slate-900">
                    {metric.label}
                    {metric.planSource === "DERIVED" ? (
                      <span className="ml-1 text-[10px] font-bold uppercase text-slate-400">derived</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">{formatValue(metric.unit, metric.plan)}</td>
                  <td className="px-3 py-2.5">{formatValue(metric.unit, metric.planToDate ?? null)}</td>
                  <td className="px-3 py-2.5">{formatValue(metric.unit, metric.fact)}</td>
                  <td className="px-3 py-2.5">{formatPace(metric.pace)}</td>
                  <td className="px-3 py-2.5 font-semibold">{formatValue(metric.unit, metric.forecast)}</td>
                  <td className="px-3 py-2.5">{formatValue(metric.unit, metric.gapToPlan)}</td>
                  <td className="px-3 py-2.5">{formatMult(metric.requiredPaceMultiplier)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${pmStatusTone(metric.status)}`}>
                      {metric.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {days.length ? (
        <div className="card overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-slate-900 hover:bg-slate-50"
            onClick={() => setDaysOpen((v) => !v)}
            aria-expanded={daysOpen}
          >
            <span>{daysOpen ? "Свернуть дни месяца" : `Развернуть по дням (${days.length})`}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {daysOpen ? "скрыть" : "показать"}
            </span>
          </button>
          {daysOpen ? (
            <div className="table-scroll border-t border-[var(--line)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">День</th>
                    <th className="px-4 py-3 font-bold">Лиды</th>
                    <th className="px-4 py-3 font-bold">Оплаты</th>
                    <th className="px-4 py-3 font-bold">Выручка</th>
                    <th className="px-4 py-3 font-bold">Spend</th>
                    <th className="px-4 py-3 font-bold">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.date} className="border-t border-[var(--line)]">
                      <td className="px-4 py-2 font-semibold text-slate-900">{day.date}</td>
                      <td className="px-4 py-2">{day.leads == null ? "—" : number(day.leads)}</td>
                      <td className="px-4 py-2">{day.payments == null ? "—" : number(day.payments)}</td>
                      <td className="px-4 py-2">{day.paidRevenue == null ? "—" : eur(day.paidRevenue)}</td>
                      <td className="px-4 py-2">{day.spend == null ? "—" : eur(day.spend)}</td>
                      <td className="px-4 py-2 text-xs uppercase text-slate-500">{day.completeness}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {block.notes.length ? (
        <ul className="space-y-1 text-xs text-slate-500">
          {block.notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
