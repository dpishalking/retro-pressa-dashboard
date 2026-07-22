import { SALES_OS_SHEETS, getSalesOsSpreadsheetId } from "@/config/sales-os";
import { PAID_LEAD_SOURCE_IDS } from "@/lib/bitrix/metric-definitions";
import { readSheetValues } from "@/lib/google/sheets-client";
import { rowsFromSheet } from "@/lib/sales-os/build-model";
import {
  aggregateTrafficChannelDaily,
  isPaidLeadSourceId,
  mergeSvodLeadsIntoTrafficFacts,
  sumTrafficChannel
} from "@/lib/sales-os/traffic-channel-facts";
import { pullSvodDailyLeads } from "@/lib/sales-os/svod-plans";

async function main() {
  const id = getSalesOsSpreadsheetId();
  const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
  const [dealValues, leadValues, invValues, payValues] = await Promise.all([
    readSheetValues({ spreadsheetId: id, range: `${q(SALES_OS_SHEETS.deals)}!A1:AZ20000` }),
    readSheetValues({ spreadsheetId: id, range: `${q(SALES_OS_SHEETS.leads)}!A1:Z20000` }),
    readSheetValues({ spreadsheetId: id, range: `${q(SALES_OS_SHEETS.invoiceEvents)}!A1:Z20000` }),
    readSheetValues({ spreadsheetId: id, range: `${q(SALES_OS_SHEETS.paymentEvents)}!A1:Z20000` })
  ]);
  const deals = rowsFromSheet(dealValues);
  const leads = rowsFromSheet(leadValues);
  const invoices = rowsFromSheet(invValues);
  const payments = rowsFromSheet(payValues);
  const month = "2026-07";

  console.log({
    leads: leads.length,
    deals: deals.length,
    invoices: invoices.length,
    payments: payments.length,
    paidIds: PAID_LEAD_SOURCE_IDS
  });

  const invJuly = invoices.filter((r) => (r.invoice_at || "").startsWith(month));
  const payJuly = payments.filter((r) => (r.paid_at || "").startsWith(month));
  console.log({ invJuly: invJuly.length, payJuly: payJuly.length });

  const dealById = new Map(deals.map((d) => [d.deal_id, d]));
  const leadById = new Map(leads.map((l) => [l.lead_id, l]));

  let invPaid = 0;
  let invEmpty = 0;
  let invOrganic = 0;
  for (const inv of invJuly) {
    const deal = dealById.get(inv.deal_id || "");
    const lead = leadById.get(inv.lead_id || deal?.lead_id || "");
    const sid = deal?.source_id || lead?.source_id || "";
    if (!sid) invEmpty += 1;
    else if (isPaidLeadSourceId(sid)) invPaid += 1;
    else invOrganic += 1;
  }
  console.log({ invPaid, invOrganic, invEmpty });

  let payPaid = 0;
  let payEmpty = 0;
  let payOrganic = 0;
  for (const pay of payJuly) {
    const deal = dealById.get(pay.deal_id || "");
    const lead = leadById.get(pay.lead_id || deal?.lead_id || "");
    const sid = deal?.source_id || lead?.source_id || "";
    if (!sid) payEmpty += 1;
    else if (isPaidLeadSourceId(sid)) payPaid += 1;
    else payOrganic += 1;
  }
  console.log({ payPaid, payOrganic, payEmpty });

  const bitrix = aggregateTrafficChannelDaily({ month, leads, deals });
  const svod = await pullSvodDailyLeads({ month });
  const merged = mergeSvodLeadsIntoTrafficFacts(bitrix, svod);
  console.log("current agg paid", sumTrafficChannel(merged, "paid", month));
  console.log("current agg organic", sumTrafficChannel(merged, "organic", month));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
