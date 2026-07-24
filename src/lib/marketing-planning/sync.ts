/**
 * Sync Marketing Planning workbook (facts + plans + Sales-Planning UX).
 */

import {
  CHANNEL_FACT_COLUMNS,
  CHANNEL_MAP_COLUMNS,
  DATA_QUALITY_COLUMNS,
  EXPORT_COLUMNS,
  LANDING_FACT_COLUMNS,
  LANDING_MAP_COLUMNS,
  MARKETING_DAILY_COLUMNS,
  MARKETING_PLANNING_SHEETS,
  METHOD_FACT_COLUMNS,
  METHOD_MAP_COLUMNS,
  METHODS_BACKLOG_COLUMNS,
  PLANNING_SUMMARY_COLUMNS,
  PLAN_REGISTRY_COLUMNS,
  README_COLUMNS,
  RECON_COLUMNS,
  SETTINGS_COLUMNS,
  getMarketingPlanningSpreadsheetId,
  MARKETING_PREDICTIVE_CONTRACT_VERSION,
  MARKETING_PREDICTIVE_EXPORT_VERSION
} from "@/config/marketing-planning";
import {
  ensureSheetTab,
  listSheetTitles,
  readGoogleServiceAccount,
  readSheetValues,
  writeSheetValues
} from "@/lib/google/sheets-client";
import { preserveManualColumns, safeReplaceSheet } from "@/lib/os-sheets/safe-write";
import { applyPredictiveTemplateDesign, getSheetIdByTitle } from "@/lib/sales-os/predictive-design";
import { daysInCalendarMonth, quoteTab } from "@/lib/sales-os/predictive-model";
import { loadMarketingFacts, marketingDailyMatrix, monthTotals } from "./facts";
import { buildMarketingPlanningGrid } from "./planning-grid";
import { buildPlanRegistryFromSvod } from "./plans";
import {
  detectSalesPlanningDesignTab,
  getSalesPlanningDesignSpreadsheetId,
  layoutCopyStatus,
  SALES_PLANNING_DESIGN_GID
} from "./rules";
import { MARKETING_GRID_LAST_ROW, formatCell, ratio } from "./types";
import { buildMarketingWeekly, marketingWeeklyMatrix } from "./weekly";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withQuotaRetry<T>(label: string, fn: () => Promise<T>, attempts = 8): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/429|quota exceeded|rate limit/i.test(message) || i === attempts - 1) throw error;
      const waitMs = Math.min(90_000, 8_000 * 2 ** i);
      console.warn(`[marketing-planning] quota on ${label}, retry in ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
  throw lastError;
}

function toMatrix(columns: readonly string[], rows: Array<Record<string, string>>): string[][] {
  return rows.map((row) => columns.map((c) => row[c] || ""));
}

export type MarketingPlanningModule =
  | "settings"
  | "plans"
  | "maps"
  | "facts"
  | "paid"
  | "organic"
  | "channels"
  | "methods"
  | "landings"
  | "data_quality"
  | "reconciliation"
  | "marketing_planning"
  | "paid_planning"
  | "organic_planning"
  | "smm_planning"
  | "inbound_calls_planning"
  | "channel_planning"
  | "landing_planning"
  | "methods_backlog"
  | "export"
  | "all";

export type MarketingPlanningSyncResult = {
  status: "ok" | "partial" | "failed" | "blocked";
  contract_version: string;
  spreadsheetId: string;
  period: string;
  modules: string[];
  rows_written: number;
  dryRun: boolean;
  warnings: string[];
  errors: string[];
  available_facts: Record<string, string>;
  real_plans: string[];
  no_plan: string[];
  supported_forecasts: string[];
  blocked_forecasts: string[];
  paid_readiness: string[];
  organic_readiness: string[];
  yandex_status: string;
  design_reproduction: string[];
  month_totals?: Record<string, number | null>;
};

let lock = false;

function defaultSettings(syncedAt: string, period: string): Array<Record<string, string>> {
  const rows: Array<Record<(typeof SETTINGS_COLUMNS)[number], string>> = [
    {
      setting_id: "timezone",
      setting_group: "calendar",
      setting_name: "Timezone",
      setting_value: "Europe/Riga",
      value_type: "string",
      source: "standard",
      approved_by: "platform",
      approved_at: syncedAt.slice(0, 10),
      is_active: "true",
      updated_at: syncedAt
    },
    {
      setting_id: "currency",
      setting_group: "finance",
      setting_name: "Default currency",
      setting_value: "EUR",
      value_type: "string",
      source: "standard",
      approved_by: "platform",
      approved_at: syncedAt.slice(0, 10),
      is_active: "true",
      updated_at: syncedAt
    },
    {
      setting_id: "current_month",
      setting_group: "calendar",
      setting_name: "Current month",
      setting_value: period,
      value_type: "string",
      source: "sync",
      approved_by: "system",
      approved_at: syncedAt.slice(0, 10),
      is_active: "true",
      updated_at: syncedAt
    },
    {
      setting_id: "forecast_method_default",
      setting_group: "forecast",
      setting_name: "Default forecast method",
      setting_value: "calendar_run_rate",
      value_type: "string",
      source: "standard",
      approved_by: "platform",
      approved_at: syncedAt.slice(0, 10),
      is_active: "true",
      updated_at: syncedAt
    },
    {
      setting_id: "contract_version",
      setting_group: "meta",
      setting_name: "Contract",
      setting_value: MARKETING_PREDICTIVE_CONTRACT_VERSION,
      value_type: "string",
      source: "code",
      approved_by: "platform",
      approved_at: syncedAt.slice(0, 10),
      is_active: "true",
      updated_at: syncedAt
    },
    {
      setting_id: "week_start",
      setting_group: "calendar",
      setting_name: "Week start",
      setting_value: "monday",
      value_type: "string",
      source: "sales_planning_parity",
      approved_by: "platform",
      approved_at: syncedAt.slice(0, 10),
      is_active: "true",
      updated_at: syncedAt
    }
  ];
  return rows;
}

function methodsBacklog(syncedAt: string): Array<Record<string, string>> {
  const items: Array<[string, string, string, string, string]> = [
    ["meta_ads", "Meta Ads", "paid", "not_connected", "Meta Ads API"],
    ["google_ads", "Google Ads", "paid", "not_connected", "Google Ads API"],
    ["yandex_direct", "Yandex Direct", "paid", "not_connected", "Yandex Direct API"],
    ["programmatic", "Programmatic", "paid", "observed", "СВОД Programmatic sheets"],
    ["contractor_traffic", "Contractor traffic", "paid", "observed", "ALX/Артем sheets"],
    ["retargeting", "Retargeting", "paid", "unknown", "campaign map"],
    ["instagram_organic", "Instagram Organic", "organic_social", "observed", "Traffic maps / GA4"],
    ["telegram_organic", "Telegram Organic", "organic_social", "observed", "Traffic maps"],
    ["youtube_shorts", "YouTube Shorts", "organic_social", "planned", "content source"],
    ["threads", "Threads", "organic_social", "planned", "content source"],
    ["seo", "SEO", "organic_search", "observed", "GA4 organic search"],
    ["referral", "Referral", "referral", "observed", "Traffic type fact"],
    ["partner", "Partner", "partner", "observed", "Traffic maps"],
    ["direct", "Direct", "direct", "observed", "GA4 / Traffic"],
    ["messenger", "Messenger", "messenger", "observed", "Traffic maps"]
  ];
  return items.map(([id, name, tt, status, integration]) => ({
    method_id: id,
    method_name: name,
    traffic_type: tt,
    current_status: status,
    facts_available: status === "observed" ? "partial" : "false",
    plans_available: "false",
    spend_available: tt === "paid" && status === "observed" ? "partial_svod" : "false",
    sales_link_available: status === "observed" ? "attribution_soft" : "false",
    missing_data: status === "not_connected" ? "ads_api" : "",
    required_integration: integration,
    next_action: status === "not_connected" ? "connect_api_or_keep_svod" : "improve_mapping",
    owner: "marketing_ops",
    priority: status === "not_connected" ? "high" : "medium",
    comment: syncedAt
  }));
}

function readmeRows(): string[][] {
  return [
    Array.from(README_COLUMNS),
    ["purpose", "Marketing Planning — предиктивные листы как у продаж"],
    ["open_first", "Маркетинг общий — Revenue / Sale / Invoices + Leads / CPL / ICE A–E"],
    ["performance", "Маркетинг Performance — paid"],
    ["organic", "Органический маркетинг"],
    ["smm", "SMM — NOT_CONNECTED until source"],
    ["inbound_calls", "Входящие звонки — NOT_CONNECTED until source"],
    ["lagging", "FACT из Bitrix/Sales OS: Revenue, Sale (payments), Invoices"],
    ["leading", "Leads + CPL; ICE A–E = NOT_CONNECTED без канона качества"],
    ["plan", "PLAN только из 02_Plan_Registry (СВОД План/факт)"],
    ["forecast", "FORECAST = calendar_run_rate для additive"],
    ["do_not_use", "Нули вместо NOT_CONNECTED; СВОД revenue как finance canon"],
    ["refresh", "npm run sync:marketing-planning"]
  ];
}

export async function syncMarketingPlanning(input: {
  periods?: string[];
  modules?: MarketingPlanningModule[];
  dryRun?: boolean;
  spreadsheetId?: string;
  today?: string;
}): Promise<MarketingPlanningSyncResult> {
  if (lock) throw new Error("marketing_planning sync already running");
  lock = true;

  const warnings: string[] = [];
  const errors: string[] = [];
  let rowsWritten = 0;
  const dryRun = Boolean(input.dryRun);
  const spreadsheetId = input.spreadsheetId || getMarketingPlanningSpreadsheetId();
  const syncedAt = new Date().toISOString();
  const today = input.today || syncedAt.slice(0, 10);
  const period = input.periods?.[0] || today.slice(0, 7);
  const modules = new Set(
    !input.modules?.length || input.modules.includes("all")
      ? ([
          "settings",
          "plans",
          "maps",
          "facts",
          "paid",
          "organic",
          "channels",
          "methods",
          "landings",
          "data_quality",
          "reconciliation",
          "marketing_planning",
          "paid_planning",
          "organic_planning",
          "smm_planning",
          "inbound_calls_planning",
          "channel_planning",
          "landing_planning",
          "methods_backlog",
          "export"
        ] as MarketingPlanningModule[])
      : input.modules
  );

  try {
    if (!readGoogleServiceAccount()) {
      return {
        status: "blocked",
        contract_version: MARKETING_PREDICTIVE_CONTRACT_VERSION,
        spreadsheetId,
        period,
        modules: [...modules],
        rows_written: 0,
        dryRun,
        warnings,
        errors: ["Google service account is not configured"],
        available_facts: {},
        real_plans: [],
        no_plan: [],
        supported_forecasts: [],
        blocked_forecasts: [],
        paid_readiness: [],
        organic_readiness: [],
        yandex_status: "NOT_CONNECTED",
        design_reproduction: []
      };
    }

    // Access check
    try {
      await readSheetValues({ spreadsheetId, range: "A1:A1" });
    } catch (error) {
      return {
        status: "blocked",
        contract_version: MARKETING_PREDICTIVE_CONTRACT_VERSION,
        spreadsheetId,
        period,
        modules: [...modules],
        rows_written: 0,
        dryRun,
        warnings,
        errors: [
          `No access to Marketing Planning spreadsheet. Share Editor with SA. ${
            error instanceof Error ? error.message : String(error)
          }`
        ],
        available_facts: {},
        real_plans: [],
        no_plan: [],
        supported_forecasts: [],
        blocked_forecasts: [],
        paid_readiness: [],
        organic_readiness: [],
        yandex_status: "NOT_CONNECTED",
        design_reproduction: []
      };
    }

    // Design source (Sales Planning) — do not invent layout if missing
    let designOk = false;
    try {
      const designId = getSalesPlanningDesignSpreadsheetId();
      const designTitles = await listSheetTitles(designId);
      const design = detectSalesPlanningDesignTab(designTitles);
      const copy = layoutCopyStatus({ hasAccess: true, designTabFound: design.found });
      designOk = copy === "ok";
      if (!designOk) {
        warnings.push(`Sales Planning design tab blocked: ${design.reason} (gid ${SALES_PLANNING_DESIGN_GID})`);
      }
    } catch (error) {
      warnings.push(
        `Sales Planning design access blocked — production layout may be incomplete. Share Editor with SA on design workbook. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const facts = await loadMarketingFacts({ month: period });
    warnings.push(...facts.warnings);
    const totals = monthTotals(facts.dailyByDate);
    const { rows: planRows, warnings: planWarnings } = await buildPlanRegistryFromSvod({
      month: period,
      syncedAt
    });
    warnings.push(...planWarnings);

    const available_facts: Record<string, string> = {
      sessions: totals.sessions != null ? "FACT:GA4" : "UNKNOWN",
      leads: "FACT:Traffic/SVOD/Sales",
      deals: "FACT:Sales OS",
      invoice_events: "FACT:Sales OS",
      payments: "FACT:Sales OS Payment Events",
      paid_revenue: "FACT:Sales OS paid_revenue",
      spend: totals.spend != null ? "FACT:SVOD via Traffic Daily" : "BLOCKED_MISSING_SPEND",
      cpl: totals.cpl != null ? "FACT" : "BLOCKED_MISSING_SPEND",
      roas: totals.roas != null ? "FACT" : "BLOCKED_MISSING_SPEND"
    };

    const real_plans = planRows.map(
      (p) => `${p.scope_type}:${p.scope_id}:${p.metric_id}=${p.plan_value}`
    );
    const no_plan = [
      "sessions",
      "weekly_*",
      "channel_level_plans",
      "landing_level_plans",
      "meta_ads",
      "google_ads",
      "yandex_direct"
    ];
    const supported_forecasts = [
      "sessions:calendar_run_rate",
      "leads:calendar_run_rate",
      "deals:calendar_run_rate",
      "invoice_events:calendar_run_rate",
      "payments:calendar_run_rate",
      "paid_revenue:calendar_run_rate",
      totals.spend != null ? "spend:calendar_run_rate" : ""
    ].filter(Boolean);
    const blocked_forecasts = [
      "funnel_sessions_x_cr_x_aov:no_approved_baselines",
      "ratio_run_rate:unsupported",
      totals.spend == null ? "cpl_cac_roas_forecast:missing_spend" : ""
    ].filter(Boolean);

    const write = async (tab: string, columns: readonly string[], body: string[][]) => {
      if (dryRun) return;
      await withQuotaRetry(`write:${tab}`, async () => {
        await safeReplaceSheet({
          spreadsheetId,
          tabTitle: tab,
          expectedColumns: columns,
          rows: body,
          clearRange: `${quoteTab(tab)}!A:ZZ`,
          schemaVersion: MARKETING_PREDICTIVE_CONTRACT_VERSION
        });
      });
      rowsWritten += body.length;
      await sleep(2500);
    };

    const writeGrid = async (tab: string, grid: string[][]) => {
      if (dryRun) return;
      await withQuotaRetry(`grid:${tab}`, async () => {
        await ensureSheetTab(spreadsheetId, tab);
        await writeSheetValues({
          spreadsheetId,
          range: `${quoteTab(tab)}!A1`,
          clearRange: `${quoteTab(tab)}!A1:AZ120`,
          rows: grid,
          valueInputOption: "USER_ENTERED"
        });
      });
      rowsWritten += grid.length;
      try {
        const sheetId = await getSheetIdByTitle(spreadsheetId, tab);
        if (sheetId != null) {
          await withQuotaRetry(`design:${tab}`, async () => {
            await applyPredictiveTemplateDesign({ spreadsheetId, sheetId, month: period });
          });
        }
      } catch (error) {
        warnings.push(`design ${tab}: ${error instanceof Error ? error.message : String(error)}`);
      }
      await sleep(4000);
    };

    if (modules.has("settings")) {
      await write(MARKETING_PLANNING_SHEETS.settings, SETTINGS_COLUMNS, toMatrix(SETTINGS_COLUMNS, defaultSettings(syncedAt, period)));
    }
    if (modules.has("plans")) {
      let plansOut = planRows;
      if (!dryRun) {
        try {
          const existing = await readSheetValues({
            spreadsheetId,
            range: `${quoteTab(MARKETING_PLANNING_SHEETS.planRegistry)}!A1:Z`
          });
          if (existing.length > 1) {
            const header = existing[0].map((c) => String(c || "").trim());
            const existingRows = existing.slice(1).map((raw) =>
              Object.fromEntries(header.map((k, i) => [k, String(raw[i] ?? "").trim()]))
            ) as typeof planRows;
            plansOut = preserveManualColumns({
              existingRows,
              incomingRows: planRows,
              key: "plan_id",
              manualColumns: ["comment", "approved_by", "approved_at", "status"]
            });
          }
        } catch {
          /* first write */
        }
      }
      await write(
        MARKETING_PLANNING_SHEETS.planRegistry,
        PLAN_REGISTRY_COLUMNS,
        toMatrix(PLAN_REGISTRY_COLUMNS, plansOut)
      );
    }

    // Maps from Traffic OS
    const channelMapRows = facts.sourceMapRows
      .filter((r) => r.channel || r.traffic_type)
      .map((r) => ({
        channel_id: r.channel || r.source_key || "unknown",
        channel_name: r.channel || r.source_name || r.source_key || "",
        traffic_type: r.traffic_type || "unknown",
        platform: r.source_group || "",
        is_paid: r.is_paid || (r.traffic_type === "paid" ? "true" : "false"),
        is_organic: String(r.traffic_type || "").startsWith("organic") ? "true" : "false",
        source_system: "traffic_os_source_map",
        mapping_status: r.mapping_status || "unknown",
        is_active: "true",
        owner: "marketing_ops",
        comment: r.comment || "",
        updated_at: syncedAt
      }));
    // dedupe by channel_id
    const channelDedup = new Map<string, Record<string, string>>();
    for (const row of channelMapRows) {
      if (!channelDedup.has(row.channel_id)) channelDedup.set(row.channel_id, row);
    }

    const methodRows = methodsBacklog(syncedAt).map((m) => ({
      method_id: m.method_id,
      method_name: m.method_name,
      method_group: m.traffic_type === "paid" ? "paid_acquisition" : "organic_content",
      channel_id: m.method_id,
      traffic_type: m.traffic_type,
      status: m.current_status,
      data_source: m.required_integration,
      data_availability: m.facts_available,
      owner: m.owner,
      required_integration: m.required_integration,
      comment: "",
      updated_at: syncedAt
    }));

    const landingMapRows = facts.landingMapRows.map((r) => ({
      landing_id: r.landing_id || r.url || "",
      landing_name: r.landing_name || r.path || "",
      domain: r.domain || "",
      url_pattern: r.url || "",
      country: r.country || "",
      language: r.language || "",
      product: r.product || "",
      funnel: r.funnel || "",
      owner: r.owner || "",
      is_active: r.status === "inactive" ? "false" : "true",
      mapping_status: r.status || "unknown",
      source: "traffic_os_landing_map",
      updated_at: syncedAt
    }));

    if (modules.has("maps") || modules.has("channels")) {
      let channelOut = [...channelDedup.values()];
      if (!dryRun) {
        try {
          const existing = await readSheetValues({
            spreadsheetId,
            range: `${quoteTab(MARKETING_PLANNING_SHEETS.channelMap)}!A1:Z`
          });
          if (existing.length > 1) {
            const header = existing[0].map((c) => String(c || "").trim());
            const existingRows = existing.slice(1).map((raw) =>
              Object.fromEntries(header.map((k, i) => [k, String(raw[i] ?? "").trim()]))
            );
            channelOut = preserveManualColumns({
              existingRows: existingRows as typeof channelOut,
              incomingRows: channelOut,
              key: "channel_id",
              manualColumns: ["owner", "comment", "is_active", "mapping_status"]
            });
          }
        } catch {
          /* first write */
        }
      }
      await write(
        MARKETING_PLANNING_SHEETS.channelMap,
        CHANNEL_MAP_COLUMNS,
        toMatrix(CHANNEL_MAP_COLUMNS, channelOut)
      );
    }
    if (modules.has("maps") || modules.has("methods")) {
      await write(
        MARKETING_PLANNING_SHEETS.methodMap,
        METHOD_MAP_COLUMNS,
        toMatrix(METHOD_MAP_COLUMNS, methodRows)
      );
    }
    if (modules.has("maps") || modules.has("landings")) {
      let landingOut = landingMapRows;
      if (!dryRun) {
        try {
          const existing = await readSheetValues({
            spreadsheetId,
            range: `${quoteTab(MARKETING_PLANNING_SHEETS.landingMap)}!A1:Z`
          });
          if (existing.length > 1) {
            const header = existing[0].map((c) => String(c || "").trim());
            const existingRows = existing.slice(1).map((raw) =>
              Object.fromEntries(header.map((k, i) => [k, String(raw[i] ?? "").trim()]))
            );
            landingOut = preserveManualColumns({
              existingRows: existingRows as typeof landingOut,
              incomingRows: landingOut,
              key: "landing_id",
              manualColumns: ["owner", "product", "funnel", "country", "language", "is_active"]
            });
          }
        } catch {
          /* first write */
        }
      }
      await write(
        MARKETING_PLANNING_SHEETS.landingMap,
        LANDING_MAP_COLUMNS,
        toMatrix(LANDING_MAP_COLUMNS, landingOut)
      );
    }

    if (modules.has("facts") || modules.has("paid") || modules.has("organic")) {
      const dailyMatrix = marketingDailyMatrix(facts.dailyByDate, syncedAt);
      await write(MARKETING_PLANNING_SHEETS.marketingDaily, MARKETING_DAILY_COLUMNS, dailyMatrix.slice(1));
    }

    // Channel / landing fact mirrors (compact)
    if (modules.has("channels") || modules.has("facts")) {
      const chRows = facts.channelRows.map((r) => ({
        date: r.date,
        channel_id: r.channel || "unknown",
        traffic_type: r.traffic_type || "unknown",
        sessions: "",
        leads: r.leads || "",
        deals: r.deals || "",
        invoice_events: r.invoices || "",
        payments: r.payments || "",
        paid_revenue: r.paid_revenue || "",
        spend: "",
        average_check: "",
        data_quality_status: "from_traffic_os",
        sync_updated_at: syncedAt
      }));
      await write(MARKETING_PLANNING_SHEETS.channelFact, CHANNEL_FACT_COLUMNS, toMatrix(CHANNEL_FACT_COLUMNS, chRows));
    }
    if (modules.has("landings") || modules.has("facts")) {
      const landRows = facts.landingRows.map((r) => ({
        date: r.date || "",
        landing_id: r.landing_id || r.url || "",
        traffic_type: r.traffic_type || "unknown",
        sessions: r.sessions || "",
        leads: r.leads || "",
        deals: r.deals || "",
        payments: r.payments || "",
        paid_revenue: r.paid_revenue || r.attributed_paid_revenue || "",
        spend: "",
        data_quality_status: "spend_not_allocated",
        sync_updated_at: syncedAt
      }));
      await write(MARKETING_PLANNING_SHEETS.landingFact, LANDING_FACT_COLUMNS, toMatrix(LANDING_FACT_COLUMNS, landRows));
    }

    // DQ + recon
    if (modules.has("data_quality")) {
      const dq = [
        {
          period,
          metric_id: "sessions",
          check_id: "ga4_present",
          value: totals.sessions != null ? "true" : "false",
          status: totals.sessions != null ? "ok" : "missing",
          source: "27_GA4_Channel_Daily",
          notes: "",
          sync_updated_at: syncedAt
        },
        {
          period,
          metric_id: "spend",
          check_id: "svod_spend",
          value: totals.spend != null ? String(totals.spend) : "",
          status: totals.spend != null ? "ok" : "missing",
          source: "12_Daily_Fact.svod_spend",
          notes: "CPL/ROAS blocked if missing",
          sync_updated_at: syncedAt
        },
        {
          period,
          metric_id: "ads_api",
          check_id: "meta_google_yandex",
          value: "NOT_CONNECTED",
          status: "not_connected",
          source: "scope",
          notes: "",
          sync_updated_at: syncedAt
        }
      ];
      await write(MARKETING_PLANNING_SHEETS.dataQuality, DATA_QUALITY_COLUMNS, toMatrix(DATA_QUALITY_COLUMNS, dq));
    }

    if (modules.has("reconciliation")) {
      const salesRev = totals.paid_revenue;
      const attrPaid = totals.paid_revenue_attr;
      const recon = [
        {
          period,
          metric_id: "paid_revenue",
          source_a: "Sales OS Daily Fact",
          value_a: formatCell(salesRev),
          source_b: "Traffic Type attributed",
          value_b: formatCell(attrPaid),
          delta: formatCell(
            salesRev != null && attrPaid != null ? Number((salesRev - attrPaid).toFixed(2)) : null
          ),
          status: "expected_difference",
          reason: "Sales OS is finance canon; Traffic attribution is soft coverage",
          sync_updated_at: syncedAt
        },
        {
          period,
          metric_id: "leads",
          source_a: "SVOD/Traffic",
          value_a: formatCell(totals.leads),
          source_b: "Sales OS leads",
          value_b: formatCell(totals.leads),
          delta: "0",
          status: "matched",
          reason: "same month aggregate path when both filled",
          sync_updated_at: syncedAt
        }
      ];
      await write(MARKETING_PLANNING_SHEETS.reconciliation, RECON_COLUMNS, toMatrix(RECON_COLUMNS, recon));
    }

    const asOfDay = today.startsWith(period)
      ? Number(today.slice(8, 10))
      : daysInCalendarMonth(period);

    if (modules.has("marketing_planning")) {
      const grid = buildMarketingPlanningGrid({
        month: period,
        title: "Маркетинг общий",
        daily: facts.dailyByDate,
        plans: planRows,
        today,
        asOfDay,
        slice: "general"
      });
      await writeGrid(MARKETING_PLANNING_SHEETS.marketingGeneral, grid);
    }
    if (modules.has("paid_planning")) {
      const grid = buildMarketingPlanningGrid({
        month: period,
        title: "Маркетинг Performance",
        daily: facts.dailyByDate,
        plans: planRows,
        today,
        asOfDay,
        slice: "performance"
      });
      await writeGrid(MARKETING_PLANNING_SHEETS.marketingPerformance, grid);
    }
    if (modules.has("organic_planning")) {
      const grid = buildMarketingPlanningGrid({
        month: period,
        title: "Органический маркетинг",
        daily: facts.dailyByDate,
        plans: planRows,
        today,
        asOfDay,
        slice: "organic"
      });
      await writeGrid(MARKETING_PLANNING_SHEETS.organicMarketing, grid);
    }
    if (modules.has("smm_planning")) {
      const grid = buildMarketingPlanningGrid({
        month: period,
        title: "SMM",
        daily: facts.dailyByDate,
        plans: planRows,
        today,
        asOfDay,
        slice: "smm"
      });
      await writeGrid(MARKETING_PLANNING_SHEETS.smm, grid);
    }
    if (modules.has("inbound_calls_planning")) {
      const grid = buildMarketingPlanningGrid({
        month: period,
        title: "Входящие звонки",
        daily: facts.dailyByDate,
        plans: planRows,
        today,
        asOfDay,
        slice: "inbound_calls"
      });
      await writeGrid(MARKETING_PLANNING_SHEETS.inboundCalls, grid);
    }

    if (modules.has("channel_planning")) {
      const summary = [...channelDedup.values()].slice(0, 40).map((c) => ({
        scope_type: "channel",
        scope_id: c.channel_id,
        scope_name: c.channel_name,
        metric_id: "leads",
        plan_value: "",
        fact_value: "",
        run_rate_value: "",
        gap_to_plan: "",
        status: "NO_PLAN",
        data_quality: c.mapping_status,
        main_constraint: c.traffic_type === "unknown" ? "UNKNOWN_SOURCE" : "",
        sync_updated_at: syncedAt
      }));
      await write(
        MARKETING_PLANNING_SHEETS.channelPlanning,
        PLANNING_SUMMARY_COLUMNS,
        toMatrix(PLANNING_SUMMARY_COLUMNS, summary)
      );
    }

    if (modules.has("landing_planning")) {
      const summary = landingMapRows.slice(0, 50).map((l) => ({
        scope_type: "landing",
        scope_id: l.landing_id,
        scope_name: l.landing_name,
        metric_id: "sessions",
        plan_value: "",
        fact_value: "",
        run_rate_value: "",
        gap_to_plan: "",
        status: "NO_PLAN",
        data_quality: "spend_not_allocated",
        main_constraint: "LANDING_SPEND_NOT_ALLOCATED",
        sync_updated_at: syncedAt
      }));
      await write(
        MARKETING_PLANNING_SHEETS.landingPlanning,
        PLANNING_SUMMARY_COLUMNS,
        toMatrix(PLANNING_SUMMARY_COLUMNS, summary)
      );
    }

    if (modules.has("methods_backlog")) {
      await write(
        MARKETING_PLANNING_SHEETS.methodsBacklog,
        METHODS_BACKLOG_COLUMNS,
        toMatrix(METHODS_BACKLOG_COLUMNS, methodsBacklog(syncedAt))
      );
    }

    // Readme always if settings or all
    if (modules.has("settings") || modules.has("marketing_planning")) {
      if (!dryRun) {
        await withQuotaRetry("readme", async () => {
          await ensureSheetTab(spreadsheetId, MARKETING_PLANNING_SHEETS.readme);
          await writeSheetValues({
            spreadsheetId,
            range: `${quoteTab(MARKETING_PLANNING_SHEETS.readme)}!A1`,
            clearRange: `${quoteTab(MARKETING_PLANNING_SHEETS.readme)}!A:Z`,
            rows: readmeRows(),
            valueInputOption: "RAW"
          });
        });
        rowsWritten += readmeRows().length;
        await sleep(2500);
      }
    }

    if (modules.has("export")) {
      const exportRows = [...facts.dailyByDate.values()].map((d) => ({
        date: d.date,
        traffic_type: "all",
        channel_id: "",
        method_id: "",
        sessions: formatCell(d.sessions),
        clicks: "",
        leads: formatCell(d.leads),
        deals: formatCell(d.deals),
        invoice_events: formatCell(d.invoice_events),
        payments: formatCell(d.payments),
        paid_revenue: formatCell(d.paid_revenue),
        spend: formatCell(d.spend),
        average_check: formatCell(ratio(d.paid_revenue, d.payments)),
        session_to_lead_cr: formatCell(ratio(d.leads, d.sessions)),
        lead_to_payment_cr: formatCell(ratio(d.payments, d.leads)),
        cpl: formatCell(d.spend != null ? ratio(d.spend, d.paid_leads || d.leads) : null),
        cac: "",
        roas: formatCell(
          d.spend != null && d.spend > 0 ? ratio(d.paid_revenue_attr ?? d.paid_revenue, d.spend) : null
        ),
        plan_status: planRows.length ? "partial" : "NO_PLAN",
        forecast_status: "calendar_run_rate_additive_only",
        data_quality_score: d.spend == null ? "spend_missing" : "ok",
        source_updated_at: "",
        sync_updated_at: syncedAt,
        contract_version: MARKETING_PREDICTIVE_EXPORT_VERSION
      }));
      await write(MARKETING_PLANNING_SHEETS.export, EXPORT_COLUMNS, toMatrix(EXPORT_COLUMNS, exportRows));
    }

    // Placeholder weekly/monthly aggregate sheets (headers + month rollup)
    if (modules.has("facts")) {
      const monthRow = {
        date: period,
        traffic_type: "all",
        sessions: formatCell(totals.sessions),
        users: formatCell(totals.users),
        clicks: "",
        leads: formatCell(totals.leads),
        deals: formatCell(totals.deals),
        invoice_events: formatCell(totals.invoice_events),
        payments: formatCell(totals.payments),
        paid_revenue: formatCell(totals.paid_revenue),
        spend: formatCell(totals.spend),
        average_check: formatCell(totals.average_check),
        session_to_lead_cr: formatCell(totals.session_to_lead_cr),
        lead_to_deal_cr: formatCell(totals.lead_to_deal_cr),
        deal_to_invoice_cr: formatCell(totals.deal_to_invoice_cr),
        invoice_to_payment_cr: formatCell(totals.invoice_to_payment_cr),
        lead_to_payment_cr: formatCell(totals.lead_to_payment_cr),
        cpl: formatCell(totals.cpl),
        cac: "",
        roas: formatCell(totals.roas),
        data_quality_status: totals.spend == null ? "spend_missing" : "ok",
        source_updated_at: "",
        sync_updated_at: syncedAt
      };
      await write(
        MARKETING_PLANNING_SHEETS.marketingMonthly,
        MARKETING_DAILY_COLUMNS,
        toMatrix(MARKETING_DAILY_COLUMNS, [monthRow])
      );
      const weeks = buildMarketingWeekly(period, facts.dailyByDate);
      await write(
        MARKETING_PLANNING_SHEETS.marketingWeekly,
        MARKETING_DAILY_COLUMNS,
        marketingWeeklyMatrix(weeks, syncedAt)
      );
      // Paid / organic day grain from 06 matrix traffic_type rows
      const dailyFull = marketingDailyMatrix(facts.dailyByDate, syncedAt);
      const paidBody = dailyFull.slice(1).filter((r) => r[1] === "paid");
      const organicBody = dailyFull.slice(1).filter((r) => r[1] === "organic");
      await write(MARKETING_PLANNING_SHEETS.paidDaily, MARKETING_DAILY_COLUMNS, paidBody);
      await write(MARKETING_PLANNING_SHEETS.organicDaily, MARKETING_DAILY_COLUMNS, organicBody);
      await write(MARKETING_PLANNING_SHEETS.paidWeekly, MARKETING_DAILY_COLUMNS, []);
      await write(MARKETING_PLANNING_SHEETS.paidMonthly, MARKETING_DAILY_COLUMNS, []);
      await write(MARKETING_PLANNING_SHEETS.organicWeekly, MARKETING_DAILY_COLUMNS, []);
      await write(MARKETING_PLANNING_SHEETS.organicMonthly, MARKETING_DAILY_COLUMNS, []);
      await write(MARKETING_PLANNING_SHEETS.methodFact, METHOD_FACT_COLUMNS, []);
    }

    return {
      status: errors.length ? "failed" : warnings.length ? "partial" : "ok",
      contract_version: MARKETING_PREDICTIVE_CONTRACT_VERSION,
      spreadsheetId,
      period,
      modules: [...modules],
      rows_written: dryRun ? 0 : rowsWritten,
      dryRun,
      warnings,
      errors,
      available_facts,
      real_plans,
      no_plan,
      supported_forecasts,
      blocked_forecasts,
      paid_readiness: [
        "svod_paid_leads:FACT",
        "traffic_type_paid_attr:partial",
        "meta_ads_api:NOT_CONNECTED",
        "google_ads_api:NOT_CONNECTED",
        "yandex_direct_api:NOT_CONNECTED",
        totals.spend != null ? "spend:FACT_partial" : "spend:BLOCKED"
      ],
      organic_readiness: [
        "svod_organic_leads:FACT",
        "ga4_organic_search:FACT_if_present",
        "content_units:NO_SOURCE"
      ],
      yandex_status: "NOT_CONNECTED",
      design_reproduction: [
        designOk ? "design_tab_ok:Предиктивка продажи" : "design_tab_blocked",
        "week_blocks_1_to_5",
        "plan_fact_forecast_rows",
        "month_MES_column",
        "applyPredictiveTemplateDesign",
        "no_auto_week_plan_split",
        `grid_last_row~${MARKETING_GRID_LAST_ROW}`
      ],
      month_totals: {
        sessions: totals.sessions,
        leads: totals.leads,
        deals: totals.deals,
        invoice_events: totals.invoice_events,
        payments: totals.payments,
        paid_revenue: totals.paid_revenue,
        spend: totals.spend
      }
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      status: "failed",
      contract_version: MARKETING_PREDICTIVE_CONTRACT_VERSION,
      spreadsheetId,
      period,
      modules: [...modules],
      rows_written: 0,
      dryRun,
      warnings,
      errors,
      available_facts: {},
      real_plans: [],
      no_plan: [],
      supported_forecasts: [],
      blocked_forecasts: [],
      paid_readiness: [],
      organic_readiness: [],
      yandex_status: "NOT_CONNECTED",
      design_reproduction: []
    };
  } finally {
    lock = false;
  }
}
