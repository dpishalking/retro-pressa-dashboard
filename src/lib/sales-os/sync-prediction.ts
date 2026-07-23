/**
 * Sync Sales Prediction Layer (sheets 40–46 + 98_PREDICTION_EXPORT) into Sales OS workbook.
 */

import { getSalesOsSpreadsheetId, SALES_OS_SHEETS } from "@/config/sales-os";
import { readGoogleServiceAccount, readSheetValues } from "@/lib/google/sheets-client";
import { safeReplaceSheet } from "@/lib/os-sheets/safe-write";
import {
  DEFAULT_FORECAST_METHOD,
  DEPARTMENT_SCOPE_ID,
  PLAN_COLUMNS,
  PREDICTION_DRIVER_COLUMNS,
  PREDICTION_EXPORT_COLUMNS,
  PREDICTION_FACT_COLUMNS,
  PREDICTION_MODEL_COLUMNS,
  PREDICTION_QUALITY_COLUMNS,
  PREDICTION_RECON_COLUMNS,
  PREDICTION_VIEW_COLUMNS,
  SALES_PREDICTION_CONTRACT_VERSION,
  activeManagerIds,
  approvedPlansOnly,
  buildAllFactRows,
  buildPredictionLayer,
  buildPredictionView,
  defaultScopes,
  departmentMonthSummary,
  findDuplicatePlanKeys,
  mergeSvodDepartmentPlans,
  plansFromSvodDepartment,
  reconcileLegacyVsSalesOs,
  resolveForecastAsOf,
  rowsFromPlanMatrix,
  type DailyFactLike,
  type PlanRow,
  type PredictionExportRow
} from "@/lib/sales-os/prediction";
import { pullSvodMonthPlans } from "@/lib/sales-os/svod-plans";
import type { ForecastMethod } from "@/types/business-os-standard";

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function toMatrix<T extends Record<string, string>>(
  columns: readonly string[],
  rows: T[]
): string[][] {
  return rows.map((row) => columns.map((c) => row[c] || ""));
}

function settingsMap(values: string[][]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of values.slice(1)) {
    const key = String(row[0] || "").trim();
    if (key) out[key] = String(row[1] || "").trim();
  }
  return out;
}

function parseDailyFact(values: string[][]): DailyFactLike[] {
  if (!values.length) return [];
  const header = values[0].map((c) => String(c || "").trim());
  const idx = (name: string) => header.indexOf(name);
  return values.slice(1).map((raw) => {
    const get = (name: string) => {
      const i = idx(name);
      return i >= 0 ? String(raw[i] ?? "").trim() : "";
    };
    return {
      date: get("date").slice(0, 10),
      manager_id: get("manager_id"),
      manager_name: get("manager_name"),
      leads: get("leads"),
      deals_created: get("deals_created"),
      invoices: get("invoices"),
      payments: get("payments"),
      revenue: get("revenue"),
      active_pipeline_deals: get("active_pipeline_deals"),
      active_pipeline_amount: get("active_pipeline_amount"),
      sync_updated_at: get("sync_updated_at")
    };
  });
}

export type SalesPredictionSyncModule =
  | "plans"
  | "fact"
  | "model"
  | "drivers"
  | "quality"
  | "view"
  | "recon"
  | "export"
  | "all";

export type SalesPredictionSyncResult = {
  status: "ok" | "partial" | "failed" | "blocked";
  contract_version: string;
  period: string;
  scopes: string[];
  plans_found: number;
  plans_approved: number;
  models_built: number;
  models_blocked: number;
  rows_read: number;
  rows_written: number;
  warnings: string[];
  errors: string[];
  forecast_methods: string[];
  forecast_as_of: string | null;
  quality_summary: {
    forecast_allowed: number;
    blocked: number;
    missing_plan: number;
  };
  dryRun: boolean;
  department_summary?: {
    plan: number | null;
    fact: number | null;
    run_rate: number | null;
    gap: number | null;
    required: number | null;
    status: string;
  };
};

let lock = false;

export async function syncSalesPrediction(input: {
  period?: string;
  scope?: Array<"department" | "manager">;
  modules?: SalesPredictionSyncModule[];
  dryRun?: boolean;
  spreadsheetId?: string;
  today?: string;
  legacyMonthAgg?: {
    paid_revenue?: number | null;
    payments?: number | null;
    average_check?: number | null;
    leads?: number | null;
    deals?: number | null;
    invoice_events?: number | null;
  };
}): Promise<SalesPredictionSyncResult> {
  if (lock) throw new Error("sales_prediction sync already running");
  lock = true;

  const warnings: string[] = [];
  const errors: string[] = [];
  let rowsWritten = 0;
  let rowsRead = 0;

  try {
    if (!readGoogleServiceAccount() && !input.dryRun) {
      return {
        status: "blocked",
        contract_version: SALES_PREDICTION_CONTRACT_VERSION,
        period: input.period || "",
        scopes: [],
        plans_found: 0,
        plans_approved: 0,
        models_built: 0,
        models_blocked: 0,
        rows_read: 0,
        rows_written: 0,
        warnings,
        errors: ["Google service account is not configured"],
        forecast_methods: [],
        forecast_as_of: null,
        quality_summary: { forecast_allowed: 0, blocked: 0, missing_plan: 0 },
        dryRun: Boolean(input.dryRun)
      };
    }

    const spreadsheetId = input.spreadsheetId || getSalesOsSpreadsheetId();
    const dryRun = Boolean(input.dryRun);
    const modules = new Set(
      !input.modules?.length || input.modules.includes("all")
        ? (["plans", "fact", "model", "drivers", "quality", "view", "recon", "export"] as const)
        : input.modules
    );
    const syncedAt = new Date().toISOString();
    const today = input.today || syncedAt.slice(0, 10);

    const settingsValues = await readSheetValues({
      spreadsheetId,
      range: `${quoteTab(SALES_OS_SHEETS.settings)}!A1:D`
    }).catch(() => [] as string[][]);
    const settings = settingsMap(settingsValues);
    rowsRead += settingsValues.length;

    const period = input.period || settings.plan_month || today.slice(0, 7);
    const methodRaw = (settings.forecast_method || DEFAULT_FORECAST_METHOD).trim();
    const forecastMethod = (
      ["calendar_run_rate", "working_day_run_rate", "weekly_pace", "unsupported"].includes(methodRaw)
        ? methodRaw
        : DEFAULT_FORECAST_METHOD
    ) as ForecastMethod;

    const dailyValues = await readSheetValues({
      spreadsheetId,
      range: `${quoteTab(SALES_OS_SHEETS.dailyFact)}!A1:Z`
    }).catch(() => [] as string[][]);
    rowsRead += dailyValues.length;
    const dailyFact = parseDailyFact(dailyValues);

    let planRows: PlanRow[] = [];
    const planValues = await readSheetValues({
      spreadsheetId,
      range: `${quoteTab(SALES_OS_SHEETS.salesPlans)}!A1:Z`
    }).catch(() => [] as string[][]);
    rowsRead += planValues.length;
    planRows = rowsFromPlanMatrix(planValues);
    const dups = findDuplicatePlanKeys(planRows);
    if (dups.length) warnings.push(`duplicate plan keys: ${dups.slice(0, 5).join(", ")}`);

    // Department month plans: СВОД «План/факт» ОБЩИЕ (July/August/…). Manager plans stay separate.
    let svodImported = 0;
    try {
      const svod = await pullSvodMonthPlans({ month: period });
      if (svod) {
        const fromSvod = plansFromSvodDepartment({ svod, syncedAt });
        svodImported = fromSvod.length;
        planRows = mergeSvodDepartmentPlans({ existing: planRows, svodPlans: fromSvod });
      } else {
        warnings.push(`СВОД План/факт: no ОБЩИЕ plan column for ${period}`);
      }
    } catch (error) {
      warnings.push(
        `СВОД plan pull failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (modules.has("plans") && !dryRun) {
      await safeReplaceSheet({
        spreadsheetId,
        tabTitle: SALES_OS_SHEETS.salesPlans,
        expectedColumns: PLAN_COLUMNS,
        rows: toMatrix(PLAN_COLUMNS, planRows),
        clearRange: `${quoteTab(SALES_OS_SHEETS.salesPlans)}!A:ZZ`,
        schemaVersion: SALES_PREDICTION_CONTRACT_VERSION
      });
      rowsWritten += planRows.length;
    } else if (!planRows.length) {
      warnings.push("40_Sales_Plans empty — all metrics NO_PLAN until СВОД/manager plans exist");
    } else if (svodImported && dryRun) {
      warnings.push(`dry-run: would import ${svodImported} department plans from СВОД ОБЩИЕ`);
    }

    const wantDept = !input.scope?.length || input.scope.includes("department");
    const wantMgr = !input.scope?.length || input.scope.includes("manager");
    const managerIds = wantMgr ? activeManagerIds({ rows: dailyFact, month: period }) : [];
    const scopes = defaultScopes(managerIds).filter((s) => {
      if (s.scopeType === "department") return wantDept;
      return wantMgr;
    });

    const factsFinal = buildAllFactRows({
      month: period,
      dailyFact,
      managerIds: wantMgr ? managerIds : [],
      factAsOf: resolveForecastAsOf({ month: period, today }),
      syncedAt,
      includeWeeks: true,
      includeDays: true
    });

    const layer = buildPredictionLayer({
      month: period,
      today,
      plans: planRows,
      facts: factsFinal,
      forecastMethod,
      syncedAt,
      scopes
    });

    const approved = approvedPlansOnly(planRows);
    const qualitySummary = {
      forecast_allowed: layer.quality.filter((q) => q.forecast_allowed === "true").length,
      blocked: layer.quality.filter((q) => q.blocked_reason).length,
      missing_plan: layer.models.filter(
        (m) => m.period_type === "month" && m.status === "NO_PLAN"
      ).length
    };

    const write = async (tab: string, columns: readonly string[], rows: string[][]) => {
      if (dryRun) return;
      await safeReplaceSheet({
        spreadsheetId,
        tabTitle: tab,
        expectedColumns: columns,
        rows,
        clearRange: `${quoteTab(tab)}!A:ZZ`,
        schemaVersion: SALES_PREDICTION_CONTRACT_VERSION
      });
      rowsWritten += rows.length;
    };

    if (modules.has("fact")) {
      await write(SALES_OS_SHEETS.predictionFact, PREDICTION_FACT_COLUMNS, toMatrix(PREDICTION_FACT_COLUMNS, factsFinal));
    }
    if (modules.has("model")) {
      await write(SALES_OS_SHEETS.predictionModel, PREDICTION_MODEL_COLUMNS, toMatrix(PREDICTION_MODEL_COLUMNS, layer.models));
    }
    if (modules.has("drivers")) {
      await write(
        SALES_OS_SHEETS.predictionDrivers,
        PREDICTION_DRIVER_COLUMNS,
        toMatrix(PREDICTION_DRIVER_COLUMNS, layer.drivers)
      );
    }
    if (modules.has("quality")) {
      await write(
        SALES_OS_SHEETS.predictionQuality,
        PREDICTION_QUALITY_COLUMNS,
        toMatrix(PREDICTION_QUALITY_COLUMNS, layer.quality)
      );
    }

    if (modules.has("view")) {
      const tagged = [
        ...buildPredictionView({
          month: period,
          scopeType: "department",
          scopeId: DEPARTMENT_SCOPE_ID,
          models: layer.models
        }),
        ...managerIds.flatMap((id) =>
          buildPredictionView({
            month: period,
            scopeType: "manager",
            scopeId: id,
            models: layer.models
          })
        )
      ];
      await write(
        SALES_OS_SHEETS.predictionView,
        PREDICTION_VIEW_COLUMNS,
        toMatrix(PREDICTION_VIEW_COLUMNS, tagged)
      );
    }

    if (modules.has("recon")) {
      const recon = reconcileLegacyVsSalesOs({
        periodType: "month",
        period,
        legacy: input.legacyMonthAgg || {},
        facts: factsFinal,
        syncedAt
      });
      if (!input.legacyMonthAgg) {
        warnings.push("legacyMonthAgg not provided — recon marked missing_legacy where empty");
      }
      await write(
        SALES_OS_SHEETS.predictionRecon,
        PREDICTION_RECON_COLUMNS,
        toMatrix(PREDICTION_RECON_COLUMNS, recon)
      );
    }

    if (modules.has("export")) {
      const exportRows: PredictionExportRow[] = layer.models
        .filter((m) => m.period_type === "month")
        .map((m) => ({
          contract_version: SALES_PREDICTION_CONTRACT_VERSION,
          period: m.period,
          scope_type: m.scope_type,
          scope_id: m.scope_id,
          metric_id: m.metric_id,
          plan_value: m.plan_value,
          fact_value: m.fact_value,
          run_rate_value: m.run_rate_value,
          gap_to_plan: m.gap_to_plan,
          status: m.status,
          forecast_method: m.forecast_method,
          forecast_as_of: m.forecast_as_of,
          sync_updated_at: syncedAt
        }));
      await write(
        SALES_OS_SHEETS.predictionExport,
        PREDICTION_EXPORT_COLUMNS,
        toMatrix(PREDICTION_EXPORT_COLUMNS, exportRows)
      );
    }

    return {
      status: errors.length ? "failed" : warnings.length ? "partial" : "ok",
      contract_version: SALES_PREDICTION_CONTRACT_VERSION,
      period,
      scopes: scopes.map((s) => `${s.scopeType}:${s.scopeId}`),
      plans_found: planRows.length,
      plans_approved: approved.length,
      models_built: layer.modelsBuilt,
      models_blocked: layer.modelsBlocked,
      rows_read: rowsRead,
      rows_written: dryRun ? 0 : rowsWritten,
      warnings,
      errors,
      forecast_methods: [forecastMethod],
      forecast_as_of: layer.forecastAsOf,
      quality_summary: qualitySummary,
      dryRun,
      department_summary: departmentMonthSummary(layer.models, period)
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      status: "failed",
      contract_version: SALES_PREDICTION_CONTRACT_VERSION,
      period: input.period || "",
      scopes: [],
      plans_found: 0,
      plans_approved: 0,
      models_built: 0,
      models_blocked: 0,
      rows_read: rowsRead,
      rows_written: 0,
      warnings,
      errors,
      forecast_methods: [],
      forecast_as_of: null,
      quality_summary: { forecast_allowed: 0, blocked: 0, missing_plan: 0 },
      dryRun: Boolean(input.dryRun)
    };
  } finally {
    lock = false;
  }
}

/** Validate plans + fact headers without writing. */
export async function validateSalesPrediction(input?: {
  spreadsheetId?: string;
  period?: string;
}): Promise<{ ok: boolean; errors: string[]; warnings: string[] }> {
  const result = await syncSalesPrediction({
    ...input,
    dryRun: true,
    modules: ["all"]
  });
  return {
    ok: result.status !== "failed" && result.status !== "blocked",
    errors: result.errors,
    warnings: result.warnings
  };
}

export { toPlanMatrix } from "@/lib/sales-os/prediction/plans";
export { parseNumber } from "@/lib/sales-os/prediction/run-rate";
