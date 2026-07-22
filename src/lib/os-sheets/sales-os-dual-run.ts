import { getMotherSpreadsheetId } from "@/config/sales-dual-run";
import { getSalesOsSpreadsheetId } from "@/config/sales-os";
import { ingestSalesOsExport } from "@/lib/os-sheets/sales-os-ingest";
import { runSalesOsReconciliation } from "@/lib/os-sheets/sales-reconciliation";
import { syncSalesOsModel } from "@/lib/sales-os/sync";
import { readSalesOsExport } from "@/lib/sales-os/export-reader";

export type DualRunOptions = {
  periods?: string[];
  dryRun?: boolean;
  runReconciliation?: boolean;
  rebuildSalesOs?: boolean;
  motherSpreadsheetId?: string;
  salesOsSpreadsheetId?: string;
};

export async function runSalesOsDualRun(options: DualRunOptions = {}) {
  const startedAt = new Date().toISOString();
  const dryRun = options.dryRun === true;
  const runReconciliation = options.runReconciliation !== false;
  const periods = options.periods?.length ? options.periods : ["2026-05", "2026-06", "2026-07"];
  const motherId = options.motherSpreadsheetId?.trim() || getMotherSpreadsheetId();
  const salesOsId = options.salesOsSpreadsheetId?.trim() || getSalesOsSpreadsheetId();
  const warnings: string[] = [];
  const errors: string[] = [];

  let buildResult: Awaited<ReturnType<typeof syncSalesOsModel>> | null = null;
  if (options.rebuildSalesOs) {
    buildResult = await syncSalesOsModel({ periods, dryRun, spreadsheetId: salesOsId, sourceSpreadsheetId: motherId });
    warnings.push(...buildResult.warnings);
    errors.push(...buildResult.errors);
  }

  const exportRead = await readSalesOsExport({ spreadsheetId: salesOsId });
  warnings.push(...exportRead.warnings);

  const ingest = await ingestSalesOsExport({
    dryRun,
    motherSpreadsheetId: motherId,
    salesOsSpreadsheetId: salesOsId,
    exportRows: exportRead.ok ? exportRead.rows : undefined,
    exportMeta: {
      ok: exportRead.ok,
      sourceUpdatedAt: exportRead.sourceUpdatedAt,
      lagMinutes: exportRead.lagMinutes,
      stale: exportRead.stale,
      duplicateKeys: exportRead.duplicateKeys,
      errors: exportRead.errors,
      warnings: exportRead.warnings
    }
  });
  warnings.push(...ingest.warnings);
  errors.push(...ingest.errors);

  let reconciliation: Awaited<ReturnType<typeof runSalesOsReconciliation>> | null = null;
  if (runReconciliation && ingest.status !== "failed") {
    reconciliation = await runSalesOsReconciliation({
      dryRun,
      periods,
      motherSpreadsheetId: motherId,
      salesOsDailyRows: dryRun || ingest.mirror_rows.length ? ingest.mirror_rows : undefined,
      sourceUpdatedAt: ingest.source_updated_at
    });
    warnings.push(...reconciliation.warnings);
    errors.push(...reconciliation.errors);
  }

  const status = errors.length
    ? (ingest.rows_written || dryRun || ingest.status === "success" ? "partial" : "failed")
    : "success";

  return {
    status,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    contract_version: ingest.contract_version,
    rows_read: ingest.rows_read,
    rows_written: ingest.rows_written + (reconciliation?.rows_written || 0),
    duplicate_keys: ingest.duplicate_keys,
    source_updated_at: ingest.source_updated_at,
    lag_minutes: ingest.lag_minutes,
    health_status: ingest.health_status,
    reconciliation_summary: reconciliation?.reconciliation_summary || [],
    cutover_readiness: reconciliation?.cutover_readiness || [],
    cutover_blocked_by: reconciliation?.cutover_blocked_by || [],
    warnings: [...new Set(warnings)],
    errors: [...new Set(errors)],
    build: buildResult,
    ingest,
    dryRun
  };
}
