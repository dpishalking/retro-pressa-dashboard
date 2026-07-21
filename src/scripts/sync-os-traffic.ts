import { syncOsTrafficToSheet } from "@/lib/os-sheets/traffic-sync";
import type { PeriodKey } from "@/types/metrics";

async function main() {
  const args = process.argv.slice(2);
  const periodArg = args.find((arg) => !arg.startsWith("--"));
  const refreshGoogle = args.includes("--refresh");
  const dryRun = args.includes("--dry-run");
  const periods: PeriodKey[] = ["may-2026", "june-2026", "july-2026"];
  const period = periods.includes(periodArg as PeriodKey) ? periodArg as PeriodKey : undefined;

  const result = await syncOsTrafficToSheet({
    period,
    refreshGoogle,
    dryRun
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
