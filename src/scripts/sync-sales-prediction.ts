import { syncSalesPrediction, validateSalesPrediction } from "@/lib/sales-os/sync-prediction";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("--dry");
  const validateOnly = args.includes("--validate");
  const periodFlag = args.find((arg) => arg.startsWith("--period="));
  const period = periodFlag?.slice("--period=".length) || args.find((arg) => /^\d{4}-\d{2}$/.test(arg));

  if (validateOnly) {
    const result = await validateSalesPrediction({ period });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
    return;
  }

  const result = await syncSalesPrediction({
    period,
    dryRun
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed" || result.status === "blocked") process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
