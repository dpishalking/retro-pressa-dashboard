import { syncPredictiveByManager } from "@/lib/sales-os/sync-predictive-by-manager";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("--dry");
  const periodFlag = args.find((arg) => arg.startsWith("--period="));
  const period =
    periodFlag?.slice("--period=".length) ||
    args.find((arg) => /^\d{4}-\d{2}$/.test(arg)) ||
    new Date().toISOString().slice(0, 7);

  const result = await syncPredictiveByManager({ month: period, dryRun });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
