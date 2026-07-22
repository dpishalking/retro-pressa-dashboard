import { syncOsMetricsRegistryToSheet } from "@/lib/os-sheets/metrics-registry-sync";
import { syncOsCustomersToSheet } from "@/lib/os-sheets/customers-sync";
import { syncOsPaymentsToSheet } from "@/lib/os-sheets/payments-sync";
import { syncOsCompanyDailyToSheet } from "@/lib/os-sheets/company-daily-sync";
import { syncOsCompanyMonthlyToSheet, syncOsReconciliationToSheet } from "@/lib/os-sheets/company-monthly-sync";
import {
  appendOsChangeLog,
  syncOsDataSourcesToSheet,
  syncOsDictionariesToSheet
} from "@/lib/os-sheets/registries-sync";
import { ensureSyncRunsHeader } from "@/lib/os-sheets/sync-runs";
import type { PeriodKey } from "@/types/metrics";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const periodArg = args.find((arg) => !arg.startsWith("--"));
  const periods: PeriodKey[] = ["may-2026", "june-2026", "july-2026"];
  const period = periods.includes(periodArg as PeriodKey) ? periodArg as PeriodKey : undefined;

  await ensureSyncRunsHeader();

  const metrics = await syncOsMetricsRegistryToSheet({ dryRun });
  const dataSources = await syncOsDataSourcesToSheet({ dryRun });
  const customers = await syncOsCustomersToSheet({ dryRun });
  const payments = await syncOsPaymentsToSheet({ dryRun });
  const companyDaily = await syncOsCompanyDailyToSheet({ period, dryRun });
  const companyMonthly = await syncOsCompanyMonthlyToSheet({ period, dryRun });
  const dictionaries = await syncOsDictionariesToSheet({ dryRun });
  const reconciliation = await syncOsReconciliationToSheet({ period, dryRun });

  if (!dryRun) {
    await appendOsChangeLog({
      changeType: "schema",
      system: "mother",
      entity: "core",
      description: "Mother hardening: identity, registries, monthly, reconciliation, safe-write",
      reason: "Sprint mother hardening",
      version: "mother-hardening-1"
    });
  }

  console.log(JSON.stringify({
    metrics,
    dataSources,
    customers,
    payments,
    companyDaily,
    companyMonthly,
    dictionaries,
    reconciliation
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
