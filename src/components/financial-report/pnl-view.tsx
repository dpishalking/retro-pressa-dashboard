"use client";

import type { CanonicalFinancialReport } from "@/lib/financial-report/types";
import { eur } from "@/lib/format";

type Props = {
  report: CanonicalFinancialReport;
};

export function FinancialPnLView({ report }: Props) {
  const { pnl } = report;

  return (
    <div className="space-y-2 text-sm">
      <PlRow label="Выручка" value={pnl.revenue.value} bold />
      <PlRow label="Себестоимость" value={-pnl.cogs.value} />
      <PlRow label="Валовая прибыль" value={pnl.grossProfit.value} bold />
      <PlRow label="Маркетинг" value={-pnl.marketingSpend.value} />
      <PlRow label="ФОТ" value={-pnl.payroll.value} />
      <PlRow label="Логистика" value={-pnl.logisticsCost.value} />
      <PlRow label="Постоянные расходы" value={-pnl.overhead.value} />
      <PlRow label="Операционная прибыль" value={pnl.operatingProfit.value} bold />
      <PlRow label="Налоги" value={-pnl.taxes.value} />
      <PlRow label="Чистая прибыль" value={pnl.netProfit.value} bold accent />
    </div>
  );
}

function PlRow({ label, value, bold, accent }: { label: string; value: number; bold?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""} ${accent ? "border-t border-slate-200 pt-2 text-emerald-700" : ""}`}>
      <span className="text-slate-600">{label}</span>
      <span className={value < 0 ? "text-red-600" : "text-slate-950"}>{value < 0 ? `−${eur(Math.abs(value))}` : eur(value)}</span>
    </div>
  );
}
