import assert from "node:assert/strict";
import {
  buildUniqueLeadIndexes,
  resolvePaymentAttribution,
  buildTrafficSalesAttributionLayer,
  classifyDealGap
} from "@/lib/traffic-os/sales-attribution";
import {
  validateTrafficExportV3Header,
  validateTrafficExportV3Rows,
  TRAFFIC_EXPORT_V3_COLUMNS,
  TRAFFIC_EXPORT_V3_CONTRACT_VERSION
} from "@/lib/traffic-os/export-contract";

const salesLeads = [
  {
    lead_id: "L1",
    created_at: "2026-04-01T10:00:00",
    source_id: "WEB",
    utm_source: "facebook",
    utm_medium: "cpc",
    utm_campaign: "spring",
    contact_id: "C1",
    customer_key: "contact:C1"
  },
  {
    lead_id: "L2",
    created_at: "2026-07-01T10:00:00",
    source_id: "UC_I4VZXD",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    contact_id: "C2",
    customer_key: "contact:C2"
  },
  {
    lead_id: "L3a",
    created_at: "2026-07-02T10:00:00",
    source_id: "WEB",
    contact_id: "C_SHARED",
    customer_key: "phone:abc"
  },
  {
    lead_id: "L3b",
    created_at: "2026-07-03T10:00:00",
    source_id: "WEB",
    contact_id: "C_SHARED",
    customer_key: "phone:abc"
  }
];

const indexes = buildUniqueLeadIndexes(salesLeads);
assert.equal(indexes.uniqueContact.get("C1"), "L1");
assert.equal(indexes.uniqueContact.has("C_SHARED"), false);
assert.equal(indexes.ambiguousContacts >= 1, true);

const attributions = [
  {
    lead_id: "L2",
    date: "2026-07-01",
    traffic_type: "messenger",
    channel: "WhatsApp",
    landing_id: "landing:unknown",
    campaign_key: "campaign:unknown",
    deal_id: "D2",
    invoice_events: 0,
    payments: 0,
    paid_revenue: 0
  }
];

const attributionByLead = new Map(attributions.map((r) => [String(r.lead_id), r]));

// high: lead_id on payment (cross-period lead)
const r1 = resolvePaymentAttribution({
  payment: {
    event_id: "P1",
    deal_id: "D1",
    lead_id: "L1",
    contact_id: "C1",
    customer_key: "contact:C1",
    paid_at: "2026-07-15",
    amount: "100"
  },
  indexes,
  attributionByLead,
  periods: ["2026-07"]
});
assert.equal(r1.method, "lead_id");
assert.equal(r1.confidence, "high");
assert.equal(r1.cross_period, true);
assert.equal(r1.identity?.traffic_type, "paid");

// medium: unique contact only
const r2 = resolvePaymentAttribution({
  payment: {
    event_id: "P2",
    deal_id: "D2",
    lead_id: "",
    contact_id: "C2",
    customer_key: "",
    paid_at: "2026-07-16",
    amount: "50"
  },
  deal: { deal_id: "D2", lead_id: "", contact_id: "C2" },
  indexes,
  attributionByLead,
  periods: ["2026-07"]
});
assert.equal(r2.method, "contact_id");
assert.equal(r2.confidence, "medium");

// ambiguous contact → unknown (no false match)
const r3 = resolvePaymentAttribution({
  payment: {
    event_id: "P3",
    deal_id: "D3",
    lead_id: "",
    contact_id: "C_SHARED",
    customer_key: "",
    paid_at: "2026-07-17",
    amount: "20"
  },
  indexes,
  attributionByLead,
  periods: ["2026-07"]
});
assert.equal(r3.method, "unknown");
assert.equal(r3.gap_reason, "ambiguous_contact");

assert.equal(classifyDealGap({ deal_id: "Dx", lead_id: "" }, indexes), "orphan_deal");
assert.equal(classifyDealGap({ deal_id: "Dy", lead_id: "MISSING" }, indexes), "missing_lead");

const layer = buildTrafficSalesAttributionLayer({
  periods: ["2026-07"],
  syncedAt: "2026-07-22T00:00:00.000Z",
  salesLeads,
  salesDeals: [
    { deal_id: "D1", lead_id: "L1", created_at: "2026-04-02", contact_id: "C1" },
    { deal_id: "D2", lead_id: "L2", created_at: "2026-07-02", contact_id: "C2" },
    { deal_id: "D_ORPHAN", lead_id: "", created_at: "2026-07-05", contact_id: "" }
  ],
  salesPayments: [
    {
      event_id: "P1",
      deal_id: "D1",
      lead_id: "L1",
      contact_id: "C1",
      customer_key: "contact:C1",
      paid_at: "2026-07-15",
      amount: "100"
    },
    {
      event_id: "P2",
      deal_id: "D2",
      lead_id: "L2",
      contact_id: "C2",
      customer_key: "contact:C2",
      paid_at: "2026-07-16",
      amount: "50"
    },
    {
      event_id: "P3",
      deal_id: "D3",
      lead_id: "",
      contact_id: "C_SHARED",
      customer_key: "phone:abc",
      paid_at: "2026-07-17",
      amount: "20"
    }
  ],
  salesInvoices: [],
  attributions,
  foundationContacts: [
    { contact_id: "C1", phone_hash: "phone:aaa", email_hash: "email:bbb" },
    { contact_id: "C2", phone_hash: "phone:ccc", email_hash: "" }
  ]
});

assert.ok(layer.joinQuality.some((r) => r.join_rule === "lead_id"));
assert.ok(layer.joinQuality.some((r) => r.join_rule === "phone_hash" && r.status === "not_used_for_revenue"));
assert.equal(layer.enrichmentCoverage.after.false_matches, 0);
assert.ok(layer.enrichmentCoverage.after.attributed_revenue >= 150);
assert.ok(layer.enrichmentCoverage.after.unknown_revenue >= 20);
assert.ok(layer.attributionGaps.some((g) => g.reason === "ambiguous_contact" || g.reason === "orphan_deal"));
assert.ok(layer.revenueAttribution.some((r) => String(r.cross_period) === "true"));
assert.ok(layer.salesCoverageExtra.some((r) => r.metric_id === "revenue_direct_attribution"));

assert.equal(validateTrafficExportV3Header([...TRAFFIC_EXPORT_V3_COLUMNS]).ok, true);
const v3 = validateTrafficExportV3Rows(layer.exportRowsV3);
assert.equal(v3.ok, true, v3.errors.join("; "));
assert.equal(layer.exportRowsV3[0]?.contract_version, TRAFFIC_EXPORT_V3_CONTRACT_VERSION);

console.log("traffic-sales-attribution tests ok", layer.enrichmentCoverage.after);
