/**
 * Marketing Plan Registry — only СВОД-verified approved plans.
 */

import { PLAN_REGISTRY_COLUMNS } from "@/config/marketing-planning";
import {
  pullSvodPaidOrganicPlans,
  type SvodPaidOrganicPlans,
  type SvodSalesPlanSlice
} from "@/lib/sales-os/svod-plans";

export type PlanRegistryRow = Record<(typeof PLAN_REGISTRY_COLUMNS)[number], string>;

function emptyPlan(): PlanRegistryRow {
  return Object.fromEntries(PLAN_REGISTRY_COLUMNS.map((c) => [c, ""])) as PlanRegistryRow;
}

function pushSlice(input: {
  rows: PlanRegistryRow[];
  month: string;
  scopeType: string;
  scopeId: string;
  slice: SvodSalesPlanSlice;
  syncedAt: string;
  sections?: string[];
}) {
  const map: Array<{ metric_id: string; value: number | null; currency: string }> = [
    { metric_id: "paid_revenue", value: input.slice.revenue, currency: "EUR" },
    { metric_id: "payments", value: input.slice.sale, currency: "" },
    { metric_id: "leads", value: input.slice.leads, currency: "" },
    { metric_id: "invoice_events", value: input.slice.invoices, currency: "" },
    { metric_id: "average_check", value: input.slice.aov, currency: "EUR" },
    { metric_id: "lead_to_payment_cr", value: input.slice.crLeadSale, currency: "" },
    { metric_id: "deal_to_invoice_cr", value: null, currency: "" },
    { metric_id: "invoice_to_payment_cr", value: input.slice.crInvoiceSale, currency: "" },
    { metric_id: "cpl", value: input.slice.cpl ?? null, currency: "EUR" },
    { metric_id: "spend", value: input.slice.spend ?? null, currency: "EUR" }
  ];
  for (const item of map) {
    if (item.value == null || !Number.isFinite(item.value)) continue;
    const row = emptyPlan();
    row.plan_id = `svod|${input.month}|${input.scopeType}|${input.scopeId}|${item.metric_id}`;
    row.period_type = "month";
    row.period = input.month;
    row.scope_type = input.scopeType;
    row.scope_id = input.scopeId;
    row.metric_id = item.metric_id;
    row.plan_value = String(item.value);
    row.currency = item.currency;
    row.approved_by = "svod_plan_fact";
    row.approved_at = input.syncedAt.slice(0, 10);
    row.source = "svod_plan_fact";
    row.status = "approved";
    row.comment =
      input.sections?.length
        ? `СВОД План/факт (${input.sections.join(", ")})`
        : "СВОД План/факт";
    row.updated_at = input.syncedAt;
    input.rows.push(row);
  }
}

export async function buildPlanRegistryFromSvod(input: {
  month: string;
  syncedAt: string;
}): Promise<{ rows: PlanRegistryRow[]; plans: SvodPaidOrganicPlans | null; warnings: string[] }> {
  const warnings: string[] = [];
  let plans: SvodPaidOrganicPlans | null = null;
  try {
    plans = await pullSvodPaidOrganicPlans({ month: input.month });
  } catch (error) {
    warnings.push(`SVOD plans: ${error instanceof Error ? error.message : String(error)}`);
  }
  const rows: PlanRegistryRow[] = [];
  if (!plans) {
    warnings.push("No СВОД plans parsed — all marketing plans NO_PLAN");
    return { rows, plans: null, warnings };
  }
  pushSlice({
    rows,
    month: input.month,
    scopeType: "company",
    scopeId: "marketing",
    slice: plans.obshie,
    syncedAt: input.syncedAt
  });
  pushSlice({
    rows,
    month: input.month,
    scopeType: "traffic_type",
    scopeId: "paid",
    slice: plans.paid,
    syncedAt: input.syncedAt,
    sections: plans.paidSections
  });
  pushSlice({
    rows,
    month: input.month,
    scopeType: "traffic_type",
    scopeId: "organic",
    slice: plans.organic,
    syncedAt: input.syncedAt
  });
  return { rows, plans, warnings };
}

export function planMatrix(rows: PlanRegistryRow[]): string[][] {
  return [
    Array.from(PLAN_REGISTRY_COLUMNS),
    ...rows.map((r) => PLAN_REGISTRY_COLUMNS.map((c) => r[c] || ""))
  ];
}

export function findApprovedPlanValue(
  rows: PlanRegistryRow[],
  input: { period: string; scopeType: string; scopeId: string; metricId: string }
): number | null {
  const row = rows.find(
    (r) =>
      r.status === "approved" &&
      r.period_type === "month" &&
      r.period === input.period &&
      r.scope_type === input.scopeType &&
      r.scope_id === input.scopeId &&
      r.metric_id === input.metricId
  );
  if (!row) return null;
  const n = Number(String(row.plan_value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
