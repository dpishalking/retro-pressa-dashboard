import { bootstrapPredictiveSheets } from "@/lib/predictive-sheets/bootstrap";
import { getPredictiveSheetsSpreadsheetId } from "@/config/predictive-sheets";

async function main() {
  const period = process.argv.find((a) => a.startsWith("--period="))?.slice("--period=".length) || "2026-08";
  const asOf = process.argv.find((a) => a.startsWith("--as-of="))?.slice("--as-of=".length);
  const spreadsheetId =
    process.argv.find((a) => a.startsWith("--id="))?.slice("--id=".length) || getPredictiveSheetsSpreadsheetId();
  const skipFormatting = process.argv.includes("--skip-formatting");
  const formatOnly = process.argv.includes("--format-only");

  console.log(`Bootstrapping Predictive Sheets → ${spreadsheetId}`);
  console.log(
    `Period=${period}${asOf ? ` asOf=${asOf}` : ""}${skipFormatting ? " (skip formatting)" : ""}${formatOnly ? " (format only)" : ""}`
  );

  const result = await bootstrapPredictiveSheets({
    spreadsheetId,
    period,
    asOfDate: asOf,
    skipFormatting,
    formatOnly
  });

  console.log("\nDone.");
  console.log("URL:", `https://docs.google.com/spreadsheets/d/${result.spreadsheetId}/edit`);
  console.log("Created:", result.sheetsCreated.join(", ") || "(none)");
  console.log("Reused:", result.sheetsReused.join(", ") || "(none)");
  console.log("Metrics:", result.metricsCount);
  console.log("Seed:", result.seededFrom);
  console.log("Missing / DQ issues:", result.missingData.length);
  for (const issue of result.missingData.slice(0, 25)) {
    console.log(" -", issue);
  }
  if (result.missingData.length > 25) {
    console.log(` ... +${result.missingData.length - 25} more`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
