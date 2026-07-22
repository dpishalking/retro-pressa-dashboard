import {
  SALES_OS_DAILY_COLUMNS,
  SALES_OS_DAILY_TAB,
  getMotherSpreadsheetId
} from "@/config/sales-dual-run";
import { OS_TABS } from "@/config/os-sheets";
import { SALES_EXPORT_CONTRACT_VERSION, type SalesExportRow } from "@/lib/sales-os/export-contract";
import { classifyIngestStatus, readSalesOsExport } from "@/lib/sales-os/export-reader";
import { appendSheetRows, ensureSheetTab, readGoogleServiceAccount, readSheetValues, writeSheetValues } from "@/lib/google/sheets-client";
import { safeReplaceSheet } from "@/lib/os-sheets/safe-write";
import { withSyncRun } from "@/lib/os-sheets/sync-runs";

export type SalesOsIngestResult = {
  status: "success" | "partial" | "failed" | "skipped";
  started_at: string;
  finished_at: string;
  dryRun: boolean;
  contract_version: string;
  rows_read: number;
  rows_written: number;
  duplicate_keys: string[];
  source_updated_at: string;
  lag_minutes: number | null;
  health_status: "healthy" | "stale" | "schema_error" | "sync_failed" | "reconciliation_warning" | "unknown";
  ingest_status: "current" | "stale" | "partial" | "schema_error";
  mirror_rows: Array<Record<(typeof SALES_OS_DAILY_COLUMNS)[number], string>>;
  export_rows: SalesExportRow[];
  warnings: string[];
  errors: string[];
};

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

export function buildMirrorRows(input: {
  exportRows: SalesExportRow[];
  ingestedAt: string;
  ingestStatus: "current" | "stale" | "partial" | "schema_error";
}): Array<Record<(typeof SALES_OS_DAILY_COLUMNS)[number], string>> {
  return input.exportRows.map((row) => ({
    date: String(row.date ?? ""),
    manager_id: String(row.manager_id ?? ""),
    leads: String(row.leads ?? ""),
    deals: String(row.deals ?? ""),
    invoice_events: String(row.invoice_events ?? ""),
    payments: String(row.payments ?? ""),
    paid_revenue: String(row.paid_revenue ?? ""),
    active_deals: String(row.active_deals ?? ""),
    active_pipeline_amount: String(row.active_pipeline_amount ?? ""),
    stale_deals: String(row.stale_deals ?? ""),
    deals_without_next_activity: String(row.deals_without_next_activity ?? ""),
    lead_to_deal_cr: String(row.lead_to_deal_cr ?? ""),
    deal_to_invoice_cr: String(row.deal_to_invoice_cr ?? ""),
    invoice_to_payment_cr: String(row.invoice_to_payment_cr ?? ""),
    deal_to_payment_cr: String(row.deal_to_payment_cr ?? ""),
    average_check: String(row.average_check ?? ""),
    data_quality_score: String(row.data_quality_score ?? ""),
    source_updated_at: String(row.source_updated_at ?? ""),
    sales_os_sync_updated_at: String(row.sync_updated_at ?? ""),
    contract_version: String(row.contract_version ?? SALES_EXPORT_CONTRACT_VERSION),
    ingested_at: input.ingestedAt,
    ingest_status: input.ingestStatus
  }));
}

async function upsertDataSourceHealth(input: {
  motherId: string;
  salesOsId: string;
  status: string;
  health: string;
  rows: number;
  sourceUpdatedAt: string;
  lagMinutes: number | null;
  errorCode?: string;
  dryRun: boolean;
}) {
  if (input.dryRun) return;
  await ensureSheetTab(input.motherId, OS_TABS.dataSources);
  const existing = await readSheetValues({
    spreadsheetId: input.motherId,
    range: `${quoteTab(OS_TABS.dataSources)}!A1:P`
  });
  const syncedAt = new Date().toISOString();
  const notes = [
    `health=${input.health}`,
    `lag_minutes=${input.lagMinutes ?? ""}`,
    `contract=${SALES_EXPORT_CONTRACT_VERSION}`,
    `source_updated_at=${input.sourceUpdatedAt}`,
    `rows=${input.rows}`,
    input.errorCode ? `error=${input.errorCode}` : ""
  ].filter(Boolean).join("; ");

  const row = [
    "sales_os_export",
    "Sales OS / 99_EXPORT",
    "google_sheets_child_os",
    input.salesOsId,
    "99_EXPORT",
    "",
    "engineering",
    "rop",
    "date × manager_id",
    "date + manager_id",
    "api_sync",
    "os-daily",
    "sales management aggregates (candidate)",
    input.status === "success" || input.status === "partial" ? syncedAt : "",
    input.status,
    notes
  ];

  if (!existing.length) {
    await writeSheetValues({
      spreadsheetId: input.motherId,
      range: `${quoteTab(OS_TABS.dataSources)}!A1`,
      rows: [[
        "source_id", "source_name", "source_type", "spreadsheet_id", "sheet_name", "gid",
        "system_owner", "business_owner", "grain", "primary_key", "refresh_mode", "refresh_schedule",
        "canonical_for", "last_success_at", "last_status", "notes"
      ], row]
    });
    return;
  }

  const header = existing[0].map((cell) => String(cell ?? "").trim());
  const idIdx = header.indexOf("source_id");
  const lines = existing.slice(1);
  const idx = lines.findIndex((line) => String(line[idIdx >= 0 ? idIdx : 0] ?? "").trim() === "sales_os_export");
  if (idx < 0) {
    await appendSheetRows({ spreadsheetId: input.motherId, tabTitle: OS_TABS.dataSources, rows: [row] });
    return;
  }

  // Rewrite whole sheet with updated row to avoid partial column drift.
  const next = lines.map((line, index) => (index === idx ? row : line.map((cell) => String(cell ?? ""))));
  await writeSheetValues({
    spreadsheetId: input.motherId,
    range: `${quoteTab(OS_TABS.dataSources)}!A1`,
    clearRange: `${quoteTab(OS_TABS.dataSources)}!A:P`,
    rows: [header, ...next]
  });
}

async function upsertRegistryCandidate(motherId: string, dryRun: boolean) {
  if (dryRun) return;
  await ensureSheetTab(motherId, OS_TABS.registry);
  const existing = await readSheetValues({
    spreadsheetId: motherId,
    range: `${quoteTab(OS_TABS.registry)}!A1:Z`
  });
  const payload = {
    sheet_id: "sales_os_daily_candidate",
    sheet_name: SALES_OS_DAILY_TAB,
    role: "sales_candidate_mirror",
    source: "Sales OS / 99_EXPORT",
    grain: "date × manager_id",
    primary_key: "date + manager_id",
    contract_version: SALES_EXPORT_CONTRACT_VERSION,
    status: "candidate"
  };
  if (!existing.length) {
    const columns = Object.keys(payload);
    await writeSheetValues({
      spreadsheetId: motherId,
      range: `${quoteTab(OS_TABS.registry)}!A1`,
      rows: [columns, columns.map((key) => payload[key as keyof typeof payload])]
    });
    return;
  }
  const header = existing[0].map((cell) => String(cell ?? "").trim());
  const keyIdx = header.findIndex((name) => /sheet_id|system_id|id/i.test(name));
  const known = new Set(existing.slice(1).map((line) => String(line[keyIdx >= 0 ? keyIdx : 0] ?? "").trim()));
  if (known.has(payload.sheet_id) || known.has(payload.sheet_name)) return;
  await appendSheetRows({
    spreadsheetId: motherId,
    tabTitle: OS_TABS.registry,
    rows: [header.map((column) => {
      const key = column.toLowerCase();
      if (key.includes("sheet_id") || key === "id") return payload.sheet_id;
      if (key.includes("name") || key.includes("title")) return payload.sheet_name;
      if (key.includes("role")) return payload.role;
      if (key.includes("source")) return payload.source;
      if (key.includes("grain")) return payload.grain;
      if (key.includes("primary")) return payload.primary_key;
      if (key.includes("version")) return payload.contract_version;
      if (key.includes("status")) return payload.status;
      return "";
    })]
  });
}

export async function ingestSalesOsExport(options: {
  dryRun?: boolean;
  motherSpreadsheetId?: string;
  salesOsSpreadsheetId?: string;
  /** When provided, skip re-read of 99_EXPORT. */
  exportRows?: SalesExportRow[];
  exportMeta?: {
    sourceUpdatedAt: string;
    lagMinutes: number | null;
    stale: boolean;
    duplicateKeys: string[];
    errors: string[];
    warnings: string[];
    ok: boolean;
  };
} = {}): Promise<SalesOsIngestResult> {
  const startedAt = new Date().toISOString();
  const dryRun = options.dryRun === true;
  const motherId = options.motherSpreadsheetId?.trim() || getMotherSpreadsheetId();
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!readGoogleServiceAccount()) {
    return {
      status: "failed",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      dryRun,
      contract_version: SALES_EXPORT_CONTRACT_VERSION,
      rows_read: 0,
      rows_written: 0,
      duplicate_keys: [],
      source_updated_at: "",
      lag_minutes: null,
      health_status: "sync_failed",
      ingest_status: "schema_error",
      mirror_rows: [],
      export_rows: [],
      warnings,
      errors: ["Google service account is not configured"]
    };
  }

  const exportRead = options.exportRows
    ? {
        ok: options.exportMeta?.ok ?? true,
        rows: options.exportRows,
        rowsRead: options.exportRows.length,
        duplicateKeys: options.exportMeta?.duplicateKeys ?? [],
        sourceUpdatedAt: options.exportMeta?.sourceUpdatedAt ?? "",
        lagMinutes: options.exportMeta?.lagMinutes ?? null,
        stale: options.exportMeta?.stale ?? false,
        errors: options.exportMeta?.errors ?? [],
        warnings: options.exportMeta?.warnings ?? [],
        spreadsheetId: options.salesOsSpreadsheetId || "",
        contractVersion: SALES_EXPORT_CONTRACT_VERSION
      }
    : await readSalesOsExport({ spreadsheetId: options.salesOsSpreadsheetId });

  warnings.push(...exportRead.warnings);
  errors.push(...exportRead.errors);

  const ingestStatus = classifyIngestStatus({
    stale: exportRead.stale,
    partial: false,
    schemaError: !exportRead.ok
  });

  const mirrorRows = exportRead.ok
    ? buildMirrorRows({
        exportRows: exportRead.rows,
        ingestedAt: startedAt,
        ingestStatus
      })
    : [];

  let rowsWritten = 0;
  let health: SalesOsIngestResult["health_status"] = exportRead.ok
    ? (exportRead.stale ? "stale" : "healthy")
    : "schema_error";

  if (!exportRead.ok) {
    await upsertDataSourceHealth({
      motherId,
      salesOsId: exportRead.spreadsheetId || options.salesOsSpreadsheetId || "",
      status: "schema_error",
      health: "schema_error",
      rows: exportRead.rowsRead,
      sourceUpdatedAt: exportRead.sourceUpdatedAt,
      lagMinutes: exportRead.lagMinutes,
      errorCode: "SCHEMA_ERROR",
      dryRun
    }).catch((error) => warnings.push(`data source health update failed: ${error instanceof Error ? error.message : String(error)}`));

    return {
      status: "failed",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      dryRun,
      contract_version: SALES_EXPORT_CONTRACT_VERSION,
      rows_read: exportRead.rowsRead,
      rows_written: 0,
      duplicate_keys: exportRead.duplicateKeys,
      source_updated_at: exportRead.sourceUpdatedAt,
      lag_minutes: exportRead.lagMinutes,
      health_status: "schema_error",
      ingest_status: "schema_error",
      mirror_rows: [],
      export_rows: exportRead.rows,
      warnings,
      errors
    };
  }

  if (!dryRun) {
    try {
      await withSyncRun({
        syncName: "sales_os_export_ingest",
        source: "Sales OS / 99_EXPORT",
        target: SALES_OS_DAILY_TAB,
        spreadsheetId: motherId,
        startedAt,
        schemaVersion: SALES_EXPORT_CONTRACT_VERSION,
        triggerType: "script"
      }, async () => {
        const written = await safeReplaceSheet({
          spreadsheetId: motherId,
          tabTitle: SALES_OS_DAILY_TAB,
          expectedColumns: SALES_OS_DAILY_COLUMNS,
          rows: mirrorRows.map((row) => SALES_OS_DAILY_COLUMNS.map((column) => row[column])),
          clearRange: `${quoteTab(SALES_OS_DAILY_TAB)}!A:ZZ`,
          schemaVersion: SALES_EXPORT_CONTRACT_VERSION
        });
        rowsWritten = written.rowsWritten;
        await upsertRegistryCandidate(motherId, false);
        await upsertDataSourceHealth({
          motherId,
          salesOsId: exportRead.spreadsheetId || options.salesOsSpreadsheetId || "",
          status: "success",
          health,
          rows: rowsWritten,
          sourceUpdatedAt: exportRead.sourceUpdatedAt,
          lagMinutes: exportRead.lagMinutes,
          dryRun: false
        });
        return { rowsRead: exportRead.rowsRead, rowsWritten };
      });
    } catch (error) {
      health = "sync_failed";
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const status = errors.length ? "failed" : (warnings.length ? "partial" : "success");
  return {
    status: dryRun && !errors.length ? "success" : status,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    dryRun,
    contract_version: SALES_EXPORT_CONTRACT_VERSION,
    rows_read: exportRead.rowsRead,
    rows_written: dryRun ? 0 : rowsWritten,
    duplicate_keys: exportRead.duplicateKeys,
    source_updated_at: exportRead.sourceUpdatedAt,
    lag_minutes: exportRead.lagMinutes,
    health_status: health,
    ingest_status: ingestStatus,
    mirror_rows: mirrorRows,
    export_rows: exportRead.rows,
    warnings,
    errors
  };
}
