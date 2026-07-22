import assert from "node:assert/strict";
import { GA4_FOUNDATION_SHEETS, GA4_FOUNDATION_CONTRACT_VERSION } from "@/config/ga4-foundation";
import { TRAFFIC_OS_SHEETS } from "@/config/traffic-os";
import { buildGa4FoundationLayer, mergeGa4MapCandidates } from "@/lib/traffic-os/ga4-foundation";

assert.equal(GA4_FOUNDATION_CONTRACT_VERSION, "ga4_foundation_v1");
assert.equal(TRAFFIC_OS_SHEETS.ga4PageDaily, "26_GA4_Page_Daily");
assert.equal(TRAFFIC_OS_SHEETS.ga4ChannelDaily, GA4_FOUNDATION_SHEETS.channelDaily);
assert.equal(TRAFFIC_OS_SHEETS.ga4LandingDaily, "34_GA4_Landing_Daily");
assert.equal(TRAFFIC_OS_SHEETS.ga4DataQuality, "36_GA4_Data_Quality");
// Management layer keeps 16–22
assert.equal(TRAFFIC_OS_SHEETS.trafficManagement, "16_Traffic_Management");

const row = (dims: string[], mets: string[]) => ({
  dimensionValues: dims.map((value) => ({ value })),
  metricValues: mets.map((value) => ({ value }))
});

const layer = buildGa4FoundationLayer({
  propertyId: "482241067",
  syncedAt: "2026-07-22T12:00:00.000Z",
  startDate: "2026-05-01",
  endDate: "2026-07-21",
  crmLeadsByDay: new Map([
    ["2026-07-01", 10],
    ["2026-07-02", 5]
  ]),
  facts: {
    pageRows: [row(["20260701", "retro-pressa.com", "/ru/new"], ["100", "120", "150", "0.4", "30", "8"])],
    channelRows: [row(["20260701", "Paid Social"], ["90", "110", "140", "7"])],
    sourceRows: [
      row(["20260701", "facebook", "cpc"], ["80", "100", "130", "6"]),
      row(["20260701", "(direct)", "(none)"], ["10", "20", "20", "1"])
    ],
    campaignRows: [
      row(["20260701", "Test Campaign", "facebook", "cpc"], ["70", "90", "120", "5"]),
      row(["20260701", "(not set)", "(direct)", "(none)"], ["5", "10", "10", "0"])
    ],
    landingRows: [
      row(["20260701", "retro-pressa.com", "/ru/new"], ["80", "100", "120", "0.5", "6"]),
      row(["20260701", "retro-pressa.com", "(not set)"], ["2", "3", "3", "0.1", "0"])
    ],
    eventRows: [
      row(["20260701", "generate_lead"], ["12", "10"]),
      row(["20260701", "page_view"], ["150", "100"])
    ],
    referrerRows: []
  }
});

assert.equal(layer.pageDaily.length, 1);
assert.equal(layer.pageDaily[0].host_name, "retro-pressa.com");
assert.equal(layer.landingDaily[0].landing_url, "https://retro-pressa.com/ru/new");
assert.ok(layer.dataQuality.some((r) => r.metric_id === "crm_link_coverage" && Number(r.value) === 0));
assert.ok(layer.coverage.hard_crm_link_pct === 0);
assert.ok(layer.coverage.generate_lead_events === 12);
assert.ok(layer.coverage.crm_leads === 15);
assert.ok(layer.sessionsByTrafficTypeDate.get("2026-07-01|paid") === 110);

const maps = mergeGa4MapCandidates({
  existingSourceMap: [],
  existingLandingMap: [],
  existingCampaignMap: [],
  sourceCandidates: layer.sourceCandidates,
  landingCandidates: layer.landingCandidates,
  campaignCandidates: layer.campaignCandidates,
  syncedAt: "2026-07-22T12:00:00.000Z"
});

assert.ok(maps.sourceMapExtra.some((r) => r.traffic_type === "unknown"));
assert.ok(maps.landingMapExtra.some((r) => String(r.status) === "observed_ga4"));
assert.ok(!maps.sourceMapExtra.some((r) => r.traffic_type === "paid"));

console.log("traffic-ga4-foundation.test.ts: ok", {
  page: layer.stats.pageDaily,
  unknownSourceShare: layer.coverage.unknown_source_share_pct
});
