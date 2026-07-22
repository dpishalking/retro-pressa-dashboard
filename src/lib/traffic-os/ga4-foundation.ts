/**
 * GA4 Foundation builders for Traffic OS warehouse sheets.
 * Uses Analytics Data API only — no ads APIs, no ROAS/CPL.
 */

import {
  GA4_CAMPAIGN_DAILY_COLUMNS,
  GA4_CHANNEL_DAILY_COLUMNS,
  GA4_CHANNEL_GROUP_TO_TRAFFIC_TYPE,
  GA4_DQ_COLUMNS,
  GA4_EVENT_DAILY_COLUMNS,
  GA4_FOUNDATION_CONTRACT_VERSION,
  GA4_LANDING_DAILY_COLUMNS,
  GA4_PAGE_DAILY_COLUMNS,
  GA4_SOURCE_DAILY_COLUMNS
} from "@/config/ga4-foundation";
import { toMatrix, type RowMap } from "@/lib/traffic-os/utils";

type Ga4RunReportResponse = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
  rowCount?: string;
  error?: { message?: string };
};

function toNumber(value?: string) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatGa4Date(raw: string): string {
  if (raw.length === 8) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return raw;
}

function isUnknownSource(source: string, medium: string): boolean {
  const s = source.trim().toLowerCase();
  const m = medium.trim().toLowerCase();
  return !s || s === "(not set)" || s === "(none)" || m === "(not set)";
}

function isUnknownCampaign(campaign: string): boolean {
  const c = campaign.trim().toLowerCase();
  return !c || c === "(not set)" || c === "(direct)" || c === "(organic)" || c === "(referral)";
}

function isUnknownLanding(path: string): boolean {
  const p = path.trim().toLowerCase();
  return !p || p === "(not set)" || p === "(not provided)";
}

export type Ga4FoundationFetchDeps = {
  propertyId: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  runReport: (body: Record<string, unknown>) => Promise<Ga4RunReportResponse>;
};

async function fetchAllRows(
  runReport: Ga4FoundationFetchDeps["runReport"],
  body: Record<string, unknown>,
  pageSize = 25000
): Promise<NonNullable<Ga4RunReportResponse["rows"]>> {
  const rows: NonNullable<Ga4RunReportResponse["rows"]> = [];
  let offset = 0;
  for (;;) {
    const data = await runReport({
      ...body,
      limit: pageSize,
      offset
    });
    const batch = data.rows || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
    if (offset > 500000) break;
  }
  return rows;
}

export async function fetchGa4FoundationFacts(deps: Ga4FoundationFetchDeps) {
  const { startDate, endDate, runReport } = deps;
  const dateRanges = [{ startDate, endDate }];

  const [pageRows, channelRows, sourceRows, campaignRows, landingRows, eventRows, referrerRows] =
    await Promise.all([
      fetchAllRows(runReport, {
        dateRanges,
        dimensions: [{ name: "date" }, { name: "hostName" }, { name: "pagePath" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "engagementRate" },
          { name: "averageSessionDuration" },
          { name: "conversions" }
        ]
      }),
      fetchAllRows(runReport, {
        dateRanges,
        dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "conversions" }
        ]
      }),
      fetchAllRows(runReport, {
        dateRanges,
        dimensions: [{ name: "date" }, { name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "conversions" }
        ]
      }),
      fetchAllRows(runReport, {
        dateRanges,
        dimensions: [
          { name: "date" },
          { name: "sessionCampaignName" },
          { name: "sessionSource" },
          { name: "sessionMedium" }
        ],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "conversions" }
        ]
      }),
      fetchAllRows(runReport, {
        dateRanges,
        dimensions: [{ name: "date" }, { name: "hostName" }, { name: "landingPage" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "engagementRate" },
          { name: "conversions" }
        ]
      }),
      fetchAllRows(runReport, {
        dateRanges,
        dimensions: [{ name: "date" }, { name: "eventName" }],
        metrics: [{ name: "eventCount" }, { name: "totalUsers" }]
      }),
      fetchAllRows(runReport, {
        dateRanges,
        dimensions: [{ name: "sessionSource" }, { name: "pageReferrer" }],
        metrics: [{ name: "sessions" }],
        dimensionFilter: {
          filter: {
            fieldName: "pageReferrer",
            stringFilter: { matchType: "EXACT", value: "(not set)" }
          }
        }
      }).catch(() => [] as NonNullable<Ga4RunReportResponse["rows"]>)
    ]);

  return {
    pageRows,
    channelRows,
    sourceRows,
    campaignRows,
    landingRows,
    eventRows,
    referrerRows
  };
}

export function buildGa4FoundationLayer(input: {
  propertyId: string;
  syncedAt: string;
  startDate: string;
  endDate: string;
  facts: Awaited<ReturnType<typeof fetchGa4FoundationFacts>>;
  crmLeadsByDay?: Map<string, number>;
}) {
  const { propertyId, syncedAt, facts } = input;

  const pageDaily = facts.pageRows.map((row) => {
    const date = formatGa4Date(row.dimensionValues?.[0]?.value || "");
    const host = row.dimensionValues?.[1]?.value || "";
    const path = row.dimensionValues?.[2]?.value || "";
    return {
      date,
      host_name: host,
      page_path: path,
      users: toNumber(row.metricValues?.[0]?.value),
      sessions: toNumber(row.metricValues?.[1]?.value),
      views: toNumber(row.metricValues?.[2]?.value),
      engagement_rate: Number(toNumber(row.metricValues?.[3]?.value).toFixed(6)),
      avg_engagement_time_sec: Number(toNumber(row.metricValues?.[4]?.value).toFixed(2)),
      conversions: toNumber(row.metricValues?.[5]?.value),
      property_id: propertyId,
      sync_updated_at: syncedAt
    };
  });

  const channelDaily = facts.channelRows.map((row) => ({
    date: formatGa4Date(row.dimensionValues?.[0]?.value || ""),
    channel_group: row.dimensionValues?.[1]?.value || "Unassigned",
    users: toNumber(row.metricValues?.[0]?.value),
    sessions: toNumber(row.metricValues?.[1]?.value),
    views: toNumber(row.metricValues?.[2]?.value),
    conversions: toNumber(row.metricValues?.[3]?.value),
    property_id: propertyId,
    sync_updated_at: syncedAt
  }));

  const sourceDaily = facts.sourceRows.map((row) => ({
    date: formatGa4Date(row.dimensionValues?.[0]?.value || ""),
    source: row.dimensionValues?.[1]?.value || "(not set)",
    medium: row.dimensionValues?.[2]?.value || "(not set)",
    users: toNumber(row.metricValues?.[0]?.value),
    sessions: toNumber(row.metricValues?.[1]?.value),
    views: toNumber(row.metricValues?.[2]?.value),
    conversions: toNumber(row.metricValues?.[3]?.value),
    property_id: propertyId,
    sync_updated_at: syncedAt
  }));

  const campaignDaily = facts.campaignRows.map((row) => ({
    date: formatGa4Date(row.dimensionValues?.[0]?.value || ""),
    campaign: row.dimensionValues?.[1]?.value || "(not set)",
    source: row.dimensionValues?.[2]?.value || "(not set)",
    medium: row.dimensionValues?.[3]?.value || "(not set)",
    users: toNumber(row.metricValues?.[0]?.value),
    sessions: toNumber(row.metricValues?.[1]?.value),
    views: toNumber(row.metricValues?.[2]?.value),
    conversions: toNumber(row.metricValues?.[3]?.value),
    property_id: propertyId,
    sync_updated_at: syncedAt
  }));

  const landingDaily = facts.landingRows.map((row) => {
    const host = row.dimensionValues?.[1]?.value || "";
    const path = row.dimensionValues?.[2]?.value || "(not set)";
    return {
      date: formatGa4Date(row.dimensionValues?.[0]?.value || ""),
      host_name: host,
      landing_path: path,
      landing_url: host && path && path !== "(not set)" ? `https://${host}${path}` : "",
      users: toNumber(row.metricValues?.[0]?.value),
      sessions: toNumber(row.metricValues?.[1]?.value),
      views: toNumber(row.metricValues?.[2]?.value),
      engagement_rate: Number(toNumber(row.metricValues?.[3]?.value).toFixed(6)),
      conversions: toNumber(row.metricValues?.[4]?.value),
      property_id: propertyId,
      sync_updated_at: syncedAt
    };
  });

  const eventDaily = facts.eventRows.map((row) => ({
    date: formatGa4Date(row.dimensionValues?.[0]?.value || ""),
    event_name: row.dimensionValues?.[1]?.value || "(not set)",
    event_count: toNumber(row.metricValues?.[0]?.value),
    users: toNumber(row.metricValues?.[1]?.value),
    property_id: propertyId,
    sync_updated_at: syncedAt
  }));

  const totalSessions = sourceDaily.reduce((s, r) => s + r.sessions, 0) || 1;
  const unknownSourceSessions = sourceDaily
    .filter((r) => isUnknownSource(r.source, r.medium))
    .reduce((s, r) => s + r.sessions, 0);
  const unknownCampaignSessions = campaignDaily
    .filter((r) => isUnknownCampaign(r.campaign))
    .reduce((s, r) => s + r.sessions, 0);
  const unknownLandingSessions = landingDaily
    .filter((r) => isUnknownLanding(r.landing_path))
    .reduce((s, r) => s + r.sessions, 0);
  const missingUtmSessions = sourceDaily
    .filter((r) => {
      const s = r.source.toLowerCase();
      const m = r.medium.toLowerCase();
      return s === "(direct)" || m === "(none)" || s === "(not set)" || m === "(not set)";
    })
    .reduce((s, r) => s + r.sessions, 0);

  const generateLead = eventDaily
    .filter((r) => r.event_name === "generate_lead")
    .reduce((s, r) => s + r.event_count, 0);
  const crmLeads = [...(input.crmLeadsByDay?.values() || [])].reduce((s, n) => s + n, 0);

  const dq = (
    id: string,
    name: string,
    value: number,
    den: number,
    definition: string,
    status?: string
  ) => {
    const share = den > 0 ? value / den : 0;
    return {
      metric_id: id,
      metric_name: name,
      value,
      denominator: den,
      share_pct: Number((share * 100).toFixed(2)),
      status:
        status ||
        (share >= 0.35 ? "Critical" : share >= 0.15 ? "Warning" : "Healthy"),
      definition,
      source: "GA4 Data API",
      sync_updated_at: syncedAt
    };
  };

  const dataQuality = [
    dq(
      "unknown_source_sessions",
      "Unknown / not-set source sessions",
      unknownSourceSessions,
      totalSessions,
      "source/medium empty|(not set)|(none)"
    ),
    dq(
      "unknown_campaign_sessions",
      "Unknown campaign sessions",
      unknownCampaignSessions,
      totalSessions,
      "campaign (not set)|(direct)|(organic)|(referral)"
    ),
    dq(
      "unknown_landing_sessions",
      "Unknown landing sessions",
      unknownLandingSessions,
      totalSessions,
      "landingPage (not set)"
    ),
    dq(
      "missing_utm_like_sessions",
      "Direct / missing UTM-like sessions",
      missingUtmSessions,
      totalSessions,
      "direct/(none) or not set source medium"
    ),
    {
      metric_id: "generate_lead_events",
      metric_name: "GA4 generate_lead events",
      value: generateLead,
      denominator: crmLeads || generateLead,
      share_pct: crmLeads ? Number(((generateLead / crmLeads) * 100).toFixed(2)) : "",
      status: "info",
      definition: "GA4 generate_lead count vs CRM leads in same periods (soft, not user join)",
      source: "GA4 event + Sales OS leads",
      sync_updated_at: syncedAt
    },
    {
      metric_id: "crm_leads",
      metric_name: "CRM leads in periods",
      value: crmLeads,
      denominator: crmLeads,
      share_pct: 100,
      status: "info",
      definition: "Traffic OS CRM leads count for sync periods",
      source: "07_CRM_Leads",
      sync_updated_at: syncedAt
    },
    {
      metric_id: "crm_link_coverage",
      metric_name: "Hard CRM↔GA4 identity coverage",
      value: 0,
      denominator: crmLeads || 1,
      share_pct: 0,
      status: "Critical",
      definition: "client_id/session_id/gclid/fbclid hard join — not available in CRM",
      source: "audit",
      sync_updated_at: syncedAt
    },
    {
      metric_id: "soft_landing_date_link",
      metric_name: "Soft link readiness (landing×date)",
      value: landingDaily.filter((r) => !isUnknownLanding(r.landing_path)).length,
      denominator: landingDaily.length || 1,
      share_pct: landingDaily.length
        ? Number(
            (
              (landingDaily.filter((r) => !isUnknownLanding(r.landing_path)).length /
                landingDaily.length) *
              100
            ).toFixed(2)
          )
        : 0,
      status: "Warning",
      definition: "Aggregate-only; not user-level attribution",
      source: "34_GA4_Landing_Daily",
      sync_updated_at: syncedAt
    },
    {
      metric_id: "property_id",
      metric_name: "GA4 property",
      value: propertyId,
      denominator: "",
      share_pct: "",
      status: "info",
      definition: `contract=${GA4_FOUNDATION_CONTRACT_VERSION}`,
      source: "env GA4_PROPERTY_ID",
      sync_updated_at: syncedAt
    },
    {
      metric_id: "total_sessions",
      metric_name: "Total sessions (source grain)",
      value: totalSessions === 1 && sourceDaily.length === 0 ? 0 : totalSessions,
      denominator: "",
      share_pct: "",
      status: "info",
      definition: "Sum of sessions in 28_GA4_Source_Daily",
      source: "GA4",
      sync_updated_at: syncedAt
    }
  ];

  // Map candidates — unknown, never auto-classified
  const sourceCandidates = new Map<string, { source: string; medium: string; sessions: number }>();
  for (const row of sourceDaily) {
    const key = `${row.source}|${row.medium}`;
    const cur = sourceCandidates.get(key) || { source: row.source, medium: row.medium, sessions: 0 };
    cur.sessions += row.sessions;
    sourceCandidates.set(key, cur);
  }

  const landingCandidates = new Map<
    string,
    { host: string; path: string; url: string; sessions: number }
  >();
  for (const row of landingDaily) {
    if (isUnknownLanding(row.landing_path)) continue;
    const key = row.landing_url || `${row.host_name}${row.landing_path}`;
    const cur = landingCandidates.get(key) || {
      host: row.host_name,
      path: row.landing_path,
      url: row.landing_url,
      sessions: 0
    };
    cur.sessions += row.sessions;
    landingCandidates.set(key, cur);
  }

  const campaignCandidates = new Map<
    string,
    { campaign: string; source: string; medium: string; sessions: number }
  >();
  for (const row of campaignDaily) {
    if (isUnknownCampaign(row.campaign)) continue;
    const key = `${row.campaign}|${row.source}|${row.medium}`;
    const cur = campaignCandidates.get(key) || {
      campaign: row.campaign,
      source: row.source,
      medium: row.medium,
      sessions: 0
    };
    cur.sessions += row.sessions;
    campaignCandidates.set(key, cur);
  }

  const sessionsByTrafficTypeDate = new Map<string, number>();
  for (const row of channelDaily) {
    const trafficType = GA4_CHANNEL_GROUP_TO_TRAFFIC_TYPE[row.channel_group] || "unknown";
    const key = `${row.date}|${trafficType}`;
    sessionsByTrafficTypeDate.set(key, (sessionsByTrafficTypeDate.get(key) || 0) + row.sessions);
  }

  const reconciliation = [
    {
      check_id: "ga4_generate_lead_vs_crm_leads",
      period: `${input.startDate}:${input.endDate}`,
      metric: "leads_soft",
      traffic_os_value: crmLeads,
      sales_os_value: crmLeads,
      ga4_value: generateLead,
      delta: Number((generateLead - crmLeads).toFixed(2)),
      delta_pct: crmLeads ? Number((((generateLead - crmLeads) / crmLeads) * 100).toFixed(2)) : "",
      status: "different_definition",
      explanation:
        "difference_reason=ga4_generate_lead_vs_bitrix_leads; not user-level join; forms/events ≠ CRM create",
      sync_updated_at: syncedAt
    },
    {
      check_id: "ga4_hard_identity_join",
      period: `${input.startDate}:${input.endDate}`,
      metric: "identity_coverage",
      traffic_os_value: 0,
      sales_os_value: crmLeads,
      ga4_value: 0,
      delta: -crmLeads,
      delta_pct: -100,
      status: "blocked",
      explanation: "difference_reason=no_client_id_in_crm; need form→Bitrix ga_client_id",
      sync_updated_at: syncedAt
    }
  ];

  return {
    pageDaily,
    channelDaily,
    sourceDaily,
    campaignDaily,
    landingDaily,
    eventDaily,
    dataQuality,
    sourceCandidates: [...sourceCandidates.values()],
    landingCandidates: [...landingCandidates.values()],
    campaignCandidates: [...campaignCandidates.values()],
    sessionsByTrafficTypeDate,
    reconciliation,
    coverage: {
      hard_crm_link_pct: 0,
      soft_landing_rows_pct: dataQuality.find((d) => d.metric_id === "soft_landing_date_link")
        ?.share_pct,
      unknown_source_share_pct: Number(((unknownSourceSessions / totalSessions) * 100).toFixed(2)),
      generate_lead_events: generateLead,
      crm_leads: crmLeads,
      property_id: propertyId
    },
    matrices: {
      pageDaily: toMatrix(GA4_PAGE_DAILY_COLUMNS, pageDaily),
      channelDaily: toMatrix(GA4_CHANNEL_DAILY_COLUMNS, channelDaily),
      sourceDaily: toMatrix(GA4_SOURCE_DAILY_COLUMNS, sourceDaily),
      campaignDaily: toMatrix(GA4_CAMPAIGN_DAILY_COLUMNS, campaignDaily),
      landingDaily: toMatrix(GA4_LANDING_DAILY_COLUMNS, landingDaily),
      eventDaily: toMatrix(GA4_EVENT_DAILY_COLUMNS, eventDaily),
      dataQuality: toMatrix(GA4_DQ_COLUMNS, dataQuality as Array<Record<string, string | number>>)
    },
    stats: {
      pageDaily: pageDaily.length,
      channelDaily: channelDaily.length,
      sourceDaily: sourceDaily.length,
      campaignDaily: campaignDaily.length,
      landingDaily: landingDaily.length,
      eventDaily: eventDaily.length,
      dataQuality: dataQuality.length
    }
  };
}

export function mergeGa4MapCandidates(input: {
  existingSourceMap: RowMap[];
  existingLandingMap: RowMap[];
  existingCampaignMap: RowMap[];
  sourceCandidates: Array<{ source: string; medium: string; sessions: number }>;
  landingCandidates: Array<{ host: string; path: string; url: string; sessions: number }>;
  campaignCandidates: Array<{
    campaign: string;
    source: string;
    medium: string;
    sessions: number;
  }>;
  syncedAt: string;
}): {
  sourceMapExtra: Array<Record<string, string | number>>;
  landingMapExtra: Array<Record<string, string | number>>;
  campaignMapExtra: Array<Record<string, string | number>>;
} {
  const existingSourceKeys = new Set(
    input.existingSourceMap.map(
      (r) =>
        `${String(r.utm_source || "").toLowerCase()}|${String(r.utm_medium || "").toLowerCase()}`
    )
  );
  const existingLandingUrls = new Set(
    input.existingLandingMap.map((r) => String(r.url || r.landing_id || "").toLowerCase())
  );
  const existingCampaignKeys = new Set(
    input.existingCampaignMap.map(
      (r) =>
        `${String(r.utm_campaign || "").toLowerCase()}|${String(r.utm_source || "").toLowerCase()}|${String(r.utm_medium || "").toLowerCase()}`
    )
  );

  const sourceMapExtra: Array<Record<string, string | number>> = [];
  for (const c of input.sourceCandidates) {
    const key = `${c.source.toLowerCase()}|${c.medium.toLowerCase()}`;
    if (existingSourceKeys.has(key)) continue;
    if (isUnknownSource(c.source, c.medium)) continue;
    sourceMapExtra.push({
      source_key: `ga4:${c.source}|${c.medium}`,
      match_type: "utm_pair",
      match_value: `${c.source}|${c.medium}`,
      source_raw: c.source,
      source_name: c.source,
      utm_source: c.source,
      utm_medium: c.medium,
      traffic_type: "unknown",
      channel: "unknown",
      source_group: "ga4_observed",
      is_paid: "",
      mapping_status: "unknown",
      confidence: "unknown",
      mapping_rule: "ga4_foundation_observed",
      comment: `Observed in GA4; sessions=${c.sessions}; not auto-classified`,
      lead_count: 0,
      updated_at: input.syncedAt,
      sync_updated_at: input.syncedAt
    });
  }

  const landingMapExtra: Array<Record<string, string | number>> = [];
  for (const c of input.landingCandidates) {
    const url = c.url.toLowerCase();
    if (!url || existingLandingUrls.has(url)) continue;
    landingMapExtra.push({
      landing_id: `landing:ga4:${c.host}${c.path}`,
      url: c.url,
      domain: c.host,
      path: c.path,
      landing_name: c.path,
      country: "",
      language: "",
      product: "",
      offer: "",
      funnel: "",
      form_name: "",
      owner: "marketing_ops",
      status: "observed_ga4",
      source_evidence: "ga4_foundation",
      notes: `sessions=${c.sessions}; unknown classification pending`,
      updated_at: input.syncedAt,
      sync_updated_at: input.syncedAt
    });
  }

  const campaignMapExtra: Array<Record<string, string | number>> = [];
  for (const c of input.campaignCandidates) {
    const key = `${c.campaign.toLowerCase()}|${c.source.toLowerCase()}|${c.medium.toLowerCase()}`;
    if (existingCampaignKeys.has(key)) continue;
    campaignMapExtra.push({
      campaign_key: `ga4:${c.source}|${c.medium}|${c.campaign}`,
      utm_source: c.source,
      utm_medium: c.medium,
      utm_campaign: c.campaign,
      traffic_type: "unknown",
      buyer: "",
      status: "observed_ga4",
      notes: `sessions=${c.sessions}; not auto-classified`,
      updated_at: input.syncedAt,
      sync_updated_at: input.syncedAt
    });
  }

  return { sourceMapExtra, landingMapExtra, campaignMapExtra };
}

export type Ga4FoundationModel = ReturnType<typeof buildGa4FoundationLayer>;
