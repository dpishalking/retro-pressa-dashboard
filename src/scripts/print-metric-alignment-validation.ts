import { readSheetValues } from "@/lib/google/sheets-client";
import {
  SALES_RECONCILIATION_TAB,
  SALES_CUTOVER_READINESS_TAB,
  getMotherSpreadsheetId
} from "@/config/sales-dual-run";

function quote(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function maps(values: string[][]) {
  if (!values.length) return [];
  const [header, ...lines] = values;
  return lines.map((line) =>
    Object.fromEntries(header.map((key, index) => [key, String(line[index] ?? "")]))
  );
}

async function main() {
  const mother = getMotherSpreadsheetId();
  const [recon, cutover] = await Promise.all([
    readSheetValues({ spreadsheetId: mother, range: `${quote(SALES_RECONCILIATION_TAB)}!A1:ZZ` }),
    readSheetValues({ spreadsheetId: mother, range: `${quote(SALES_CUTOVER_READINESS_TAB)}!A1:ZZ` })
  ]);

  const rows = maps(recon);
  const months = ["2026-05", "2026-06", "2026-07"];
  const metrics = [
    "deals",
    "payments",
    "paid_revenue",
    "active_deals",
    "active_pipeline_amount",
    "manager_count"
  ];

  for (const month of months) {
    console.log(`\n=== ${month} ===`);
    for (const metric of metrics) {
      const row = rows.find(
        (item) =>
          item.period_type === "month" &&
          item.period === month &&
          item.manager_id === "all" &&
          item.metric_id === metric
      );
      if (!row) {
        console.log(metric, "MISSING");
        continue;
      }
      console.log(
        metric,
        "legacy",
        row.legacy_value,
        "sos",
        row.sales_os_value,
        "delta",
        row.delta,
        row.status,
        (row.difference_reason || "").slice(0, 100)
      );
    }
  }

  console.log("\n=== CUTOVER ===");
  for (const row of maps(cutover)) {
    console.log(
      row.metric_id,
      "ready",
      row.cutover_ready,
      "latest",
      row.latest_status,
      "m7",
      row.matched_days_7d,
      (row.blocking_reason || "").slice(0, 120)
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
