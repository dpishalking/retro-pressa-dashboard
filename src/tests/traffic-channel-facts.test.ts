import assert from "node:assert/strict";
import {
  aggregateTrafficChannelDaily,
  buildTrafficDiagnosis,
  isPaidUtm,
  mergeSvodLeadsIntoTrafficFacts,
  resolveTrafficChannel,
  sumTrafficChannel,
  channelOfSourceId
} from "@/lib/sales-os/traffic-channel-facts";

assert.equal(channelOfSourceId("UC_GQ92V4"), "paid");
assert.equal(channelOfSourceId("CALL"), "organic");
assert.equal(isPaidUtm("facebook", "cpc"), true);
assert.equal(isPaidUtm("facebook", "paid_social"), true);
assert.equal(isPaidUtm("", "organic"), false);
assert.equal(resolveTrafficChannel({ sourceId: "WEB", utmSource: "facebook", utmMedium: "cpc" }), "paid");
assert.equal(resolveTrafficChannel({ sourceId: "WEB", utmSource: "", utmMedium: "" }), "organic");

const byDate = aggregateTrafficChannelDaily({
  month: "2026-07",
  leads: [
    {
      lead_id: "1",
      created_at: "2026-07-10T10:00:00",
      source_id: "UC_GQ92V4",
      status_id: "NEW",
      utm_source: "facebook",
      utm_medium: "cpc"
    },
    {
      lead_id: "2",
      created_at: "2026-07-10T11:00:00",
      source_id: "WEB",
      status_id: "NEW",
      utm_source: "facebook",
      utm_medium: "paid_social"
    },
    {
      lead_id: "3",
      created_at: "2026-07-10T12:00:00",
      source_id: "CALL",
      status_id: "NEW"
    },
    { lead_id: "4", created_at: "2026-07-10T12:00:00", source_id: "UC_PXE40M", status_id: "1" }
  ],
  deals: [
    { deal_id: "d1", lead_id: "1", created_at: "2026-07-11T10:00:00", source_id: "UC_GQ92V4" },
    { deal_id: "d2", lead_id: "2", created_at: "2026-07-11T11:00:00", source_id: "WEB" },
    { deal_id: "d3", lead_id: "3", created_at: "2026-07-11T12:00:00", source_id: "CALL" }
  ],
  invoiceEvents: [
    { deal_id: "d1", lead_id: "1", invoice_at: "2026-07-12T10:00:00" },
    { deal_id: "d2", lead_id: "2", invoice_at: "2026-07-12T11:00:00" },
    { deal_id: "d3", lead_id: "3", invoice_at: "2026-07-12T12:00:00" }
  ],
  paymentEvents: [
    { deal_id: "d1", lead_id: "1", paid_at: "2026-07-13T10:00:00", amount: "100" },
    { deal_id: "d2", lead_id: "2", paid_at: "2026-07-14T10:00:00", amount: "200" },
    { deal_id: "d3", lead_id: "3", paid_at: "2026-07-14T11:00:00", amount: "50" }
  ]
});

assert.equal(byDate.get("2026-07-10")?.paid.leads, 2); // FB source + WEB+utm
assert.equal(byDate.get("2026-07-10")?.organic.leads, 1);
assert.equal(byDate.get("2026-07-12")?.paid.invoices, 2);
assert.equal(byDate.get("2026-07-12")?.organic.invoices, 1);
assert.equal(byDate.get("2026-07-13")?.paid.sale, 1);
assert.equal(byDate.get("2026-07-13")?.paid.revenue, 100);
assert.equal(byDate.get("2026-07-14")?.paid.sale, 1);
assert.equal(byDate.get("2026-07-14")?.paid.revenue, 200);
assert.equal(byDate.get("2026-07-14")?.organic.sale, 1);

const merged = mergeSvodLeadsIntoTrafficFacts(
  byDate,
  new Map([["2026-07-10", { paid: 50, organic: 5, total: 55 }]])
);
assert.equal(merged.get("2026-07-10")?.paid.leads, 50);
assert.equal(sumTrafficChannel(merged, "paid", "2026-07").invoices, 2);

const diag = buildTrafficDiagnosis({
  paid: { leads: 100, deals: 40, invoices: 10, sale: 5, revenue: 500 },
  organic: { leads: 20, deals: 10, invoices: 8, sale: 6, revenue: 900 }
});
assert.ok(diag.length >= 1);

console.log("traffic-channel-facts tests ok");
