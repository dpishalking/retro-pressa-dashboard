import {
  DAILY_FACT_COLUMNS,
  DATA_QUALITY_COLUMNS,
  DEALS_COLUMNS,
  DEFAULT_SALES_OS_PERIODS,
  DIALOG_LINKS_COLUMNS,
  FUNNEL_FACT_COLUMNS,
  INVOICE_EVENTS_COLUMNS,
  LEADS_COLUMNS,
  MANAGERS_COLUMNS,
  PAYMENT_EVENTS_COLUMNS,
  PIPELINE_COLUMNS,
  README_COLUMNS,
  ROP_BOARD_COLUMNS,
  SALES_OS_CONTRACT_VERSION,
  SALES_OS_SHEETS,
  SETTINGS_COLUMNS,
  STAGE_HISTORY_COLUMNS,
  STAGE_MAP_COLUMNS,
  MARIA_DAILY_COLUMNS,
  MARIA_SNAPSHOT_COLUMNS,
  getSalesOsSourceSpreadsheetId,
  getSalesOsSpreadsheetId,
  type SalesOsModule
} from "@/config/sales-os";
import { DATA_SOURCES_COLUMNS, OS_TABS } from "@/config/os-sheets";
import { SALES_FOUNDATION_TABS } from "@/config/sales-foundation";
import { SALES_EXPORT_COLUMNS } from "@/lib/sales-os/export-contract";
import { checkSalesOsAccess } from "@/lib/sales-os/access";
import { buildSalesOsModel, rowsFromSheet, toMatrix } from "@/lib/sales-os/build-model";
import { buildRopBoard, mergeSettingsWithRopPlan, type SettingsRow } from "@/lib/sales-os/rop-board";
import { mariaDailyFromMap, mergeMariaDailyRows, type MariaDailyRow } from "@/lib/sales-os/maria-daily";
import {
  applyMariaTruthToDaily,
  mariaSnapshotRows,
  pullMariaTruthSnapshot
} from "@/lib/sales-os/maria-truth";
import { syncPredictiveSalesFront, type PredictiveSyncResult } from "@/lib/sales-os/sync-predictive";
import {
  syncPredictiveByTraffic,
  type TrafficSyncResult
} from "@/lib/sales-os/sync-predictive-by-traffic";
import {
  appendSheetRows,
  ensureSheetTab,
  readGoogleServiceAccount,
  readSheetValues,
  writeSheetValues
} from "@/lib/google/sheets-client";
import { safeReplaceSheet } from "@/lib/os-sheets/safe-write";
import { appendOsChangeLog } from "@/lib/os-sheets/registries-sync";
import { withSyncRun } from "@/lib/os-sheets/sync-runs";

export type SalesOsSyncResult = {
  status: "success" | "partial" | "failed" | "blocked";
  started_at: string;
  finished_at: string;
  dryRun: boolean;
  spreadsheetId: string;
  sourceSpreadsheetId: string;
  periods: string[];
  rows_read: number;
  rows_written: number;
  sheets: Array<{ sheet: string; rows: number; written: number }>;
  warnings: string[];
  errors: string[];
  access?: Awaited<ReturnType<typeof checkSalesOsAccess>>;
  reconciliation?: {
    leads: number;
    deals: number;
    invoices: number;
    payments: number;
    export_rows: number;
  };
  predictive?: PredictiveSyncResult;
  predictiveTraffic?: TrafficSyncResult;
};

let lock: Promise<SalesOsSyncResult> | null = null;

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function normalizePeriods(periods?: string[]): string[] {
  if (!periods?.length) return [...DEFAULT_SALES_OS_PERIODS];
  return periods.map((period) => {
    if (/^\d{4}-\d{2}$/.test(period)) return period;
    if (period === "may-2026") return "2026-05";
    if (period === "june-2026") return "2026-06";
    if (period === "july-2026") return "2026-07";
    return period;
  });
}

async function readMotherTab(spreadsheetId: string, tabTitle: string) {
  const values = await readSheetValues({
    spreadsheetId,
    range: `${quoteTab(tabTitle)}!A1:ZZ`
  });
  return rowsFromSheet(values);
}

async function writeSheet(input: {
  dryRun: boolean;
  spreadsheetId: string;
  tabTitle: string;
  columns: readonly string[];
  rows: Array<Array<string | number>>;
}) {
  if (input.dryRun) return { written: 0 };
  const result = await safeReplaceSheet({
    spreadsheetId: input.spreadsheetId,
    tabTitle: input.tabTitle,
    expectedColumns: input.columns,
    rows: input.rows,
    clearRange: `${quoteTab(input.tabTitle)}!A:ZZ`,
    schemaVersion: SALES_OS_CONTRACT_VERSION
  });
  return { written: result.rowsWritten };
}

async function registerInMother(input: {
  motherId: string;
  salesOsId: string;
  syncedAt: string;
  dryRun: boolean;
}) {
  if (input.dryRun) return;
  await ensureSheetTab(input.motherId, OS_TABS.registry);
  const registry = await readSheetValues({
    spreadsheetId: input.motherId,
    range: `${quoteTab(OS_TABS.registry)}!A1:Z`
  });
  const header = (registry[0] || []).map((cell) => String(cell ?? "").trim());
  const payload = {
    system_id: "sales_os",
    system_name: "Retro Pressa — Sales OS",
    system_type: "child_os",
    spreadsheet_id: input.salesOsId,
    role: "sales_data_model",
    contract_sheet: "99_EXPORT",
    contract_version: SALES_OS_CONTRACT_VERSION,
    status: "active",
    updated_at: input.syncedAt
  };

  if (!header.length) {
    const columns = Object.keys(payload);
    await writeSheetValues({
      spreadsheetId: input.motherId,
      range: `${quoteTab(OS_TABS.registry)}!A1`,
      rows: [columns, columns.map((column) => payload[column as keyof typeof payload])]
    });
  } else {
    const idIndex = header.findIndex((name) => /system_id|sheet_id|spreadsheet/i.test(name));
    const keyIndex = idIndex >= 0 ? idIndex : 0;
    const existing = new Set(registry.slice(1).map((line) => String(line[keyIndex] ?? "").trim()));
    if (!existing.has("sales_os") && !existing.has(input.salesOsId)) {
      await appendSheetRows({
        spreadsheetId: input.motherId,
        tabTitle: OS_TABS.registry,
        rows: [header.map((column) => {
          const key = column.toLowerCase();
          if (key.includes("system_id") || key === "id") return payload.system_id;
          if (key.includes("name") || key.includes("title")) return payload.system_name;
          if (key.includes("type")) return payload.system_type;
          if (key.includes("spreadsheet")) return payload.spreadsheet_id;
          if (key.includes("role")) return payload.role;
          if (key.includes("contract_sheet") || key.includes("export")) return payload.contract_sheet;
          if (key.includes("version")) return payload.contract_version;
          if (key.includes("status")) return payload.status;
          if (key.includes("updated") || key.includes("sync")) return payload.updated_at;
          return "";
        })]
      });
    }
  }

  await ensureSheetTab(input.motherId, OS_TABS.dataSources);
  const sources = await readSheetValues({
    spreadsheetId: input.motherId,
    range: `${quoteTab(OS_TABS.dataSources)}!A1:P`
  });
  const sourceRow = [
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
    "manual/api",
    "sales management aggregates",
    input.syncedAt,
    "active",
    "Mother reads only 99_EXPORT"
  ];
  if (!sources.length) {
    await safeReplaceSheet({
      spreadsheetId: input.motherId,
      tabTitle: OS_TABS.dataSources,
      expectedColumns: DATA_SOURCES_COLUMNS,
      rows: [sourceRow],
      clearRange: `${quoteTab(OS_TABS.dataSources)}!A:P`
    });
  } else {
    const headerSources = sources[0].map((cell) => String(cell ?? "").trim());
    const idIdx = headerSources.indexOf("source_id");
    const known = new Set(sources.slice(1).map((line) => String(line[idIdx >= 0 ? idIdx : 0] ?? "").trim()));
    if (!known.has("sales_os_export")) {
      await appendSheetRows({
        spreadsheetId: input.motherId,
        tabTitle: OS_TABS.dataSources,
        rows: [sourceRow]
      });
    }
  }

  await appendOsChangeLog({
    spreadsheetId: input.motherId,
    changeType: "register",
    system: "sales_os",
    entity: "99_EXPORT",
    description: `Registered Sales OS child workbook ${input.salesOsId}`,
    reason: "Sales OS Data Model v1",
    version: SALES_OS_CONTRACT_VERSION
  });
}

export async function syncSalesOsModel(options: {
  periods?: string[];
  dryRun?: boolean;
  spreadsheetId?: string;
  sourceSpreadsheetId?: string;
  modules?: SalesOsModule[];
} = {}): Promise<SalesOsSyncResult> {
  if (lock) throw new Error("sales_os sync already running");

  const run = (async (): Promise<SalesOsSyncResult> => {
    const startedAt = new Date().toISOString();
    const periods = normalizePeriods(options.periods);
    const dryRun = options.dryRun === true;
    const spreadsheetId = options.spreadsheetId?.trim() || getSalesOsSpreadsheetId();
    const sourceSpreadsheetId = options.sourceSpreadsheetId?.trim() || getSalesOsSourceSpreadsheetId();
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!readGoogleServiceAccount()) {
      return {
        status: "blocked",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        dryRun,
        spreadsheetId,
        sourceSpreadsheetId,
        periods,
        rows_read: 0,
        rows_written: 0,
        sheets: [],
        warnings,
        errors: ["Google service account is not configured"]
      };
    }

    const access = await checkSalesOsAccess(spreadsheetId);
    if (!access.ok && !dryRun) {
      return {
        status: "blocked",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        dryRun,
        spreadsheetId,
        sourceSpreadsheetId,
        periods,
        rows_read: 0,
        rows_written: 0,
        sheets: [],
        warnings,
        errors: [access.error, ...access.instruction],
        access
      };
    }
    if (!access.ok && dryRun) {
      warnings.push(`Sales OS write access unavailable: ${access.error}`);
      warnings.push(...access.instruction);
    }

    const [
      leadsRaw,
      dealsRaw,
      stagesRaw,
      stageHistoryRaw,
      pipelineRaw,
      dialogLinksRaw,
      dataQualityRaw
    ] = await Promise.all([
      readMotherTab(sourceSpreadsheetId, SALES_FOUNDATION_TABS.leadsRaw),
      readMotherTab(sourceSpreadsheetId, SALES_FOUNDATION_TABS.dealsRaw),
      readMotherTab(sourceSpreadsheetId, SALES_FOUNDATION_TABS.stages),
      readMotherTab(sourceSpreadsheetId, SALES_FOUNDATION_TABS.stageHistory),
      readMotherTab(sourceSpreadsheetId, SALES_FOUNDATION_TABS.pipeline),
      readMotherTab(sourceSpreadsheetId, SALES_FOUNDATION_TABS.dialogLinks),
      readMotherTab(sourceSpreadsheetId, SALES_FOUNDATION_TABS.dataQuality)
    ]);

    const model = buildSalesOsModel({
      periods,
      syncedAt: startedAt,
      leadsRaw,
      dealsRaw,
      stagesRaw,
      stageHistoryRaw,
      pipelineRaw,
      dialogLinksRaw,
      dataQualityRaw
    });

    let existingSettings: SettingsRow[] = [];
    try {
      const settingsValues = await readSheetValues({
        spreadsheetId,
        range: `${quoteTab(SALES_OS_SHEETS.settings)}!A1:Z`
      });
      existingSettings = rowsFromSheet(settingsValues).map((row) => ({
        key: row.key || "",
        value: row.value || "",
        notes: row.notes || "",
        updated_at: row.updated_at || ""
      })).filter((row) => row.key);
    } catch {
      existingSettings = [];
    }

    const planMonthDefault = periods.includes(startedAt.slice(0, 7))
      ? startedAt.slice(0, 7)
      : (periods[periods.length - 1] || startedAt.slice(0, 7));

    const mergedSettings = mergeSettingsWithRopPlan({
      systemSettings: model.settings as SettingsRow[],
      existingSettings,
      syncedAt: startedAt,
      defaultPlanMonth: planMonthDefault
    });

    let existingMaria: MariaDailyRow[] = [];
    try {
      const mariaValues = await readSheetValues({
        spreadsheetId,
        range: `${quoteTab(SALES_OS_SHEETS.mariaDaily)}!A1:Z`
      });
      existingMaria = rowsFromSheet(mariaValues)
        .map((row) => mariaDailyFromMap(row))
        .filter((row): row is MariaDailyRow => Boolean(row));
    } catch {
      existingMaria = [];
    }

    let mariaDaily = mergeMariaDailyRows({
      existing: existingMaria,
      syncedAt: startedAt
    });

    let mariaSnapshotRowsData: Array<{ key: string; value: string; notes: string; updated_at: string }> = [];
    try {
      const truth = await pullMariaTruthSnapshot();
      mariaDaily = applyMariaTruthToDaily({
        existing: mariaDaily,
        snapshot: truth,
        syncedAt: startedAt
      });
      // Preserve chat-level paid_* on report date if already filled (truth sheet has invoices, not always day payments).
      mariaSnapshotRowsData = mariaSnapshotRows(truth);
      console.log(`[sales-os] maria truth pulled report_date=${truth.reportDate} invoices=${truth.yesterday.invoicesCount} month_revenue=${truth.month.revenue}`);
    } catch (error) {
      warnings.push(`maria truth pull failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const ropBoard = buildRopBoard({
      settings: mergedSettings,
      dailyFact: model.dailyFact,
      pipeline: model.pipeline,
      mariaDaily,
      mariaSnapshot: mariaSnapshotRowsData,
      today: startedAt.slice(0, 10),
      syncedAt: startedAt
    });

    const sheetPlans: Array<{ sheet: string; columns: readonly string[]; rows: Array<Array<string | number>> }> = [
      { sheet: SALES_OS_SHEETS.readme, columns: README_COLUMNS, rows: toMatrix(README_COLUMNS, model.readme) },
      { sheet: SALES_OS_SHEETS.settings, columns: SETTINGS_COLUMNS, rows: toMatrix(SETTINGS_COLUMNS, mergedSettings) },
      { sheet: SALES_OS_SHEETS.managers, columns: MANAGERS_COLUMNS, rows: toMatrix(MANAGERS_COLUMNS, model.managers) },
      { sheet: SALES_OS_SHEETS.leads, columns: LEADS_COLUMNS, rows: toMatrix(LEADS_COLUMNS, model.leads) },
      { sheet: SALES_OS_SHEETS.deals, columns: DEALS_COLUMNS, rows: toMatrix(DEALS_COLUMNS, model.deals) },
      { sheet: SALES_OS_SHEETS.stageMap, columns: STAGE_MAP_COLUMNS, rows: toMatrix(STAGE_MAP_COLUMNS, model.stageMap) },
      { sheet: SALES_OS_SHEETS.stageHistory, columns: STAGE_HISTORY_COLUMNS, rows: toMatrix(STAGE_HISTORY_COLUMNS, model.stageHistory) },
      { sheet: SALES_OS_SHEETS.invoiceEvents, columns: INVOICE_EVENTS_COLUMNS, rows: toMatrix(INVOICE_EVENTS_COLUMNS, model.invoiceEvents) },
      { sheet: SALES_OS_SHEETS.paymentEvents, columns: PAYMENT_EVENTS_COLUMNS, rows: toMatrix(PAYMENT_EVENTS_COLUMNS, model.paymentEvents) },
      { sheet: SALES_OS_SHEETS.activePipeline, columns: PIPELINE_COLUMNS, rows: toMatrix(PIPELINE_COLUMNS, model.pipeline) },
      { sheet: SALES_OS_SHEETS.dialogLinks, columns: DIALOG_LINKS_COLUMNS, rows: toMatrix(DIALOG_LINKS_COLUMNS, model.dialogLinks) },
      { sheet: SALES_OS_SHEETS.dataQuality, columns: DATA_QUALITY_COLUMNS, rows: toMatrix(DATA_QUALITY_COLUMNS, model.dataQuality) },
      { sheet: SALES_OS_SHEETS.dailyFact, columns: DAILY_FACT_COLUMNS, rows: toMatrix(DAILY_FACT_COLUMNS, model.dailyFact) },
      { sheet: SALES_OS_SHEETS.funnelFact, columns: FUNNEL_FACT_COLUMNS, rows: toMatrix(FUNNEL_FACT_COLUMNS, model.funnelFact) },
      { sheet: SALES_OS_SHEETS.mariaDaily, columns: MARIA_DAILY_COLUMNS, rows: toMatrix(MARIA_DAILY_COLUMNS, mariaDaily) },
      { sheet: SALES_OS_SHEETS.mariaSnapshot, columns: MARIA_SNAPSHOT_COLUMNS, rows: toMatrix(MARIA_SNAPSHOT_COLUMNS, mariaSnapshotRowsData) },
      { sheet: SALES_OS_SHEETS.ropBoard, columns: ROP_BOARD_COLUMNS, rows: toMatrix(ROP_BOARD_COLUMNS, ropBoard) },
      { sheet: SALES_OS_SHEETS.export, columns: SALES_EXPORT_COLUMNS, rows: toMatrix(SALES_EXPORT_COLUMNS, model.exportRows) }
    ];

    const sheets: SalesOsSyncResult["sheets"] = [];
    let rowsWritten = 0;

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const writeAll = async () => {
      for (const plan of sheetPlans) {
        console.log(`[sales-os] write ${plan.sheet} rows=${plan.rows.length}`);
        try {
          const result = await writeSheet({
            dryRun,
            spreadsheetId,
            tabTitle: plan.sheet,
            columns: plan.columns,
            rows: plan.rows
          });
          sheets.push({ sheet: plan.sheet, rows: plan.rows.length, written: result.written });
          rowsWritten += result.written;
          if (!dryRun) await sleep(1200);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${plan.sheet}: ${message}`);
          sheets.push({ sheet: plan.sheet, rows: plan.rows.length, written: 0 });
          if (/quota|rate/i.test(message)) await sleep(5000);
        }
      }
    };

    await writeAll();

    let predictive: PredictiveSyncResult | undefined;
    let predictiveTraffic: TrafficSyncResult | undefined;
    const planMonth = mergedSettings.find((row) => row.key === "plan_month")?.value?.trim()
      || startedAt.slice(0, 7);
    try {
      predictive = await syncPredictiveSalesFront({
        month: planMonth,
        mariaDaily,
        mariaSnapshot: mariaSnapshotRowsData,
        dailyFact: model.dailyFact,
        syncedAt: startedAt,
        dryRun
      });
      console.log(
        `[sales-os] predictive front cells=${predictive.factCellsWritten} dates=${predictive.datesFilled}`
        + (predictive.skipped ? ` skipped=${predictive.skipped}` : "")
      );
      if (predictive.skipped) warnings.push(`predictive: ${predictive.skipped}`);
    } catch (error) {
      warnings.push(`predictive sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      predictiveTraffic = await syncPredictiveByTraffic({
        month: planMonth,
        leads: model.leads,
        deals: model.deals,
        invoiceEvents: model.invoiceEvents,
        paymentEvents: model.paymentEvents,
        syncedAt: startedAt,
        dryRun
      });
      console.log(
        `[sales-os] traffic front tabs=${predictiveTraffic.tabs.join(" | ")} cells=${predictiveTraffic.factCellsWritten} dates=${predictiveTraffic.datesFilled}`
        + (predictiveTraffic.skipped ? ` skipped=${predictiveTraffic.skipped}` : "")
      );
      if (predictiveTraffic.skipped) warnings.push(`traffic: ${predictiveTraffic.skipped}`);
    } catch (error) {
      warnings.push(`traffic sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!dryRun) {
      try {
        await registerInMother({
          motherId: sourceSpreadsheetId,
          salesOsId: spreadsheetId,
          syncedAt: startedAt,
          dryRun: false
        });
      } catch (error) {
        warnings.push(`mother registry update failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      try {
        await withSyncRun({
          syncName: "sales_os_model_v1",
          source: "mother_60_69",
          target: spreadsheetId,
          spreadsheetId: sourceSpreadsheetId,
          startedAt,
          schemaVersion: SALES_OS_CONTRACT_VERSION,
          triggerType: "script",
          status: errors.length ? "partial" : "success"
        }, async () => ({
          rowsRead: leadsRaw.length + dealsRaw.length + stageHistoryRaw.length,
          rowsWritten
        }));
      } catch (error) {
        warnings.push(`sync_runs append failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const finishedAt = new Date().toISOString();
    const rowsRead = leadsRaw.length + dealsRaw.length + stageHistoryRaw.length + pipelineRaw.length + dialogLinksRaw.length;
    const status = errors.length
      ? (rowsWritten || dryRun ? "partial" : "failed")
      : "success";

    return {
      status,
      started_at: startedAt,
      finished_at: finishedAt,
      dryRun,
      spreadsheetId,
      sourceSpreadsheetId,
      periods,
      rows_read: rowsRead,
      rows_written: dryRun ? 0 : rowsWritten,
      sheets,
      warnings,
      errors,
      access,
      reconciliation: {
        leads: model.leads.length,
        deals: model.deals.length,
        invoices: model.invoiceEvents.length,
        payments: model.paymentEvents.length,
        export_rows: model.exportRows.length
      },
      predictive,
      predictiveTraffic
    };
  })();

  lock = run;
  try {
    return await run;
  } finally {
    if (lock === run) lock = null;
  }
}
