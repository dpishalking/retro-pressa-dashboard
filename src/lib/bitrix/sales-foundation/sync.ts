import {
  ACTIVITIES_COLUMNS,
  CONTACTS_RAW_COLUMNS,
  DATA_QUALITY_COLUMNS,
  DEFAULT_SF_PERIODS,
  DEALS_RAW_COLUMNS,
  DIALOG_LINKS_COLUMNS,
  FIELD_CATALOG_COLUMNS,
  LEADS_RAW_COLUMNS,
  PIPELINE_COLUMNS,
  SALES_FOUNDATION_CONTRACT_VERSION,
  SALES_FOUNDATION_SYNC_ORDER,
  SALES_FOUNDATION_TABS,
  STAGE_HISTORY_COLUMNS,
  STAGES_COLUMNS,
  type SalesFoundationModule
} from "@/config/sales-foundation";
import { OS_SPREADSHEET_ID, OS_TABS, DATA_SOURCES_COLUMNS } from "@/config/os-sheets";
import { activitiesToSheetRows, fetchActivitiesRaw } from "@/lib/bitrix/sales-foundation/activities";
import { contactsToSheetRows, fetchContactsRaw, type ContactRawRow } from "@/lib/bitrix/sales-foundation/contacts";
import { buildDataQualityRows, dataQualityToSheetRows } from "@/lib/bitrix/sales-foundation/data-quality";
import { dealsToSheetRows, fetchDealsRaw, type DealRawRow } from "@/lib/bitrix/sales-foundation/deals";
import { dialogLinksToSheetRows, fetchDialogLinksRaw } from "@/lib/bitrix/sales-foundation/dialog-links";
import { fetchFieldCatalogRaw, fieldCatalogToSheetRows } from "@/lib/bitrix/sales-foundation/field-catalog";
import { fetchLeadsRaw, leadsToSheetRows, type LeadRawRow } from "@/lib/bitrix/sales-foundation/leads";
import { fetchPipelineRaw, pipelineToSheetRows } from "@/lib/bitrix/sales-foundation/pipeline";
import { fetchStageHistoryRaw, stageHistoryToSheetRows, type StageHistoryRow } from "@/lib/bitrix/sales-foundation/stage-history";
import { fetchStagesRaw, stagesToSheetRows } from "@/lib/bitrix/sales-foundation/stages";
import { requireBitrixWebhook } from "@/lib/bitrix/rest-client";
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
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type ModuleResult = {
  module: Exclude<SalesFoundationModule, "all">;
  status: "success" | "partial" | "failed" | "skipped";
  rows_read: number;
  rows_written: number;
  warnings: string[];
  error?: string;
  error_code?: string;
};

export type SalesFoundationSyncResult = {
  status: "success" | "partial" | "failed";
  started_at: string;
  finished_at: string;
  modules: ModuleResult[];
  rows_read: number;
  rows_written: number;
  warnings: string[];
  errors: string[];
  dryRun: boolean;
  spreadsheetId: string;
  periods: string[];
};

let syncLock: Promise<SalesFoundationSyncResult> | null = null;

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function normalizePeriods(periods?: string[]): string[] {
  if (!periods?.length) return [...DEFAULT_SF_PERIODS];
  return periods.map((period) => {
    if (/^\d{4}-\d{2}$/.test(period)) return period;
    if (period === "may-2026") return "2026-05";
    if (period === "june-2026") return "2026-06";
    if (period === "july-2026") return "2026-07";
    return period;
  });
}

function resolveModules(modules?: SalesFoundationModule[]): Exclude<SalesFoundationModule, "all">[] {
  if (!modules?.length || modules.includes("all")) return [...SALES_FOUNDATION_SYNC_ORDER];
  const set = new Set(modules.filter((m): m is Exclude<SalesFoundationModule, "all"> => m !== "all"));
  return SALES_FOUNDATION_SYNC_ORDER.filter((module) => set.has(module));
}

async function writeOrDry(input: {
  dryRun: boolean;
  spreadsheetId: string;
  tabTitle: string;
  columns: readonly string[];
  rows: Array<Array<string | number>>;
  syncName: string;
  source: string;
}) {
  if (input.dryRun) {
    return { rowsWritten: 0, rowsRead: input.rows.length };
  }
  return withSyncRun({
    syncName: input.syncName,
    source: input.source,
    target: input.tabTitle,
    spreadsheetId: input.spreadsheetId,
    startedAt: new Date().toISOString(),
    schemaVersion: SALES_FOUNDATION_CONTRACT_VERSION,
    triggerType: "script"
  }, async () => {
    const written = await safeReplaceSheet({
      spreadsheetId: input.spreadsheetId,
      tabTitle: input.tabTitle,
      expectedColumns: input.columns,
      rows: input.rows,
      clearRange: `${quoteTab(input.tabTitle)}!A:ZZ`,
      schemaVersion: SALES_FOUNDATION_CONTRACT_VERSION
    });
    return { rowsWritten: written.rowsWritten, rowsRead: input.rows.length };
  });
}

async function upsertRegistry(spreadsheetId: string, syncedAt: string) {
  const tab = OS_TABS.registry;
  await ensureSheetTab(spreadsheetId, tab);
  const existing = await readSheetValues({ spreadsheetId, range: `${quoteTab(tab)}!A1:Z` });
  const header = existing[0]?.map((cell) => String(cell ?? "").trim()) || [];
  const lines = existing.slice(1);

  const registryRows = Object.entries(SALES_FOUNDATION_TABS).map(([key, title]) => ({
    sheet_id: title,
    sheet_name: title,
    system: "bitrix_sales_foundation",
    grain: key,
    primary_key: key.includes("Quality") || key === "dataQuality" ? "period|entity|field" : "entity_id",
    owner: "engineering",
    status: "staging",
    updated_at: syncedAt
  }));

  if (!header.length) {
    const columns = ["sheet_id", "sheet_name", "system", "grain", "primary_key", "owner", "status", "updated_at"];
    await writeSheetValues({
      spreadsheetId,
      range: `${quoteTab(tab)}!A1`,
      rows: [
        columns,
        ...registryRows.map((row) => columns.map((column) => row[column as keyof typeof row]))
      ]
    });
    return;
  }

  const idIndex = header.findIndex((name) => /sheet_id|tab|name|лист/i.test(name));
  const keyIndex = idIndex >= 0 ? idIndex : 0;
  const existingKeys = new Set(lines.map((line) => String(line[keyIndex] ?? "").trim()).filter(Boolean));
  const toAppend = registryRows
    .filter((row) => !existingKeys.has(row.sheet_id))
    .map((row) => header.map((column) => {
      const normalized = column.toLowerCase();
      if (normalized.includes("sheet_id") || normalized === "tab" || normalized.includes("лист")) return row.sheet_id;
      if (normalized.includes("name") || normalized.includes("title")) return row.sheet_name;
      if (normalized.includes("system")) return row.system;
      if (normalized.includes("grain")) return row.grain;
      if (normalized.includes("primary")) return row.primary_key;
      if (normalized.includes("owner")) return row.owner;
      if (normalized.includes("status")) return row.status;
      if (normalized.includes("updated") || normalized.includes("sync")) return row.updated_at;
      return "";
    }));

  if (toAppend.length) {
    await appendSheetRows({ spreadsheetId, tabTitle: tab, rows: toAppend });
  }
}

async function upsertDataSources(spreadsheetId: string, syncedAt: string) {
  const sources = [
    ["bitrix_leads", "Bitrix Leads", "api", "", SALES_FOUNDATION_TABS.leadsRaw, "", "engineering", "rop", "lead", "lead_id", "pull", "manual/api", "sales_foundation_leads", syncedAt, "active", "crm.lead.list"],
    ["bitrix_deals", "Bitrix Deals", "api", "", SALES_FOUNDATION_TABS.dealsRaw, "", "engineering", "rop", "deal", "deal_id", "pull", "manual/api", "sales_foundation_deals", syncedAt, "active", "crm.deal.list"],
    ["bitrix_contacts", "Bitrix Contacts", "api", "", SALES_FOUNDATION_TABS.contactsRaw, "", "engineering", "rop", "contact", "contact_id", "pull", "manual/api", "sales_foundation_contacts", syncedAt, "active", "crm.contact.get"],
    ["bitrix_stage_history", "Bitrix Stage History", "api", "", SALES_FOUNDATION_TABS.stageHistory, "", "engineering", "rop", "stage_event", "event_id", "pull", "manual/api", "sales_foundation_stage_history", syncedAt, "active", "crm.stagehistory.list"],
    ["bitrix_stages", "Bitrix Stages", "api", "", SALES_FOUNDATION_TABS.stages, "", "engineering", "rop", "stage", "stage_id", "pull", "manual/api", "sales_foundation_stages", syncedAt, "active", "crm.dealcategory.stage.list"],
    ["bitrix_activities", "Bitrix Activities", "api", "", SALES_FOUNDATION_TABS.activities, "", "engineering", "rop", "activity", "activity_id", "pull", "manual/api", "sales_foundation_activities", syncedAt, "active", "crm.activity.list"],
    ["bitrix_open_lines", "Bitrix Open Lines", "api", "", SALES_FOUNDATION_TABS.dialogLinks, "", "engineering", "rop", "dialog", "session_id", "pull", "manual/api", "sales_foundation_dialog_links", syncedAt, "active", "crm.activity.list + imopenlines.session.history.get"]
  ];

  await ensureSheetTab(spreadsheetId, OS_TABS.dataSources);
  const existing = await readSheetValues({
    spreadsheetId,
    range: `${quoteTab(OS_TABS.dataSources)}!A1:P`
  });
  if (!existing.length) {
    await safeReplaceSheet({
      spreadsheetId,
      tabTitle: OS_TABS.dataSources,
      expectedColumns: DATA_SOURCES_COLUMNS,
      rows: sources,
      clearRange: `${quoteTab(OS_TABS.dataSources)}!A:P`
    });
    return;
  }

  const header = existing[0].map((cell) => String(cell ?? "").trim());
  const idIndex = header.indexOf("source_id");
  const known = new Set(existing.slice(1).map((line) => String(line[idIndex >= 0 ? idIndex : 0] ?? "").trim()));
  const toAppend = sources.filter((row) => !known.has(String(row[0])));
  if (toAppend.length) {
    await appendSheetRows({ spreadsheetId, tabTitle: OS_TABS.dataSources, rows: toAppend });
  }
}

async function saveLocalSnapshot(payload: unknown) {
  const dir = path.join(process.cwd(), "data", "bitrix-sales-foundation");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(file, JSON.stringify(payload, null, 2), "utf8");
  return file;
}

export async function syncBitrixSalesFoundation(options: {
  periods?: string[];
  modules?: SalesFoundationModule[];
  dryRun?: boolean;
  spreadsheetId?: string;
  maxDialogSessions?: number;
} = {}): Promise<SalesFoundationSyncResult> {
  if (syncLock) {
    throw new Error("bitrix_sales_foundation sync already running");
  }

  const run = (async (): Promise<SalesFoundationSyncResult> => {
    const startedAt = new Date().toISOString();
    const periods = normalizePeriods(options.periods);
    const modules = resolveModules(options.modules);
    const dryRun = options.dryRun === true;
    const spreadsheetId = options.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
    const warnings: string[] = [];
    const errors: string[] = [];
    const moduleResults: ModuleResult[] = [];

    requireBitrixWebhook();
    if (!dryRun && !readGoogleServiceAccount()) {
      throw new Error("Google service account is not configured");
    }

    let leads: LeadRawRow[] = [];
    let deals: DealRawRow[] = [];
    let contacts: ContactRawRow[] = [];
    let stageHistory: StageHistoryRow[] = [];
    let stageNameById = new Map<string, string>();

    const runModule = async (
      module: Exclude<SalesFoundationModule, "all">,
      fn: () => Promise<Omit<ModuleResult, "module">>
    ) => {
      try {
        const result = await fn();
        moduleResults.push({ module, ...result });
        warnings.push(...result.warnings);
        if (result.error) errors.push(`${module}: ${result.error}`);
        console.log(`[sales-foundation] done ${module} status=${result.status} rows=${result.rows_read}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`[sales-foundation] fail ${module}: ${message}`);
        moduleResults.push({
          module,
          status: "failed",
          rows_read: 0,
          rows_written: 0,
          warnings: [],
          error: message
        });
        errors.push(`${module}: ${message}`);
      }
    };

    for (const module of modules) {
      console.log(`[sales-foundation] start ${module}`);
      if (module === "field_catalog") {
        await runModule(module, async () => {
          const { rows, warnings: w } = await fetchFieldCatalogRaw(startedAt);
          const sheetRows = fieldCatalogToSheetRows(rows);
          const written = await writeOrDry({
            dryRun,
            spreadsheetId,
            tabTitle: SALES_FOUNDATION_TABS.fieldCatalog,
            columns: FIELD_CATALOG_COLUMNS,
            rows: sheetRows,
            syncName: "bitrix_sales_foundation_field_catalog",
            source: "crm.*.fields"
          });
          return { status: "success", rows_read: rows.length, rows_written: written.rowsWritten, warnings: w };
        });
      }

      if (module === "stages") {
        await runModule(module, async () => {
          const { rows, warnings: w, stageNameById: map } = await fetchStagesRaw(startedAt);
          stageNameById = map;
          const written = await writeOrDry({
            dryRun,
            spreadsheetId,
            tabTitle: SALES_FOUNDATION_TABS.stages,
            columns: STAGES_COLUMNS,
            rows: stagesToSheetRows(rows),
            syncName: "bitrix_sales_foundation_stages",
            source: "crm.dealcategory.stage.list"
          });
          return { status: "success", rows_read: rows.length, rows_written: written.rowsWritten, warnings: w };
        });
      }

      if (module === "leads") {
        await runModule(module, async () => {
          const { rows, warnings: w } = await fetchLeadsRaw(periods, startedAt);
          leads = rows;
          const written = await writeOrDry({
            dryRun,
            spreadsheetId,
            tabTitle: SALES_FOUNDATION_TABS.leadsRaw,
            columns: LEADS_RAW_COLUMNS,
            rows: leadsToSheetRows(rows),
            syncName: "bitrix_sales_foundation_leads",
            source: "crm.lead.list"
          });
          return { status: "success", rows_read: rows.length, rows_written: written.rowsWritten, warnings: w };
        });
      }

      if (module === "deals") {
        await runModule(module, async () => {
          const { rows, warnings: w } = await fetchDealsRaw(periods, startedAt);
          deals = rows;
          const written = await writeOrDry({
            dryRun,
            spreadsheetId,
            tabTitle: SALES_FOUNDATION_TABS.dealsRaw,
            columns: DEALS_RAW_COLUMNS,
            rows: dealsToSheetRows(rows),
            syncName: "bitrix_sales_foundation_deals",
            source: "crm.deal.list"
          });
          return { status: "success", rows_read: rows.length, rows_written: written.rowsWritten, warnings: w };
        });
      }

      if (module === "contacts") {
        await runModule(module, async () => {
          if (!leads.length && modules.includes("leads") === false) {
            const fetched = await fetchLeadsRaw(periods, startedAt);
            leads = fetched.rows;
          }
          if (!deals.length && modules.includes("deals") === false) {
            const fetched = await fetchDealsRaw(periods, startedAt);
            deals = fetched.rows;
          }
          const { rows, warnings: w, errorCode } = await fetchContactsRaw({ leads, deals, syncedAt: startedAt });
          contacts = rows;
          if (errorCode && !rows.length) {
            return {
              status: "partial",
              rows_read: 0,
              rows_written: 0,
              warnings: w,
              error: w.join("; "),
              error_code: errorCode
            };
          }
          const written = await writeOrDry({
            dryRun,
            spreadsheetId,
            tabTitle: SALES_FOUNDATION_TABS.contactsRaw,
            columns: CONTACTS_RAW_COLUMNS,
            rows: contactsToSheetRows(rows),
            syncName: "bitrix_sales_foundation_contacts",
            source: "crm.contact.get"
          });
          return {
            status: errorCode ? "partial" : "success",
            rows_read: rows.length,
            rows_written: written.rowsWritten,
            warnings: w,
            error_code: errorCode
          };
        });
      }

      if (module === "stage_history") {
        await runModule(module, async () => {
          if (!stageNameById.size) {
            const stages = await fetchStagesRaw(startedAt);
            stageNameById = stages.stageNameById;
          }
          const { rows, warnings: w } = await fetchStageHistoryRaw(periods, stageNameById, startedAt);
          stageHistory = rows;
          const written = await writeOrDry({
            dryRun,
            spreadsheetId,
            tabTitle: SALES_FOUNDATION_TABS.stageHistory,
            columns: STAGE_HISTORY_COLUMNS,
            rows: stageHistoryToSheetRows(rows),
            syncName: "bitrix_sales_foundation_stage_history",
            source: "crm.stagehistory.list"
          });
          return { status: "success", rows_read: rows.length, rows_written: written.rowsWritten, warnings: w };
        });
      }

      if (module === "pipeline") {
        await runModule(module, async () => {
          if (!stageNameById.size) {
            const stages = await fetchStagesRaw(startedAt);
            stageNameById = stages.stageNameById;
          }
          if (!stageHistory.length && modules.includes("stage_history") === false) {
            const hist = await fetchStageHistoryRaw(periods, stageNameById, startedAt);
            stageHistory = hist.rows;
          }
          const { rows, warnings: w } = await fetchPipelineRaw({
            stageNameById,
            stageHistory,
            syncedAt: startedAt
          });
          const written = await writeOrDry({
            dryRun,
            spreadsheetId,
            tabTitle: SALES_FOUNDATION_TABS.pipeline,
            columns: PIPELINE_COLUMNS,
            rows: pipelineToSheetRows(rows),
            syncName: "bitrix_sales_foundation_pipeline",
            source: "crm.deal.list"
          });
          return { status: "success", rows_read: rows.length, rows_written: written.rowsWritten, warnings: w };
        });
      }

      if (module === "activities") {
        await runModule(module, async () => {
          const { rows, warnings: w, errorCode, partial } = await fetchActivitiesRaw(periods, startedAt);
          if (partial && !rows.length) {
            return {
              status: "partial",
              rows_read: 0,
              rows_written: 0,
              warnings: w,
              error: w.join("; "),
              error_code: errorCode
            };
          }
          const written = await writeOrDry({
            dryRun,
            spreadsheetId,
            tabTitle: SALES_FOUNDATION_TABS.activities,
            columns: ACTIVITIES_COLUMNS,
            rows: activitiesToSheetRows(rows),
            syncName: "bitrix_sales_foundation_activities",
            source: "crm.activity.list"
          });
          return {
            status: partial ? "partial" : "success",
            rows_read: rows.length,
            rows_written: written.rowsWritten,
            warnings: w,
            error_code: errorCode
          };
        });
      }

      if (module === "dialog_links") {
        await runModule(module, async () => {
          const { rows, warnings: w, errorCode, partial } = await fetchDialogLinksRaw(periods, startedAt, {
            maxSessions: options.maxDialogSessions ?? 500
          });
          if (partial && !rows.length) {
            return {
              status: "partial",
              rows_read: 0,
              rows_written: 0,
              warnings: w,
              error: w.join("; "),
              error_code: errorCode
            };
          }
          const written = await writeOrDry({
            dryRun,
            spreadsheetId,
            tabTitle: SALES_FOUNDATION_TABS.dialogLinks,
            columns: DIALOG_LINKS_COLUMNS,
            rows: dialogLinksToSheetRows(rows),
            syncName: "bitrix_sales_foundation_dialog_links",
            source: "openlines+crm.activity"
          });
          return {
            status: partial ? "partial" : "success",
            rows_read: rows.length,
            rows_written: written.rowsWritten,
            warnings: w,
            error_code: errorCode
          };
        });
      }

      if (module === "data_quality") {
        await runModule(module, async () => {
          if (!leads.length && modules.includes("leads") === false) {
            leads = (await fetchLeadsRaw(periods, startedAt)).rows;
          }
          if (!deals.length && modules.includes("deals") === false) {
            deals = (await fetchDealsRaw(periods, startedAt)).rows;
          }
          if (!contacts.length && modules.includes("contacts") === false) {
            contacts = (await fetchContactsRaw({ leads, deals, syncedAt: startedAt })).rows;
          }
          const rows = buildDataQualityRows({ leads, deals, contacts, periods, syncedAt: startedAt });
          const written = await writeOrDry({
            dryRun,
            spreadsheetId,
            tabTitle: SALES_FOUNDATION_TABS.dataQuality,
            columns: DATA_QUALITY_COLUMNS,
            rows: dataQualityToSheetRows(rows),
            syncName: "bitrix_sales_foundation_data_quality",
            source: "derived"
          });
          return { status: "success", rows_read: rows.length, rows_written: written.rowsWritten, warnings: [] };
        });
      }
    }

    if (!dryRun) {
      try {
        await upsertRegistry(spreadsheetId, startedAt);
        await upsertDataSources(spreadsheetId, startedAt);
        await appendOsChangeLog({
          spreadsheetId,
          changeType: "sync",
          system: "bitrix_sales_foundation",
          entity: "tabs_60_69",
          description: `Sales foundation sync modules=${modules.join(",")}`,
          reason: "staging bitrix pull",
          version: SALES_FOUNDATION_CONTRACT_VERSION
        });
      } catch (error) {
        warnings.push(`registry/data_sources update failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const finishedAt = new Date().toISOString();
    const rowsRead = moduleResults.reduce((sum, row) => sum + row.rows_read, 0);
    const rowsWritten = moduleResults.reduce((sum, row) => sum + row.rows_written, 0);
    const failed = moduleResults.filter((row) => row.status === "failed").length;
    const partial = moduleResults.filter((row) => row.status === "partial").length;
    const status = failed === moduleResults.length && moduleResults.length
      ? "failed"
      : failed || partial
        ? "partial"
        : "success";

    if (!dryRun) {
      await withSyncRun({
        syncName: "bitrix_sales_foundation_all",
        source: "bitrix",
        target: "60-69",
        spreadsheetId,
        startedAt,
        schemaVersion: SALES_FOUNDATION_CONTRACT_VERSION,
        triggerType: "script",
        status
      }, async () => ({
        rowsRead,
        rowsWritten
      })).catch(() => undefined);
    }

    const result: SalesFoundationSyncResult = {
      status,
      started_at: startedAt,
      finished_at: finishedAt,
      modules: moduleResults,
      rows_read: rowsRead,
      rows_written: dryRun ? 0 : rowsWritten,
      warnings: [...new Set(warnings)],
      errors,
      dryRun,
      spreadsheetId,
      periods
    };

    await saveLocalSnapshot({
      ...result,
      note: "Safe aggregate snapshot; no open phones/emails"
    }).catch(() => undefined);

    return result;
  })();

  syncLock = run;
  try {
    return await run;
  } finally {
    if (syncLock === run) syncLock = null;
  }
}
