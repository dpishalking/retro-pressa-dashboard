import { syncBitrixOpenLinesViaCrm } from "@/lib/bitrix/openline-crm-connector";
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
  const sessionLimit = Number(readArg("--dialog-limit") ?? "300");
  const skipSheet = hasFlag("--skip-sheet");
  const startOffset = Number(readArg("--start-offset") ?? "0");

  console.log(`Pulling Bitrix open lines for ${periodKey}, ${dateFrom}..${dateTo}...`);
  const conversations = await syncBitrixOpenLinesViaCrm({
    period: periodKey,
    dateFrom,
    dateTo,
    sessionLimit,
    startOffset,
  });

  console.log(JSON.stringify({
    activitiesScanned: conversations.summary.activitiesScanned,
    sessionsImported: conversations.summary.sessionsImported,
    messagesAdded: conversations.summary.messagesAdded,
    dialogsAdded: conversations.summary.dialogsAdded,
    totalDialogs: conversations.summary.totalDialogs,
    totalMessages: conversations.summary.totalMessages,
    nextOffset: conversations.summary.nextOffset,
    hasMore: conversations.summary.hasMore,
  }, null, 2));

  const liveExport = await syncLiveStoreToExportFile(periodKey);
  console.log(JSON.stringify({ liveExport }, null, 2));

  if (skipSheet) {
    console.log("Skipping Google Sheets upload (--skip-sheet).");
    return;
  }

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
