import { readClaritySnapshot, writeClaritySnapshot, type ClarityDimensionRow, type ClaritySnapshot } from "@/lib/clarity/clarity-snapshot-store";
import { isCompliantUtmPair, slugifyUtmValue } from "@/lib/utm-standards";

type ClarityMetricBlock = {
  metricName?: string;
  information?: Array<Record<string, string | number>>;
};

export type ClaritySyncPayload = ClaritySnapshot & {
  dataSource: "snapshot" | "live";
  snapshotUpdatedAt: string | null;
  dashboardUrl: string | null;
};

type ClarityQuery = {
  dimension1: string;
  dimension2?: string;
  dimension3?: string;
};

const clarityApiBase = "https://www.clarity.ms/export-data/api/v1/project-live-insights";

function clarityToken() {
  return process.env.CLARITY_API_TOKEN?.trim() || "";
}

function clarityDashboardUrl() {
  return process.env.CLARITY_DASHBOARD_URL?.trim() || null;
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dimensionValue(row: Record<string, string | number>, dimensions: string[]) {
  if (dimensions.length > 1) {
    const parts = dimensions
      .map((key) => row[key])
      .filter((value) => value !== undefined && value !== null && String(value).trim())
      .map((value) => String(value));
    if (parts.length) return parts.join(" / ");
  }

  for (const key of dimensions) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }
  return "(not set)";
}

function parseQueryResponse(blocks: ClarityMetricBlock[], dimensionKeys: string[]) {
  const bucket = new Map<string, ClarityDimensionRow>();

  for (const block of blocks) {
    const metricName = block.metricName ?? "";
    for (const row of block.information ?? []) {
      const value = dimensionValue(row, dimensionKeys);
      const current = bucket.get(value) ?? {
        dimension: dimensionKeys.join(" / "),
        value,
        sessions: 0
      };

      if (metricName === "Traffic") {
        current.sessions = Math.max(current.sessions, toNumber(row.totalSessionCount));
      }
      if (metricName === "Engagement Time") {
        current.engagementTime = toNumber(row.totalEngagementTime ?? row.engagementTime ?? row.activeTime);
      }
      if (metricName === "Scroll Depth") {
        current.scrollDepth = toNumber(row.averageScrollDepth ?? row.scrollDepth);
      }
      if (metricName === "Rage Click Count") {
        current.rageClicks = toNumber(row.totalRageClickCount ?? row.rageClickCount ?? row.rageClicks);
      }
      if (metricName === "Dead Click Count") {
        current.deadClicks = toNumber(row.totalDeadClickCount ?? row.deadClickCount ?? row.deadClicks);
      }
      if (metricName === "Quickback Click") {
        current.quickbackClicks = toNumber(row.totalQuickbackCount ?? row.quickbackClick ?? row.quickbackClicks);
      }
      if (metricName === "Error Click Count") {
        current.errorClicks = toNumber(row.totalErrorClickCount ?? row.errorClickCount);
      }
      if (metricName === "Script Error Count") {
        current.scriptErrors = toNumber(row.totalScriptErrorCount ?? row.scriptErrorCount);
      }

      bucket.set(value, current);
    }
  }

  return Array.from(bucket.values()).sort((a, b) => b.sessions - a.sessions);
}

async function fetchClarityInsights(token: string, numOfDays: 1 | 2 | 3, query: ClarityQuery) {
  const params = new URLSearchParams({
    numOfDays: String(numOfDays),
    dimension1: query.dimension1
  });
  if (query.dimension2) params.set("dimension2", query.dimension2);
  if (query.dimension3) params.set("dimension3", query.dimension3);

  const response = await fetch(`${clarityApiBase}?${params.toString()}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    cache: "no-store"
  });

  const data = await response.json();
  if (!response.ok) {
    const message = typeof data === "object" && data && "message" in data
      ? String((data as { message?: string }).message)
      : response.statusText;
    throw new Error(`Clarity API failed (${response.status}): ${message || "unknown error"}`);
  }

  return data as ClarityMetricBlock[];
}

function isSnapshotFreshToday(createdAt: string, now = new Date()) {
  const snapshotDate = new Date(createdAt);
  if (Number.isNaN(snapshotDate.getTime())) return false;
  return snapshotDate.getFullYear() === now.getFullYear()
    && snapshotDate.getMonth() === now.getMonth()
    && snapshotDate.getDate() === now.getDate();
}

async function buildClaritySnapshot(numOfDays: 1 | 2 | 3 = 3): Promise<ClaritySnapshot> {
  const token = clarityToken();
  if (!token) throw new Error("CLARITY_API_TOKEN is not configured");

  const queries: ClarityQuery[] = [
    { dimension1: "Campaign" },
    { dimension1: "URL" },
    { dimension1: "Source", dimension2: "Medium" },
    { dimension1: "Device" },
    { dimension1: "Country/Region" }
  ];

  const responses = await Promise.all(queries.map((query) => fetchClarityInsights(token, numOfDays, query)));

  const byCampaign = parseQueryResponse(responses[0] ?? [], ["Campaign"]).slice(0, 30);
  const byUrl = parseQueryResponse(responses[1] ?? [], ["URL"]).slice(0, 30);
  const bySourceMedium = parseQueryResponse(responses[2] ?? [], ["Source", "Medium"]).slice(0, 30);
  const byDevice = parseQueryResponse(responses[3] ?? [], ["Device"]).slice(0, 15);
  const byCountry = parseQueryResponse(responses[4] ?? [], ["Country/Region"]).slice(0, 15);

  const totalSessions = byCampaign.reduce((sum, row) => sum + row.sessions, 0);
  const totalRageClicks = byUrl.reduce((sum, row) => sum + (row.rageClicks ?? 0), 0);
  const totalDeadClicks = byUrl.reduce((sum, row) => sum + (row.deadClicks ?? 0), 0);
  const totalQuickbackClicks = byUrl.reduce((sum, row) => sum + (row.quickbackClicks ?? 0), 0);
  const mobileSessions = byDevice
    .filter((row) => /mobile|phone|android|ios/i.test(row.value))
    .reduce((sum, row) => sum + row.sessions, 0);

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    numOfDays,
    queriesUsed: queries.length,
    summary: {
      totalSessions,
      totalRageClicks,
      totalDeadClicks,
      totalQuickbackClicks,
      topCampaign: byCampaign[0]?.value ?? null,
      topUrl: byUrl[0]?.value ?? null,
      mobileSessionShare: totalSessions > 0 ? mobileSessions / totalSessions : 0
    },
    byCampaign,
    byUrl,
    bySourceMedium,
    byDevice,
    byCountry
  };
}

export function clarityUtmIssues(snapshot: ClaritySnapshot) {
  return snapshot.bySourceMedium
    .filter((row) => {
      const [source, medium] = row.value.split(" / ");
      return !isCompliantUtmPair(source, medium);
    })
    .slice(0, 8)
    .map((row) => row.value);
}

export function clarityFrictionHotspots(snapshot: ClaritySnapshot) {
  return snapshot.byUrl
    .filter((row) => (row.rageClicks ?? 0) + (row.deadClicks ?? 0) + (row.quickbackClicks ?? 0) > 0)
    .sort((a, b) => (
      (b.rageClicks ?? 0) + (b.deadClicks ?? 0) + (b.quickbackClicks ?? 0)
    ) - (
      (a.rageClicks ?? 0) + (a.deadClicks ?? 0) + (a.quickbackClicks ?? 0)
    ))
    .slice(0, 10);
}

export function clarityContextForAsk(snapshot: ClaritySnapshot) {
  return {
    windowDays: snapshot.numOfDays,
    summary: snapshot.summary,
    utmIssues: clarityUtmIssues(snapshot),
    frictionHotspots: clarityFrictionHotspots(snapshot).map((row) => ({
      url: row.value,
      sessions: row.sessions,
      rageClicks: row.rageClicks ?? 0,
      deadClicks: row.deadClicks ?? 0,
      quickbackClicks: row.quickbackClicks ?? 0
    })),
    topCampaigns: snapshot.byCampaign.slice(0, 10),
    topUrls: snapshot.byUrl.slice(0, 10),
    devices: snapshot.byDevice.slice(0, 5),
    countries: snapshot.byCountry.slice(0, 5)
  };
}

export type ClaritySyncOptions = {
  refresh?: boolean;
  numOfDays?: 1 | 2 | 3;
};

export async function syncClarityInsights(options: ClaritySyncOptions = {}): Promise<ClaritySyncPayload> {
  const existing = await readClaritySnapshot();
  const numOfDays = options.numOfDays ?? 3;

  if (!options.refresh && existing && isSnapshotFreshToday(existing.createdAt)) {
    return {
      ...existing,
      dataSource: "snapshot",
      snapshotUpdatedAt: existing.createdAt,
      dashboardUrl: clarityDashboardUrl()
    };
  }

  const snapshot = await buildClaritySnapshot(numOfDays);
  await writeClaritySnapshot(snapshot);

  return {
    ...snapshot,
    dataSource: "live",
    snapshotUpdatedAt: snapshot.createdAt,
    dashboardUrl: clarityDashboardUrl()
  };
}

export function normalizeClarityCampaign(value: string) {
  return slugifyUtmValue(value);
}
