import { buildFallbackFinancialReport } from "@/lib/financial-report/fallback";
import { parsePeriodParam } from "@/lib/financial-report/period";
import type { CanonicalFinancialReport } from "@/lib/financial-report/types";
import { parsePlanningMode, type ScenarioChange } from "@/lib/planning-layer";
import type { PeriodKey } from "@/types/metrics";

export type FetchFinancialReportOptions = {
  period?: PeriodKey | string;
  refresh?: boolean;
  mode?: string;
  driverOverrides?: Partial<Record<string, number>>;
  changes?: ScenarioChange[];
  scenarioId?: string;
  includeDelta?: boolean;
};

export async function fetchFinancialReport(
  options: FetchFinancialReportOptions = {}
): Promise<{ report: CanonicalFinancialReport; isFallback: boolean }> {
  const period = parsePeriodParam(options.period ?? null);
  const mode = parsePlanningMode(options.mode);
  const isScenario = mode === "SCENARIO";
  const hasScenarioInput =
    isScenario &&
    ((options.driverOverrides && Object.keys(options.driverOverrides).length > 0) ||
      (options.changes && options.changes.length > 0) ||
      options.scenarioId);

  try {
    const url = new URL("/api/financial-report", window.location.origin);
    url.searchParams.set("period", period);
    url.searchParams.set("mode", mode);
    if (options.refresh) url.searchParams.set("refresh", "1");
    if (options.includeDelta) url.searchParams.set("includeDelta", "1");
    if (options.scenarioId) url.searchParams.set("scenarioId", options.scenarioId);

    const response = hasScenarioInput
      ? await fetch("/api/financial-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            period,
            mode,
            refresh: options.refresh === true,
            overrides: options.driverOverrides,
            changes: options.changes,
            scenarioId: options.scenarioId,
            includeDelta: options.includeDelta === true
          }),
          cache: "no-store"
        })
      : await fetch(url.toString(), { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Financial Report API: ${response.status}`);
    }

    const payload = (await response.json()) as CanonicalFinancialReport | { ok: false; error: string };
    if (!payload.ok) {
      throw new Error(payload.error);
    }

    return { report: payload, isFallback: false };
  } catch {
    return {
      report: buildFallbackFinancialReport(period, {
        mode,
        overrides: options.driverOverrides,
        changes: options.changes,
        scenarioId: options.scenarioId
      }),
      isFallback: true
    };
  }
}
