import { buildFallbackCompanySnapshot } from "@/lib/company-snapshot/fallback";
import { computeFinancialReport } from "@/lib/financial-engine/compute";
import type { PeriodKey } from "@/types/metrics";
import { serializeFinancialReport } from "./serialize";
import type { CanonicalFinancialReport } from "./types";

/** Client-safe fallback when API недоступен. Использует тот же FOS, без дублирования формул. */
export function buildFallbackFinancialReport(
  period: PeriodKey = "june-2026",
  driverOverrides?: Partial<Record<string, number>>
): CanonicalFinancialReport {
  const snapshot = buildFallbackCompanySnapshot(period);
  const report = computeFinancialReport(snapshot, { driverOverrides });
  return serializeFinancialReport(report, {
    builtAt: new Date().toISOString(),
    fromCache: false
  });
}
