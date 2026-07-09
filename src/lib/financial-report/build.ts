import { getCompanySnapshot } from "@/lib/company-snapshot/build-snapshot";
import { computeFinancialReport } from "@/lib/financial-engine/compute";
import type { PeriodKey } from "@/types/metrics";
import { serializeFinancialReport } from "./serialize";
import type { CanonicalFinancialReport } from "./types";

export type BuildFinancialReportOptions = {
  period: PeriodKey;
  refresh?: boolean;
  driverOverrides?: Partial<Record<string, number>>;
};

export async function buildCanonicalFinancialReport(
  options: BuildFinancialReportOptions
): Promise<CanonicalFinancialReport> {
  const payload = await getCompanySnapshot({
    period: options.period,
    refresh: options.refresh === true,
    forceRebuild: options.refresh === true
  });

  const report = computeFinancialReport(payload.snapshot, {
    driverOverrides: options.driverOverrides
  });

  return serializeFinancialReport(report, {
    builtAt: payload.builtAt,
    fromCache: payload.fromCache
  });
}
