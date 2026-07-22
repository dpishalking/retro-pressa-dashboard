import type { TrafficType } from "@/config/traffic-os";
import {
  bitrixSourceName,
  classifySourceId,
  classifyUtmPair,
  resolveLeadIdentity,
  type IdentityRuleHit,
  type MappingStatus
} from "@/lib/traffic-os/taxonomy";
import { campaignKey, type RowMap } from "@/lib/traffic-os/utils";

export type SourceMapRow = {
  source_key: string;
  match_type: string;
  match_value: string;
  source_raw: string;
  source_name: string;
  utm_source: string;
  utm_medium: string;
  traffic_type: TrafficType | "";
  channel: string;
  source_group: string;
  is_paid: string;
  mapping_status: MappingStatus | string;
  confidence: string;
  mapping_rule: string;
  comment: string;
  lead_count: string | number;
  updated_at: string;
  sync_updated_at: string;
};

function fromIdentity(
  key: string,
  matchType: string,
  matchValue: string,
  hit: IdentityRuleHit,
  syncedAt: string,
  extras?: Partial<SourceMapRow>
): SourceMapRow {
  return {
    source_key: key,
    match_type: matchType,
    match_value: matchValue,
    source_raw: matchValue,
    source_name: hit.source_name,
    utm_source: extras?.utm_source || "",
    utm_medium: extras?.utm_medium || "",
    traffic_type: hit.traffic_type,
    channel: hit.channel,
    source_group: hit.source_group,
    is_paid: hit.is_paid ? "TRUE" : "FALSE",
    mapping_status: hit.mapping_status,
    confidence: hit.confidence,
    mapping_rule: hit.mapping_rule,
    comment: hit.comment,
    lead_count: extras?.lead_count ?? "",
    updated_at: syncedAt,
    sync_updated_at: syncedAt
  };
}

/**
 * Build Source Map with Bitrix names + derived UTM rules.
 * Preserves rows with mapping_status=manual.
 */
export function buildSourceMapRows(input: {
  sourceIds: string[];
  utmPairs: Array<{ utm_source: string; utm_medium: string; lead_count?: number }>;
  sourceLeadCounts?: Map<string, number>;
  existing?: RowMap[];
  syncedAt: string;
}): SourceMapRow[] {
  const existingByKey = new Map(
    (input.existing || []).map((row) => [String(row.source_key || "").trim(), row])
  );
  const rows: SourceMapRow[] = [];
  const seen = new Set<string>();

  const push = (row: SourceMapRow) => {
    if (seen.has(row.source_key)) return;
    seen.add(row.source_key);
    const prev = existingByKey.get(row.source_key);
    if (prev && String(prev.mapping_status || "").toLowerCase() === "manual" && prev.traffic_type?.trim()) {
      row.traffic_type = prev.traffic_type.trim() as TrafficType;
      row.channel = prev.channel?.trim() || row.channel;
      row.source_group = prev.source_group?.trim() || row.source_group;
      row.is_paid = prev.is_paid?.trim() || row.is_paid;
      row.mapping_status = "manual";
      row.confidence = prev.confidence?.trim() || "high";
      row.mapping_rule = prev.mapping_rule?.trim() || "manual_override";
      row.comment = prev.comment?.trim() || prev.notes || row.comment;
      row.updated_at = prev.updated_at || input.syncedAt;
    }
    rows.push(row);
  };

  for (const sourceId of input.sourceIds) {
    const id = String(sourceId || "").trim();
    if (!id) continue;
    const hit = classifySourceId(id);
    push(
      fromIdentity(`source_id:${id}`, "source_id", id, hit, input.syncedAt, {
        lead_count: input.sourceLeadCounts?.get(id) ?? ""
      })
    );
  }

  for (const pair of input.utmPairs) {
    const s = String(pair.utm_source || "").trim().toLowerCase();
    const m = String(pair.utm_medium || "").trim().toLowerCase();
    if (!s && !m) continue;
    const key = `utm:${s || "-"}|${m || "-"}`;
    const derived = classifyUtmPair(s, m);
    const hit =
      derived ||
      ({
        traffic_type: "unknown",
        channel: "Unknown",
        source_group: "utm_unclassified",
        is_paid: false,
        mapping_status: "unknown",
        confidence: "low",
        mapping_rule: "utm:no_rule",
        comment: "UTM pair observed — no verified/derived rule (left unknown)",
        source_name: `utm:${s}|${m}`
      } satisfies IdentityRuleHit);
    push(
      fromIdentity(key, "utm_pair", `${s}|${m}`, hit, input.syncedAt, {
        utm_source: s,
        utm_medium: m,
        lead_count: pair.lead_count ?? ""
      })
    );
  }

  return rows.sort((a, b) => a.source_key.localeCompare(b.source_key));
}

export function resolveTrafficType(input: {
  sourceId: string;
  utmSource: string;
  utmMedium: string;
  sourceMap: SourceMapRow[];
}): IdentityRuleHit & { method: string } {
  const byKey = new Map(input.sourceMap.map((row) => [row.source_key, row]));
  const sourceKey = `source_id:${String(input.sourceId || "").trim()}`;
  const sourceHit = byKey.get(sourceKey);
  if (sourceHit && String(sourceHit.mapping_status).toLowerCase() === "manual" && sourceHit.traffic_type) {
    return {
      traffic_type: sourceHit.traffic_type as TrafficType,
      channel: sourceHit.channel as IdentityRuleHit["channel"],
      source_group: sourceHit.source_group || "manual",
      is_paid: String(sourceHit.is_paid).toUpperCase() === "TRUE",
      mapping_status: "manual",
      confidence: (sourceHit.confidence as IdentityRuleHit["confidence"]) || "high",
      mapping_rule: sourceHit.mapping_rule || "manual",
      comment: sourceHit.comment,
      source_name: sourceHit.source_name || bitrixSourceName(input.sourceId),
      method: "source_map:manual"
    };
  }

  const hit = resolveLeadIdentity({
    sourceId: input.sourceId,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium
  });
  return {
    ...hit,
    method:
      hit.mapping_rule.startsWith("utm:")
        ? "taxonomy:utm"
        : hit.mapping_status === "verified"
          ? "taxonomy:source_id"
          : "taxonomy:unknown"
  };
}

export function buildCampaignMapRows(input: {
  attributions: Array<{
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    traffic_type: string;
  }>;
  existing?: RowMap[];
  syncedAt: string;
}): Array<Record<string, string>> {
  const existingByKey = new Map(
    (input.existing || []).map((row) => [String(row.campaign_key || "").trim(), row])
  );
  const map = new Map<string, Record<string, string>>();
  for (const row of input.attributions) {
    const key = campaignKey(row);
    if (map.has(key)) continue;
    const prev = existingByKey.get(key);
    map.set(key, {
      campaign_key: key,
      utm_source: row.utm_source,
      utm_medium: row.utm_medium,
      utm_campaign: row.utm_campaign,
      traffic_type: prev?.traffic_type?.trim() || row.traffic_type || "unknown",
      buyer: prev?.buyer || "",
      status: prev?.status || "observed",
      notes: prev?.notes || "",
      updated_at: prev?.updated_at || input.syncedAt,
      sync_updated_at: input.syncedAt
    });
  }
  return [...map.values()].sort((a, b) => a.campaign_key.localeCompare(b.campaign_key));
}

export function attributionQuality(input: {
  traffic_type: string;
  landing_id: string;
  campaign_key: string;
  source_id: string;
  mapping_status: string;
}): { status: string; confidence: string; reason: string } {
  const hasType = input.traffic_type && input.traffic_type !== "unknown";
  const hasLanding = input.landing_id && input.landing_id !== "landing:unknown";
  const hasCampaign = input.campaign_key && input.campaign_key !== "campaign:unknown";
  const hasSource = Boolean(String(input.source_id || "").trim());

  if (String(input.mapping_status).toLowerCase() === "conflict") {
    return { status: "conflict", confidence: "low", reason: "mapping_status=conflict" };
  }
  if (hasType && hasLanding && (hasCampaign || hasSource)) {
    return {
      status: "fully_attributed",
      confidence: "high",
      reason: "traffic_type + landing + source/campaign"
    };
  }
  if (hasType && !hasLanding) {
    return { status: "source_only", confidence: "medium", reason: "traffic_type known, landing missing" };
  }
  if (!hasType && hasLanding) {
    return { status: "landing_only", confidence: "medium", reason: "landing known, traffic_type unknown" };
  }
  if (!hasType && hasCampaign) {
    return { status: "campaign_only", confidence: "low", reason: "campaign present, traffic_type unknown" };
  }
  return { status: "unknown", confidence: "low", reason: "insufficient identity evidence" };
}
