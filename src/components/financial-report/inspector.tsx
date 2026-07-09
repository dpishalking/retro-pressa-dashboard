"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import type { CanonicalFinancialReport } from "@/lib/financial-report/types";
import type { LineageNode } from "@/lib/financial-engine/types";
import { eur, number, pct } from "@/lib/format";

const metricOptions = [
  { id: "netProfit", label: "Чистая прибыль" },
  { id: "revenue", label: "Выручка" },
  { id: "grossProfit", label: "Валовая прибыль" },
  { id: "operatingProfit", label: "Операционная прибыль" },
  { id: "ebitda", label: "EBITDA" }
] as const;

type Props = {
  report: CanonicalFinancialReport;
};

export function FinancialReportInspector({ report }: Props) {
  const [selectedId, setSelectedId] = useState<string>("netProfit");

  const lineage = useMemo(() => {
    if (report.explain[selectedId]) return report.explain[selectedId];
    const pnlMetric = report.pnl[selectedId as keyof typeof report.pnl];
    if (pnlMetric && "lineage" in pnlMetric) return pnlMetric.lineage;
    return report.explain.netProfit;
  }, [report, selectedId]);

  const metricValue = useMemo(() => {
    if (selectedId in report.summary) {
      return report.summary[selectedId as keyof typeof report.summary];
    }
    const pnlMetric = report.pnl[selectedId as keyof typeof report.pnl];
    if (pnlMetric && "value" in pnlMetric) return pnlMetric.value;
    return report.summary.netProfit;
  }, [report, selectedId]);

  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-normal text-violet-600">Dev Inspector</p>
          <h2 className="text-xl font-black text-slate-950">Financial Report Inspector</h2>
          <p className="mt-1 text-sm text-slate-500">Проверка значения, источника, формулы и дерева расчёта</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Search size={14} className="text-slate-400" />
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="bg-transparent text-sm font-semibold text-slate-800 outline-none"
          >
            {metricOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
        <p className="text-xs font-bold uppercase text-violet-700">Значение</p>
        <p className="mt-1 text-3xl font-black text-slate-950">{formatLineageValue(metricValue, lineage.unit)}</p>
        <p className="mt-2 text-xs text-slate-600">
          Период {report.periodIso} · {report.dataMode} · вычислено {new Date(report.computedAt).toLocaleString("ru-RU")}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-sm font-bold text-slate-800">Дерево расчёта (Explainability)</p>
        <LineageTree node={lineage} />
      </div>

      {report.dataQuality.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-bold text-amber-800">Data Quality ({report.dataQuality.length})</p>
          <ul className="space-y-1 text-xs text-amber-900">
            {report.dataQuality.map((issue) => (
              <li key={issue.metricId}>
                {issue.label}: {issue.reason} · {issue.source}
                {issue.fallbackUsed ? " · fallback" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function LineageTree({ node, depth = 0 }: { node: LineageNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div className={depth > 0 ? "ml-4 border-l border-slate-200 pl-3" : ""}>
      <button
        type="button"
        onClick={() => hasChildren && setOpen(!open)}
        className={`mb-1 flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left ${hasChildren ? "hover:bg-white" : ""}`}
      >
        {hasChildren ? (
          <ChevronRight size={14} className={`mt-0.5 shrink-0 transition ${open ? "rotate-90" : ""}`} />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{node.label}</span>
            <span className="text-sm font-black text-slate-950">{formatLineageValue(node.value, node.unit)}</span>
          </div>
          <p className="text-xs text-slate-500">
            {node.source}
            {node.formula ? ` · ${node.formula}` : ""}
            {!node.available ? " · недоступен" : ""}
          </p>
        </div>
      </button>
      {open && hasChildren ? (
        <div className="mb-1">
          {node.children.map((child) => (
            <LineageTree key={`${node.id}-${child.id}`} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatLineageValue(value: number, unit: LineageNode["unit"]) {
  switch (unit) {
    case "currency":
      return eur(value);
    case "percent":
      return pct(value);
    case "count":
      return number(value, 0);
    case "days":
      return `${number(value, 0)} дн.`;
    default:
      return number(value, 2);
  }
}
