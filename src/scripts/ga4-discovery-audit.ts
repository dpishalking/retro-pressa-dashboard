/**
 * Read-only GA4 discovery for Foundation audit. Does not write sheets.
 */
import crypto from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

function creds() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  let privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim()
    ?.replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "\n");
  if (!email || !privateKey) throw new Error("Service account not configured");
  return { email, privateKey };
}

async function token(scope: string) {
  const c = creds();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: c.email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    })
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(c.privateKey).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${sig}`
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.access_token as string;
}

async function runReport(accessToken: string, propertyId: string, body: unknown) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function adminGet(accessToken: string, path: string) {
  const res = await fetch(`https://analyticsadmin.googleapis.com/v1beta/${path}`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  return { status: res.status, data };
}

function compactReport(r: { status: number; data: any }) {
  if (r.status !== 200) return { status: r.status, error: r.data?.error || r.data };
  const rows = (r.data.rows || []).map((row: any) => ({
    dims: (row.dimensionValues || []).map((d: any) => d.value),
    mets: (row.metricValues || []).map((m: any) => m.value)
  }));
  return { status: 200, rowCount: rows.length, rows };
}

async function main() {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  if (!propertyId) throw new Error("GA4_PROPERTY_ID missing");

  const access = await token("https://www.googleapis.com/auth/analytics.readonly");
  const dateRange = { startDate: "2026-05-01", endDate: "2026-07-21" };

  const property = await adminGet(access, `properties/${propertyId}`);
  const dataStreams = await adminGet(access, `properties/${propertyId}/dataStreams`);
  const accountSummaries = await adminGet(access, "accountSummaries?pageSize=50");

  const hostnames = await runReport(access, propertyId, {
    dateRanges: [dateRange],
    dimensions: [{ name: "hostName" }],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 50
  });

  const events = await runReport(access, propertyId, {
    dateRanges: [dateRange],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: 100
  });

  const utm = await runReport(access, propertyId, {
    dateRanges: [dateRange],
    dimensions: [
      { name: "sessionSource" },
      { name: "sessionMedium" },
      { name: "sessionCampaignName" },
      { name: "sessionManualAdContent" },
      { name: "sessionManualTerm" }
    ],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 30
  });

  const landings = await runReport(access, propertyId, {
    dateRanges: [dateRange],
    dimensions: [{ name: "hostName" }, { name: "landingPage" }],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "conversions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 40
  });

  const channelDaily = await runReport(access, propertyId, {
    dateRanges: [dateRange],
    dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "screenPageViews" }, { name: "conversions" }],
    limit: 5
  });

  const metaRes = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}/metadata`,
    { headers: { authorization: `Bearer ${access}` } }
  );
  const meta = await metaRes.json();
  const dims = (meta.dimensions || []).map((d: any) => d.apiName as string);
  const wanted = [
    "sessionSource",
    "sessionMedium",
    "sessionCampaignName",
    "sessionManualAdContent",
    "sessionManualTerm",
    "firstUserSource",
    "firstUserMedium",
    "pageLocation",
    "pageReferrer",
    "landingPage",
    "hostName",
    "sessionDefaultChannelGroup",
    "sessionSourceMedium",
    "pagePath",
    "pagePathPlusQueryString"
  ];

  const summary = {
    discovered_at: new Date().toISOString(),
    propertyId,
    property:
      property.status === 200
        ? {
            displayName: property.data.displayName,
            timeZone: property.data.timeZone,
            currencyCode: property.data.currencyCode,
            industryCategory: property.data.industryCategory,
            propertyType: property.data.propertyType
          }
        : property,
    dataStreams:
      dataStreams.status === 200
        ? (dataStreams.data.dataStreams || []).map((s: any) => ({
            name: s.name,
            displayName: s.displayName,
            type: s.type,
            webStreamData: s.webStreamData
          }))
        : dataStreams,
    accountSummaries:
      accountSummaries.status === 200
        ? (accountSummaries.data.accountSummaries || []).map((a: any) => ({
            account: a.account,
            displayName: a.displayName,
            properties: (a.propertySummaries || []).map((p: any) => ({
              property: p.property,
              displayName: p.displayName
            }))
          }))
        : accountSummaries,
    hostnames: compactReport(hostnames),
    events: compactReport(events),
    utmSample: compactReport(utm),
    landings: compactReport(landings),
    channelDailyProbe: compactReport(channelDaily),
    metadata: {
      status: metaRes.status,
      dimCount: dims.length,
      present: Object.fromEntries(wanted.map((w) => [w, dims.includes(w)]))
    }
  };

  const outPath = resolve("data/ga4-snapshots/_discovery-audit.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
