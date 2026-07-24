import { moscowPeriodKey } from "@/lib/moscow-time";
import { refreshPredictiveSalesFrontFromWorkbook } from "@/lib/sales-os/sync-predictive";
import type { PeriodKey } from "@/types/metrics";

function isoMonthFromPeriodKey(period: PeriodKey): string {
  if (period === "may-2026") return "2026-05";
  if (period === "june-2026") return "2026-06";
  return "2026-07";
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("--dry");
  const monthFlag = args.find((a) => a.startsWith("--month="));
  const month =
    monthFlag?.slice("--month=".length) ||
    args.find((a) => /^\d{4}-\d{2}$/.test(a)) ||
    isoMonthFromPeriodKey(moscowPeriodKey());

  const result = await refreshPredictiveSalesFrontFromWorkbook({ month, dryRun });
  console.log(JSON.stringify(result, null, 2));
  if (result.skipped) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
