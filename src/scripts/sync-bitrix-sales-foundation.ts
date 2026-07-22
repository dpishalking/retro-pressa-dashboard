import {
  SALES_FOUNDATION_SYNC_ORDER,
  type SalesFoundationModule
} from "@/config/sales-foundation";
import { syncBitrixSalesFoundation } from "@/lib/bitrix/sales-foundation/sync";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("--dry");
  const moduleArgs = args
    .filter((arg) => arg.startsWith("--module="))
    .map((arg) => arg.slice("--module=".length) as SalesFoundationModule);
  const periodArgs = args
    .filter((arg) => arg.startsWith("--period="))
    .map((arg) => arg.slice("--period=".length));
  const periodsFlag = args.find((arg) => arg.startsWith("--periods="));
  const periods = periodsFlag
    ? periodsFlag.slice("--periods=".length).split(",").map((value) => value.trim()).filter(Boolean)
    : periodArgs;

  const modules = moduleArgs.length
    ? moduleArgs
    : args.includes("--fields")
      ? (["field_catalog"] as SalesFoundationModule[])
      : args.includes("--contacts")
        ? (["contacts"] as SalesFoundationModule[])
        : args.includes("--stage-history")
          ? (["stage_history"] as SalesFoundationModule[])
          : args.includes("--pipeline")
            ? (["pipeline"] as SalesFoundationModule[])
            : args.includes("--data-quality")
              ? (["data_quality"] as SalesFoundationModule[])
              : (["all"] as SalesFoundationModule[]);

  for (const module of modules) {
    if (module !== "all" && !SALES_FOUNDATION_SYNC_ORDER.includes(module)) {
      throw new Error(`Unknown module: ${module}`);
    }
  }

  const maxDialogsArg = args.find((arg) => arg.startsWith("--max-dialogs="));
  const maxDialogSessions = maxDialogsArg
    ? Number(maxDialogsArg.slice("--max-dialogs=".length))
    : undefined;

  const result = await syncBitrixSalesFoundation({
    periods: periods.length ? periods : undefined,
    modules,
    dryRun,
    maxDialogSessions: Number.isFinite(maxDialogSessions) ? maxDialogSessions : undefined
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed") process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
