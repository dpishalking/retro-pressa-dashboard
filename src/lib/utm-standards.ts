import { slugifyUtmValue } from "@/lib/utm-generator";

export type UtmComplianceIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
};

export type UtmTagSet = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

const validSourceMediumPairs: Array<{ source: string; medium: string; channel: string }> = [
  { source: "facebook", medium: "paid_social", channel: "Paid Social" },
  { source: "instagram", medium: "paid_social", channel: "Paid Social" },
  { source: "meta", medium: "paid_social", channel: "Paid Social" },
  { source: "tiktok", medium: "paid_social", channel: "Paid Social" },
  { source: "google", medium: "cpc", channel: "Paid Search" },
  { source: "push", medium: "mobile_push", channel: "Mobile Push Notifications" },
  { source: "telegram", medium: "organic_social", channel: "Organic Social" },
  { source: "email", medium: "email", channel: "Email" },
  { source: "blogger", medium: "referral", channel: "Referral" },
  { source: "manager", medium: "chat", channel: "Direct" },
  { source: "whatsapp", medium: "chat", channel: "Direct" }
];

const badSourceValues = new Set([
  "cpc",
  "paid_social",
  "paid",
  "social_paid",
  "ig",
  "fb",
  "th",
  "an"
]);

const badMediumValues = new Set([
  "instagram_reels",
  "instagram_feed",
  "instagram_stories",
  "facebook_mobile_feed",
  "facebook_mobile_reels",
  "paid"
]);

export function normalizeCampaignSlug(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "(not set)" || trimmed === "(direct)" || trimmed === "(referral)" || trimmed === "(organic)") {
    return "";
  }
  return slugifyUtmValue(trimmed);
}

export function campaignsMatch(a?: string | null, b?: string | null) {
  const left = normalizeCampaignSlug(a);
  const right = normalizeCampaignSlug(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export function isCompliantUtmPair(source?: string | null, medium?: string | null) {
  const normalizedSource = slugifyUtmValue(source ?? "");
  const normalizedMedium = slugifyUtmValue(medium ?? "");
  if (!normalizedSource || !normalizedMedium) return false;
  if (badSourceValues.has(normalizedSource)) return false;
  if (badMediumValues.has(normalizedMedium)) return false;
  return validSourceMediumPairs.some((pair) => pair.source === normalizedSource && pair.medium === normalizedMedium);
}

export function auditUtmTags(tags: UtmTagSet): UtmComplianceIssue[] {
  const issues: UtmComplianceIssue[] = [];
  const source = slugifyUtmValue(tags.utm_source ?? "");
  const medium = slugifyUtmValue(tags.utm_medium ?? "");
  const campaign = slugifyUtmValue(tags.utm_campaign ?? "");

  if (!source) issues.push({ level: "error", code: "missing_source", message: "Нет utm_source." });
  if (!medium) issues.push({ level: "error", code: "missing_medium", message: "Нет utm_medium." });
  if (!campaign) issues.push({ level: "error", code: "missing_campaign", message: "Нет utm_campaign." });

  if (source && badSourceValues.has(source)) {
    issues.push({
      level: "error",
      code: "bad_source",
      message: `utm_source="${source}" — это medium/платформа, а не источник. Используйте facebook, instagram, google.`
    });
  }

  if (medium && badMediumValues.has(medium)) {
    issues.push({
      level: "error",
      code: "bad_medium",
      message: `utm_medium="${medium}" — формат Meta, а не стандарт. Используйте paid_social, cpc, mobile_push.`
    });
  }

  if (source && medium && !isCompliantUtmPair(source, medium)) {
    issues.push({
      level: "warning",
      code: "nonstandard_pair",
      message: `Пара ${source}/${medium} не в стандарте Retro Pressa — возможен Unassigned в GA4.`
    });
  }

  if (campaign && !/^\d{4}_\d{2}_/.test(campaign)) {
    issues.push({
      level: "warning",
      code: "legacy_campaign",
      message: `Кампания "${campaign}" не в формате YYYY_MM_topic_market.`
    });
  }

  return issues;
}

export function predictChannelFromUtm(source?: string | null, medium?: string | null) {
  const normalizedSource = slugifyUtmValue(source ?? "");
  const normalizedMedium = slugifyUtmValue(medium ?? "");
  const match = validSourceMediumPairs.find((pair) => pair.source === normalizedSource && pair.medium === normalizedMedium);
  if (match) return match.channel;
  if (normalizedSource === "manager" || normalizedMedium === "chat") return "Direct";
  return "Unassigned";
}

export function managerChatUtm(market = "lv", topic = "gift", landing = "/lv") {
  return {
    baseUrl: `https://retro-pressa.com${landing.startsWith("/") ? landing : `/${landing}`}`,
    utm_source: "manager",
    utm_medium: "chat",
    utm_campaign: campaignNameFromParts(topic, market),
    utm_content: "chat_link",
    utm_term: market
  };
}

export function campaignNameFromParts(topic = "gift", market?: string, date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const marketSuffix = market ? `_${slugifyUtmValue(market)}` : "";
  return `${year}_${month}_${slugifyUtmValue(topic)}${marketSuffix}`;
}

export function extractBitrixWebValue(web: unknown): string {
  if (!web) return "";
  if (typeof web === "string") return web.trim();
  if (Array.isArray(web)) {
    return web
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const record = item as Record<string, unknown>;
        return String(record.VALUE ?? record.value ?? "").trim();
      })
      .filter(Boolean)
      .join(" ");
  }
  if (typeof web === "object") {
    const record = web as Record<string, unknown>;
    return String(record.VALUE ?? record.value ?? "").trim();
  }
  return "";
}
