import { countryFromLanguageOrPath, languageFromPath } from "@/lib/traffic-os/country-map";
import { landingUrlFromSourceName } from "@/lib/traffic-os/taxonomy";
import {
  landingIdFromUrl,
  looksLikeUrl,
  parseLandingUrl,
  type RowMap
} from "@/lib/traffic-os/utils";

export type LandingMapRow = {
  landing_id: string;
  url: string;
  domain: string;
  path: string;
  landing_name: string;
  country: string;
  language: string;
  product: string;
  offer: string;
  funnel: string;
  form_name: string;
  owner: string;
  status: string;
  source_evidence: string;
  notes: string;
  updated_at: string;
  sync_updated_at: string;
};

function landingName(domain: string, path: string): string {
  if (!domain) return "";
  return path && path !== "/" ? `${domain}${path}` : domain;
}

/**
 * Build Landing Map from evidence URLs.
 * Missing landings stay status=missing / landing:unknown. No invented URLs.
 */
export function buildLandingMapRows(input: {
  urls: Array<{ url: string; evidence: string; form_name?: string }>;
  existing?: RowMap[];
  syncedAt: string;
}): LandingMapRow[] {
  const existingById = new Map(
    (input.existing || []).map((row) => [String(row.landing_id || "").trim(), row])
  );
  const byId = new Map<string, LandingMapRow>();

  const upsert = (urlRaw: string, evidence: string, formName = "") => {
    if (!looksLikeUrl(urlRaw)) return;
    const parsed = parseLandingUrl(urlRaw);
    if (!parsed) return;
    const landingId = landingIdFromUrl(parsed.url);
    const prev = existingById.get(landingId) || byId.get(landingId);
    const evidenceSet = new Set(
      String(prev?.source_evidence || "")
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean)
    );
    evidenceSet.add(evidence);
    const language = prev?.language?.trim() || languageFromPath(parsed.path);
    const country =
      prev?.country?.trim() || countryFromLanguageOrPath(parsed.path, parsed.domain);
    byId.set(landingId, {
      landing_id: landingId,
      url: prev?.url || parsed.url,
      domain: prev?.domain || parsed.domain,
      path: prev?.path || parsed.path,
      landing_name: prev?.landing_name?.trim() || landingName(parsed.domain, parsed.path),
      country,
      language,
      product: prev?.product || "",
      offer: prev?.offer || "",
      funnel: prev?.funnel || "",
      form_name: prev?.form_name || formName || "",
      owner: prev?.owner || "",
      status: prev?.status || "observed",
      source_evidence: [...evidenceSet].sort().join("|"),
      notes: prev?.notes || "",
      updated_at: prev?.updated_at || input.syncedAt,
      sync_updated_at: input.syncedAt
    });
  };

  for (const item of input.urls) upsert(item.url, item.evidence, item.form_name);

  if (!byId.has("landing:unknown")) {
    byId.set("landing:unknown", {
      landing_id: "landing:unknown",
      url: "",
      domain: "",
      path: "",
      landing_name: "",
      country: "",
      language: "",
      product: "",
      offer: "",
      funnel: "",
      form_name: "",
      owner: "",
      status: "missing",
      source_evidence: "system",
      notes: "Leads without recoverable landing URL",
      updated_at: input.syncedAt,
      sync_updated_at: input.syncedAt
    });
  }

  return [...byId.values()].sort((a, b) => a.landing_id.localeCompare(b.landing_id));
}

/** Scan all likely WEB-carrying fields; first parseable URL wins. */
export function resolveLeadLanding(input: {
  landingUrl?: string;
  sourceDescription?: string;
  web?: string;
  utmContent?: string;
  utmCampaign?: string;
  formName?: string;
  sourceName?: string;
}): { landing_url: string; landing_id: string; domain: string; website: string; evidence: string } {
  const candidates: Array<{ value: string; evidence: string }> = [
    { value: String(input.landingUrl || ""), evidence: "landing_url" },
    { value: String(input.web || ""), evidence: "web" },
    { value: String(input.sourceDescription || ""), evidence: "source_description" },
    { value: landingUrlFromSourceName(String(input.sourceName || "")), evidence: "source_name" },
    { value: String(input.utmContent || ""), evidence: "utm_content" },
    { value: String(input.utmCampaign || ""), evidence: "utm_campaign" }
  ];

  for (const candidate of candidates) {
    const value = candidate.value.trim();
    if (!value || !looksLikeUrl(value)) continue;
    const parsed = parseLandingUrl(value);
    if (!parsed) continue;
    return {
      landing_url: parsed.url,
      landing_id: landingIdFromUrl(parsed.url),
      domain: parsed.domain,
      website: parsed.domain,
      evidence: candidate.evidence
    };
  }

  return {
    landing_url: "",
    landing_id: "landing:unknown",
    domain: "",
    website: "",
    evidence: "missing"
  };
}
