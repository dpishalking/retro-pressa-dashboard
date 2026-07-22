import { runSalesOsDualRun } from "@/lib/os-sheets/sales-os-dual-run";
import { runSalesOsReconciliation } from "@/lib/os-sheets/sales-reconciliation";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("--dry");
  const reconOnly = args.includes("--reconciliation-only") || args.includes("--cutover-readiness");
  const rebuild = args.includes("--rebuild-sales-os");
  const periodsFlag = args.find((arg) => arg.startsWith("--periods="));
  const periods = periodsFlag
    ? periodsFlag.slice("--periods=".length).split(",").map((value) => value.trim()).filter(Boolean)
    : undefined;

  if (reconOnly) {
    const result = await runSalesOsReconciliation({ dryRun, periods });
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "failed") process.exit(1);
    return;
  }

  const result = await runSalesOsDualRun({
    periods,
    dryRun,
    runReconciliation: !args.includes("--no-reconciliation"),
    rebuildSalesOs: rebuild
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed") process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
