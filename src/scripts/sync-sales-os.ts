import { syncSalesOsModel } from "@/lib/sales-os/sync";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("--dry");
  const periodsFlag = args.find((arg) => arg.startsWith("--periods="));
  const periods = periodsFlag
    ? periodsFlag.slice("--periods=".length).split(",").map((value) => value.trim()).filter(Boolean)
    : args.filter((arg) => /^\d{4}-\d{2}$/.test(arg) || /^(may|june|july)-2026$/.test(arg));

  const result = await syncSalesOsModel({
    periods: periods.length ? periods : undefined,
    dryRun
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed" || result.status === "blocked") process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
