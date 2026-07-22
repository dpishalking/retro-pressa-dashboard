import { syncOsDialogIndexToSheet } from "@/lib/os-sheets/dialog-index-sync";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const result = await syncOsDialogIndexToSheet({ dryRun });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
