import type { FinancialContext, FinancialMetric, LineageNode, PnLStatement } from "./types";
import { margin } from "./math";
import { buildNetProfitLineage, lineageNode } from "./explainability";

function fm(
  id: string,
  label: string,
  value: number,
  source: FinancialContext["sources"][string] | { source: import("@/lib/company-snapshot/types").SnapshotSourceId; available: boolean },
  unit: FinancialMetric["unit"] = "currency",
  lineage?: LineageNode
): FinancialMetric {
  const src = source ?? { source: "computed", available: true };
  return {
    id,
    label,
    value,
    unit,
    source: src.source,
    available: src.available,
    lineage: lineage ?? lineageNode({ id, label, value, unit, source: src.source, available: src.available })
  };
}

export function computePnL(ctx: FinancialContext): { pnl: PnLStatement; netProfitLineage: LineageNode } {
  const grossProfit = ctx.revenue - ctx.cogs - ctx.defectCost;
  const operatingExpenses = ctx.marketingSpend + ctx.payroll + ctx.logisticsCost + ctx.overhead;
  const operatingProfit = grossProfit - operatingExpenses;
  const ebitda = operatingProfit;
  const taxes = Math.max(0, operatingProfit * ctx.taxRate);
  const netProfit = operatingProfit - taxes;
  const netProfitLineage = buildNetProfitLineage(ctx, netProfit);

  const pnl: PnLStatement = {
    revenue: fm("revenue", "Выручка", ctx.revenue, ctx.sources.revenue, "currency"),
    repeatRevenue: fm("repeatRevenue", "Повторные продажи", ctx.baseRevenue * ctx.repeatSalesRate, { source: "computed", available: true }),
    cogs: fm("cogs", "Себестоимость", ctx.cogs, ctx.sources.unitCost),
    defectCost: fm("defectCost", "Брак", ctx.defectCost, { source: "google_production", available: true }),
    grossProfit: fm("grossProfit", "Валовая прибыль", grossProfit, { source: "computed", available: true }),
    grossMargin: fm("grossMargin", "Валовая маржа", margin(grossProfit, ctx.revenue), { source: "computed", available: true }, "percent"),
    marketingSpend: fm("marketingSpend", "Маркетинг", ctx.marketingSpend, ctx.sources.marketingSpend),
    payroll: fm("payroll", "ФОТ", ctx.payroll, ctx.sources.payroll),
    productionCost: fm("productionCost", "Производство", ctx.cogs, ctx.sources.unitCost),
    logisticsCost: fm("logisticsCost", "Логистика", ctx.logisticsCost, { source: "computed", available: true }),
    overhead: fm("overhead", "Постоянные расходы", ctx.overhead, { source: "google_finance", available: snapshotFinanceAvailable(ctx, "overhead") }),
    operatingExpenses: fm("operatingExpenses", "Операционные расходы", operatingExpenses, { source: "computed", available: true }),
    ebitda: fm("ebitda", "EBITDA", ebitda, { source: "computed", available: true }),
    operatingProfit: fm("operatingProfit", "Операционная прибыль", operatingProfit, { source: "computed", available: true }),
    operatingMargin: fm("operatingMargin", "Операционная маржа", margin(operatingProfit, ctx.revenue), { source: "computed", available: true }, "percent"),
    taxes: fm("taxes", "Налоги", taxes, { source: "google_finance", available: true }),
    netProfit: fm("netProfit", "Чистая прибыль", netProfit, { source: "computed", available: true }, "currency", netProfitLineage),
    netMargin: fm("netMargin", "Чистая маржа", margin(netProfit, ctx.revenue), { source: "computed", available: true }, "percent")
  };

  return { pnl, netProfitLineage };
}

function snapshotFinanceAvailable(ctx: FinancialContext, _field: string) {
  return ctx.dataMode === "fallback" || ctx.overhead > 0;
}
