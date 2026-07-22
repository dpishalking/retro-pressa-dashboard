import { createHash } from "node:crypto";

/**
 * Sales funnel = Bitrix CATEGORY_ID 0.
 * Other funnels use stage ids like C4:WON.
 */
export function isSalesFunnelDeal(input: {
  categoryId?: string | null;
  stageId?: string | null;
}): boolean {
  const category = String(input.categoryId ?? "").trim();
  if (category && category !== "0") return false;
  const stage = String(input.stageId ?? "").trim();
  if (/^C[1-9]\d*:/i.test(stage)) return false;
  return true;
}

export function parseSheetNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const normalized = String(value).replace(/\s/g, "").replace(",", ".");
  // Sheets sometimes stores "47," 
  const cleaned = normalized.replace(/\.$/, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function dayKeyFromIso(value: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const ts = Date.parse(trimmed);
  if (!Number.isFinite(ts)) return "";
  return new Date(ts).toISOString().slice(0, 10);
}

export function inCalendarMonth(iso: string, month: string): boolean {
  const day = dayKeyFromIso(iso);
  return Boolean(day && day.startsWith(month));
}

export function stableIdListHash(ids: string[]): string {
  return createHash("sha256").update([...ids].sort().join(",")).digest("hex").slice(0, 12);
}
