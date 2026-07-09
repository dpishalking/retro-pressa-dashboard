import { syncManagerDialogsToSheet } from "@/lib/manager-dialogs-sheet-sync";
import type { PeriodKey } from "@/types/metrics";

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const managerQuery = readArg("--manager") ?? "*";
  const periodKey = (readArg("--period") ?? "july-2026") as PeriodKey;
  const spreadsheetId = readArg("--sheet-id");
  const tabTitle = readArg("--tab");
  const dryRun = hasFlag("--dry-run");
  const successSource = (readArg("--success-source") ?? "text") as "bitrix" | "text";
  const refreshBitrix = hasFlag("--refresh-bitrix");
  const skipLiveExport = hasFlag("--skip-live-export");
  const mode = (readArg("--mode") ?? "incremental") as "full" | "backfill" | "incremental";
  const dateFrom = readArg("--date-from");
  const dateTo = readArg("--date-to");

  const result = await syncManagerDialogsToSheet({
    periodKey,
    managerQuery,
    spreadsheetId,
    tabTitle,
    successSource,
    refreshBitrix,
    syncLiveExport: !skipLiveExport,
    dryRun,
    mode,
    dateFrom,
    dateTo,
  });

  console.log(JSON.stringify(result, null, 2));

  if (dryRun) {
    console.log("Dry run — Google Sheets not updated.");
    return;
  }

  if (result.exportedDialogs === 0) {
    console.log("No new dialogs to upload.");
    return;
  }

  console.log(`Uploaded ${result.exportedDialogs} dialogs to https://docs.google.com/spreadsheets/d/${result.spreadsheetId}/edit`);
  console.log(`Tab: ${result.tabTitle}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
