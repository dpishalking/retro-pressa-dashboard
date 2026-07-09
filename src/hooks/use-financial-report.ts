"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchFinancialReport } from "@/lib/financial-report/client";
import { parsePeriodParam } from "@/lib/financial-report/period";
import type { CanonicalFinancialReport } from "@/lib/financial-report/types";
import type { PeriodKey } from "@/types/metrics";

export type UseFinancialReportOptions = {
  period?: PeriodKey | string;
  driverOverrides?: Partial<Record<string, number>>;
  enabled?: boolean;
};

export type UseFinancialReportResult = {
  report: CanonicalFinancialReport | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  isFallback: boolean;
  period: PeriodKey;
};

function overridesKey(overrides?: Partial<Record<string, number>>) {
  if (!overrides || Object.keys(overrides).length === 0) return "";
  return JSON.stringify(
    Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b))
  );
}

export function useFinancialReport(options: UseFinancialReportOptions = {}): UseFinancialReportResult {
  const enabled = options.enabled !== false;
  const period = parsePeriodParam(options.period ?? null);
  const overrides = options.driverOverrides;
  const overridesSignature = useMemo(() => overridesKey(overrides), [overrides]);

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
          refresh,
          driverOverrides: overrides
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
    [enabled, overrides, period]
  );

  useEffect(() => {
    void load(false);
  }, [load, overridesSignature]);

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  return {
    report,
    loading,
    error,
    refresh,
    isFallback,
    period
  };
}
