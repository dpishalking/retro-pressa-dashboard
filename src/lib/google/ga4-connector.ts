import crypto from "node:crypto";

import type { PeriodKey } from "@/types/metrics";
import { isCompliantUtmPair } from "@/lib/utm-standards";
import { readGa4Snapshot, writeGa4Snapshot, type Ga4CampaignRow, type Ga4ChannelRow, type Ga4DailyRow, type Ga4LandingRow, type Ga4Snapshot } from "@/lib/google/ga4-snapshot-store";

export type Ga4TrafficPayload = Ga4Snapshot & {
  dataSource: "snapshot" | "live";
  snapshotUpdatedAt: string | null;
  snapshotPath: string;
};

type Ga4RunReportResponse = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
  error?: { message?: string };
};

function serviceAccountCredentials() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  let privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim();

  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson);
    email = email || parsed.client_email;
    privateKey = privateKey || parsed.private_key;
  }

  privateKey = privateKey
    ?.replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "\n")
    .trim();

  if (!email || !privateKey) return null;
  return { email, privateKey };
}

function ga4PropertyId() {
  return process.env.GA4_PROPERTY_ID?.trim() || "";
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function getGoogleAccessToken(scope: string) {
  const credentials = serviceAccountCredentials();
  if (!credentials) throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are not configured");

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({
    iss: credentials.email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  });
  const unsignedToken = `${header}.${payload}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsignedToken).sign(credentials.privateKey).toString("base64url");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedToken}.${signature}`
    }),
    cache: "no-store"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Google auth failed: ${data.error_description || data.error || response.status}`);
  }
  if (!data.access_token) throw new Error("Google auth did not return an access token");

  return String(data.access_token);
}

function monthRangeForPeriod(period: PeriodKey) {
  const mapping: Record<PeriodKey, { year: number; month: number }> = {
    "may-2026": { year: 2026, month: 5 },
    "june-2026": { year: 2026, month: 6 },
    "july-2026": { year: 2026, month: 7 }
  };
  const { year, month } = mapping[period];
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { startDate, endDate };
}

function isClosedPeriod(period: PeriodKey, now = new Date()) {
  const mapping: Record<PeriodKey, { year: number; month: number }> = {
    "may-2026": { year: 2026, month: 5 },
    "june-2026": { year: 2026, month: 6 },
    "july-2026": { year: 2026, month: 7 }
  };
  const { year, month } = mapping[period];
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return periodStart < currentMonthStart;
}

function isSnapshotFreshToday(createdAt: string, now = new Date()) {
  const snapshotDate = new Date(createdAt);
  if (Number.isNaN(snapshotDate.getTime())) return false;
  return snapshotDate.getFullYear() === now.getFullYear()
    && snapshotDate.getMonth() === now.getMonth()
    && snapshotDate.getDate() === now.getDate();
}

function toNumber(value?: string) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function runGa4Report(propertyId: string, accessToken: string, body: Record<string, unknown>) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const data = await response.json() as Ga4RunReportResponse;

  if (!response.ok) {
    throw new Error(`GA4 request failed: ${data.error?.message || response.status}`);
  }

  return data;
}

async function fetchChannelBreakdown(propertyId: string, accessToken: string, startDate: string, endDate: string) {
  const data = await runGa4Report(propertyId, accessToken, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [
      { name: "newUsers" },
      { name: "sessions" },
      { name: "engagedSessions" }
    ],
    orderBys: [{ metric: { metricName: "newUsers" }, desc: true }],
    limit: 20
  });

  return (data.rows ?? []).map((row) => ({
    channel: row.dimensionValues?.[0]?.value || "Unassigned",
    newUsers: toNumber(row.metricValues?.[0]?.value),
    sessions: toNumber(row.metricValues?.[1]?.value),
    engagedSessions: toNumber(row.metricValues?.[2]?.value)
  })) as Ga4ChannelRow[];
}

async function fetchCampaignBreakdown(propertyId: string, accessToken: string, startDate: string, endDate: string) {
  const data = await runGa4Report(propertyId, accessToken, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: "sessionCampaignName" },
      { name: "sessionSource" },
      { name: "sessionMedium" }
    ],
    metrics: [
      { name: "sessions" },
      { name: "newUsers" }
    ],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 50
  });

  return (data.rows ?? []).map((row) => {
    const source = row.dimensionValues?.[1]?.value || "";
    const medium = row.dimensionValues?.[2]?.value || "";
    return {
      campaign: row.dimensionValues?.[0]?.value || "(not set)",
      source,
      medium,
      sessions: toNumber(row.metricValues?.[0]?.value),
      newUsers: toNumber(row.metricValues?.[1]?.value),
      compliant: isCompliantUtmPair(source, medium)
    };
  }) as Ga4CampaignRow[];
}

async function fetchLandingBreakdown(propertyId: string, accessToken: string, startDate: string, endDate: string) {
  const data = await runGa4Report(propertyId, accessToken, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: "landingPage" },
      { name: "sessionSource" },
      { name: "sessionMedium" }
    ],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 30
  });

  return (data.rows ?? []).map((row) => ({
    landingPage: row.dimensionValues?.[0]?.value || "/",
    source: row.dimensionValues?.[1]?.value || "",
    medium: row.dimensionValues?.[2]?.value || "",
    sessions: toNumber(row.metricValues?.[0]?.value)
  })) as Ga4LandingRow[];
}

async function fetchDailyBreakdown(propertyId: string, accessToken: string, startDate: string, endDate: string) {
  const data = await runGa4Report(propertyId, accessToken, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "newUsers" },
      { name: "sessions" }
    ],
    orderBys: [{ dimension: { dimensionName: "date" } }]
  });

  return (data.rows ?? []).map((row) => {
    const rawDate = row.dimensionValues?.[0]?.value || "";
    const formattedDate = rawDate.length === 8
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : rawDate;
    return {
      date: formattedDate,
      newUsers: toNumber(row.metricValues?.[0]?.value),
      sessions: toNumber(row.metricValues?.[1]?.value)
    };
  }) as Ga4DailyRow[];
}

async function fetchTotals(propertyId: string, accessToken: string, startDate: string, endDate: string) {
  const data = await runGa4Report(propertyId, accessToken, {
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "newUsers" },
      { name: "sessions" },
      { name: "engagedSessions" },
      { name: "activeUsers" }
    ]
  });
  const row = data.rows?.[0];
  const newUsers = toNumber(row?.metricValues?.[0]?.value);
  const activeUsers = toNumber(row?.metricValues?.[3]?.value);
  return {
    newUsers,
    sessions: toNumber(row?.metricValues?.[1]?.value),
    engagedSessions: toNumber(row?.metricValues?.[2]?.value),
    returningUsers: Math.max(0, activeUsers - newUsers)
  };
}

async function buildGa4Snapshot(period: PeriodKey): Promise<Ga4Snapshot> {
  const propertyId = ga4PropertyId();
  if (!propertyId) throw new Error("GA4_PROPERTY_ID is not configured");

  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/analytics.readonly");
  const { startDate, endDate } = monthRangeForPeriod(period);
  const [byChannel, byCampaign, byLanding, daily, totals] = await Promise.all([
    fetchChannelBreakdown(propertyId, accessToken, startDate, endDate),
    fetchCampaignBreakdown(propertyId, accessToken, startDate, endDate),
    fetchLandingBreakdown(propertyId, accessToken, startDate, endDate),
    fetchDailyBreakdown(propertyId, accessToken, startDate, endDate),
    fetchTotals(propertyId, accessToken, startDate, endDate)
  ]);

  const unassignedUsers = byChannel
    .filter((row) => row.channel.toLowerCase() === "unassigned")
    .reduce((sum, row) => sum + row.newUsers, 0);

  const compliantSessions = byCampaign
    .filter((row) => row.compliant)
    .reduce((sum, row) => sum + row.sessions, 0);
  const sessionsWithoutUtm = byCampaign
    .filter((row) => row.campaign === "(not set)" || row.campaign === "(direct)" || row.source === "(direct)")
    .reduce((sum, row) => sum + row.sessions, 0);

  return {
    version: 1,
    period,
    propertyId,
    dateRange: { startDate, endDate },
    createdAt: new Date().toISOString(),
    summary: {
      ...totals,
      unassignedUsers,
      unassignedShare: totals.newUsers > 0 ? unassignedUsers / totals.newUsers : 0,
      channels: byChannel.map((row) => row.channel),
      compliantSessionShare: totals.sessions > 0 ? compliantSessions / totals.sessions : 0,
      sessionsWithoutUtm
    },
    byChannel,
    byCampaign,
    byLanding,
    daily
  };
}

async function loadGa4Snapshot(period: PeriodKey, refresh = false) {
  if (!refresh) {
    const cached = await readGa4Snapshot(period);
    if (cached && (isClosedPeriod(period) || isSnapshotFreshToday(cached.createdAt))) {
      return cached;
    }
  }
  const snapshot = await buildGa4Snapshot(period);
  await writeGa4Snapshot(snapshot);
  return snapshot;
}

export type Ga4SyncOptions = {
  period?: PeriodKey;
  refresh?: boolean;
};

export async function syncGa4Traffic(options: Ga4SyncOptions = {}): Promise<Ga4TrafficPayload> {
  const period = options.period ?? "july-2026";
  const existing = await readGa4Snapshot(period);
  const snapshot = await loadGa4Snapshot(period, options.refresh === true);
  const fromCache = Boolean(existing && existing.createdAt === snapshot.createdAt);

  return {
    ...snapshot,
    dataSource: fromCache && !options.refresh ? "snapshot" : "live",
    snapshotUpdatedAt: snapshot.createdAt,
    snapshotPath: `data/ga4-snapshots/${period}.json`
  };
}

export function ga4ContextForAsk(snapshot: Ga4Snapshot, marketing?: {
  paidLeads: number;
  organicLeads: number;
  adSpend: number;
  ql: number;
}) {
  return {
    propertyId: snapshot.propertyId,
    period: snapshot.period,
    dateRange: snapshot.dateRange,
    summary: snapshot.summary,
    byChannel: snapshot.byChannel,
    byCampaign: snapshot.byCampaign.slice(0, 20),
    byLanding: snapshot.byLanding.slice(0, 15),
    daily: snapshot.daily.slice(-14),
    marketingComparison: marketing ?? null
  };
}
