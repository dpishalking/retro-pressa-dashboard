import { currentPeriodKey } from "@/lib/conversation-periods";
import type { PeriodKey } from "@/types/metrics";

const periodKeys: PeriodKey[] = ["may-2026", "june-2026", "july-2026"];

export function isPeriodKey(value: string): value is PeriodKey {
  return periodKeys.includes(value as PeriodKey);
}

/** Supports `july-2026` and `2026-07` formats. */
export function parsePeriodParam(input: string | null | undefined): PeriodKey {
  if (!input) return currentPeriodKey();
  if (isPeriodKey(input)) return input;

  const isoMatch = input.match(/^(\d{4})-(\d{2})$/);
  if (isoMatch) {
    const month = Number(isoMatch[2]);
    if (month === 5) return "may-2026";
    if (month === 6) return "june-2026";
    if (month === 7) return "july-2026";
  }

  return currentPeriodKey();
}

export function periodToIsoMonth(period: PeriodKey): string {
  if (period === "may-2026") return "2026-05";
  if (period === "june-2026") return "2026-06";
  return "2026-07";
}
