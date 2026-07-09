"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchFinancialReport } from "@/lib/financial-report/client";
import { parsePeriodParam } from "@/lib/financial-report/period";
import type { CanonicalFinancialReport } from "@/lib/financial-report/types";
import { parsePlanningMode, type PlanningMode, type ScenarioChange } from "@/lib/planning-layer";
import type { PeriodKey } from "@/types/metrics";

export type UseFinancialReportOptions = {
  period?: PeriodKey | string;
  mode?: PlanningMode | string;
  driverOverrides?: Partial<Record<string, number>>;
  changes?: ScenarioChange[];
  scenarioId?: string;
  includeDelta?: boolean;
  enabled?: boolean;
};

export type UseFinancialReportResult = {
  report: CanonicalFinancialReport | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  isFallback: boolean;
  period: PeriodKey;
  mode: PlanningMode;
};

function requestSignature(options: UseFinancialReportOptions) {
  return JSON.stringify({
    period: parsePeriodParam(options.period ?? null),
    mode: parsePlanningMode(options.mode),
    overrides: options.driverOverrides ?? {},
    changes: options.changes ?? [],
    scenarioId: options.scenarioId ?? "",
    includeDelta: options.includeDelta === true
  });
}

export function useFinancialReport(options: UseFinancialReportOptions = {}): UseFinancialReportResult {
  const enabled = options.enabled !== false;
  const period = parsePeriodParam(options.period ?? null);
  const mode = parsePlanningMode(options.mode);
  const signature = useMemo(() => requestSignature(options), [
    options.period,
    options.mode,
    options.driverOverrides,
    options.changes,
    options.scenarioId,
    options.includeDelta
  ]);

  const [report, setReport] = useState<CanonicalFinancialReport | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(
    async (refresh = false) => {
      if (!enabled) return;

      const currentRequest = ++requestId.current;
      setLoading(true);
      setError(null);

      try {
        const result = await fetchFinancialReport({
          period,
          mode,
          refresh,
          driverOverrides: mode === "SCENARIO" ? options.driverOverrides : undefined,
          changes: mode === "SCENARIO" ? options.changes : undefined,
          scenarioId: mode === "SCENARIO" ? options.scenarioId : undefined,
          includeDelta: options.includeDelta
        });

        if (currentRequest !== requestId.current) return;

        setReport(result.report);
        setIsFallback(result.isFallback);
        if (result.isFallback) {
          setError("API недоступен — используется локальный fallback");
        }
      } catch (err) {
        if (currentRequest !== requestId.current) return;
        const message = err instanceof Error ? err.message : "Не удалось загрузить Financial Report";
        setError(message);
      } finally {
        if (currentRequest === requestId.current) {
          setLoading(false);
        }
      }
    },
    [enabled, mode, options.changes, options.driverOverrides, options.includeDelta, options.scenarioId, period]
  );

  useEffect(() => {
    void load(false);
  }, [load, signature]);

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  return {
    report,
    loading,
    error,
    refresh,
    isFallback,
    period,
    mode
  };
}
