import { syncOsOrdersToSheet } from "@/lib/os-sheets/orders-sync";
import type { PeriodKey } from "@/types/metrics";

async function main() {
  const args = process.argv.slice(2);
  const periodArg = args.find((arg) => !arg.startsWith("--"));
  const refreshBitrix = args.includes("--refresh");
  const dryRun = args.includes("--dry-run");
  const periods: PeriodKey[] = ["may-2026", "june-2026", "july-2026"];
  const period = periods.includes(periodArg as PeriodKey) ? periodArg as PeriodKey : undefined;

  const result = await syncOsOrdersToSheet({
    period,
    refreshBitrix,
    dryRun
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
