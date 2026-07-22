import assert from "node:assert/strict";
import {
  TRAFFIC_ORGANIC_TAB_DEFAULT,
  TRAFFIC_PAID_TAB_DEFAULT,
  buildTrafficChannelGrid,
  parseTrafficDateColumns,
  trafficChannelTitle,
  trafficTabTitleForChannel
} from "@/lib/sales-os/predictive-by-traffic-model";
import { PREDICTIVE_METRICS, deriveDealsPlanForInvoices } from "@/lib/sales-os/predictive-model";

assert.equal(TRAFFIC_PAID_TAB_DEFAULT, "Продажи — Paid");
assert.equal(TRAFFIC_ORGANIC_TAB_DEFAULT, "Продажи — Organic");
assert.equal(trafficTabTitleForChannel("paid"), TRAFFIC_PAID_TAB_DEFAULT);
assert.equal(trafficChannelTitle("organic"), "Продажи — органика");

const planDeals = deriveDealsPlanForInvoices({
  planInvoices: 587,
  dealsFact: 750,
  invoicesFact: 149
});
assert.ok(planDeals != null && planDeals > 0);

const paidGrid = buildTrafficChannelGrid({
  month: "2026-07",
  channel: "paid",
  plans: {
    revenue: 29017,
    sale: 427,
    leads: 2667,
    invoices: 587,
    aov: 68,
    crLeadInvoice: 0.22,
    crLeadSale: 0.16,
    crInvoiceSale: 0.73
  },
  planDeals
});
assert.equal(paidGrid[0][0], "Продажи — платный трафик");
assert.equal(paidGrid[PREDICTIVE_METRICS.cr_l_deal.planRow - 1][0], "CR L → Deal");
assert.match(String(paidGrid[PREDICTIVE_METRICS.revenue.planRow - 1][43] || ""), /29017/);
assert.equal(String(paidGrid[PREDICTIVE_METRICS.deals.planRow - 1][43] || ""), String(planDeals));
// Plan CR = formula deals/leads (same as main sheet), not SVOD «Лид в счет».
assert.match(
  String(paidGrid[PREDICTIVE_METRICS.cr_l_deal.planRow - 1][43] || ""),
  new RegExp(`AR${PREDICTIVE_METRICS.deals.planRow}/AR${PREDICTIVE_METRICS.leads.planRow}`)
);
assert.match(
  String(paidGrid[PREDICTIVE_METRICS.cr_l_deal.factRow - 1][43] || ""),
  new RegExp(`AR${PREDICTIVE_METRICS.deals.factRow}/AR${PREDICTIVE_METRICS.leads.factRow}`)
);
assert.match(
  String(paidGrid[PREDICTIVE_METRICS.cr_deal_invoice.planRow - 1][43] || ""),
  new RegExp(`AR${PREDICTIVE_METRICS.invoices.planRow}/AR${PREDICTIVE_METRICS.deals.planRow}`)
);
assert.match(String(paidGrid[2][3] || ""), /29\.06/);

const organicGrid = buildTrafficChannelGrid({
  month: "2026-07",
  channel: "organic",
  plans: {
    revenue: 7257,
    sale: 107,
    leads: 667,
    invoices: 147,
    aov: 68,
    crLeadInvoice: 0.22,
    crLeadSale: 0.16,
    crInvoiceSale: 0.73
  },
  planDeals: 420
});
assert.equal(organicGrid[0][0], "Продажи — органика");
assert.match(String(organicGrid[PREDICTIVE_METRICS.leads.planRow - 1][43] || ""), /667/);
assert.equal(String(organicGrid[PREDICTIVE_METRICS.deals.planRow - 1][43] || ""), "420");

const map = parseTrafficDateColumns(paidGrid, "2026-07");
assert.ok(map.has("2026-07-01"));
assert.ok(map.has("2026-07-22"));

console.log("predictive-by-traffic tests ok");
