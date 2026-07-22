import assert from "node:assert/strict";
import { TRAFFIC_HEALTH_WEIGHTS, MARKETING_OS_CONTRACT_VERSION } from "@/config/marketing-os";
import { TRAFFIC_OS_SHEETS } from "@/config/traffic-os";
import {
  buildMarketingControlLayer,
  computeTrafficHealthScore,
  entityMonitorStatus,
  healthStatusFromScore
} from "@/lib/traffic-os/marketing-home";

assert.equal(MARKETING_OS_CONTRACT_VERSION, "marketing_os_v1");
assert.equal(TRAFFIC_OS_SHEETS.marketingHome, "30_Marketing_Home");
assert.equal(TRAFFIC_OS_SHEETS.unknownCenter, "31_Unknown_Center");
assert.equal(TRAFFIC_OS_SHEETS.dataQualityCenter, "32_Data_Quality_Center");
assert.equal(TRAFFIC_OS_SHEETS.marketingTimeline, "33_Marketing_Timeline");

const weightSum =
  TRAFFIC_HEALTH_WEIGHTS.unknown +
  TRAFFIC_HEALTH_WEIGHTS.channel_coverage +
  TRAFFIC_HEALTH_WEIGHTS.landing_coverage +
  TRAFFIC_HEALTH_WEIGHTS.revenue_coverage +
  TRAFFIC_HEALTH_WEIGHTS.broken_utm +
  TRAFFIC_HEALTH_WEIGHTS.freshness;
assert.ok(Math.abs(weightSum - 1) < 1e-9);

const perfect = computeTrafficHealthScore({
  unknownShare: 0,
  channelCoverage: 1,
  landingCoverage: 1,
  revenueCoverage: 1,
  brokenUtmShare: 0,
  freshnessOk: true
});
assert.equal(perfect.score, 100);
assert.equal(healthStatusFromScore(perfect.score), "Healthy");

const weak = computeTrafficHealthScore({
  unknownShare: 0.5,
  channelCoverage: 0.4,
  landingCoverage: 0.3,
  revenueCoverage: 0.4,
  brokenUtmShare: 0.1,
  freshnessOk: false
});
assert.ok(weak.score < 50);
assert.equal(healthStatusFromScore(weak.score), "Critical");

assert.equal(
  entityMonitorStatus({ trafficType: "unknown", sampleSize: 100 }),
  "Unknown"
);
assert.equal(
  entityMonitorStatus({ managementStatus: "conflict", sampleSize: 100 }),
  "Critical"
);
assert.equal(
  entityMonitorStatus({ trafficType: "paid", managementStatus: "usable", sampleSize: 100 }),
  "Healthy"
);

const syncedAt = "2026-07-22T12:00:00.000Z";
const layer = buildMarketingControlLayer({
  syncedAt,
  periods: ["2026-07"],
  coverageSummary: {
    unknown_share_pct: 14.5,
    channel_coverage_pct: 85.5,
    landing_coverage_pct: 48,
    revenue_coverage_pct: 79.7,
    payment_linkage_pct: 7.5,
    attributed_paid_revenue: 69893
  },
  enrichmentCoverage: {
    before: {
      unknown_share_pct: 67.25,
      revenue_amount_coverage_pct: 71.57,
      landing_coverage_pct: 42.27,
      payment_linkage_pct: 7.5
    },
    after: {
      unknown_share_pct: 14.5,
      revenue_amount_coverage_pct: 79.7,
      landing_coverage_pct: 48,
      payment_linkage_pct: 7.5
    }
  },
  identityCoverage: {
    before: {
      unknown_pct: 67.25,
      channel_coverage_pct: 32.75,
      landing_coverage_pct: 42.27
    },
    after: {
      unknown_pct: 14.5,
      channel_coverage_pct: 85.5,
      landing_coverage_pct: 48
    }
  },
  attributions: [
    {
      traffic_type: "unknown",
      source_id: "WEB",
      source_name: "Website",
      utm_source: "",
      utm_medium: "",
      landing_id: "landing:unknown",
      paid_revenue: 100
    },
    {
      traffic_type: "unknown",
      source_id: "WEB",
      source_name: "Website",
      utm_source: "instagram",
      utm_medium: "social",
      landing_id: "landing:x",
      paid_revenue: 50
    },
    {
      traffic_type: "paid",
      source_id: "FB",
      source_name: "Facebook",
      utm_source: "facebook",
      utm_medium: "cpc",
      landing_id: "landing:x",
      paid_revenue: 200
    },
    {
      traffic_type: "paid",
      source_id: "FB",
      source_name: "Facebook",
      utm_source: "{{campaign.name}}",
      utm_medium: "cpc",
      landing_id: "landing:x",
      paid_revenue: 0
    }
  ],
  channelManagement: [
    {
      period_type: "month",
      channel_name: "Facebook Ads",
      traffic_type: "paid",
      management_status: "usable",
      leads: 10,
      sample_size: 10
    },
    {
      period_type: "month",
      channel_name: "Unknown",
      traffic_type: "unknown",
      management_status: "unknown",
      leads: 5,
      sample_size: 5
    }
  ],
  landingManagement: [
    {
      period_type: "month",
      landing_id: "landing:x",
      landing_name: "Offer X",
      management_status: "usable",
      leads: 8,
      sample_size: 8
    },
    {
      period_type: "month",
      landing_id: "landing:unknown",
      landing_name: "Unknown",
      management_status: "unknown",
      leads: 4,
      sample_size: 4
    }
  ],
  sourceMap: [
    {
      source_key: "web",
      source_raw: "WEB",
      source_name: "Website",
      mapping_status: "unknown",
      confidence: "unknown",
      traffic_type: "unknown",
      mapping_rule: "none",
      lead_count: 2
    },
    {
      source_key: "fb",
      source_raw: "FB",
      source_name: "Facebook",
      mapping_status: "verified",
      confidence: "high",
      traffic_type: "paid",
      mapping_rule: "utm",
      lead_count: 2
    }
  ],
  alerts: [
    {
      alert_id: "a1",
      alert_date: "2026-07-22",
      alert_type: "unknown_high",
      severity: "warning",
      entity_type: "traffic",
      entity_id: "all",
      entity_name: "all",
      metric_id: "unknown_share",
      actual_value: 14.5,
      threshold: 15,
      status: "open",
      message: "Unknown elevated",
      recommended_action: "check Unknown Center",
      owner: "marketing_ops",
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt
    }
  ],
  previousAlerts: [
    {
      alert_id: "old1",
      alert_type: "broken_utm",
      severity: "warning",
      entity_type: "utm",
      entity_id: "x",
      entity_name: "x",
      metric_id: "broken",
      message: "macros",
      owner: "marketing_ops"
    }
  ],
  previousTimeline: [
    {
      event_id: "run:old|unknown_share_pct",
      event_at: "2026-07-20T12:00:00.000Z",
      metric_id: "unknown_share_pct",
      metric_name: "Unknown %",
      value: "20",
      previous_value: "67",
      delta: "-47",
      direction: "down",
      note: "",
      sync_run_id: "run:old",
      sync_updated_at: "2026-07-20T12:00:00.000Z"
    }
  ]
});

assert.ok(layer.marketingHome.some((r) => r.block === "traffic_health"));
assert.ok(layer.marketingHome.some((r) => r.block === "todays_priorities"));
assert.ok(layer.marketingHome.some((r) => r.block === "channel_monitor"));
assert.ok(layer.marketingHome.some((r) => r.block === "landing_monitor"));
assert.ok(layer.marketingHome.some((r) => r.block === "source_monitor"));
assert.ok(layer.marketingHome.some((r) => r.block === "operational_status"));
assert.ok(layer.marketingHome.some((r) => r.block === "marketing_readiness"));
assert.ok(layer.marketingHome.some((r) => r.block === "definitions"));

const spend = layer.marketingHome.find(
  (r) => r.block === "operational_status" && r.item_id === "spend_analytics"
);
assert.equal(spend?.value, "Not Connected");

const forecast = layer.marketingHome.find(
  (r) => r.block === "operational_status" && r.item_id === "forecast"
);
assert.equal(forecast?.value, "Blocked");

assert.ok(layer.unknownCenter.length >= 1);
assert.equal(layer.unknownCenter[0].rank, 1);
assert.ok(Number(layer.unknownCenter[0].impact_score) >= Number(layer.unknownCenter.at(-1)?.impact_score || 0));

assert.ok(layer.dataQualityCenter.some((r) => r.metric_id === "traffic_health_score"));
assert.ok(layer.marketingTimeline.some((r) => String(r.sync_run_id).includes("2026-07-22")));
assert.ok(layer.marketingTimeline.some((r) => r.sync_run_id === "run:old"));

const resolved = layer.marketingAlerts.find((a) => String(a.alert_id) === "old1");
assert.equal(resolved?.bucket, "Resolved");
assert.equal(resolved?.lifecycle_status, "resolved");

const open = layer.marketingAlerts.find((a) => String(a.alert_id) === "a1");
assert.equal(open?.bucket, "Warning");

assert.ok(layer.trafficHealth.score > 0);
assert.ok(["Healthy", "Warning", "Critical"].includes(layer.trafficHealth.status));

assert.ok(layer.matrices.marketingHome.length === layer.marketingHome.length);
assert.ok(layer.matrices.unknownCenter.length === layer.unknownCenter.length);

console.log("traffic-marketing-os.test.ts: ok");
