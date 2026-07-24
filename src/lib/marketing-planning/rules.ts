/**
 * Pure marketing-planning rules — testable without Sheets I/O.
 */

export const SALES_PLANNING_DESIGN_GID = 419868082;
export const SALES_PLANNING_DESIGN_TAB = "Предиктивка продажи";
export const SALES_PLANNING_DESIGN_SPREADSHEET_ID_DEFAULT =
  "1_bVqzLXOrIsV9A3UaD7UnRFPYp74FT4kXfw370Cx820";

export function getSalesPlanningDesignSpreadsheetId(): string {
  return (
    process.env.PREDICTIVE_SALES_SPREADSHEET_ID?.trim() ||
    SALES_PLANNING_DESIGN_SPREADSHEET_ID_DEFAULT
  );
}

/** Detect design source tab by exact title (gid verified separately via Sheets API). */
export function detectSalesPlanningDesignTab(titles: string[]): {
  found: boolean;
  tabName: string | null;
  layoutBlocked: boolean;
  reason: string;
} {
  const hit = titles.find((t) => t.trim() === SALES_PLANNING_DESIGN_TAB);
  if (!hit) {
    return {
      found: false,
      tabName: null,
      layoutBlocked: true,
      reason: "design_tab_missing"
    };
  }
  return {
    found: true,
    tabName: hit,
    layoutBlocked: false,
    reason: "ok"
  };
}

export function layoutCopyStatus(input: {
  hasAccess: boolean;
  designTabFound: boolean;
}): "ok" | "blocked_no_access" | "blocked_no_design_tab" {
  if (!input.hasAccess) return "blocked_no_access";
  if (!input.designTabFound) return "blocked_no_design_tab";
  return "ok";
}

export function planCellStatus(plan: number | null | undefined): "PLAN" | "NO_PLAN" {
  return plan != null && Number.isFinite(plan) ? "PLAN" : "NO_PLAN";
}

export function paidEfficiencyCells(input: {
  spend: number | null | undefined;
  leads: number | null | undefined;
  revenue: number | null | undefined;
}): {
  cpl: number | null;
  cac: number | null;
  roas: number | null;
  status: "ok" | "BLOCKED_MISSING_SPEND";
} {
  if (input.spend == null || !Number.isFinite(input.spend)) {
    return { cpl: null, cac: null, roas: null, status: "BLOCKED_MISSING_SPEND" };
  }
  const cpl =
    input.leads != null && input.leads > 0 ? Number((input.spend / input.leads).toFixed(6)) : null;
  const roas =
    input.spend > 0 && input.revenue != null
      ? Number((input.revenue / input.spend).toFixed(6))
      : null;
  return { cpl, cac: cpl, roas, status: "ok" };
}

export function forecastAdditive(input: {
  method: string;
  factToDate: number | null;
  elapsedDays: number;
  totalDays: number;
}): { value: number | null; status: "FORECAST" | "BLOCKED" | "UNKNOWN"; confidence: string } {
  if (input.method !== "calendar_run_rate") {
    return { value: null, status: "BLOCKED", confidence: "unsupported" };
  }
  if (input.factToDate == null || input.elapsedDays <= 0 || input.totalDays <= 0) {
    return { value: null, status: "UNKNOWN", confidence: "unsupported" };
  }
  return {
    value: Number(((input.factToDate / input.elapsedDays) * input.totalDays).toFixed(6)),
    status: "FORECAST",
    confidence: "medium"
  };
}

export function funnelForecastAllowed(input: {
  allComponentsPresent: boolean;
  unknownShareBelowThreshold: boolean;
  definitionsAligned: boolean;
}): { allowed: boolean; status: "FORECAST" | "BLOCKED" } {
  const ok =
    input.allComponentsPresent && input.unknownShareBelowThreshold && input.definitionsAligned;
  return { allowed: ok, status: ok ? "FORECAST" : "BLOCKED" };
}

export function scenarioIsNotForecast(valueKind: string): boolean {
  return valueKind === "SCENARIO";
}

export function factAllowedForDate(input: {
  date: string;
  forecastAsOf: string | null;
  weekState: "past" | "current" | "future";
}): boolean {
  if (input.weekState === "future") return false;
  if (!input.forecastAsOf) return false;
  return input.date <= input.forecastAsOf;
}

export function weekState(input: {
  weekStart: string;
  weekEnd: string;
  today: string;
}): "past" | "current" | "future" {
  if (input.today < input.weekStart) return "future";
  if (input.today > input.weekEnd) return "past";
  return "current";
}

export function completedWeekForecast(input: {
  weekState: "past" | "current" | "future";
  weekFact: number | null;
}): number | null {
  if (input.weekState === "past") return input.weekFact;
  if (input.weekState === "future") return null;
  return null; // current week: month-level run rate only in v1
}

export function monthHasFiveWeeks(weekCount: number): boolean {
  return weekCount === 5;
}

export function sumAdditive(values: Array<number | null>): number | null {
  let sum = 0;
  let any = false;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    sum += v;
    any = true;
  }
  return any ? sum : null;
}

export function recalculateRatio(num: number | null, den: number | null): number | null {
  if (num == null || den == null || !(den > 0)) return null;
  return Number((num / den).toFixed(6));
}

export function classifyTrafficType(raw: string): {
  bucket: string;
  isUnknown: boolean;
  convertedToOrganic: boolean;
} {
  const t = String(raw || "").trim().toLowerCase();
  if (!t || t === "unknown") {
    return { bucket: "unknown", isUnknown: true, convertedToOrganic: false };
  }
  if (t === "paid") return { bucket: "paid", isUnknown: false, convertedToOrganic: false };
  if (
    t === "organic_social" ||
    t === "organic_search" ||
    t === "referral" ||
    t === "direct" ||
    t === "partner" ||
    t === "messenger"
  ) {
    return { bucket: t, isUnknown: false, convertedToOrganic: false };
  }
  // Never auto-promote unknown-like labels to organic
  if (t.includes("organic")) {
    return { bucket: t, isUnknown: false, convertedToOrganic: false };
  }
  return { bucket: "unknown", isUnknown: true, convertedToOrganic: false };
}

export function revenueCanonSource(source: string): boolean {
  return source === "sales_os" || source === "os_paid_revenue";
}

export function ga4GenerateLeadEqualsCrmLead(): boolean {
  return false;
}

export function channelConnectionStatus(input: {
  apiConnected: boolean;
  factsObserved: boolean;
}): "FACT" | "NOT_CONNECTED" | "observed" {
  if (input.apiConnected) return "FACT";
  if (input.factsObserved) return "observed";
  return "NOT_CONNECTED";
}

export function yandexDirectStatus(): "NOT_CONNECTED" {
  return "NOT_CONNECTED";
}

export function landingSpendAllowed(hasAllocationRule: boolean): boolean {
  return hasAllocationRule;
}

export function zeroDenominatorEmpty(num: number, den: number): number | null {
  if (!(den > 0)) return null;
  return num / den;
}

export function staleSource(input: {
  sourceUpdatedAt: string | null;
  thresholdHours: number;
  nowIso: string;
}): boolean {
  if (!input.sourceUpdatedAt) return true;
  const then = Date.parse(input.sourceUpdatedAt);
  const now = Date.parse(input.nowIso);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return true;
  return (now - then) / 3_600_000 > input.thresholdHours;
}

export function classifyReconciliation(input: {
  valueA: number | null;
  valueB: number | null;
  tolerancePct: number;
  expectedDifference?: boolean;
  differentDefinition?: boolean;
}): string {
  if (input.valueA == null || input.valueB == null) return "missing_source";
  if (input.differentDefinition) return "different_definition";
  if (input.expectedDifference) return "expected_difference";
  if (input.valueA === input.valueB) return "matched";
  const base = Math.max(Math.abs(input.valueA), Math.abs(input.valueB), 1);
  const pct = (Math.abs(input.valueA - input.valueB) / base) * 100;
  if (pct <= input.tolerancePct) return "within_tolerance";
  return "mismatch";
}

export function exportContractVersion(): string {
  return "marketing_predictive_export_v1";
}

export function dryRunWritesNothing(dryRun: boolean, rowsWritten: number): boolean {
  return dryRun ? rowsWritten === 0 : true;
}
