import { buildFallbackFinancialReport } from "@/lib/financial-report/fallback";
import { parsePeriodParam } from "@/lib/financial-report/period";
import type { CanonicalFinancialReport } from "@/lib/financial-report/types";
import type { PeriodKey } from "@/types/metrics";

export type FetchFinancialReportOptions = {
  period?: PeriodKey | string;
  refresh?: boolean;
  driverOverrides?: Partial<Record<string, number>>;
};

export async function fetchFinancialReport(
  options: FetchFinancialReportOptions = {}
): Promise<{ report: CanonicalFinancialReport; isFallback: boolean }> {
  const period = parsePeriodParam(options.period ?? null);
  const hasOverrides = options.driverOverrides && Object.keys(options.driverOverrides).length > 0;

  try {
    const url = new URL("/api/financial-report", window.location.origin);
    url.searchParams.set("period", period);
    if (options.refresh) url.searchParams.set("refresh", "1");

    const response = hasOverrides
      ? await fetch("/api/financial-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            period,
            refresh: options.refresh === true,
            driverOverrides: options.driverOverrides
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
      report: buildFallbackFinancialReport(period, options.driverOverrides),
      isFallback: true
    };
  }
}
