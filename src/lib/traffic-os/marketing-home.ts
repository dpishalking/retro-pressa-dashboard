/**
 * Marketing Control Layer builders (sheets 30–33).
 * Uses existing Traffic OS aggregates only — no spend APIs / ROAS / forecast.
 */

import {
  DATA_QUALITY_CENTER_COLUMNS,
  MARKETING_HOME_COLUMNS,
  MARKETING_OS_CONTRACT_VERSION,
  MARKETING_TIMELINE_COLUMNS,
  TRAFFIC_HEALTH_WEIGHTS,
  UNKNOWN_CENTER_COLUMNS
} from "@/config/marketing-os";
import { TRAFFIC_MANAGEMENT_THRESHOLDS } from "@/config/traffic-management";
import { classifyUnknownReason } from "@/lib/traffic-os/management";
import { num, pct, toMatrix, type RowMap } from "@/lib/traffic-os/utils";

export type CoverageLike = Record<string, number | string>;

function asNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function computeTrafficHealthScore(input: {
  unknownShare: number; // 0..1
  channelCoverage: number; // 0..1
  landingCoverage: number; // 0..1
  revenueCoverage: number; // 0..1
  brokenUtmShare: number; // 0..1 of leads
  freshnessOk: boolean;
  weights?: typeof TRAFFIC_HEALTH_WEIGHTS;
}): { score: number; components: Record<string, number> } {
  const w = input.weights || TRAFFIC_HEALTH_WEIGHTS;
  const unknownScore = clamp01(1 - input.unknownShare);
  const channelScore = clamp01(input.channelCoverage);
  const landingScore = clamp01(input.landingCoverage);
  const revenueScore = clamp01(input.revenueCoverage);
  const brokenScore = clamp01(1 - input.brokenUtmShare);
  const freshnessScore = input.freshnessOk ? 1 : 0;
  const score =
    100 *
    (w.unknown * unknownScore +
      w.channel_coverage * channelScore +
      w.landing_coverage * landingScore +
      w.revenue_coverage * revenueScore +
      w.broken_utm * brokenScore +
      w.freshness * freshnessScore);
  return {
    score: Number(score.toFixed(1)),
    components: {
      unknown: Number((unknownScore * 100).toFixed(1)),
      channel_coverage: Number((channelScore * 100).toFixed(1)),
      landing_coverage: Number((landingScore * 100).toFixed(1)),
      revenue_coverage: Number((revenueScore * 100).toFixed(1)),
      broken_utm: Number((brokenScore * 100).toFixed(1)),
      freshness: Number((freshnessScore * 100).toFixed(1))
    }
  };
}

export function healthStatusFromScore(score: number): "Healthy" | "Warning" | "Critical" {
  if (score >= 75) return "Healthy";
  if (score >= 50) return "Warning";
  return "Critical";
}

export function entityMonitorStatus(input: {
  trafficType?: string;
  managementStatus?: string;
  sampleSize: number;
  unknownShare?: number;
}): "Healthy" | "Warning" | "Critical" | "Unknown" {
  if (input.trafficType === "unknown" || input.managementStatus === "unknown") return "Unknown";
  if (input.managementStatus === "conflict" || input.managementStatus === "low_coverage") return "Critical";
  if (input.managementStatus === "low_sample" || input.managementStatus === "limited") return "Warning";
  if (input.sampleSize < TRAFFIC_MANAGEMENT_THRESHOLDS.minimumSampleSize) return "Warning";
  if ((input.unknownShare || 0) > TRAFFIC_MANAGEMENT_THRESHOLDS.unknownWarningThreshold) return "Warning";
  return "Healthy";
}

function pushHome(
  rows: Array<Record<string, string | number>>,
  block: string,
  itemId: string,
  itemName: string,
  metricId: string,
  metricName: string,
  value: string | number,
  opts: {
    status?: string;
    priority?: number | string;
    definition?: string;
    source?: string;
    confidence?: string;
    coverage?: number | string;
    owner?: string;
    comment?: string;
    syncedAt: string;
  }
) {
  rows.push({
    block,
    item_id: itemId,
    item_name: itemName,
    metric_id: metricId,
    metric_name: metricName,
    value,
    status: opts.status || "info",
    priority: opts.priority ?? "",
    definition: opts.definition || "",
    source: opts.source || "",
    confidence: opts.confidence || "medium",
    coverage_pct: opts.coverage ?? "",
    owner: opts.owner || "marketing",
    comment: opts.comment || "",
    sync_updated_at: opts.syncedAt
  });
}

export function buildMarketingControlLayer(input: {
  syncedAt: string;
  periods: string[];
  coverageSummary: CoverageLike;
  enrichmentCoverage?: { before: CoverageLike; after: CoverageLike };
  identityCoverage?: { before: CoverageLike; after: CoverageLike };
  attributions: Array<Record<string, string | number>>;
  channelManagement: Array<Record<string, string | number>>;
  landingManagement: Array<Record<string, string | number>>;
  sourceMap: Array<Record<string, string | number>>;
  alerts: Array<Record<string, string | number>>;
  previousAlerts?: RowMap[];
  previousTimeline?: RowMap[];
  previousHomeSnapshot?: RowMap[];
}) {
  const { syncedAt, coverageSummary, attributions, alerts } = input;
  const t = TRAFFIC_MANAGEMENT_THRESHOLDS;
  const totalLeads = attributions.length || 1;
  const unknownShare = asNum(coverageSummary.unknown_share_pct) / 100;
  const channelCoverage = asNum(coverageSummary.channel_coverage_pct) / 100;
  const landingCoverage = asNum(coverageSummary.landing_coverage_pct) / 100;
  const revenueCoverage = asNum(coverageSummary.revenue_coverage_pct) / 100;
  const brokenN = attributions.filter((r) => {
    const s = `${r.utm_source}|${r.utm_medium}`;
    return /\{\{|\}\}/.test(s);
  }).length;
  const brokenShare = brokenN / totalLeads;
  const syncDay = syncedAt.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const freshnessOk = syncDay === today || syncDay === new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const health = computeTrafficHealthScore({
    unknownShare,
    channelCoverage,
    landingCoverage,
    revenueCoverage,
    brokenUtmShare: brokenShare,
    freshnessOk
  });
  const healthStatus = healthStatusFromScore(health.score);

  const home: Array<Record<string, string | number>> = [];

  // --- Traffic Health ---
  pushHome(home, "traffic_health", "score", "Traffic Health Score", "traffic_health_score", "Score 0–100", health.score, {
    status: healthStatus,
    definition: "Weighted: unknown, channel, landing, revenue coverage, broken UTM, freshness. Weights in 01_Settings.",
    source: "coverageSummary + attributions",
    confidence: "medium",
    coverage: asNum(coverageSummary.channel_coverage_pct),
    owner: "marketing_ops",
    syncedAt,
    comment: `weights=${JSON.stringify({
      unknown: TRAFFIC_HEALTH_WEIGHTS.unknown,
      channel: TRAFFIC_HEALTH_WEIGHTS.channel_coverage,
      landing: TRAFFIC_HEALTH_WEIGHTS.landing_coverage,
      revenue: TRAFFIC_HEALTH_WEIGHTS.revenue_coverage,
      broken: TRAFFIC_HEALTH_WEIGHTS.broken_utm,
      freshness: TRAFFIC_HEALTH_WEIGHTS.freshness
    })}; status=${TRAFFIC_HEALTH_WEIGHTS.threshold_status}`
  });
  const healthMetrics: Array<[string, string, string | number, string]> = [
    ["unknown_share", "Unknown %", asNum(coverageSummary.unknown_share_pct), "Share of leads with traffic_type=unknown"],
    ["channel_coverage", "Channel coverage %", asNum(coverageSummary.channel_coverage_pct), "Share with classified traffic_type"],
    ["landing_coverage", "Landing coverage %", asNum(coverageSummary.landing_coverage_pct), "landing_id != landing:unknown"],
    ["revenue_coverage", "Revenue amount coverage %", asNum(coverageSummary.revenue_coverage_pct), "Attributed / Sales calendar revenue"],
    ["payment_linkage", "Payment linkage % (leads)", asNum(coverageSummary.payment_linkage_pct), "Leads with ≥1 attributed payment"],
    ["broken_utm", "Broken UTM macros (leads)", brokenN, "utm contains {{ }}"],
    ["data_freshness", "Data freshness", freshnessOk ? "fresh" : "stale", "Sync day vs today"]
  ];
  for (const [id, name, value, def] of healthMetrics) {
    let status = "Healthy";
    if (id === "unknown_share") {
      status =
        unknownShare >= t.unknownCriticalThreshold
          ? "Critical"
          : unknownShare >= t.unknownWarningThreshold
            ? "Warning"
            : "Healthy";
    } else if (id === "landing_coverage" && landingCoverage < t.minimumLandingCoverage) status = "Warning";
    else if (id === "channel_coverage" && channelCoverage < t.minimumChannelCoverage) status = "Warning";
    else if (id === "revenue_coverage" && revenueCoverage < 0.5) status = "Critical";
    else if (id === "payment_linkage" && asNum(coverageSummary.payment_linkage_pct) / 100 < t.minimumPaymentLinkage)
      status = "Critical";
    else if (id === "broken_utm" && brokenN > 0) status = "Warning";
    else if (id === "data_freshness" && !freshnessOk) status = "Warning";
    pushHome(home, "traffic_health", id, name, id, name, value, {
      status,
      definition: def,
      source: "Traffic OS sync",
      confidence: "medium",
      coverage: asNum(coverageSummary.channel_coverage_pct),
      syncedAt
    });
  }

  // --- Today's Priorities (rule-based, not AI) ---
  const priorities: Array<{ id: string; name: string; status: string; priority: number; comment: string }> = [];
  if (unknownShare >= t.unknownWarningThreshold) {
    priorities.push({
      id: "unknown_high",
      name: "Unknown traffic elevated",
      status: unknownShare >= t.unknownCriticalThreshold ? "Critical" : "Warning",
      priority: 1,
      comment: `Unknown ${(unknownShare * 100).toFixed(1)}% — check 31_Unknown_Center`
    });
  }
  if (landingCoverage < t.minimumLandingCoverage) {
    priorities.push({
      id: "landing_low",
      name: "Landing coverage below threshold",
      status: "Warning",
      priority: 2,
      comment: `Landing ${(landingCoverage * 100).toFixed(1)}% < ${(t.minimumLandingCoverage * 100).toFixed(0)}%`
    });
  }
  if (brokenN > 0) {
    priorities.push({
      id: "broken_macros",
      name: "Broken UTM macros present",
      status: "Warning",
      priority: 3,
      comment: `${brokenN} leads with {{macros}} — исправить UTM`
    });
  }
  if (asNum(coverageSummary.payment_linkage_pct) / 100 < t.minimumPaymentLinkage) {
    priorities.push({
      id: "payment_linkage",
      name: "Payment linkage low",
      status: "Critical",
      priority: 1,
      comment: "Attributed-only funnel limited — see 24_Revenue_Attribution"
    });
  }
  if (revenueCoverage < 0.75) {
    priorities.push({
      id: "revenue_coverage",
      name: "Revenue coverage limited",
      status: "Warning",
      priority: 2,
      comment: `Amount coverage ${(revenueCoverage * 100).toFixed(1)}%`
    });
  }
  const unmappedSources = input.sourceMap.filter((r) => String(r.mapping_status) === "unknown");
  if (unmappedSources.length > 0) {
    priorities.push({
      id: "unmapped_sources",
      name: "Sources without verified mapping",
      status: "Info",
      priority: 4,
      comment: `${unmappedSources.length} Source Map rows still unknown`
    });
  }
  if (!freshnessOk) {
    priorities.push({
      id: "stale_data",
      name: "Sync data may be stale",
      status: "Warning",
      priority: 2,
      comment: `Last sync day ${syncDay}`
    });
  }
  if (!priorities.length) {
    priorities.push({
      id: "all_clear",
      name: "No critical priorities",
      status: "Healthy",
      priority: 9,
      comment: "Continue monitoring Channel/Landing monitors"
    });
  }
  for (const p of priorities.sort((a, b) => a.priority - b.priority)) {
    pushHome(home, "todays_priorities", p.id, p.name, "priority", p.name, p.name, {
      status: p.status,
      priority: p.priority,
      definition: "Rule-based attention list from thresholds (not AI)",
      source: "Marketing Control Layer",
      confidence: "medium",
      comment: p.comment,
      owner: "marketing",
      syncedAt
    });
  }

  // --- Period snapshots ---
  pushHome(home, "today", "sync", "Last sync", "last_sync_at", "Last sync", syncedAt, {
    status: freshnessOk ? "Healthy" : "Warning",
    definition: "ISO timestamp of Traffic OS sync",
    source: "sync",
    syncedAt
  });
  pushHome(home, "this_month", "leads", "Leads in scope", "leads", "Leads", totalLeads, {
    status: "info",
    definition: "CRM leads in sync periods",
    source: "07_CRM_Leads",
    coverage: asNum(coverageSummary.channel_coverage_pct),
    syncedAt,
    comment: `periods=${input.periods.join(",")}`
  });
  pushHome(
    home,
    "this_month",
    "attributed_revenue",
    "Attributed revenue",
    "attributed_paid_revenue",
    "Attributed paid revenue",
    asNum(coverageSummary.attributed_paid_revenue),
    {
      status: revenueCoverage < 0.75 ? "Warning" : "Healthy",
      definition: "Attributed-only; not total Sales revenue",
      source: "24_Revenue_Attribution / enrichment",
      confidence: "medium",
      coverage: asNum(coverageSummary.revenue_coverage_pct),
      syncedAt
    }
  );

  // --- Key changes (from enrichment / identity baselines if present) ---
  const before = input.enrichmentCoverage?.before || input.identityCoverage?.before;
  if (before) {
    const pairs: Array<[string, string, string]> = [
      ["unknown_share_pct", "Unknown %", "unknown_share_pct"],
      ["revenue_amount_coverage_pct", "Revenue coverage %", "revenue_amount_coverage_pct"],
      ["landing_coverage_pct", "Landing coverage %", "landing_coverage_pct"]
    ];
    for (const [id, name, key] of pairs) {
      const prev = asNum((before as CoverageLike)[key] ?? (before as CoverageLike).unknown_pct);
      const cur =
        key === "unknown_share_pct"
          ? asNum(coverageSummary.unknown_share_pct)
          : key === "landing_coverage_pct"
            ? asNum(coverageSummary.landing_coverage_pct)
            : asNum(coverageSummary.revenue_coverage_pct);
      const delta = Number((cur - prev).toFixed(2));
      pushHome(home, "main_changes", id, name, id, name, cur, {
        status: "info",
        definition: "Compared to sprint baseline / previous enrichment baseline",
        source: "IDENTITY_BASELINE / ATTRIBUTION_ENRICHMENT_BASELINE",
        comment: `before=${prev} → after=${cur} (Δ ${delta})`,
        syncedAt
      });
    }
  }

  // --- Wins / problems ---
  pushHome(home, "main_wins", "revenue_coverage", "Revenue coverage improved vs foundation", "win", "Win", "revenue_coverage", {
    status: "Healthy",
    definition: "Amount coverage after Attribution Enrichment",
    source: "enrichment",
    comment: `${asNum(coverageSummary.revenue_coverage_pct)}% amount coverage`,
    syncedAt
  });
  pushHome(home, "main_problems", "payment_linkage", "Lead payment linkage still low", "problem", "Problem", "payment_linkage", {
    status: "Critical",
    definition: "% leads with payment — cohort metric",
    source: "coverageSummary",
    comment: `${asNum(coverageSummary.payment_linkage_pct)}% — do not treat as full funnel`,
    syncedAt
  });

  // --- Channel monitor ---
  const monthChannels = input.channelManagement.filter((r) => r.period_type === "month");
  const channelAgg = new Map<string, { leads: number; status: string; traffic_type: string }>();
  for (const row of monthChannels) {
    const name = String(row.channel_name);
    const cur = channelAgg.get(name) || { leads: 0, status: "Healthy", traffic_type: String(row.traffic_type) };
    cur.leads += asNum(row.leads);
    const st = entityMonitorStatus({
      trafficType: String(row.traffic_type),
      managementStatus: String(row.management_status),
      sampleSize: asNum(row.sample_size || row.leads)
    });
    if (st === "Critical" || (st === "Warning" && cur.status === "Healthy") || st === "Unknown") cur.status = st;
    channelAgg.set(name, cur);
  }
  for (const [name, cur] of [...channelAgg.entries()].sort((a, b) => b[1].leads - a[1].leads).slice(0, 15)) {
    pushHome(home, "channel_monitor", name, name, "leads", "Leads", cur.leads, {
      status: cur.status,
      definition: "Month-grain channel status from management_status + sample rules",
      source: "18_Channel_Management",
      confidence: cur.status === "Unknown" ? "unknown" : "medium",
      coverage: channelCoverage * 100,
      syncedAt,
      comment: `traffic_type=${cur.traffic_type}`
    });
  }

  // --- Landing monitor ---
  const monthLandings = input.landingManagement.filter((r) => r.period_type === "month");
  const landingAgg = new Map<string, { leads: number; status: string; name: string }>();
  for (const row of monthLandings) {
    const id = String(row.landing_id);
    const cur = landingAgg.get(id) || {
      leads: 0,
      status: "Healthy",
      name: String(row.landing_name || id)
    };
    cur.leads += asNum(row.leads);
    const st = entityMonitorStatus({
      trafficType: id === "landing:unknown" ? "unknown" : "classified",
      managementStatus: String(row.management_status),
      sampleSize: asNum(row.sample_size || row.leads)
    });
    if (st === "Critical" || (st === "Warning" && cur.status === "Healthy") || st === "Unknown") cur.status = st;
    landingAgg.set(id, cur);
  }
  for (const [id, cur] of [...landingAgg.entries()].sort((a, b) => b[1].leads - a[1].leads).slice(0, 15)) {
    pushHome(home, "landing_monitor", id, cur.name, "leads", "Leads", cur.leads, {
      status: cur.status,
      definition: "Month-grain landing status; missing landing kept visible",
      source: "19_Landing_Management",
      confidence: id === "landing:unknown" ? "unknown" : "medium",
      coverage: landingCoverage * 100,
      syncedAt
    });
  }

  // --- Source monitor ---
  for (const row of [...input.sourceMap].sort((a, b) => asNum(b.lead_count) - asNum(a.lead_count)).slice(0, 20)) {
    const status =
      String(row.mapping_status) === "unknown"
        ? "Unknown"
        : String(row.mapping_status) === "conflict"
          ? "Critical"
          : String(row.confidence) === "low"
            ? "Warning"
            : "Healthy";
    pushHome(
      home,
      "source_monitor",
      String(row.source_key || row.source_raw),
      String(row.source_name || row.source_raw),
      "lead_count",
      "Leads",
      asNum(row.lead_count),
      {
        status,
        definition: "Source Map mapping_status / confidence",
        source: "02_Source_Map",
        confidence: String(row.confidence || "low"),
        syncedAt,
        comment: `traffic_type=${row.traffic_type}; rule=${row.mapping_rule}`
      }
    );
  }

  // --- Operational status ---
  const ops: Array<[string, string, string]> = [
    ["traffic", "Traffic", healthStatus],
    ["landing_mapping", "Landing Mapping", landingCoverage >= 0.5 ? "Healthy" : "Warning"],
    ["revenue_attribution", "Revenue Attribution", revenueCoverage >= 0.75 ? "Healthy" : "Limited"],
    ["forecast", "Forecast", "Blocked"],
    ["spend_analytics", "Spend Analytics", "Not Connected"]
  ];
  for (const [id, name, status] of ops) {
    pushHome(home, "operational_status", id, name, "status", "Status", status, {
      status,
      definition: "Capability readiness for daily ops",
      source: "Marketing OS",
      confidence: "high",
      syncedAt,
      comment:
        status === "Blocked"
          ? "No predictive layer"
          : status === "Not Connected"
            ? "No Meta/Google Ads API in scope"
            : ""
    });
  }

  // --- Marketing readiness ---
  const readiness: Array<[string, string, string]> = [
    ["foundation", "Foundation", "Ready"],
    ["identity", "Identity", "Ready"],
    ["management", "Management", "Ready"],
    ["attribution", "Attribution Enrichment", "Ready"],
    ["control", "Marketing Control (this sprint)", "Ready"],
    ["spend", "Spend", "Not Connected"],
    ["planning", "Planning", "Blocked"],
    ["forecast", "Forecast", "Blocked"]
  ];
  for (const [id, name, status] of readiness) {
    pushHome(home, "marketing_readiness", id, name, "readiness", "Readiness", status, {
      status: status === "Ready" ? "Healthy" : status === "Blocked" ? "Critical" : "Warning",
      definition: "Layer readiness checklist",
      source: "docs/business-os/MARKETING_OS.md",
      confidence: "high",
      syncedAt
    });
  }

  // --- Definitions block (card contracts) ---
  const defs: Array<[string, string, string, string]> = [
    [
      "traffic_health_score",
      "Traffic Health Score",
      "Weighted composite of coverage/quality components",
      "01_Settings weights"
    ],
    ["unknown_share", "Unknown share", "leads with traffic_type=unknown / all leads", "08_Attribution"],
    [
      "attributed_paid_revenue",
      "Attributed paid revenue",
      "Safe-join attributed payment amounts only",
      "24_Revenue_Attribution"
    ]
  ];
  for (const [id, name, def, source] of defs) {
    pushHome(home, "definitions", id, name, "definition", name, def, {
      status: "info",
      definition: def,
      source,
      confidence: "high",
      owner: "marketing_ops",
      syncedAt
    });
  }

  // --- 31 Unknown Center ---
  const unkBySource = new Map<
    string,
    { leads: number; revenue: number; name: string; reason: string }
  >();
  let unkRevenueTotal = 0;
  for (const row of attributions) {
    if (String(row.traffic_type) !== "unknown") continue;
    const id = String(row.source_id || "(empty)");
    const name = String(row.source_name || id);
    const reason = classifyUnknownReason(row);
    const cur = unkBySource.get(id) || { leads: 0, revenue: 0, name, reason };
    cur.leads += 1;
    cur.revenue += num(row.paid_revenue);
    unkRevenueTotal += num(row.paid_revenue);
    unkBySource.set(id, cur);
  }
  const unknownLeads = attributions.filter((r) => String(r.traffic_type) === "unknown").length;
  const unknownCenter = [...unkBySource.entries()]
    .map(([id, cur]) => {
      const impact = cur.leads / Math.max(unknownLeads, 1) * 0.6 + cur.revenue / Math.max(unkRevenueTotal, 1) * 0.4;
      return {
        rank: 0,
        entity_type: "source",
        entity_id: id,
        entity_name: cur.name,
        leads: cur.leads,
        lead_share_pct: pct(cur.leads, unknownLeads),
        attributed_revenue: Number(cur.revenue.toFixed(2)),
        revenue_share_pct: pct(cur.revenue, unkRevenueTotal || 1),
        impact_score: Number(impact.toFixed(4)),
        reason: cur.reason,
        recommended_action:
          cur.reason === "ambiguous_instagram_social"
            ? "оставить unknown до evidence; исправить UTM medium"
            : cur.reason === "bare_web"
              ? "улучшить UTM на формах WEB"
              : cur.reason === "broken_macro"
                ? "исправить broken macro"
                : "проверить mapping; оставить unknown без догадок",
        owner: "marketing_ops",
        sync_updated_at: syncedAt
      };
    })
    .sort((a, b) => b.impact_score - a.impact_score || b.leads - a.leads)
    .map((row, i) => ({ ...row, rank: i + 1 }));

  // --- 32 Data Quality Center ---
  const prevEnrich = input.enrichmentCoverage?.before;
  const dqRows: Array<Record<string, string | number>> = [
    {
      metric_id: "unknown_share_pct",
      metric_name: "Unknown share %",
      value: asNum(coverageSummary.unknown_share_pct),
      previous_value: asNum(input.identityCoverage?.before.unknown_pct ?? prevEnrich?.unknown_share_pct),
      delta: "",
      status: unknownShare >= t.unknownCriticalThreshold ? "Critical" : unknownShare >= t.unknownWarningThreshold ? "Warning" : "Healthy",
      threshold: t.unknownWarningThreshold * 100,
      definition: "traffic_type=unknown / leads",
      source: "08_Attribution",
      owner: "marketing_ops",
      sync_updated_at: syncedAt
    },
    {
      metric_id: "channel_coverage_pct",
      metric_name: "Channel coverage %",
      value: asNum(coverageSummary.channel_coverage_pct),
      previous_value: asNum(input.identityCoverage?.before.channel_coverage_pct),
      delta: "",
      status: channelCoverage < t.minimumChannelCoverage ? "Warning" : "Healthy",
      threshold: t.minimumChannelCoverage * 100,
      definition: "classified traffic_type share",
      source: "08_Attribution",
      owner: "marketing_ops",
      sync_updated_at: syncedAt
    },
    {
      metric_id: "landing_coverage_pct",
      metric_name: "Landing coverage %",
      value: asNum(coverageSummary.landing_coverage_pct),
      previous_value: asNum(input.identityCoverage?.before.landing_coverage_pct),
      delta: "",
      status: landingCoverage < t.minimumLandingCoverage ? "Warning" : "Healthy",
      threshold: t.minimumLandingCoverage * 100,
      definition: "known landing_id share",
      source: "07_CRM_Leads",
      owner: "marketing_ops",
      sync_updated_at: syncedAt
    },
    {
      metric_id: "revenue_coverage_pct",
      metric_name: "Revenue amount coverage %",
      value: asNum(coverageSummary.revenue_coverage_pct),
      previous_value: asNum(prevEnrich?.revenue_amount_coverage_pct),
      delta: "",
      status: revenueCoverage < 0.5 ? "Critical" : revenueCoverage < 0.75 ? "Warning" : "Healthy",
      threshold: 75,
      definition: "attributed / Sales calendar revenue",
      source: "24_Revenue_Attribution",
      owner: "rop",
      sync_updated_at: syncedAt
    },
    {
      metric_id: "payment_linkage_pct",
      metric_name: "Payment linkage % (leads)",
      value: asNum(coverageSummary.payment_linkage_pct),
      previous_value: asNum(prevEnrich?.payment_linkage_pct),
      delta: "",
      status: asNum(coverageSummary.payment_linkage_pct) / 100 < t.minimumPaymentLinkage ? "Critical" : "Warning",
      threshold: t.minimumPaymentLinkage * 100,
      definition: "leads with payment > 0",
      source: "08_Attribution",
      owner: "rop",
      sync_updated_at: syncedAt
    },
    {
      metric_id: "broken_utm_leads",
      metric_name: "Broken UTM leads",
      value: brokenN,
      previous_value: "",
      delta: "",
      status: brokenN > 0 ? "Warning" : "Healthy",
      threshold: 0,
      definition: "utm fields contain template macros",
      source: "07_CRM_Leads",
      owner: "marketing_ops",
      sync_updated_at: syncedAt
    },
    {
      metric_id: "traffic_health_score",
      metric_name: "Traffic Health Score",
      value: health.score,
      previous_value: "",
      delta: "",
      status: healthStatus,
      threshold: 75,
      definition: "Weighted composite (see Settings)",
      source: "Marketing Control Layer",
      owner: "marketing",
      sync_updated_at: syncedAt
    },
    {
      metric_id: "data_freshness",
      metric_name: "Data freshness",
      value: freshnessOk ? 1 : 0,
      previous_value: "",
      delta: "",
      status: freshnessOk ? "Healthy" : "Warning",
      threshold: 1,
      definition: "1 if sync day is today/yesterday",
      source: "sync_updated_at",
      owner: "marketing_ops",
      sync_updated_at: syncedAt
    }
  ];
  for (const row of dqRows) {
    const prev = row.previous_value === "" ? "" : asNum(row.previous_value);
    const cur = asNum(row.value);
    row.delta = prev === "" ? "" : Number((cur - Number(prev)).toFixed(2));
  }

  // --- Alerts: Critical / Warning / Info / Resolved ---
  const prevAlertIds = new Set((input.previousAlerts || []).map((r) => String(r.alert_id || "").trim()).filter(Boolean));
  const currentAlertIds = new Set(alerts.map((r) => String(r.alert_id || "").trim()).filter(Boolean));
  const marketingAlerts: Array<Record<string, string | number>> = alerts.map((a) => ({
    ...a,
    lifecycle_status: "open",
    bucket: String(a.severity || "info")
  }));
  for (const id of prevAlertIds) {
    if (!currentAlertIds.has(id) && id) {
      const prev = (input.previousAlerts || []).find((r) => String(r.alert_id) === id);
      marketingAlerts.push({
        alert_id: id,
        alert_date: syncedAt.slice(0, 10),
        alert_type: String(prev?.alert_type || "resolved"),
        severity: "info",
        entity_type: String(prev?.entity_type || "traffic_os"),
        entity_id: String(prev?.entity_id || ""),
        entity_name: String(prev?.entity_name || ""),
        metric_id: String(prev?.metric_id || ""),
        actual_value: "",
        threshold: "",
        status: "resolved",
        message: `Resolved: ${prev?.message || id}`,
        recommended_action: "нет действия",
        owner: String(prev?.owner || "marketing_ops"),
        source_updated_at: syncedAt,
        sync_updated_at: syncedAt,
        lifecycle_status: "resolved",
        bucket: "Resolved"
      });
    }
  }
  for (const a of marketingAlerts) {
    const sev = String(a.severity || a.bucket || "info").toLowerCase();
    if (String(a.status) === "resolved" || String(a.lifecycle_status) === "resolved") {
      a.bucket = "Resolved";
    } else if (sev === "critical") a.bucket = "Critical";
    else if (sev === "warning") a.bucket = "Warning";
    else a.bucket = "Info";
  }

  // --- Timeline ---
  const syncRunId = `run:${syncedAt}`;
  const timelineMetrics: Array<{ id: string; name: string; value: number; prev?: number }> = [
    {
      id: "unknown_share_pct",
      name: "Unknown %",
      value: asNum(coverageSummary.unknown_share_pct),
      prev: asNum(input.identityCoverage?.before.unknown_pct)
    },
    {
      id: "revenue_coverage_pct",
      name: "Revenue coverage %",
      value: asNum(coverageSummary.revenue_coverage_pct),
      prev: asNum(prevEnrich?.revenue_amount_coverage_pct)
    },
    {
      id: "landing_coverage_pct",
      name: "Landing coverage %",
      value: asNum(coverageSummary.landing_coverage_pct),
      prev: asNum(input.identityCoverage?.before.landing_coverage_pct)
    },
    {
      id: "channel_coverage_pct",
      name: "Channel coverage %",
      value: asNum(coverageSummary.channel_coverage_pct),
      prev: asNum(input.identityCoverage?.before.channel_coverage_pct)
    },
    {
      id: "traffic_health_score",
      name: "Traffic Health Score",
      value: health.score,
      prev: undefined
    }
  ];

  const newTimelineRows: Array<Record<string, string | number>> = timelineMetrics.map((m) => {
    const prevFromHistory = [...(input.previousTimeline || [])]
      .reverse()
      .find((r) => String(r.metric_id) === m.id && String(r.sync_run_id) !== syncRunId);
    const previous = m.prev != null && m.prev !== 0 ? m.prev : asNum(prevFromHistory?.value);
    const hasPrev = previous !== 0 || prevFromHistory != null || m.prev != null;
    const delta = hasPrev ? Number((m.value - previous).toFixed(2)) : "";
    const direction =
      delta === "" ? "n/a" : Number(delta) > 0 ? "up" : Number(delta) < 0 ? "down" : "flat";
    return {
      event_id: `${syncRunId}|${m.id}`,
      event_at: syncedAt,
      metric_id: m.id,
      metric_name: m.name,
      value: m.value,
      previous_value: hasPrev ? previous : "",
      delta,
      direction,
      note: `contract=${MARKETING_OS_CONTRACT_VERSION}`,
      sync_run_id: syncRunId,
      sync_updated_at: syncedAt
    };
  });

  const previousTimelineFiltered = (input.previousTimeline || []).filter(
    (r) => String(r.sync_run_id) !== syncRunId
  );
  const marketingTimeline = [
    ...previousTimelineFiltered.map((r) => ({
      event_id: r.event_id || "",
      event_at: r.event_at || "",
      metric_id: r.metric_id || "",
      metric_name: r.metric_name || "",
      value: r.value || "",
      previous_value: r.previous_value || "",
      delta: r.delta || "",
      direction: r.direction || "",
      note: r.note || "",
      sync_run_id: r.sync_run_id || "",
      sync_updated_at: r.sync_updated_at || ""
    })),
    ...newTimelineRows
  ].slice(-500);

  return {
    marketingHome: home,
    unknownCenter,
    dataQualityCenter: dqRows,
    marketingTimeline,
    marketingAlerts,
    trafficHealth: { score: health.score, status: healthStatus, components: health.components },
    matrices: {
      marketingHome: toMatrix(MARKETING_HOME_COLUMNS, home),
      unknownCenter: toMatrix(UNKNOWN_CENTER_COLUMNS, unknownCenter),
      dataQualityCenter: toMatrix(DATA_QUALITY_CENTER_COLUMNS, dqRows),
      marketingTimeline: toMatrix(MARKETING_TIMELINE_COLUMNS, marketingTimeline)
    },
    stats: {
      marketingHome: home.length,
      unknownCenter: unknownCenter.length,
      dataQualityCenter: dqRows.length,
      marketingTimeline: marketingTimeline.length,
      marketingAlerts: marketingAlerts.length,
      traffic_health_score: health.score
    }
  };
}

export type MarketingControlModel = ReturnType<typeof buildMarketingControlLayer>;
