"use client";

import type { DeltaMetricRow } from "@/lib/planning-layer";
import { eur } from "@/lib/format";

type Props = {
  rows: DeltaMetricRow[];
};

export function PlanningDeltaView({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <section className="card overflow-hidden p-0">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <h2 className="text-lg font-black text-slate-950">Delta View</h2>
        <p className="text-xs text-slate-500">FACT · PLAN · SCENARIO</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Показатель</th>
              <th className="px-4 py-3">Fact</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Scenario</th>
              <th className="px-4 py-3">Δ Plan</th>
              <th className="px-4 py-3">Δ Fact</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metricId} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-800">{row.label}</td>
                <td className="px-4 py-3">{formatValue(row.fact, row.unit)}</td>
                <td className="px-4 py-3">{row.plan === null ? "—" : formatValue(row.plan, row.unit)}</td>
                <td className="px-4 py-3">{row.scenario === null ? "—" : formatValue(row.scenario, row.unit)}</td>
                <td className="px-4 py-3">{row.deltaPlan === null ? "—" : formatDelta(row.deltaPlan, row.unit)}</td>
                <td className="px-4 py-3">{row.deltaFact === null ? "—" : formatDelta(row.deltaFact, row.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatValue(value: number, unit: DeltaMetricRow["unit"]) {
  return unit === "currency" ? eur(value) : `${(value * 100).toFixed(1)}%`;
}

function formatDelta(value: number, unit: DeltaMetricRow["unit"]) {
  const sign = value >= 0 ? "+" : "−";
  return unit === "currency" ? `${sign}${eur(Math.abs(value))}` : `${sign}${Math.abs(value * 100).toFixed(1)}%`;
}
