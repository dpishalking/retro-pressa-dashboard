/**
 * Approved plans for Sales Prediction — draft ignored; no auto-allocation.
 */

import {
  DEPARTMENT_SCOPE_ID,
  PLAN_COLUMNS,
  emptyPlanRow,
  planPrimaryKey,
  type PlanRow,
  type PredictionScopeType
} from "./contract";
import { parseNumber } from "./run-rate";

export function rowsFromPlanMatrix(values: string[][]): PlanRow[] {
  if (!values.length) return [];
  const header = values[0].map((c) => String(c || "").trim());
  const idx = (name: string) => header.indexOf(name);
  const rows: PlanRow[] = [];
  for (const raw of values.slice(1)) {
    if (!raw.some((c) => String(c || "").trim())) continue;
    const row = emptyPlanRow();
    for (const col of PLAN_COLUMNS) {
      const i = idx(col);
      row[col] = i >= 0 ? String(raw[i] ?? "").trim() : "";
    }
    if (!row.period || !row.metric_id) continue;
    rows.push(row);
  }
  return rows;
}

export function approvedPlansOnly(rows: PlanRow[]): PlanRow[] {
  return rows.filter((r) => String(r.status).toLowerCase() === "approved");
}

export function findApprovedPlan(input: {
  plans: PlanRow[];
  periodType: string;
  period: string;
  scopeType: PredictionScopeType;
  scopeId: string;
  metricId: string;
}): PlanRow | null {
  const approved = approvedPlansOnly(input.plans);
  const key = planPrimaryKey({
    period_type: input.periodType,
    period: input.period,
    scope_type: input.scopeType,
    scope_id: input.scopeId,
    metric_id: input.metricId
  });
  return approved.find((r) => planPrimaryKey(r) === key) || null;
}

export function planValueOf(row: PlanRow | null): number | null {
  if (!row) return null;
  return parseNumber(row.plan_value);
}

/** Detect duplicate primary keys among plans. */
export function findDuplicatePlanKeys(rows: PlanRow[]): string[] {
  const seen = new Map<string, number>();
  const dups: string[] = [];
  for (const row of rows) {
    const key = planPrimaryKey(row);
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    if (n === 2) dups.push(key);
  }
  return dups;
}

/**
 * Preserve all existing plan rows; never auto-generate manager splits.
 * Optionally ensure header-only empty book gets no fake approved rows.
 */
export function mergePreservePlans(input: {
  existing: PlanRow[];
  incomingSeed?: PlanRow[];
}): PlanRow[] {
  const byKey = new Map<string, PlanRow>();
  for (const row of input.existing) byKey.set(planPrimaryKey(row), row);
  for (const row of input.incomingSeed || []) {
    const key = planPrimaryKey(row);
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return [...byKey.values()];
}

/** Official department month plans from СВОД «План/факт» → ОБЩИЕ. */
export const SVOD_DEPARTMENT_PLAN_SOURCE = "svod_plan_fact_obshie";

export type SvodDepartmentPlanInput = {
  month: string;
  revenue?: number | null;
  sale?: number | null;
  leads?: number | null;
  invoices?: number | null;
  aov?: number | null;
};

/**
 * Map СВОД ОБЩИЕ month plan columns → Prediction metric plans (department only).
 * Does not create week/day splits or manager allocations.
 */
export function plansFromSvodDepartment(input: {
  svod: SvodDepartmentPlanInput;
  syncedAt: string;
  approvedBy?: string;
}): PlanRow[] {
  const specs: Array<{
    metric_id: string;
    value: number | null | undefined;
    unit: string;
    currency: string;
  }> = [
    { metric_id: "paid_revenue", value: input.svod.revenue, unit: "EUR", currency: "EUR" },
    { metric_id: "payments", value: input.svod.sale, unit: "count", currency: "" },
    { metric_id: "leads", value: input.svod.leads, unit: "count", currency: "" },
    { metric_id: "invoice_events", value: input.svod.invoices, unit: "count", currency: "" },
    { metric_id: "average_check", value: input.svod.aov, unit: "EUR", currency: "EUR" }
  ];
  const out: PlanRow[] = [];
  for (const spec of specs) {
    if (spec.value == null || !Number.isFinite(spec.value)) continue;
    const row = emptyPlanRow();
    row.plan_id = `svod|${input.svod.month}|department|${DEPARTMENT_SCOPE_ID}|${spec.metric_id}`;
    row.period_type = "month";
    row.period = input.svod.month;
    row.scope_type = "department";
    row.scope_id = DEPARTMENT_SCOPE_ID;
    row.metric_id = spec.metric_id;
    row.plan_value = String(spec.value);
    row.unit = spec.unit;
    row.currency = spec.currency;
    row.owner = "marketing_svod";
    row.approved_by = input.approvedBy || "svod_plan_fact";
    row.approved_at = input.syncedAt.slice(0, 10);
    row.plan_source = SVOD_DEPARTMENT_PLAN_SOURCE;
    row.status = "approved";
    row.comment = "СВОД План/факт → ОБЩИЕ (department month)";
    row.updated_at = input.syncedAt;
    out.push(row);
  }
  return out;
}

/**
 * Upsert СВОД department plans. Manual overrides (non-SVOD source on same PK) are preserved.
 * Manager / week / day rows are never touched by this merge.
 */
export function mergeSvodDepartmentPlans(input: {
  existing: PlanRow[];
  svodPlans: PlanRow[];
}): PlanRow[] {
  const byKey = new Map<string, PlanRow>();
  for (const row of input.existing) byKey.set(planPrimaryKey(row), row);
  for (const incoming of input.svodPlans) {
    const key = planPrimaryKey(incoming);
    const existing = byKey.get(key);
    if (
      existing &&
      existing.plan_source &&
      existing.plan_source !== SVOD_DEPARTMENT_PLAN_SOURCE &&
      String(existing.status).toLowerCase() === "approved"
    ) {
      // Manual approved override wins over СВОД refresh.
      continue;
    }
    byKey.set(key, incoming);
  }
  return [...byKey.values()];
}

/**
 * Suggest draft seed from Settings (NOT approved). Caller must not treat as plan.
 */
export function draftSeedFromSettings(input: {
  month: string;
  planPaidRevenue?: string;
  planPaymentsCount?: string;
  updatedAt: string;
}): PlanRow[] {
  const out: PlanRow[] = [];
  const base = (): PlanRow => {
    const row = emptyPlanRow();
    row.period_type = "month";
    row.period = input.month;
    row.scope_type = "department";
    row.scope_id = DEPARTMENT_SCOPE_ID;
    row.status = "draft";
    row.plan_source = "settings_hint";
    row.updated_at = input.updatedAt;
    row.comment = "Draft seed from Settings — not used until approved";
    return row;
  };
  if (input.planPaidRevenue?.trim()) {
    const row = base();
    row.plan_id = `draft|${input.month}|dept|paid_revenue`;
    row.metric_id = "paid_revenue";
    row.plan_value = input.planPaidRevenue.trim();
    row.unit = "EUR";
    row.currency = "EUR";
    out.push(row);
  }
  if (input.planPaymentsCount?.trim()) {
    const row = base();
    row.plan_id = `draft|${input.month}|dept|payments`;
    row.metric_id = "payments";
    row.plan_value = input.planPaymentsCount.trim();
    row.unit = "count";
    out.push(row);
  }
  return out;
}

export function toPlanMatrix(rows: PlanRow[]): string[][] {
  return [Array.from(PLAN_COLUMNS), ...rows.map((row) => PLAN_COLUMNS.map((c) => row[c] || ""))];
}
