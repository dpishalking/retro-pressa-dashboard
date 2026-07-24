import {
  ATTRIBUTION_COLUMNS,
  CAMPAIGN_FACT_COLUMNS,
  CAMPAIGN_MAP_COLUMNS,
  CHANNEL_FACT_COLUMNS,
  CRM_LEADS_COLUMNS,
  DAILY_FACT_COLUMNS,
  DATA_QUALITY_COLUMNS,
  DEFAULT_TRAFFIC_OS_PERIODS,
  LANDING_FACT_COLUMNS,
  LANDING_MAP_COLUMNS,
  MONTHLY_FACT_COLUMNS,
  ORGANIC_RAW_COLUMNS,
  README_COLUMNS,
  RECONCILIATION_COLUMNS,
  SETTINGS_COLUMNS,
  SOURCE_MAP_COLUMNS,
  TRAFFIC_OS_CONTRACT_VERSION,
  TRAFFIC_OS_SHEETS,
  TRAFFIC_RAW_COLUMNS,
  getTrafficOsSpreadsheetId
} from "@/config/traffic-os";
import {
  CAMPAIGN_MANAGEMENT_COLUMNS,
  CHANNEL_MANAGEMENT_COLUMNS,
  LANDING_MANAGEMENT_COLUMNS,
  ATTRIBUTION_GAPS_COLUMNS,
  JOIN_QUALITY_COLUMNS,
  REVENUE_ATTRIBUTION_COLUMNS,
  TRAFFIC_ALERTS_COLUMNS,
  TRAFFIC_MANAGEMENT_COLUMNS,
  TRAFFIC_MANAGEMENT_CONTRACT_VERSION,
  TRAFFIC_SALES_COVERAGE_COLUMNS,
  TRAFFIC_TYPE_FACT_COLUMNS,
  type TrafficManagementModule
} from "@/config/traffic-management";
import {
  DATA_QUALITY_CENTER_COLUMNS,
  MARKETING_HOME_COLUMNS,
  MARKETING_OS_CONTRACT_VERSION,
  MARKETING_TIMELINE_COLUMNS,
  UNKNOWN_CENTER_COLUMNS
} from "@/config/marketing-os";
import {
  GA4_CAMPAIGN_DAILY_COLUMNS,
  GA4_CHANNEL_DAILY_COLUMNS,
  GA4_DQ_COLUMNS,
  GA4_EVENT_DAILY_COLUMNS,
  GA4_FOUNDATION_CONTRACT_VERSION,
  GA4_LANDING_DAILY_COLUMNS,
  GA4_PAGE_DAILY_COLUMNS,
  GA4_SOURCE_DAILY_COLUMNS
} from "@/config/ga4-foundation";
import { OS_SPREADSHEET_ID, OS_SVOD_SPREADSHEET_ID } from "@/config/os-sheets";
import { getSalesOsSpreadsheetId, SALES_OS_SHEETS } from "@/config/sales-os";
import { SALES_FOUNDATION_TABS } from "@/config/sales-foundation";
import {
  TRAFFIC_EXPORT_V3_COLUMNS,
  TRAFFIC_EXPORT_V3_CONTRACT_VERSION,
  validateTrafficExportV3Rows
} from "@/lib/traffic-os/export-contract";
import { buildTrafficOsModel } from "@/lib/traffic-os/build-model";
import { buildTrafficOsGa4Foundation } from "@/lib/traffic-os/ga4-foundation-sync";
import { extractLandingUrlsFromSheetTitles } from "@/lib/traffic-os/parse-svod-raw";
import { rowsFromSheet, toMatrix } from "@/lib/traffic-os/utils";
import {
  ensureSheetTab,
  listSheetTitles,
  readGoogleServiceAccount,
  readSheetValues
} from "@/lib/google/sheets-client";
import { safeReplaceSheet } from "@/lib/os-sheets/safe-write";

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function normalizePeriods(periods?: string[]): string[] {
  if (!periods?.length) return [...DEFAULT_TRAFFIC_OS_PERIODS];
  return periods.map((period) => {
    if (/^\d{4}-\d{2}$/.test(period)) return period;
    if (period === "may-2026") return "2026-05";
    if (period === "june-2026") return "2026-06";
    if (period === "july-2026") return "2026-07";
    return period;
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /429|quota|rate/i.test(message);
      if (!retryable || i === attempts - 1) throw error;
      const wait = 1500 * (i + 1) * (i + 1);
      console.warn(`[traffic-os] ${label} retry ${i + 1}/${attempts} after ${wait}ms: ${message}`);
      await sleep(wait);
    }
  }
  throw lastError;
}

async function writeTab(input: {
  dryRun: boolean;
  spreadsheetId: string;
  tabTitle: string;
  columns: readonly string[];
  rows: Array<Array<string | number>>;
}) {
  if (input.dryRun) return { written: 0 };
  const result = await withRetry(
    () =>
      safeReplaceSheet({
        spreadsheetId: input.spreadsheetId,
        tabTitle: input.tabTitle,
        expectedColumns: input.columns,
        rows: input.rows,
        clearRange: `${quoteTab(input.tabTitle)}!A:ZZ`,
        schemaVersion: TRAFFIC_OS_CONTRACT_VERSION
      }),
    `write:${input.tabTitle}`
  );
  await sleep(400);
  return { written: result.rowsWritten };
}

function normalizeModules(modules?: string[]): Set<string> {
  if (!modules?.length || modules.includes("all")) {
    return new Set(["all"]);
  }
  if (modules.includes("management")) {
    return new Set([
      "traffic_management",
      "traffic_type_fact",
      "channel_management",
      "landing_management",
      "campaign_management",
      "sales_coverage",
      "alerts",
      "export",
      "data_quality",
      "reconciliation",
      "marketing_home",
      "unknown_center",
      "data_quality_center",
      "marketing_timeline"
    ]);
  }
  if (modules.includes("marketing")) {
    return new Set([
      "marketing_home",
      "unknown_center",
      "data_quality_center",
      "marketing_timeline",
      "alerts",
      "settings"
    ]);
  }
  if (modules.includes("foundation")) {
    return new Set(["foundation", "export", "data_quality", "reconciliation"]);
  }
  if (modules.includes("ga4") || modules.includes("ga4_foundation")) {
    return new Set([
      "ga4_foundation",
      "foundation",
      "data_quality",
      "reconciliation"
    ]);
  }
  return new Set(modules);
}

export type TrafficOsSyncResult = {
  status: "success" | "failed" | "blocked";
  started_at: string;
  finished_at: string;
  dryRun: boolean;
  spreadsheetId: string;
  periods: string[];
  modules: string[];
  rows_read: number;
  rows_written: number;
  sheets: Array<{ sheet: string; rows: number; written: number }>;
  stats: Record<string, number>;
  coverage_summary?: Record<string, number | string>;
  identityCoverage?: {
    before: Record<string, number>;
    after: Record<string, number>;
  };
      enrichmentCoverage?: {
    before: Record<string, number>;
    after: Record<string, number>;
  };
  traffic_health?: {
    score: number;
    status: string;
    components: Record<string, number>;
  };
  ga4_foundation?: {
    property_id: string;
    startDate: string;
    endDate: string;
    stats: Record<string, number>;
    coverage: Record<string, string | number | undefined>;
  };
  reconciliation: Array<Record<string, string | number>>;
  warnings: string[];
  errors: string[];
  contract_version: string;
};

let lock: Promise<TrafficOsSyncResult> | null = null;

export async function syncTrafficOs(input?: {
  periods?: string[];
  dryRun?: boolean;
  spreadsheetId?: string;
  modules?: string[] | TrafficManagementModule[];
}): Promise<TrafficOsSyncResult> {
  if (lock) return lock;
  lock = runSync(input).finally(() => {
    lock = null;
  });
  return lock;
}

async function runSync(input?: {
  periods?: string[];
  dryRun?: boolean;
  spreadsheetId?: string;
  modules?: string[];
}): Promise<TrafficOsSyncResult> {
  const started_at = new Date().toISOString();
  const dryRun = Boolean(input?.dryRun);
  const periods = normalizePeriods(input?.periods);
  const spreadsheetId = input?.spreadsheetId || getTrafficOsSpreadsheetId();
  const moduleSet = normalizeModules(input?.modules);
  const modules = [...moduleSet];
  const warnings: string[] = [];
  const errors: string[] = [];
  const sheets: TrafficOsSyncResult["sheets"] = [];
  let rows_read = 0;
  let rows_written = 0;

  if (!readGoogleServiceAccount()) {
    return {
      status: "blocked",
      started_at,
      finished_at: new Date().toISOString(),
      dryRun,
      spreadsheetId,
      periods,
      modules,
      rows_read: 0,
      rows_written: 0,
      sheets,
      stats: {},
      reconciliation: [],
      warnings,
      errors: ["Google service account is not configured"],
      contract_version: TRAFFIC_EXPORT_V3_CONTRACT_VERSION
    };
  }

  try {
    if (!dryRun) {
      await withRetry(async () => {
        const titles = await listSheetTitles(spreadsheetId);
        for (const title of Object.values(TRAFFIC_OS_SHEETS)) {
          if (!titles.includes(title)) await ensureSheetTab(spreadsheetId, title);
        }
      }, "ensure-tabs");
    }

    const salesId = getSalesOsSpreadsheetId();
    const svodId = OS_SVOD_SPREADSHEET_ID;
    const motherId = OS_SPREADSHEET_ID;
    const q = quoteTab;

    const [
      svodDay,
      svodOrganic,
      salesLeadsValues,
      salesDealsValues,
      salesInvValues,
      salesPayValues,
      foundationLeadsValues,
      foundationContactsValues,
      existingSourceMap,
      existingLandingMap,
      existingCampaignMap,
      existingAlerts,
      existingTimeline
    ] = await Promise.all([
      readSheetValues({ spreadsheetId: svodId, range: `${q("day")}!A1:N400` }),
      readSheetValues({ spreadsheetId: svodId, range: `${q("Органика")}!A1:O400` }),
      readSheetValues({ spreadsheetId: salesId, range: `${q(SALES_OS_SHEETS.leads)}!A1:Z20000` }),
      readSheetValues({ spreadsheetId: salesId, range: `${q(SALES_OS_SHEETS.deals)}!A1:AZ20000` }),
      readSheetValues({
        spreadsheetId: salesId,
        range: `${q(SALES_OS_SHEETS.invoiceEvents)}!A1:Z20000`
      }),
      readSheetValues({
        spreadsheetId: salesId,
        range: `${q(SALES_OS_SHEETS.paymentEvents)}!A1:Z20000`
      }),
      readSheetValues({
        spreadsheetId: motherId,
        range: `${q(SALES_FOUNDATION_TABS.leadsRaw)}!A1:AZ8000`
      }).catch((error) => {
        warnings.push(
          `foundation leads skipped: ${error instanceof Error ? error.message : String(error)}`
        );
        return [] as string[][];
      }),
      readSheetValues({
        spreadsheetId: motherId,
        range: `${q(SALES_FOUNDATION_TABS.contactsRaw)}!A1:AZ8000`
      }).catch((error) => {
        warnings.push(
          `foundation contacts skipped: ${error instanceof Error ? error.message : String(error)}`
        );
        return [] as string[][];
      }),
      readSheetValues({
        spreadsheetId,
        range: `${q(TRAFFIC_OS_SHEETS.sourceMap)}!A1:Z5000`
      }).catch(() => [] as string[][]),
      readSheetValues({
        spreadsheetId,
        range: `${q(TRAFFIC_OS_SHEETS.landingMap)}!A1:Z5000`
      }).catch(() => [] as string[][]),
      readSheetValues({
        spreadsheetId,
        range: `${q(TRAFFIC_OS_SHEETS.campaignMap)}!A1:Z5000`
      }).catch(() => [] as string[][]),
      readSheetValues({
        spreadsheetId,
        range: `${q(TRAFFIC_OS_SHEETS.alerts)}!A1:Z5000`
      }).catch(() => [] as string[][]),
      readSheetValues({
        spreadsheetId,
        range: `${q(TRAFFIC_OS_SHEETS.marketingTimeline)}!A1:Z5000`
      }).catch(() => [] as string[][])
    ]);

    rows_read =
      svodDay.length +
      svodOrganic.length +
      salesLeadsValues.length +
      salesDealsValues.length +
      salesInvValues.length +
      salesPayValues.length +
      foundationLeadsValues.length +
      foundationContactsValues.length;

    const contractorLandingUrls: string[] = [];
    for (const [label, id] of [
      ["ALX", "1Hh6U4udZXp69RVKMIF29RBHjKef5JxEbLHdmLZYIAIM"],
      ["ART", "1TW6WJFQGs-E1TUNLUYKDCULkHDLyagg8tZMCyx--yuA"]
    ] as const) {
      try {
        const titles = await listSheetTitles(id);
        contractorLandingUrls.push(...extractLandingUrlsFromSheetTitles(titles));
      } catch (error) {
        warnings.push(
          `contractor ${label} skipped: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    const model = buildTrafficOsModel({
      syncedAt: started_at,
      periods,
      svodDaySheet: svodDay,
      svodOrganicSheet: svodOrganic,
      salesLeads: rowsFromSheet(salesLeadsValues),
      salesDeals: rowsFromSheet(salesDealsValues),
      salesInvoices: rowsFromSheet(salesInvValues),
      salesPayments: rowsFromSheet(salesPayValues),
      foundationLeads: rowsFromSheet(foundationLeadsValues),
      foundationContacts: rowsFromSheet(foundationContactsValues),
      existingSourceMap: rowsFromSheet(existingSourceMap),
      existingLandingMap: rowsFromSheet(existingLandingMap),
      existingCampaignMap: rowsFromSheet(existingCampaignMap),
      previousAlerts: rowsFromSheet(existingAlerts),
      previousTimeline: rowsFromSheet(existingTimeline),
      contractorLandingUrls
    });

    const exportValidation = validateTrafficExportV3Rows(model.exportRows);
    if (!exportValidation.ok) {
      errors.push(...exportValidation.errors.slice(0, 20));
      return {
        status: "failed",
        started_at,
        finished_at: new Date().toISOString(),
        dryRun,
        spreadsheetId,
        periods,
        modules,
        rows_read,
        rows_written: 0,
        sheets,
        stats: model.stats,
        coverage_summary: model.coverageSummary,
        identityCoverage: model.identityCoverage,
        reconciliation: model.reconciliation,
        warnings,
        errors,
        contract_version: TRAFFIC_EXPORT_V3_CONTRACT_VERSION
      };
    }

    const wantGa4 = moduleSet.has("all") || moduleSet.has("ga4_foundation");
    let ga4:
      | Awaited<ReturnType<typeof buildTrafficOsGa4Foundation>>
      | null = null;
    if (wantGa4) {
      try {
        ga4 = await buildTrafficOsGa4Foundation({
          periods,
          syncedAt: started_at,
          crmLeads: model.crmLeads.map((row) =>
            Object.fromEntries(
              Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)])
            )
          ),
          existingSourceMap: model.sourceMap.map((row) =>
            Object.fromEntries(
              Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)])
            )
          ),
          existingLandingMap: model.landingMap.map((row) =>
            Object.fromEntries(
              Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)])
            )
          ),
          existingCampaignMap: model.campaignMap.map((row) =>
            Object.fromEntries(
              Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)])
            )
          )
        });
        model.sourceMap.push(...(ga4.sourceMapExtra as typeof model.sourceMap));
        model.landingMap.push(...(ga4.landingMapExtra as typeof model.landingMap));
        model.campaignMap.push(...(ga4.campaignMapExtra as typeof model.campaignMap));
        model.matrices.sourceMap = toMatrix(SOURCE_MAP_COLUMNS, model.sourceMap);
        model.matrices.landingMap = toMatrix(LANDING_MAP_COLUMNS, model.landingMap);
        model.matrices.campaignMap = toMatrix(CAMPAIGN_MAP_COLUMNS, model.campaignMap);
        model.reconciliation.push(
          ...ga4.reconciliation.map((row) => ({
            check_id: row.check_id,
            period: row.period,
            metric: row.metric,
            traffic_os_value: row.traffic_os_value,
            sales_os_value: row.sales_os_value,
            delta: row.delta,
            delta_pct: row.delta_pct,
            status: row.status,
            explanation: `${row.explanation}; ga4_value=${row.ga4_value}`,
            sync_updated_at: row.sync_updated_at
          }))
        );
        model.matrices.reconciliation = toMatrix(RECONCILIATION_COLUMNS, model.reconciliation);
        model.settings.push(
          {
            key: "ga4_foundation_contract_version",
            value: GA4_FOUNDATION_CONTRACT_VERSION,
            notes: "Sheets 26–29 / 34–36",
            updated_at: started_at
          },
          {
            key: "ga4_property_id",
            value: ga4.propertyId,
            notes: "Single property foundation v1",
            updated_at: started_at
          }
        );
        model.matrices.settings = toMatrix(SETTINGS_COLUMNS, model.settings);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`GA4 foundation failed: ${message}`);
        return {
          status: "failed",
          started_at,
          finished_at: new Date().toISOString(),
          dryRun,
          spreadsheetId,
          periods,
          modules,
          rows_read,
          rows_written: 0,
          sheets,
          stats: model.stats,
          coverage_summary: model.coverageSummary,
          identityCoverage: model.identityCoverage,
          enrichmentCoverage: model.enrichmentCoverage,
          reconciliation: model.reconciliation,
          warnings,
          errors,
          contract_version: TRAFFIC_EXPORT_V3_CONTRACT_VERSION
        };
      }
    }

    type WriteItem = {
      moduleKey: string;
      sheet: string;
      columns: readonly string[];
      rows: Array<Array<string | number>>;
      count: number;
    };

    const writes: WriteItem[] = [
      {
        moduleKey: "foundation",
        sheet: TRAFFIC_OS_SHEETS.readme,
        columns: README_COLUMNS,
        rows: model.matrices.readme,
        count: model.readme.length
      },
      {
        moduleKey: "foundation",
        sheet: TRAFFIC_OS_SHEETS.settings,
        columns: SETTINGS_COLUMNS,
        rows: model.matrices.settings,
        count: model.settings.length
      },
      {
        moduleKey: "foundation",
        sheet: TRAFFIC_OS_SHEETS.sourceMap,
        columns: SOURCE_MAP_COLUMNS,
        rows: model.matrices.sourceMap,
        count: model.sourceMap.length
      },
      {
        moduleKey: "foundation",
        sheet: TRAFFIC_OS_SHEETS.landingMap,
        columns: LANDING_MAP_COLUMNS,
        rows: model.matrices.landingMap,
        count: model.landingMap.length
      },
      {
        moduleKey: "foundation",
        sheet: TRAFFIC_OS_SHEETS.campaignMap,
        columns: CAMPAIGN_MAP_COLUMNS,
        rows: model.matrices.campaignMap,
        count: model.campaignMap.length
      },
      {
        moduleKey: "foundation",
        sheet: TRAFFIC_OS_SHEETS.trafficRaw,
        columns: TRAFFIC_RAW_COLUMNS,
        rows: model.matrices.trafficRaw,
        count: model.trafficRaw.length
      },
      {
        moduleKey: "foundation",
        sheet: TRAFFIC_OS_SHEETS.organicRaw,
        columns: ORGANIC_RAW_COLUMNS,
        rows: model.matrices.organicRaw,
        count: model.organicRaw.length
      },
      {
        moduleKey: "foundation",
        sheet: TRAFFIC_OS_SHEETS.crmLeads,
        columns: CRM_LEADS_COLUMNS,
        rows: model.matrices.crmLeads,
        count: model.crmLeads.length
      },
      {
        moduleKey: "foundation",
        sheet: TRAFFIC_OS_SHEETS.attribution,
        columns: ATTRIBUTION_COLUMNS,
        rows: model.matrices.attributions,
        count: model.attributions.length
      },
      {
        moduleKey: "foundation",
        sheet: TRAFFIC_OS_SHEETS.landingFact,
        columns: LANDING_FACT_COLUMNS,
        rows: model.matrices.landingFact,
        count: model.landingFact.length
      },
      {
        moduleKey: "foundation",
        sheet: TRAFFIC_OS_SHEETS.channelFact,
        columns: CHANNEL_FACT_COLUMNS,
        rows: model.matrices.channelFact,
        count: model.channelFact.length
      },
      {
        moduleKey: "foundation",
        sheet: TRAFFIC_OS_SHEETS.campaignFact,
        columns: CAMPAIGN_FACT_COLUMNS,
        rows: model.matrices.campaignFact,
        count: model.campaignFact.length
      },
      {
        moduleKey: "foundation",
        sheet: TRAFFIC_OS_SHEETS.dailyFact,
        columns: DAILY_FACT_COLUMNS,
        rows: model.matrices.dailyFact,
        count: model.dailyFact.length
      },
      {
        moduleKey: "foundation",
        sheet: TRAFFIC_OS_SHEETS.monthlyFact,
        columns: MONTHLY_FACT_COLUMNS,
        rows: model.matrices.monthlyFact,
        count: model.monthlyFact.length
      },
      {
        moduleKey: "traffic_type_fact",
        sheet: TRAFFIC_OS_SHEETS.trafficTypeFact,
        columns: TRAFFIC_TYPE_FACT_COLUMNS,
        rows: model.matrices.trafficTypeFact,
        count: model.trafficTypeFact.length
      },
      {
        moduleKey: "traffic_management",
        sheet: TRAFFIC_OS_SHEETS.trafficManagement,
        columns: TRAFFIC_MANAGEMENT_COLUMNS,
        rows: model.matrices.trafficManagement,
        count: model.trafficManagement.length
      },
      {
        moduleKey: "channel_management",
        sheet: TRAFFIC_OS_SHEETS.channelManagement,
        columns: CHANNEL_MANAGEMENT_COLUMNS,
        rows: model.matrices.channelManagement,
        count: model.channelManagement.length
      },
      {
        moduleKey: "landing_management",
        sheet: TRAFFIC_OS_SHEETS.landingManagement,
        columns: LANDING_MANAGEMENT_COLUMNS,
        rows: model.matrices.landingManagement,
        count: model.landingManagement.length
      },
      {
        moduleKey: "campaign_management",
        sheet: TRAFFIC_OS_SHEETS.campaignManagement,
        columns: CAMPAIGN_MANAGEMENT_COLUMNS,
        rows: model.matrices.campaignManagement,
        count: model.campaignManagement.length
      },
      {
        moduleKey: "sales_coverage",
        sheet: TRAFFIC_OS_SHEETS.salesCoverage,
        columns: TRAFFIC_SALES_COVERAGE_COLUMNS,
        rows: model.matrices.salesCoverage,
        count: model.salesCoverage.length
      },
      {
        moduleKey: "alerts",
        sheet: TRAFFIC_OS_SHEETS.alerts,
        columns: TRAFFIC_ALERTS_COLUMNS,
        rows: model.matrices.alerts,
        count: model.alerts.length
      },
      {
        moduleKey: "sales_coverage",
        sheet: TRAFFIC_OS_SHEETS.joinQuality,
        columns: JOIN_QUALITY_COLUMNS,
        rows: model.matrices.joinQuality,
        count: model.joinQuality.length
      },
      {
        moduleKey: "sales_coverage",
        sheet: TRAFFIC_OS_SHEETS.revenueAttribution,
        columns: REVENUE_ATTRIBUTION_COLUMNS,
        rows: model.matrices.revenueAttribution,
        count: model.revenueAttribution.length
      },
      {
        moduleKey: "sales_coverage",
        sheet: TRAFFIC_OS_SHEETS.attributionGaps,
        columns: ATTRIBUTION_GAPS_COLUMNS,
        rows: model.matrices.attributionGaps,
        count: model.attributionGaps.length
      },
      ...(ga4
        ? ([
            {
              moduleKey: "ga4_foundation",
              sheet: TRAFFIC_OS_SHEETS.ga4PageDaily,
              columns: GA4_PAGE_DAILY_COLUMNS,
              rows: ga4.matrices.pageDaily,
              count: ga4.stats.pageDaily
            },
            {
              moduleKey: "ga4_foundation",
              sheet: TRAFFIC_OS_SHEETS.ga4ChannelDaily,
              columns: GA4_CHANNEL_DAILY_COLUMNS,
              rows: ga4.matrices.channelDaily,
              count: ga4.stats.channelDaily
            },
            {
              moduleKey: "ga4_foundation",
              sheet: TRAFFIC_OS_SHEETS.ga4SourceDaily,
              columns: GA4_SOURCE_DAILY_COLUMNS,
              rows: ga4.matrices.sourceDaily,
              count: ga4.stats.sourceDaily
            },
            {
              moduleKey: "ga4_foundation",
              sheet: TRAFFIC_OS_SHEETS.ga4CampaignDaily,
              columns: GA4_CAMPAIGN_DAILY_COLUMNS,
              rows: ga4.matrices.campaignDaily,
              count: ga4.stats.campaignDaily
            },
            {
              moduleKey: "ga4_foundation",
              sheet: TRAFFIC_OS_SHEETS.ga4LandingDaily,
              columns: GA4_LANDING_DAILY_COLUMNS,
              rows: ga4.matrices.landingDaily,
              count: ga4.stats.landingDaily
            },
            {
              moduleKey: "ga4_foundation",
              sheet: TRAFFIC_OS_SHEETS.ga4EventDaily,
              columns: GA4_EVENT_DAILY_COLUMNS,
              rows: ga4.matrices.eventDaily,
              count: ga4.stats.eventDaily
            },
            {
              moduleKey: "ga4_foundation",
              sheet: TRAFFIC_OS_SHEETS.ga4DataQuality,
              columns: GA4_DQ_COLUMNS,
              rows: ga4.matrices.dataQuality,
              count: ga4.stats.dataQuality
            }
          ] as WriteItem[])
        : []),
      {
        moduleKey: "marketing_home",
        sheet: TRAFFIC_OS_SHEETS.marketingHome,
        columns: MARKETING_HOME_COLUMNS,
        rows: model.matrices.marketingHome,
        count: model.marketingHome.length
      },
      {
        moduleKey: "unknown_center",
        sheet: TRAFFIC_OS_SHEETS.unknownCenter,
        columns: UNKNOWN_CENTER_COLUMNS,
        rows: model.matrices.unknownCenter,
        count: model.unknownCenter.length
      },
      {
        moduleKey: "data_quality_center",
        sheet: TRAFFIC_OS_SHEETS.dataQualityCenter,
        columns: DATA_QUALITY_CENTER_COLUMNS,
        rows: model.matrices.dataQualityCenter,
        count: model.dataQualityCenter.length
      },
      {
        moduleKey: "marketing_timeline",
        sheet: TRAFFIC_OS_SHEETS.marketingTimeline,
        columns: MARKETING_TIMELINE_COLUMNS,
        rows: model.matrices.marketingTimeline,
        count: model.marketingTimeline.length
      },
      {
        moduleKey: "data_quality",
        sheet: TRAFFIC_OS_SHEETS.dataQuality,
        columns: DATA_QUALITY_COLUMNS,
        rows: model.matrices.dataQuality,
        count: model.dataQuality.length
      },
      {
        moduleKey: "reconciliation",
        sheet: TRAFFIC_OS_SHEETS.reconciliation,
        columns: RECONCILIATION_COLUMNS,
        rows: model.matrices.reconciliation,
        count: model.reconciliation.length
      },
      {
        moduleKey: "export",
        sheet: TRAFFIC_OS_SHEETS.export,
        columns: TRAFFIC_EXPORT_V3_COLUMNS,
        rows: model.matrices.exportRows,
        count: model.exportRows.length
      }
    ];

    for (const item of writes) {
      const writeAll = moduleSet.has("all");
      const writeThis =
        writeAll ||
        moduleSet.has(item.moduleKey) ||
        (item.sheet === TRAFFIC_OS_SHEETS.settings && moduleSet.has("settings"));
      if (!writeThis) continue;

      if (!dryRun) {
        const titles = await listSheetTitles(spreadsheetId);
        if (!titles.includes(item.sheet)) {
          await ensureSheetTab(spreadsheetId, item.sheet);
        }
      }

      const result = await writeTab({
        dryRun,
        spreadsheetId,
        tabTitle: item.sheet,
        columns: item.columns,
        rows: item.rows
      });
      rows_written += result.written;
      sheets.push({ sheet: item.sheet, rows: item.count, written: result.written });
    }

    return {
      status: errors.length ? "failed" : "success",
      started_at,
      finished_at: new Date().toISOString(),
      dryRun,
      spreadsheetId,
      periods,
      modules,
      rows_read,
      rows_written,
      sheets,
      stats: model.stats,
      coverage_summary: model.coverageSummary,
      identityCoverage: model.identityCoverage,
      enrichmentCoverage: model.enrichmentCoverage,
      traffic_health: model.trafficHealth,
      ga4_foundation: ga4
        ? {
            property_id: ga4.propertyId,
            startDate: ga4.startDate,
            endDate: ga4.endDate,
            stats: ga4.stats,
            coverage: ga4.coverage
          }
        : undefined,
      reconciliation: model.reconciliation,
      warnings,
      errors,
      contract_version: `${TRAFFIC_OS_CONTRACT_VERSION}/${TRAFFIC_MANAGEMENT_CONTRACT_VERSION}/${TRAFFIC_EXPORT_V3_CONTRACT_VERSION}/${MARKETING_OS_CONTRACT_VERSION}/${GA4_FOUNDATION_CONTRACT_VERSION}`
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      status: "failed",
      started_at,
      finished_at: new Date().toISOString(),
      dryRun,
      spreadsheetId,
      periods,
      modules,
      rows_read,
      rows_written,
      sheets,
      stats: {},
      reconciliation: [],
      warnings,
      errors,
      contract_version: TRAFFIC_EXPORT_V3_CONTRACT_VERSION
    };
  }
}
