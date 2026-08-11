/**
 * Historical backfill of Analytics OS Bitrix period snapshots.
 * Does NOT wipe Mother Foundation — only refreshes data/bitrix-snapshots/{period}.json
 *
 * Usage:
 *   npx tsx --env-file=.env.local src/scripts/backfill-bitrix-snapshots.ts
 *   npx tsx --env-file=.env.local src/scripts/backfill-bitrix-snapshots.ts --periods=may-2026,june-2026,july-2026,august-2026
 */
import { syncBitrixMetrics } from "@/lib/bitrix/connector";
import type { PeriodKey } from "@/types/metrics";

const DEFAULT_PERIODS: PeriodKey[] = ["may-2026", "june-2026", "july-2026", "august-2026"];

function parsePeriods(): PeriodKey[] {
  const arg = process.argv.find((item) => item.startsWith("--periods="));
  if (!arg) return DEFAULT_PERIODS;
  const raw = arg.slice("--periods=".length).split(",").map((s) => s.trim()).filter(Boolean);
  return (raw.length ? raw : DEFAULT_PERIODS) as PeriodKey[];
}

async function main() {
  const periods = parsePeriods();
  console.log(`Backfill Bitrix snapshots: ${periods.join(", ")}`);
  for (const period of periods) {
    const started = Date.now();
    const payload = await syncBitrixMetrics({ period, refresh: true });
    const summary = (payload as { summary?: { paidDealsLoaded?: number; leadsLoaded?: number; snapshotUpdatedAt?: string } }).summary;
    console.log(
      `${period}: leads=${summary?.leadsLoaded ?? "?"} paid=${summary?.paidDealsLoaded ?? "?"} updated=${summary?.snapshotUpdatedAt ?? "?"} (${Date.now() - started}ms)`
    );
  }
  console.log("Done. Sales Cycle will merge all period snapshots on next /api/analytics/sales-cycle request.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
