/**
 * Auth + runReport bridge for GA4 Foundation (Traffic OS).
 * Reuses the same SA credentials as ad-analytics connector.
 */

import crypto from "node:crypto";
import {
  buildGa4FoundationLayer,
  fetchGa4FoundationFacts,
  mergeGa4MapCandidates
} from "@/lib/traffic-os/ga4-foundation";
import type { RowMap } from "@/lib/traffic-os/utils";

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
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsignedToken)
    .sign(credentials.privateKey)
    .toString("base64url");

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

function ga4PropertyId() {
  return process.env.GA4_PROPERTY_ID?.trim() || "";
}

export function periodsToDateRange(periods: string[]): { startDate: string; endDate: string } {
  const months = periods
    .map((p) => {
      if (/^\d{4}-\d{2}$/.test(p)) return p;
      if (p === "may-2026") return "2026-05";
      if (p === "june-2026") return "2026-06";
      if (p === "july-2026") return "2026-07";
      return "";
    })
    .filter(Boolean)
    .sort();
  if (!months.length) {
    return { startDate: "2026-05-01", endDate: "2026-07-31" };
  }
  const start = months[0];
  const end = months[months.length - 1];
  const [ey, em] = end.split("-").map(Number);
  const endDate = new Date(Date.UTC(ey, em, 0)).toISOString().slice(0, 10);
  return { startDate: `${start}-01`, endDate };
}

export async function buildTrafficOsGa4Foundation(input: {
  periods: string[];
  syncedAt: string;
  crmLeads: RowMap[];
  existingSourceMap: RowMap[];
  existingLandingMap: RowMap[];
  existingCampaignMap: RowMap[];
}) {
  const propertyId = ga4PropertyId();
  if (!propertyId) {
    throw new Error("GA4_PROPERTY_ID is not configured");
  }

  const { startDate, endDate } = periodsToDateRange(input.periods);
  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/analytics.readonly");

  const runReport = async (body: Record<string, unknown>) => {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(body),
        cache: "no-store"
      }
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`GA4 request failed: ${data.error?.message || response.status}`);
    }
    return data;
  };

  const facts = await fetchGa4FoundationFacts({
    propertyId,
    accessToken,
    startDate,
    endDate,
    runReport
  });

  const crmLeadsByDay = new Map<string, number>();
  for (const lead of input.crmLeads) {
    const day = String(lead.created_at || lead.lead_created_at || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    crmLeadsByDay.set(day, (crmLeadsByDay.get(day) || 0) + 1);
  }

  const layer = buildGa4FoundationLayer({
    propertyId,
    syncedAt: input.syncedAt,
    startDate,
    endDate,
    facts,
    crmLeadsByDay
  });

  const mapExtras = mergeGa4MapCandidates({
    existingSourceMap: input.existingSourceMap,
    existingLandingMap: input.existingLandingMap,
    existingCampaignMap: input.existingCampaignMap,
    sourceCandidates: layer.sourceCandidates,
    landingCandidates: layer.landingCandidates,
    campaignCandidates: layer.campaignCandidates,
    syncedAt: input.syncedAt
  });

  return {
    ...layer,
    ...mapExtras,
    startDate,
    endDate,
    propertyId
  };
}
