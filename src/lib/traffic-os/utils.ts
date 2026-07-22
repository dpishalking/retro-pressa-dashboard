import { parseSvodDayDate, parseSvodPlanNumber } from "@/lib/sales-os/svod-plans";
import type { TrafficType } from "@/config/traffic-os";
import { classifySourceId } from "@/lib/traffic-os/taxonomy";

export type RowMap = Record<string, string>;

export function rowsFromSheet(values: string[][]): RowMap[] {
  if (!values.length) return [];
  const [header, ...lines] = values;
  const keys = header.map((cell) => String(cell ?? "").trim());
  return lines
    .map((line) => {
      const row: RowMap = {};
      keys.forEach((key, index) => {
        if (!key) return;
        row[key] = String(line[index] ?? "").trim();
      });
      return row;
    })
    .filter((row) => Object.values(row).some(Boolean));
}

export function toMatrix(
  columns: readonly string[],
  rows: Array<Record<string, string | number>>
): Array<Array<string | number>> {
  return rows.map((row) => columns.map((column) => row[column] ?? ""));
}

export function dayOfIso(iso: string): string {
  const text = String(iso || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return parseSvodDayDate(text) || "";
}

export function periodOfDay(day: string): string {
  return day.length >= 7 ? day.slice(0, 7) : "";
}

export function num(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  return parseSvodPlanNumber(raw) ?? 0;
}

export function pct(numValue: number, den: number): string {
  if (!(den > 0)) return "";
  return Number((numValue / den).toFixed(6)).toString();
}

export function aov(revenue: number, payments: number): string {
  if (!(payments > 0)) return "";
  return Number((revenue / payments).toFixed(2)).toString();
}

export function qualityStatus(fillRatePct: number): string {
  if (fillRatePct >= 90) return "good";
  if (fillRatePct >= 70) return "acceptable";
  if (fillRatePct > 0) return "poor";
  return "empty";
}

export function normalizeUrl(raw: string): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (!/^https?:\/\//i.test(text) && /^[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) {
    return `https://${text}`;
  }
  return text;
}

export function parseLandingUrl(raw: string): { url: string; domain: string; path: string } | null {
  const normalized = normalizeUrl(raw);
  if (!normalized || !/^https?:\/\//i.test(normalized)) return null;
  try {
    const u = new URL(normalized);
    const domain = u.hostname.replace(/^www\./i, "").toLowerCase();
    let path = u.pathname || "/";
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    const url = `${u.protocol}//${domain}${path === "/" ? "" : path}${u.hash || ""}`;
    return { url: url.toLowerCase(), domain, path: path.toLowerCase() };
  } catch {
    return null;
  }
}

export function looksLikeUrl(raw: string): boolean {
  const t = String(raw || "").trim();
  return /^https?:\/\//i.test(t) || /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(t) || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(t);
}

export function landingIdFromUrl(url: string): string {
  const parsed = parseLandingUrl(url);
  if (!parsed) return "landing:unknown";
  const key = `${parsed.domain}${parsed.path === "/" ? "" : parsed.path}`;
  return `landing:${key.replace(/[^a-z0-9._/-]+/gi, "_").slice(0, 120)}`;
}

export function campaignKey(input: {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}): string {
  const s = String(input.utm_source || "").trim().toLowerCase() || "-";
  const m = String(input.utm_medium || "").trim().toLowerCase() || "-";
  const c = String(input.utm_campaign || "").trim().toLowerCase() || "-";
  if (s === "-" && m === "-" && c === "-") return "campaign:unknown";
  return `campaign:${s}|${m}|${c}`;
}

export function isMessengerSourceId(sourceId: string): boolean {
  return /WHATSAPP|TELEGRAM|\bWZ/i.test(sourceId) || classifySourceId(sourceId).channel === "WhatsApp" || classifySourceId(sourceId).channel === "Telegram";
}

export function isExcludedSourceId(sourceId: string): boolean {
  return classifySourceId(sourceId).traffic_type === "excluded";
}

/** Prefer taxonomy catalog; keep signature for older callers. */
export function seedTrafficTypeForSourceId(
  sourceId: string,
  paidSourceIds?: ReadonlySet<string>
): TrafficType {
  const hit = classifySourceId(sourceId);
  if (hit.traffic_type !== "unknown") return hit.traffic_type as TrafficType;
  const id = String(sourceId || "").trim();
  if (paidSourceIds?.has(id)) return "paid";
  return "unknown";
}

export function findHeaderIndex(header: string[], ...aliases: string[]): number {
  const norm = (s: string) =>
    String(s || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const h = header.map(norm);
  for (const alias of aliases) {
    const i = h.indexOf(norm(alias));
    if (i >= 0) return i;
  }
  for (const alias of aliases) {
    const a = norm(alias);
    const i = h.findIndex((x) => x.includes(a));
    if (i >= 0) return i;
  }
  return -1;
}
