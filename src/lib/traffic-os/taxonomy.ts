/**
 * Central Traffic OS identity taxonomy.
 * All classification rules live here — not in sheet formulas.
 *
 * Mapping statuses: verified | derived | manual | unknown | conflict
 * Do not invent traffic_type without evidence.
 */

import { PAID_LEAD_SOURCE_IDS } from "@/lib/bitrix/metric-definitions";

export const TRAFFIC_TYPES_V2 = [
  "paid",
  "organic_social",
  "organic_search",
  "direct",
  "referral",
  "partner",
  "messenger",
  "email",
  "offline",
  "unknown",
  "excluded"
] as const;

export type TrafficTypeV2 = (typeof TRAFFIC_TYPES_V2)[number];

export const CHANNELS = [
  "Meta Ads",
  "Google Ads",
  "Instagram Organic",
  "Telegram",
  "Threads",
  "Website",
  "SEO",
  "Referral",
  "WhatsApp",
  "Email",
  "Direct",
  "Offline",
  "Unknown",
  "Excluded"
] as const;

export type ChannelName = (typeof CHANNELS)[number];

export type MappingStatus = "verified" | "derived" | "manual" | "unknown" | "conflict";

export type IdentityRuleHit = {
  traffic_type: TrafficTypeV2;
  channel: ChannelName;
  source_group: string;
  is_paid: boolean;
  mapping_status: MappingStatus;
  confidence: "high" | "medium" | "low";
  mapping_rule: string;
  comment: string;
  source_name: string;
};

const META_SOURCES = new Set(["facebook", "fb", "instagram", "ig", "meta"]);
const PAID_MEDIA_MEDIUMS = new Set(["cpc", "ppc", "paid", "paid_social", "social_paid"]);
const PAID_SOURCE_ALIASES = new Set(["cpc", "ppc", "paid", "paid_social", "social_paid"]);

function isMetaPlacement(medium: string): boolean {
  const m = medium.toLowerCase();
  return (
    m.startsWith("facebook_") ||
    m.startsWith("instagram_") ||
    m.startsWith("fb_") ||
    m.startsWith("ig_") ||
    /facebook|instagram/.test(m)
  );
}

/** Bitrix crm.status SOURCE catalog (pulled 2026-07-22). */
export const BITRIX_SOURCE_CATALOG: Record<
  string,
  { name: string; rule: IdentityRuleHit | null }
> = {
  UC_GQ92V4: {
    name: "Facebook",
    rule: {
      traffic_type: "paid",
      channel: "Meta Ads",
      source_group: "meta_ads",
      is_paid: true,
      mapping_status: "verified",
      confidence: "high",
      mapping_rule: "bitrix_source:Facebook + PAID_LEAD_SOURCE_IDS",
      comment: "Bitrix SOURCE name Facebook",
      source_name: "Facebook"
    }
  },
  UC_PXE40M: {
    name: "Instagram",
    rule: {
      traffic_type: "paid",
      channel: "Meta Ads",
      source_group: "meta_ads",
      is_paid: true,
      mapping_status: "verified",
      confidence: "high",
      mapping_rule: "bitrix_source:Instagram + PAID_LEAD_SOURCE_IDS",
      comment: "Bitrix SOURCE name Instagram",
      source_name: "Instagram"
    }
  },
  UC_LL4UYE: {
    name: "Facebook comments",
    rule: {
      traffic_type: "paid",
      channel: "Meta Ads",
      source_group: "meta_ads",
      is_paid: true,
      mapping_status: "verified",
      confidence: "high",
      mapping_rule: "bitrix_source:Facebook comments",
      comment: "Paid Meta comments lead form",
      source_name: "Facebook comments"
    }
  },
  UC_61GF35: {
    name: "Instagram Your Story",
    rule: {
      traffic_type: "paid",
      channel: "Meta Ads",
      source_group: "meta_ads",
      is_paid: true,
      mapping_status: "verified",
      confidence: "high",
      mapping_rule: "bitrix_source:Instagram Your Story",
      comment: "Paid Meta Your Story",
      source_name: "Instagram Your Story"
    }
  },
  UC_YY5741: {
    name: "Instagram (хочу узнать)",
    rule: {
      traffic_type: "paid",
      channel: "Meta Ads",
      source_group: "meta_ads",
      is_paid: true,
      mapping_status: "verified",
      confidence: "high",
      mapping_rule: "bitrix_source:Instagram хочу узнать",
      comment: "Paid Meta lead intent",
      source_name: "Instagram (хочу узнать)"
    }
  },
  UC_I4VZXD: {
    name: "WhatsApp",
    rule: {
      traffic_type: "messenger",
      channel: "WhatsApp",
      source_group: "messenger",
      is_paid: false,
      mapping_status: "verified",
      confidence: "high",
      mapping_rule: "bitrix_source:WhatsApp",
      comment: "Bitrix SOURCE name WhatsApp — not paid ads",
      source_name: "WhatsApp"
    }
  },
  UC_MA9866: {
    name: "Telegram retro-pressa",
    rule: {
      traffic_type: "messenger",
      channel: "Telegram",
      source_group: "messenger",
      is_paid: false,
      mapping_status: "verified",
      confidence: "high",
      mapping_rule: "bitrix_source:Telegram retro-pressa",
      comment: "Telegram channel/source",
      source_name: "Telegram retro-pressa"
    }
  },
  UC_LKPUT4: {
    name: "В ручную",
    rule: {
      traffic_type: "offline",
      channel: "Offline",
      source_group: "offline",
      is_paid: false,
      mapping_status: "verified",
      confidence: "high",
      mapping_rule: "bitrix_source:В ручную",
      comment: "Manual CRM entry",
      source_name: "В ручную"
    }
  },
  EMAIL: {
    name: "E-Mail",
    rule: {
      traffic_type: "email",
      channel: "Email",
      source_group: "email",
      is_paid: false,
      mapping_status: "verified",
      confidence: "high",
      mapping_rule: "bitrix_source:E-Mail",
      comment: "Email source",
      source_name: "E-Mail"
    }
  },
  CALL: {
    name: "Call",
    rule: {
      traffic_type: "offline",
      channel: "Offline",
      source_group: "offline",
      is_paid: false,
      mapping_status: "verified",
      confidence: "high",
      mapping_rule: "bitrix_source:Call",
      comment: "Phone call",
      source_name: "Call"
    }
  },
  REPEAT_SALE: {
    name: "Website Retro pressa.by",
    rule: {
      traffic_type: "excluded",
      channel: "Excluded",
      source_group: "excluded",
      is_paid: false,
      mapping_status: "verified",
      confidence: "medium",
      mapping_rule: "bitrix_source:REPEAT_SALE",
      comment: "Operational repeat-sale id (name mentions website.by) — excluded from acquisition traffic",
      source_name: "Website Retro pressa.by"
    }
  },
  // Website / landing-labeled sources: NAME known, traffic_type NOT inferred (need UTM/referrer)
  WEB: {
    name: "Website Retro Pressa.com",
    rule: null
  },
  UC_SLHKKC: { name: "https://retro-pressa.com/ru/new", rule: null },
  UC_RA0GLX: { name: "https://retro-pressa.com/life", rule: null },
  UC_C4W1PZ: { name: "retro-pressa.com/ru/new2", rule: null },
  UC_OS8P3D: { name: "retro-pressa.net", rule: null },
  UC_3YCW0D: { name: "Website Your story", rule: null },
  UC_GZE217: { name: "https://partypagee.com/new2/ru", rule: null },
  UC_MXX4PR: { name: "https://familia-studio.com", rule: null },
  UC_GDD445: { name: "Website Party pagee", rule: null },
  UC_2S0AL0: { name: "https://retro-pressa.com/est/new", rule: null },
  UC_M7Y18M: { name: "https://retro-pressa.com/gifts", rule: null },
  UC_M3HHIH: { name: "https://retro-pressa.com/de/new", rule: null },
  UC_NM0EFI: { name: "Website Vintage Gazeta", rule: null },
  UC_Y40OHA: { name: "Website chat", rule: null },
  UC_LG827Z: { name: "Website Yourstory-inside Partypagee", rule: null },
  UC_F18932: { name: "https://story-passport.com/", rule: null },
  UC_36YK6V: { name: "https://partypagee.com/wedding", rule: null },
  UC_RDKWFH: { name: "https://retro-pressa.com/es/new", rule: null },
  UC_AZMLWL: { name: "retro_pressa_bot", rule: null },
  WEBFORM: { name: "CRM form", rule: null },
  STORE: { name: "Online Store", rule: null },
  BOOKING: { name: "Booking", rule: null },
  CALLBACK: { name: "Callback", rule: null },
  RC_GENERATOR: { name: "Sales boost", rule: null }
};

export function bitrixSourceName(sourceId: string): string {
  const id = String(sourceId || "").trim();
  return BITRIX_SOURCE_CATALOG[id]?.name || id || "(empty)";
}

export function unknownIdentity(sourceName = ""): IdentityRuleHit {
  return {
    traffic_type: "unknown",
    channel: "Unknown",
    source_group: "unknown",
    is_paid: false,
    mapping_status: "unknown",
    confidence: "low",
    mapping_rule: "unknown",
    comment: "No verified/derived evidence",
    source_name: sourceName
  };
}

/** Messenger connector patterns (Wazzup / Telegram bots). */
export function classifyMessengerSourceId(sourceId: string): IdentityRuleHit | null {
  const id = String(sourceId || "").trim();
  if (/WHATSAPP/i.test(id)) {
    return {
      traffic_type: "messenger",
      channel: "WhatsApp",
      source_group: "messenger",
      is_paid: false,
      mapping_status: "verified",
      confidence: "high",
      mapping_rule: "pattern:WHATSAPP",
      comment: "WhatsApp connector id",
      source_name: bitrixSourceName(id) || "WhatsApp"
    };
  }
  if (/TELEGRAM|\bWZ/i.test(id) || /_bot$/i.test(BITRIX_SOURCE_CATALOG[id]?.name || "")) {
    return {
      traffic_type: "messenger",
      channel: "Telegram",
      source_group: "messenger",
      is_paid: false,
      mapping_status: "verified",
      confidence: "high",
      mapping_rule: "pattern:TELEGRAM|WZ",
      comment: "Telegram / Wazzup connector",
      source_name: bitrixSourceName(id) || "Telegram"
    };
  }
  return null;
}

/**
 * Evidence-based UTM classification only.
 * Ambiguous pairs (e.g. medium=social alone) stay unknown.
 */
export function classifyUtmPair(utmSource: string, utmMedium: string): IdentityRuleHit | null {
  const s = String(utmSource || "").trim().toLowerCase();
  const m = String(utmMedium || "").trim().toLowerCase();
  if (!s && !m) return null;

  if (META_SOURCES.has(s) && PAID_MEDIA_MEDIUMS.has(m)) {
    return {
      traffic_type: "paid",
      channel: "Meta Ads",
      source_group: "meta_ads",
      is_paid: true,
      mapping_status: "derived",
      confidence: "high",
      mapping_rule: "utm:meta_source+paid_medium",
      comment: `UTM ${s}/${m} matches Meta paid standard`,
      source_name: `utm:${s}|${m}`
    };
  }

  // Meta Ads often puts placement in utm_source (instagram_reels|cpc, facebook_mobile_feed|cpc)
  if (PAID_MEDIA_MEDIUMS.has(m) && isMetaPlacement(s)) {
    return {
      traffic_type: "paid",
      channel: "Meta Ads",
      source_group: "meta_ads",
      is_paid: true,
      mapping_status: "derived",
      confidence: "high",
      mapping_rule: "utm:meta_placement_source+paid_medium",
      comment: `UTM source is Meta placement (${s}) with paid medium (${m})`,
      source_name: `utm:${s}|${m}`
    };
  }

  // Non-compliant but evidenced Meta placements (source/medium swapped)
  if (PAID_SOURCE_ALIASES.has(s) && isMetaPlacement(m)) {
    return {
      traffic_type: "paid",
      channel: "Meta Ads",
      source_group: "meta_ads",
      is_paid: true,
      mapping_status: "derived",
      confidence: "medium",
      mapping_rule: "utm:swapped_paid_source+meta_placement",
      comment: `Non-compliant UTM (${s}/${m}) but Meta placement evidence`,
      source_name: `utm:${s}|${m}`
    };
  }

  if ((s === "google" || s === "googleads" || s === "adwords") && PAID_MEDIA_MEDIUMS.has(m)) {
    return {
      traffic_type: "paid",
      channel: "Google Ads",
      source_group: "google_ads",
      is_paid: true,
      mapping_status: "derived",
      confidence: "high",
      mapping_rule: "utm:google+paid_medium",
      comment: `UTM ${s}/${m} matches Google paid`,
      source_name: `utm:${s}|${m}`
    };
  }

  if (s === "telegram" && (m === "social" || m === "organic_social" || m === "messenger")) {
    return {
      traffic_type: "organic_social",
      channel: "Telegram",
      source_group: "organic_social",
      is_paid: false,
      mapping_status: "derived",
      confidence: "medium",
      mapping_rule: "utm:telegram+social",
      comment: "Telegram organic social UTM",
      source_name: `utm:${s}|${m}`
    };
  }

  // Explicit organic_social medium only (not bare "social" — ambiguous)
  if (m === "organic_social" && META_SOURCES.has(s)) {
    return {
      traffic_type: "organic_social",
      channel: s.includes("instagram") || s === "ig" ? "Instagram Organic" : "Meta Ads",
      source_group: "organic_social",
      is_paid: false,
      mapping_status: "derived",
      confidence: "medium",
      mapping_rule: "utm:meta+organic_social",
      comment: "Explicit organic_social medium",
      source_name: `utm:${s}|${m}`
    };
  }

  return null;
}

export function classifySourceId(sourceId: string): IdentityRuleHit {
  const id = String(sourceId || "").trim();
  if (!id) return unknownIdentity();

  const catalog = BITRIX_SOURCE_CATALOG[id];
  if (catalog?.rule) return { ...catalog.rule, source_name: catalog.name };

  const messenger = classifyMessengerSourceId(id);
  if (messenger) return messenger;

  if (PAID_LEAD_SOURCE_IDS.includes(id as (typeof PAID_LEAD_SOURCE_IDS)[number])) {
    return {
      traffic_type: "paid",
      channel: "Meta Ads",
      source_group: "meta_ads",
      is_paid: true,
      mapping_status: "verified",
      confidence: "high",
      mapping_rule: "PAID_LEAD_SOURCE_IDS",
      comment: "In paid allow-list",
      source_name: bitrixSourceName(id)
    };
  }

  // Known website/landing SOURCE names — identity known, traffic_type still unknown
  if (catalog) {
    return {
      traffic_type: "unknown",
      channel: "Website",
      source_group: "website_unattributed",
      is_paid: false,
      mapping_status: "unknown",
      confidence: "low",
      mapping_rule: "bitrix_source:named_website_or_landing",
      comment:
        "SOURCE name known (website/landing) but acquisition traffic_type needs UTM/referrer — kept unknown",
      source_name: catalog.name
    };
  }

  return {
    ...unknownIdentity(id),
    comment: "SOURCE_ID not in Bitrix catalog snapshot — unknown"
  };
}

/**
 * Resolve lead identity.
 * Priority: manual map override → verified source_id → derived UTM → unknown.
 */
export function resolveLeadIdentity(input: {
  sourceId: string;
  utmSource: string;
  utmMedium: string;
  manual?: Partial<IdentityRuleHit> | null;
}): IdentityRuleHit {
  if (input.manual?.traffic_type && input.manual.mapping_status === "manual") {
    return {
      traffic_type: input.manual.traffic_type,
      channel: (input.manual.channel as ChannelName) || "Unknown",
      source_group: input.manual.source_group || "manual",
      is_paid: Boolean(input.manual.is_paid),
      mapping_status: "manual",
      confidence: (input.manual.confidence as IdentityRuleHit["confidence"]) || "high",
      mapping_rule: input.manual.mapping_rule || "manual_override",
      comment: input.manual.comment || "Manual Source Map override",
      source_name: input.manual.source_name || bitrixSourceName(input.sourceId)
    };
  }

  const bySource = classifySourceId(input.sourceId);
  if (bySource.traffic_type !== "unknown") return bySource;

  const byUtm = classifyUtmPair(input.utmSource, input.utmMedium);
  if (byUtm) {
    return {
      ...byUtm,
      source_name: bySource.source_name || byUtm.source_name,
      comment: `${byUtm.comment}; source_id=${input.sourceId || "(empty)"} name=${bySource.source_name}`
    };
  }

  return bySource;
}

export function landingUrlFromSourceName(sourceName: string): string {
  const t = String(sourceName || "").trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(t) && t.includes("/")) return `https://${t}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(t)) return `https://${t}`;
  return "";
}
