import type { PeriodKey } from "@/types/metrics";

export function inferPeriodKeyFromLabel(label: string): PeriodKey | null {
  const text = label.toLowerCase();
  if (/2026-05|2026_05|may-2026|\bмай\b|\bmay\b/.test(text)) return "may-2026";
  if (/2026-06|2026_06|june-2026|\bиюн/.test(text)) return "june-2026";
  if (/2026-07|2026_07|july-2026|\bиюл/.test(text)) return "july-2026";
  return null;
}

export function currentPeriodKey(now = new Date()): PeriodKey {
  const month = now.getUTCMonth() + 1;
  if (month === 5) return "may-2026";
  if (month === 6) return "june-2026";
  return "july-2026";
}

export function periodArchiveFilename(periodKey: PeriodKey) {
  return `archive-${periodKey}.json`;
}

export function livePeriodFilename(periodKey: PeriodKey) {
  return `live-${periodKey}.json`;
}

export function isLivePeriodFilename(filename: string) {
  return /^live-(may|june|july)-2026\.json$/.test(filename);
}

export function isPeriodArchiveFilename(filename: string) {
  return /^archive-(may|june|july)-2026\.json$/.test(filename);
}
