import { syncTrafficOs } from "@/lib/traffic-os/sync";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("--dry");
  const validateOnly = args.includes("--validate");
  const coverageOnly = args.includes("--coverage-only");
  const periodsFlag = args.find((arg) => arg.startsWith("--periods="));
  const modulesFlag = args.find((arg) => arg.startsWith("--modules="));
  const periods = periodsFlag
    ? periodsFlag
        .slice("--periods=".length)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : args.filter((arg) => /^\d{4}-\d{2}$/.test(arg) || /^(may|june|july)-2026$/.test(arg));
  const modules = modulesFlag
    ? modulesFlag
        .slice("--modules=".length)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : coverageOnly
      ? ["sales_coverage", "alerts", "data_quality", "reconciliation"]
      : validateOnly
        ? ["export"]
        : undefined;

  const result = await syncTrafficOs({
    periods: periods.length ? periods : undefined,
    dryRun: dryRun || validateOnly,
    modules
  });

  if (validateOnly) {
    console.log(
      JSON.stringify(
        {
          status: result.status,
          contract_version: result.contract_version,
          export_rows: result.stats.exportRows,
          errors: result.errors,
          warnings: result.warnings
        },
        null,
        2
      )
    );
  } else {
    console.log(JSON.stringify(result, null, 2));
  }

  if (result.status === "failed" || result.status === "blocked") process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
