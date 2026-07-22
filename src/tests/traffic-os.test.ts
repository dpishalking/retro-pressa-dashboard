import assert from "node:assert/strict";
import { buildTrafficOsModel, IDENTITY_BASELINE } from "@/lib/traffic-os/build-model";
import {
  validateTrafficExportV3Header,
  validateTrafficExportV3Rows,
  TRAFFIC_EXPORT_V3_CONTRACT_VERSION,
  TRAFFIC_EXPORT_V3_COLUMNS
} from "@/lib/traffic-os/export-contract";
import { normalizeCountry } from "@/lib/traffic-os/country-map";

assert.equal(normalizeCountry("1402").code, "LV");
assert.equal(normalizeCountry("1224").code, "RU");
assert.equal(normalizeCountry("Латвия").code, "LV");
assert.equal(normalizeCountry("999999").status, "unknown");

import { buildLandingMapRows, resolveLeadLanding } from "@/lib/traffic-os/landing-map";
import { parseSvodDayTrafficRaw, parseSvodOrganicRaw } from "@/lib/traffic-os/parse-svod-raw";
import { buildSourceMapRows, resolveTrafficType } from "@/lib/traffic-os/source-map";
import {
  classifySourceId,
  classifyUtmPair,
  resolveLeadIdentity
} from "@/lib/traffic-os/taxonomy";

assert.equal(classifyUtmPair("instagram_reels", "cpc")?.traffic_type, "paid");
assert.equal(classifyUtmPair("facebook_mobile_feed", "cpc")?.channel, "Meta Ads");
assert.equal(classifyUtmPair("instagram", "social"), null);
// --- Taxonomy: verified Bitrix names ---
assert.equal(classifySourceId("UC_I4VZXD").traffic_type, "messenger");
assert.equal(classifySourceId("UC_I4VZXD").channel, "WhatsApp");
assert.equal(classifySourceId("UC_MA9866").channel, "Telegram");
assert.equal(classifySourceId("EMAIL").traffic_type, "email");
assert.equal(classifySourceId("UC_LKPUT4").traffic_type, "offline");
assert.equal(classifySourceId("WEB").traffic_type, "unknown");
assert.equal(classifySourceId("WEB").channel, "Website");
assert.equal(classifySourceId("WEB").source_name, "Website Retro Pressa.com");
assert.equal(classifySourceId("UC_SLHKKC").traffic_type, "unknown"); // landing-named, needs UTM

// --- UTM derived (not guess) ---
assert.equal(classifyUtmPair("facebook", "cpc")?.traffic_type, "paid");
assert.equal(classifyUtmPair("instagram", "paid_social")?.channel, "Meta Ads");
assert.equal(classifyUtmPair("cpc", "Facebook_Mobile_Reels")?.traffic_type, "paid");
assert.equal(classifyUtmPair("instagram", "social"), null); // ambiguous → no auto
assert.equal(classifyUtmPair("facebook", "social"), null);

// WEB + facebook/cpc → paid via UTM
const webPaid = resolveLeadIdentity({
  sourceId: "WEB",
  utmSource: "facebook",
  utmMedium: "cpc"
});
assert.equal(webPaid.traffic_type, "paid");
assert.equal(webPaid.mapping_status, "derived");

const webBare = resolveLeadIdentity({ sourceId: "WEB", utmSource: "", utmMedium: "" });
assert.equal(webBare.traffic_type, "unknown");

// --- Country ---
assert.equal(normalizeCountry("Russia").code, "RU");
assert.equal(normalizeCountry("Латвия").code, "LV");
assert.equal(normalizeCountry("").status, "unknown");

// --- Landing / WEB detection ---
assert.equal(
  resolveLeadLanding({ sourceName: "https://retro-pressa.com/ru/new" }).domain,
  "retro-pressa.com"
);
assert.equal(
  resolveLeadLanding({ utmContent: "https://partypagee.com/wedding" }).domain,
  "partypagee.com"
);
assert.equal(resolveLeadLanding({ formName: "проверить наличие" }).landing_id, "landing:unknown");

const landings = buildLandingMapRows({
  urls: [{ url: "https://retro-pressa.com/life", evidence: "test" }],
  syncedAt: "t"
});
assert.ok(landings.some((r) => r.status === "missing" && r.landing_id === "landing:unknown"));
assert.ok(landings.some((r) => r.path === "/life" && r.domain === "retro-pressa.com"));

// --- Source map ---
const sourceMap = buildSourceMapRows({
  sourceIds: ["WEB", "UC_GQ92V4", "UC_I4VZXD", "UC_SLHKKC"],
  utmPairs: [
    { utm_source: "facebook", utm_medium: "cpc", lead_count: 10 },
    { utm_source: "instagram", utm_medium: "social", lead_count: 5 }
  ],
  sourceLeadCounts: new Map([
    ["WEB", 100],
    ["UC_I4VZXD", 50]
  ]),
  syncedAt: "2026-07-22T00:00:00.000Z"
});
assert.ok(sourceMap.some((r) => r.match_value === "UC_I4VZXD" && r.traffic_type === "messenger"));
assert.ok(sourceMap.some((r) => r.match_type === "utm_pair" && r.match_value === "facebook|cpc" && r.traffic_type === "paid"));
assert.ok(sourceMap.some((r) => r.match_value === "instagram|social" && r.traffic_type === "unknown"));

const resolved = resolveTrafficType({
  sourceId: "UC_SLHKKC",
  utmSource: "facebook",
  utmMedium: "cpc",
  sourceMap
});
assert.equal(resolved.traffic_type, "paid");

// --- Model ---
const daySheet = [
  ["ФОРМУЛЫ!!!", "Расход", "Выручка", "ROAS", "Клики", "Лиды CRM", "Квал. лиды", "x", "y", "z", "w", "Кол-во продаж"],
  ["День"],
  ["01.07.2026", "10", "100", "1", "5", "12", "3", "", "", "", "", "2"]
];
const orgSheet = [
  ["", "Выручка", "ROAS", "CPM", "Показы", "Клики", "CTR", "CPC", "Лиды", "Лиды CRM", "Квал. лиды", "CR", "Кол-во продаж"],
  ["День"],
  ["01.07.2026", "50", "-", "-", "0", "0", "-", "-", "0", "4", "1", "-", "1"]
];
assert.equal(parseSvodDayTrafficRaw(daySheet)[0].leads_crm, 12);
assert.equal(parseSvodOrganicRaw(orgSheet)[0].leads_crm, 4);

const model = buildTrafficOsModel({
  syncedAt: "2026-07-22T12:00:00.000Z",
  periods: ["2026-07"],
  svodDaySheet: daySheet,
  svodOrganicSheet: orgSheet,
  salesLeads: [
    {
      lead_id: "L1",
      created_at: "2026-07-01T10:00:00",
      source_id: "WEB",
      utm_source: "facebook",
      utm_medium: "cpc",
      utm_campaign: "summer",
      form_name: "проверить наличие",
      country_raw: "Latvia"
    },
    {
      lead_id: "L2",
      created_at: "2026-07-01T11:00:00",
      source_id: "UC_I4VZXD",
      utm_source: "",
      utm_medium: "",
      form_name: "",
      country_raw: ""
    },
    {
      lead_id: "L3",
      created_at: "2026-07-01T12:00:00",
      source_id: "WEB",
      utm_source: "",
      utm_medium: "",
      form_name: "заявка с сайта",
      country_raw: "Russia"
    }
  ],
  salesDeals: [{ deal_id: "D1", lead_id: "L1", created_at: "2026-07-01T12:00:00" }],
  salesInvoices: [{ event_id: "i1", deal_id: "D1", invoice_at: "2026-07-02T00:00:00" }],
  salesPayments: [{ event_id: "p1", deal_id: "D1", paid_at: "2026-07-03T00:00:00", amount: "67.5" }],
  foundationLeads: [
    { lead_id: "L1", source_description: "https://retro-pressa.com/ru/new", language_raw: "" }
  ],
  contractorLandingUrls: ["https://yourstorymagazine.com/"]
});

const a1 = model.attributions.find((r) => r.lead_id === "L1")!;
assert.equal(a1.traffic_type, "paid");
assert.equal(a1.channel, "Meta Ads");
assert.equal(a1.attribution_status, "fully_attributed");
assert.equal(String(a1.country_normalized), "LV");
assert.ok(String(a1.landing_id).includes("retro-pressa.com"));

const a2 = model.attributions.find((r) => r.lead_id === "L2")!;
assert.equal(a2.traffic_type, "messenger");
assert.equal(a2.channel, "WhatsApp");

const a3 = model.attributions.find((r) => r.lead_id === "L3")!;
assert.equal(a3.traffic_type, "unknown");
assert.equal(String(a3.country_normalized), "RU");

assert.ok(model.stats.unknownShare < 0.5);
assert.ok(model.identityCoverage.after.unknown_pct < IDENTITY_BASELINE.unknown_pct);
assert.equal(validateTrafficExportV3Header([...TRAFFIC_EXPORT_V3_COLUMNS]).ok, true);
assert.equal(validateTrafficExportV3Rows(model.exportRows).ok, true);
assert.equal(model.exportRows[0].contract_version, TRAFFIC_EXPORT_V3_CONTRACT_VERSION);
assert.ok(model.trafficManagement.length > 0);
assert.ok(model.joinQuality.length > 0);
assert.ok(model.revenueAttribution.length >= 0);
assert.ok(model.coverageSummary.unknown_share_pct != null);

console.log("traffic-os identity tests ok", {
  unknownShare: model.stats.unknownShare,
  after: model.identityCoverage.after
});
