"use client";

import { pct, eur } from "@/lib/format";
import { useFinancialReport } from "@/hooks/use-financial-report";
import type { Scenario } from "@/lib/digital-twin/types";

type Props = {
  scenario: Scenario;
  isActive: boolean;
  onSelect: () => void;
};

export function ScenarioFinancialCard({ scenario, isActive, onSelect }: Props) {
  const { report, loading } = useFinancialReport({ driverOverrides: scenario.overrides });

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`card p-6 text-left transition ${isActive ? "ring-2 ring-violet-500" : "hover:-translate-y-0.5 hover:shadow-lg"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xl font-black text-slate-950">{scenario.name}</h3>
        {isActive ? <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">Активный</span> : null}
      </div>
      <p className="text-sm text-slate-600">{scenario.description}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-slate-500">Выручка</p>
          <p className="font-black text-slate-950">{loading || !report ? "…" : eur(report.summary.revenue)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Прибыль</p>
          <p className="font-black text-emerald-600">{loading || !report ? "…" : eur(report.summary.netProfit)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Рентабельность</p>
          <p className="font-black text-slate-950">{loading || !report ? "…" : pct(report.pnl.netMargin.value)}</p>
        </div>
      </div>
    </button>
  );
}
