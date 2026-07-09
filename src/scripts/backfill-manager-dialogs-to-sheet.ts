import { syncBitrixConversationHistory } from "@/lib/bitrix/conversation-connector";
import { syncLiveStoreToExportFile } from "@/lib/conversation-live-export";
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
  const periodKey = (readArg("--period") ?? "july-2026") as PeriodKey;
  const dateFrom = readArg("--date-from") ?? "2026-07-01";
  const dateTo = readArg("--date-to") ?? "2026-07-08";
  const spreadsheetId = readArg("--sheet-id");
  const tabTitle = readArg("--tab");
  const dryRun = hasFlag("--dry-run");
  const daysBack = Number(readArg("--days-back") ?? "10");
  const dialogLimit = Number(readArg("--dialog-limit") ?? "300");

  console.log(`Pulling Bitrix conversations for ${periodKey}, last ${daysBack} days...`);
  const conversations = await syncBitrixConversationHistory({
    period: periodKey,
    incremental: true,
    daysBack,
    maxDaysBack: daysBack,
    dialogLimit,
    maxDialogLimit: dialogLimit,
  });

  console.log(JSON.stringify({
    messagesAdded: conversations.summary.messagesAdded ?? 0,
    dialogsAdded: conversations.summary.dialogsAdded ?? 0,
    totalDialogs: conversations.summary.totalDialogs ?? conversations.summary.dialogsLoaded,
    totalMessages: conversations.summary.totalMessages ?? conversations.summary.messagesLoaded,
  }, null, 2));

  const liveExport = await syncLiveStoreToExportFile(periodKey);
  console.log(JSON.stringify({ liveExport }, null, 2));

  const result = await syncManagerDialogsToSheet({
    periodKey,
    managerQuery: "*",
    spreadsheetId,
    tabTitle,
    successSource: "text",
    syncLiveExport: false,
    dryRun,
    mode: "backfill",
    dateFrom,
    dateTo,
  });

  console.log(JSON.stringify(result, null, 2));

  if (dryRun) {
    console.log("Dry run — Google Sheets not updated.");
    return;
  }

  console.log(`Backfill uploaded ${result.exportedDialogs} dialogs (${dateFrom}..${dateTo})`);
  console.log(`https://docs.google.com/spreadsheets/d/${result.spreadsheetId}/edit`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
