import { syncMarketingPlanning } from "@/lib/marketing-planning/sync";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("--dry");
  const validateOnly = args.includes("--validate");
  const reconOnly = args.includes("--reconciliation");
  const periodFlag = args.find((a) => a.startsWith("--period="));
  const periodsFlag = args.find((a) => a.startsWith("--periods="));
  const periods = periodsFlag
    ? periodsFlag
        .slice("--periods=".length)
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : periodFlag
      ? [periodFlag.slice("--period=".length)]
      : args.filter((a) => /^\d{4}-\d{2}$/.test(a));

  const modules = reconOnly
    ? (["reconciliation", "data_quality"] as const)
    : validateOnly
      ? (["settings", "plans", "facts"] as const)
      : undefined;

  const result = await syncMarketingPlanning({
    periods: periods.length ? periods : undefined,
    modules: modules ? [...modules] : undefined,
    dryRun: dryRun || validateOnly
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed" || result.status === "blocked") process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
