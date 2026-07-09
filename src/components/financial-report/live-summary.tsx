"use client";

import { RefreshCcw } from "lucide-react";
import { useFinancialReport } from "@/hooks/use-financial-report";
import { eur, number, pct } from "@/lib/format";
import type { PeriodKey } from "@/types/metrics";

type Props = {
  period?: PeriodKey | string;
};

export function FinancialReportLiveSummary({ period }: Props) {
  const { report, loading, error, refresh, isFallback } = useFinancialReport({ period });

  if (loading && !report) {
    return (
      <section className="card p-4">
        <p className="text-sm text-slate-500">Загрузка Financial Report…</p>
      </section>
    );
  }

  if (!report) {
    return (
      <section className="card border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-800">Financial Report недоступен</p>
        {error ? <p className="mt-1 text-xs text-amber-700">{error}</p> : null}
      </section>
    );
  }

  const { summary } = report;

  return (
    <section className="card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-normal text-emerald-700">Financial Report</p>
          <h2 className="text-2xl font-black text-slate-950">Реальные финансовые показатели</h2>
          <p className="mt-1 text-sm text-slate-500">
            {report.periodIso} · {report.dataMode}
            {isFallback ? " · fallback" : " · live API"}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCcw size={14} />
          Обновить
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <SummaryMetric label="Выручка" value={eur(summary.revenue)} />
        <SummaryMetric label="Валовая прибыль" value={eur(summary.grossProfit)} />
        <SummaryMetric label="Операционная" value={eur(summary.operatingProfit)} />
        <SummaryMetric label="Чистая прибыль" value={eur(summary.netProfit)} accent />
        <SummaryMetric label="EBITDA" value={eur(summary.ebitda)} />
        <SummaryMetric label="Cash" value={eur(summary.cash)} />
        <SummaryMetric label="Burn Rate" value={eur(summary.burnRate)} />
        <SummaryMetric label="Runway" value={`${number(summary.runway, 0)} дн.`} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <SummaryMetric label="Валовая маржа" value={pct(report.pnl.grossMargin.value)} />
        <SummaryMetric label="Операционная маржа" value={pct(report.pnl.operatingMargin.value)} />
        <SummaryMetric label="Чистая маржа" value={pct(report.pnl.netMargin.value)} />
      </div>

      {error ? <p className="mt-3 text-xs text-amber-700">{error}</p> : null}
    </section>
  );
}

function SummaryMetric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-black ${accent ? "text-emerald-700" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}
