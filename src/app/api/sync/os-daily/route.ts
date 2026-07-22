import { NextResponse } from "next/server";
import { moscowPeriodKey, moscowYesterdayIso } from "@/lib/moscow-time";
import { syncOsOrdersToSheet } from "@/lib/os-sheets/orders-sync";
import { syncOsTrafficToSheet } from "@/lib/os-sheets/traffic-sync";
import { syncOsSalesToSheet } from "@/lib/os-sheets/sales-sync";
import { syncOsFinanceToSheet } from "@/lib/os-sheets/finance-sync";
import { syncOsCustomersToSheet } from "@/lib/os-sheets/customers-sync";
import { syncOsPaymentsToSheet } from "@/lib/os-sheets/payments-sync";
import { syncOsCompanyDailyToSheet } from "@/lib/os-sheets/company-daily-sync";
import { syncOsCompanyMonthlyToSheet, syncOsReconciliationToSheet } from "@/lib/os-sheets/company-monthly-sync";
import {
  appendOsChangeLog,
  syncOsDataSourcesToSheet,
  syncOsDictionariesToSheet
} from "@/lib/os-sheets/registries-sync";
import { syncOsMetricsRegistryToSheet } from "@/lib/os-sheets/metrics-registry-sync";
import { ensureSyncRunsHeader } from "@/lib/os-sheets/sync-runs";
import { runSalesOsDualRun } from "@/lib/os-sheets/sales-os-dual-run";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const periods: PeriodKey[] = ["may-2026", "june-2026", "july-2026"];

let osDailyRunning = false;

async function runStep<T>(name: string, fn: () => Promise<T>): Promise<{ name: string; ok: boolean; result?: T; error?: string }> {
  try {
    const result = await fn();
    return { name, ok: true, result };
  } catch (error) {
    return { name, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Morning OS sheet refresh.
 * Legacy domain syncs first; Sales OS candidate ingest is non-blocking for company aggregates.
 */
export async function POST(request: Request) {
  if (osDailyRunning) {
    return NextResponse.json({ error: "os-daily already running", status: "skipped" }, { status: 409 });
  }
  osDailyRunning = true;

  try {
    const body = await request.json().catch(() => ({})) as {
      period?: string;
      refresh?: boolean;
      skipSalesOsCandidate?: boolean;
    };

    const targetDay = moscowYesterdayIso();
    const period = periods.includes(body.period as PeriodKey)
      ? body.period as PeriodKey
      : moscowPeriodKey();
    const refresh = body.refresh !== false;

    await ensureSyncRunsHeader();

    const orders = await runStep("orders", () => syncOsOrdersToSheet({ period, refreshBitrix: refresh }));
    const traffic = await runStep("traffic", () => syncOsTrafficToSheet({ period, refreshGoogle: refresh }));
    const sales = await runStep("sales", () => syncOsSalesToSheet({ period }));
    const finance = await runStep("finance", () => syncOsFinanceToSheet({ period }));
    const customers = await runStep("customers", () => syncOsCustomersToSheet({ triggerType: "cron" }));
    const payments = await runStep("payments", () => syncOsPaymentsToSheet({ triggerType: "cron" }));

    const isoPeriod = period === "may-2026" ? "2026-05" : period === "june-2026" ? "2026-06" : "2026-07";
    const salesOsCandidate = body.skipSalesOsCandidate
      ? { name: "sales_os_candidate", ok: true as const, result: { status: "skipped" } }
      : await runStep("sales_os_candidate", () => runSalesOsDualRun({
          periods: [isoPeriod],
          dryRun: false,
          runReconciliation: true,
          rebuildSalesOs: false
        }));

    const companyDaily = await runStep("company_daily", () => syncOsCompanyDailyToSheet({ period }));
    const companyMonthly = await runStep("company_monthly", () => syncOsCompanyMonthlyToSheet({ period }));
    const dictionaries = await runStep("dictionaries", () => syncOsDictionariesToSheet());
    const reconciliation = await runStep("reconciliation", () => syncOsReconciliationToSheet({ period }));
    const metrics = await runStep("metrics_registry", () => syncOsMetricsRegistryToSheet({ triggerType: "cron" }));
    const dataSources = await runStep("data_sources", () => syncOsDataSourcesToSheet());

    const steps = [
      orders, traffic, sales, finance, customers, payments,
      salesOsCandidate,
      companyDaily, companyMonthly, dictionaries, reconciliation, metrics, dataSources
    ];
    const failed = steps.filter((step) => !step.ok);
    const status = failed.length === 0 ? "success" : failed.length === steps.length ? "failed" : "partial";

    if (status !== "failed") {
      await appendOsChangeLog({
        changeType: "sync",
        system: "os-daily",
        entity: "mother",
        description: `os-daily ${status} for ${period}`,
        reason: failed.length
          ? failed.map((item) => `${item.name}:${"error" in item ? item.error : "failed"}`).join("; ").slice(0, 300)
          : "scheduled refresh",
        version: "sales-os-dual-run-1"
      }).catch(() => undefined);
    }

    return NextResponse.json({
      ok: status !== "failed",
      status,
      timezone: "Europe/Moscow",
      targetDay,
      period,
      syncedAt: new Date().toISOString(),
      steps
    }, { status: status === "failed" ? 500 : 200 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "os-daily failed"
    }, { status: 500 });
  } finally {
    osDailyRunning = false;
  }
}
