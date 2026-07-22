import assert from "node:assert/strict";
import {
  ORGANIC_TOTAL_TYPES,
  TRAFFIC_MANAGEMENT_THRESHOLDS
} from "@/config/traffic-management";
import {
  validateTrafficExportV2Header,
  validateTrafficExportV2Rows,
  TRAFFIC_EXPORT_V2_COLUMNS,
  TRAFFIC_EXPORT_V2_CONTRACT_VERSION
} from "@/lib/traffic-os/export-contract";
import {
  buildTrafficManagementLayer,
  classifyAggregateConfidence,
  classifyManagementStatus,
  classifyUnknownReason,
  isOrganicTotalType,
  isoWeekKey
} from "@/lib/traffic-os/management";
import { classifySourceId, resolveLeadIdentity } from "@/lib/traffic-os/taxonomy";
import { pct } from "@/lib/traffic-os/utils";

// paid / organic / unknown preservation
assert.equal(resolveLeadIdentity({ sourceId: "WEB", utmSource: "facebook", utmMedium: "cpc" }).traffic_type, "paid");
assert.equal(resolveLeadIdentity({ sourceId: "WEB", utmSource: "", utmMedium: "" }).traffic_type, "unknown");
assert.equal(classifySourceId("UC_I4VZXD").traffic_type, "messenger");
assert.equal(isOrganicTotalType("messenger"), false);
assert.equal(isOrganicTotalType("email"), false);
assert.equal(isOrganicTotalType("offline"), false);
assert.equal(isOrganicTotalType("organic_social"), true);
assert.equal(isOrganicTotalType("direct"), true);
assert.ok(ORGANIC_TOTAL_TYPES.includes("referral"));

// zero denominator → empty CR (not 0%)
assert.equal(pct(1, 0), "");
assert.equal(pct(0, 10), "0");

// confidence / management status
assert.equal(
  classifyManagementStatus({ trafficType: "unknown", sampleSize: 100, coveragePct: 1 }),
  "unknown"
);
assert.equal(
  classifyManagementStatus({ trafficType: "paid", sampleSize: 5, coveragePct: 1 }),
  "low_sample"
);
assert.equal(
  classifyManagementStatus({ trafficType: "paid", sampleSize: 100, coveragePct: 0.4 }),
  "low_coverage"
);
assert.equal(
  classifyAggregateConfidence({ fullyShare: 0.6, knownShare: 0.95, sampleSize: 100 }),
  "high"
);
assert.equal(
  classifyAggregateConfidence({ fullyShare: 0.1, knownShare: 0.8, sampleSize: 100 }),
  "medium"
);
assert.equal(
  classifyAggregateConfidence({ fullyShare: 0, knownShare: 0, sampleSize: 0, trafficType: "unknown" }),
  "unknown"
);

assert.ok(isoWeekKey("2026-07-01").startsWith("2026-W"));

assert.equal(
  classifyUnknownReason({
    source_id: "WEB",
    source_name: "Website",
    utm_source: "",
    utm_medium: "",
    landing_id: "landing:x"
  }),
  "bare_web"
);
assert.equal(
  classifyUnknownReason({
    source_id: "WEB",
    utm_source: "instagram",
    utm_medium: "social",
    landing_id: "landing:x"
  }),
  "ambiguous_instagram_social"
);
assert.equal(
  classifyUnknownReason({
    source_id: "WEB",
    utm_source: "cpc",
    utm_medium: "{{placement}}",
    landing_id: "landing:x"
  }),
  "broken_macro"
);

const attributions = [
  {
    lead_id: "1",
    date: "2026-07-01",
    traffic_type: "paid",
    channel: "Meta Ads",
    source_id: "WEB",
    source_name: "Website",
    utm_source: "facebook",
    utm_medium: "cpc",
    utm_campaign: "summer",
    campaign_key: "campaign:facebook|cpc|summer",
    landing_id: "landing:retro-pressa.com/ru/new",
    domain: "retro-pressa.com",
    deal_id: "d1",
    invoice_events: 1,
    payments: 1,
    paid_revenue: 100,
    attribution_status: "fully_attributed",
    attribution_confidence: "high"
  },
  {
    lead_id: "2",
    date: "2026-07-01",
    traffic_type: "messenger",
    channel: "WhatsApp",
    source_id: "UC_I4VZXD",
    source_name: "WhatsApp",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    campaign_key: "campaign:unknown",
    landing_id: "landing:unknown",
    domain: "",
    deal_id: "",
    invoice_events: 0,
    payments: 0,
    paid_revenue: 0,
    attribution_status: "source_only",
    attribution_confidence: "medium"
  },
  {
    lead_id: "3",
    date: "2026-07-02",
    traffic_type: "unknown",
    channel: "Website",
    source_id: "WEB",
    source_name: "Website Retro Pressa.com",
    utm_source: "instagram",
    utm_medium: "social",
    utm_campaign: "",
    campaign_key: "campaign:instagram|social|-",
    landing_id: "landing:retro-pressa.com/life",
    domain: "retro-pressa.com",
    deal_id: "d2",
    invoice_events: 0,
    payments: 0,
    paid_revenue: 0,
    attribution_status: "landing_only",
    attribution_confidence: "medium"
  },
  {
    lead_id: "4",
    date: "2026-07-02",
    traffic_type: "email",
    channel: "Email",
    source_id: "EMAIL",
    source_name: "E-Mail",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    campaign_key: "campaign:unknown",
    landing_id: "landing:unknown",
    domain: "",
    deal_id: "",
    invoice_events: 0,
    payments: 0,
    paid_revenue: 0,
    attribution_status: "source_only",
    attribution_confidence: "medium"
  },
  {
    lead_id: "5",
    date: "2026-07-03",
    traffic_type: "offline",
    channel: "Offline",
    source_id: "UC_LKPUT4",
    source_name: "В ручную",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    campaign_key: "campaign:unknown",
    landing_id: "landing:unknown",
    domain: "",
    deal_id: "",
    invoice_events: 0,
    payments: 0,
    paid_revenue: 0,
    attribution_status: "source_only",
    attribution_confidence: "medium"
  }
];

const mgmt = buildTrafficManagementLayer({
  attributions,
  landingMap: [
    {
      landing_id: "landing:retro-pressa.com/ru/new",
      landing_name: "/ru/new",
      domain: "retro-pressa.com",
      path: "/ru/new"
    },
    { landing_id: "landing:unknown", landing_name: "unknown", domain: "", path: "" }
  ],
  salesTotals: {
    period: "2026-07",
    leads: 5,
    deals: 10,
    invoice_events: 8,
    payments: 7,
    paid_revenue: 1000
  },
  syncedAt: "2026-07-22T00:00:00.000Z",
  periods: ["2026-07"]
});

// messenger/email/offline not in organic_total
const organicLeads = mgmt.trafficManagement.filter(
  (r) => r.summary_block === "traffic_types" && r.item_id === "organic_total" && r.metric_id === "leads"
)[0];
assert.equal(Number(organicLeads?.value || 0), 0);

const messengerLeads = mgmt.trafficManagement.filter(
  (r) => r.summary_block === "traffic_types" && r.item_id === "messenger" && r.metric_id === "leads"
)[0];
assert.equal(Number(messengerLeads?.value), 1);

const unknownLeads = mgmt.trafficManagement.filter(
  (r) => r.summary_block === "traffic_types" && r.item_id === "unknown" && r.metric_id === "leads"
)[0];
assert.equal(Number(unknownLeads?.value), 1);

// attributed revenue only
assert.equal(mgmt.coverageSummary.attributed_paid_revenue, 100);
assert.equal(mgmt.coverageSummary.total_sales_revenue, 1000);
assert.equal(mgmt.coverageSummary.unattributed_revenue, 900);

// unknown landing / campaign present
assert.ok(mgmt.landingManagement.some((r) => r.landing_id === "landing:unknown"));
assert.ok(mgmt.campaignManagement.some((r) => r.campaign_id === "campaign:unknown"));

// channel aggregation
assert.ok(mgmt.channelManagement.some((r) => r.channel_name === "Meta Ads" && Number(r.leads) >= 1));
assert.ok(mgmt.trafficTypeFact.some((r) => r.traffic_type === "paid"));

// sales coverage
const revCov = mgmt.salesCoverage.find((r) => r.metric_id === "paid_revenue");
assert.ok(revCov);
assert.equal(Number(revCov?.covered_value), 100);
assert.ok(String(revCov?.difference_reason || "").includes("unattributed"));

// alerts (system defaults — not decision policy)
assert.ok(mgmt.alerts.some((a) => a.alert_type === "landing_coverage_low" || a.alert_type === "missing_landing"));
assert.ok(mgmt.alerts.some((a) => a.severity === "warning" || a.severity === "critical" || a.severity === "info"));

// export v2
assert.equal(validateTrafficExportV2Header([...TRAFFIC_EXPORT_V2_COLUMNS]).ok, true);
const v2 = validateTrafficExportV2Rows(mgmt.exportRowsV2);
assert.equal(v2.ok, true, v2.errors.join("; "));
assert.equal(mgmt.exportRowsV2[0].contract_version, TRAFFIC_EXPORT_V2_CONTRACT_VERSION);
assert.ok("attributed_paid_revenue" in mgmt.exportRowsV2[0]);
assert.ok(!("paid_revenue" in mgmt.exportRowsV2[0] && !("attributed_paid_revenue" in mgmt.exportRowsV2[0])));

// duplicate PK check
const keys = new Set<string>();
for (const row of mgmt.exportRowsV2) {
  const key = `${row.date}|${row.traffic_type}|${row.channel_id}|${row.landing_id}|${row.campaign_id}`;
  assert.equal(keys.has(key), false);
  keys.add(key);
}

// thresholds marked default_not_approved
assert.equal(TRAFFIC_MANAGEMENT_THRESHOLDS.threshold_status, "default_not_approved");
assert.equal(TRAFFIC_MANAGEMENT_THRESHOLDS.minimumSampleSize, 30);

// unknown breakdown includes ambiguous instagram social
assert.ok(
  mgmt.trafficManagement.some(
    (r) => r.summary_block === "unknown_breakdown" && String(r.item_id).includes("ambiguous")
  )
);

console.log("traffic-management tests ok", {
  alerts: mgmt.alerts.length,
  export: mgmt.exportRowsV2.length,
  coverage: mgmt.coverageSummary
});
