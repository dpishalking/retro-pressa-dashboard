import {
  utmMediumPresets,
  utmRequiredFields,
  utmSourcePresets,
  type UtmField
} from "@/config/utm-taxonomy";
import { campaignNameFromParts, isCompliantUtmPair, predictChannelFromUtm } from "@/lib/utm-standards";

export type UtmParams = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
};

export type UtmValidationIssue = {
  field?: UtmField;
  level: "error" | "warning";
  message: string;
};

const utmFieldKeys: UtmField[] = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

export function slugifyUtmValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function normalizeBaseUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return url.toString().replace(/\/$/, "") + (url.pathname === "/" ? "/" : "");
  } catch {
    return "";
  }
}

export function buildUtmUrl(baseUrl: string, params: Partial<UtmParams>) {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  if (!normalizedBase) return "";

  const url = new URL(normalizedBase.endsWith("/") && normalizedBase !== "https://" ? normalizedBase : normalizedBase.replace(/\/$/, "") || normalizedBase);
  if (!url.pathname) url.pathname = "/";

  utmFieldKeys.forEach((key) => {
    const value = slugifyUtmValue(params[key] ?? "");
    if (value) url.searchParams.set(key, value);
  });

  return url.toString();
}

export function predictGa4Channel(source: string, medium: string) {
  const channel = predictChannelFromUtm(source, medium);
  if (channel !== "Unassigned") return channel;
  const normalizedSource = slugifyUtmValue(source);
  const normalizedMedium = slugifyUtmValue(medium);
  const sourcePreset = utmSourcePresets.find((item) => item.value === normalizedSource);
  const mediumPreset = utmMediumPresets.find((item) => item.value === normalizedMedium);
  return mediumPreset?.ga4Channel || sourcePreset?.ga4Channel || "Unassigned / проверьте метки";
}

export function validateUtmParams(baseUrl: string, params: Partial<UtmParams>): UtmValidationIssue[] {
  const issues: UtmValidationIssue[] = [];

  if (!normalizeBaseUrl(baseUrl)) {
    issues.push({ level: "error", message: "Укажите корректный URL сайта или лендинга." });
  }

  utmRequiredFields.forEach((field) => {
    if (!slugifyUtmValue(params[field] ?? "")) {
      issues.push({ field, level: "error", message: `Поле ${field} обязательно.` });
    }
  });

  utmFieldKeys.forEach((field) => {
    const raw = params[field] ?? "";
    if (!raw.trim()) return;
    const slug = slugifyUtmValue(raw);
    if (raw !== slug && /[A-Z\s]/.test(raw)) {
      issues.push({
        field,
        level: "warning",
        message: `${field}: лучше использовать латиницу и нижнее подчёркивание (будет: ${slug}).`
      });
    }
  });

  if (params.utm_source && params.utm_medium && !isCompliantUtmPair(params.utm_source, params.utm_medium)) {
    issues.push({
      level: "warning",
      message: "Такая пара source/medium может попасть в Unassigned. Выберите значения из списка."
    });
  }

  return issues;
}

export function campaignNameSuggestion(market?: string, topic = "gift") {
  return campaignNameFromParts(topic, market);
}
