import { SALES_OS_SHEETS, getSalesOsSpreadsheetId } from "@/config/sales-os";
import { readSheetValues } from "@/lib/google/sheets-client";
import { rowsFromSheet } from "@/lib/sales-os/build-model";
import { syncPredictiveByTraffic } from "@/lib/sales-os/sync-predictive-by-traffic";

async function main() {
  const salesOsId = getSalesOsSpreadsheetId();
  const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
  const [leadValues, dealValues, invValues, payValues] = await Promise.all([
    readSheetValues({ spreadsheetId: salesOsId, range: `${q(SALES_OS_SHEETS.leads)}!A1:Z20000` }),
    readSheetValues({ spreadsheetId: salesOsId, range: `${q(SALES_OS_SHEETS.deals)}!A1:AZ20000` }),
    readSheetValues({
      spreadsheetId: salesOsId,
      range: `${q(SALES_OS_SHEETS.invoiceEvents)}!A1:Z20000`
    }),
    readSheetValues({
      spreadsheetId: salesOsId,
      range: `${q(SALES_OS_SHEETS.paymentEvents)}!A1:Z20000`
    })
  ]);
  const leads = rowsFromSheet(leadValues);
  const deals = rowsFromSheet(dealValues);
  const invoiceEvents = rowsFromSheet(invValues);
  const paymentEvents = rowsFromSheet(payValues);
  console.log({
    leads: leads.length,
    deals: deals.length,
    invoices: invoiceEvents.length,
    payments: paymentEvents.length
  });

  const result = await syncPredictiveByTraffic({
    month: "2026-07",
    leads,
    deals,
    invoiceEvents,
    paymentEvents,
    syncedAt: "2026-07-22T12:00:00.000Z",
    dryRun: false,
    forceBootstrap: true
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
