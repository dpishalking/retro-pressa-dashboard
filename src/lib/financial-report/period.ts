import { currentPeriodKey } from "@/lib/conversation-periods";
import type { PeriodKey } from "@/types/metrics";
import { PERIOD_KEYS } from "@/types/metrics";

export function isPeriodKey(value: string): value is PeriodKey {
  return (PERIOD_KEYS as readonly string[]).includes(value);
}

/** Supports `july-2026` / `august-2026` and `2026-07` / `2026-08` formats. */
export function parsePeriodParam(input: string | null | undefined): PeriodKey {
  if (!input) return currentPeriodKey();
  if (isPeriodKey(input)) return input;

  const isoMatch = input.match(/^(\d{4})-(\d{2})$/);
  if (isoMatch) {
    const month = Number(isoMatch[2]);
    if (month === 5) return "may-2026";
    if (month === 6) return "june-2026";
    if (month === 7) return "july-2026";
    if (month === 8) return "august-2026";
  }

  return currentPeriodKey();
}

export function periodToIsoMonth(period: PeriodKey): string {
  if (period === "may-2026") return "2026-05";
  if (period === "june-2026") return "2026-06";
  if (period === "july-2026") return "2026-07";
  return "2026-08";
}
