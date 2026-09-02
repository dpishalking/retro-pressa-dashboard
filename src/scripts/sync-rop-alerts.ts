import { syncRopAlertsDaySummary } from "@/lib/rop-alerts/sync-day-summary";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipDialogs = process.argv.includes("--skip-dialogs");
  const result = await syncRopAlertsDaySummary({
    dryRun,
    includeDialogs: !skipDialogs
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
