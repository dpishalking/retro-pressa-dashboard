import { QUALITY_THRESHOLDS } from "@/config/sales-foundation";
import { createHash } from "node:crypto";
import {
  normalizeEmail,
  normalizePhone,
  resolveCustomerIdentity,
  type CustomerIdentityInput,
  type ResolvedCustomerKey
} from "@/lib/os-sheets/customer-identity";

export { normalizeEmail, normalizePhone, resolveCustomerIdentity };
export type { CustomerIdentityInput, ResolvedCustomerKey };

/** Prefer first non-empty normalized phone; hash is sha256 of that value. */
export function pickStablePhoneHash(phones: Array<string | null | undefined>): {
  count: number;
  hash: string;
  present: boolean;
} {
  const normalized = phones.map((p) => normalizePhone(p)).filter((p): p is string => Boolean(p));
  normalized.sort();
  const primary = normalized[0] || "";
  return {
    count: normalized.length,
    present: normalized.length > 0,
    hash: primary ? `phone:${createHash("sha256").update(primary).digest("hex")}` : ""
  };
}

export function pickStableEmailHash(emails: Array<string | null | undefined>): {
  count: number;
  hash: string;
  present: boolean;
} {
  const normalized = emails.map((e) => normalizeEmail(e)).filter((e): e is string => Boolean(e));
  normalized.sort();
  const primary = normalized[0] || "";
  return {
    count: normalized.length,
    present: normalized.length > 0,
    hash: primary ? `email:${createHash("sha256").update(primary).digest("hex")}` : ""
  };
}

export function resolveSfCustomerKey(input: CustomerIdentityInput): ResolvedCustomerKey {
  return resolveCustomerIdentity(input);
}

export function multiValue(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => {
      if (item && typeof item === "object" && "VALUE" in item) return [String((item as { VALUE?: string }).VALUE || "")];
      return [String(item)];
    }).filter(Boolean);
  }
  if (typeof raw === "object" && raw && "VALUE" in raw) {
    return [String((raw as { VALUE?: string }).VALUE || "")].filter(Boolean);
  }
  const text = String(raw).trim();
  return text ? [text] : [];
}

export function asBoolFlag(value: unknown): string {
  if (value === true || value === "Y" || value === "1" || value === 1) return "true";
  if (value === false || value === "N" || value === "0" || value === 0) return "false";
  return "";
}

export function asString(value: unknown): string {
  if (value == null) return "";
  const text = String(value).trim();
  return text;
}

export function asNumberString(value: unknown): string {
  if (value == null || value === "") return "";
  const n = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? String(n) : "";
}

export function periodToRange(period: string): { startIso: string; endIso: string; periodKey: string } {
  // Accept 2026-05 or may-2026
  let year = 2026;
  let month = 7;
  const iso = period.match(/^(\d{4})-(\d{2})$/);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
  } else if (period === "may-2026") month = 5;
  else if (period === "june-2026") month = 6;
  else if (period === "july-2026") month = 7;

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  const periodKey = `${year}-${String(month).padStart(2, "0")}`;
  return { startIso: start.toISOString(), endIso: end.toISOString(), periodKey };
}

export function qualityStatus(fillRatePct: number | null): string {
  if (fillRatePct == null || Number.isNaN(fillRatePct)) return "unknown";
  if (fillRatePct >= QUALITY_THRESHOLDS.good) return "good";
  if (fillRatePct >= QUALITY_THRESHOLDS.acceptable) return "acceptable";
  if (fillRatePct >= QUALITY_THRESHOLDS.poor) return "poor";
  return "critical";
}

export function classifyActivityGroup(providerId: string, typeId: string): string {
  const p = providerId.toUpperCase();
  const t = String(typeId);
  if (p.includes("IMOPENLINES") || p.includes("OPENLINE")) return "open_line";
  if (p.includes("CALL") || t === "2") return "call";
  if (p.includes("EMAIL") || p.includes("MAIL") || t === "4") return "email";
  if (p.includes("TASK") || t === "6") return "task";
  if (p.includes("MEETING") || t === "1") return "meeting";
  return "other";
}

export function deterministicEventId(parts: string[]): string {
  return parts.map((p) => String(p || "").trim()).join("|");
}

export async function loadUserNames(ids: string[]): Promise<Map<string, string>> {
  const { bitrixBatch, chunkIds } = await import("@/lib/bitrix/rest-client");
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  for (const chunk of chunkIds(unique, 50)) {
    const cmd: Record<string, string> = {};
    chunk.forEach((id, index) => {
      cmd[`u${index}`] = `user.get?ID=${encodeURIComponent(id)}`;
    });
    const result = await bitrixBatch<Array<{ ID?: string; NAME?: string; LAST_NAME?: string }> | { ID?: string; NAME?: string; LAST_NAME?: string }>(cmd);
    for (const value of Object.values(result)) {
      const user = Array.isArray(value) ? value[0] : value;
      if (!user?.ID) continue;
      map.set(String(user.ID), `${user.NAME || ""} ${user.LAST_NAME || ""}`.trim() || `ID ${user.ID}`);
    }
  }
  return map;
}
