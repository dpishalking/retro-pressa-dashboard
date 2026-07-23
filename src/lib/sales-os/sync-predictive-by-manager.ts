/**
 * Sync per-manager predictive tabs into the ROP predictive workbook.
 * Facts from Sales OS 12_Daily_Fact. Plans left empty (later sheet).
 */

import { getSalesOsSpreadsheetId, SALES_OS_SHEETS } from "@/config/sales-os";
import {
  ensureSheetColumnCapacity,
  ensureSheetRowCapacity,
  ensureSheetTab,
  readSheetValues,
  writeSheetValues
} from "@/lib/google/sheets-client";
import { applyPredictiveTemplateDesign, getSheetIdByTitle } from "@/lib/sales-os/predictive-design";
import {
  PREDICTIVE_ASOF_DAY_ROW,
  PREDICTIVE_AUTO_FACT_METRICS,
  PREDICTIVE_METRICS,
  buildMonthDayColumns,
  daysInCalendarMonth,
  getPredictiveSpreadsheetId,
  layoutForMonth,
  quoteTab
} from "@/lib/sales-os/predictive-model";
import {
  MANAGER_INDEX_COLUMNS,
  PREDICTIVE_MANAGERS_INDEX_TAB,
  aggregateManagerDayFacts,
  buildManagerPredictiveGrid,
  managerPredictiveTabTitle,
  monthTotalsFromDayFacts
} from "@/lib/sales-os/predictive-by-manager-model";
import { activeManagerIds, type DailyFactLike } from "@/lib/sales-os/prediction/facts";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withQuotaRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/quota exceeded|rate limit|429/i.test(message)) throw error;
      const waitMs = 15_000 + attempt * 10_000;
      console.warn(`[predictive-managers] quota on ${label}, retry in ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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
      sync_updated_at: get("sync_updated_at")
    };
  });
}

function managerNameMap(dailyFact: DailyFactLike[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of dailyFact) {
    const id = String(row.manager_id || "").trim();
    if (!id) continue;
    const name = String(row.manager_name || "").trim();
    if (name && !map.has(id)) map.set(id, name);
  }
  return map;
}

export type PredictiveManagersSyncResult = {
  spreadsheetId: string;
  month: string;
  managers: number;
  tabs: string[];
  indexRows: number;
  factCellsWritten: number;
  dryRun: boolean;
  warnings: string[];
};

export async function syncPredictiveByManager(input: {
  month: string;
  dryRun?: boolean;
  spreadsheetId?: string;
  salesOsSpreadsheetId?: string;
  asOfDay?: number;
}): Promise<PredictiveManagersSyncResult> {
  const dryRun = Boolean(input.dryRun);
  const spreadsheetId = input.spreadsheetId || getPredictiveSpreadsheetId();
  const salesOsId = input.salesOsSpreadsheetId || getSalesOsSpreadsheetId();
  const month = input.month;
  const warnings: string[] = [];
  const syncedAt = new Date().toISOString();
  const today = syncedAt.slice(0, 10);
  const asOfDay =
    input.asOfDay ??
    (today.startsWith(month)
      ? Number(today.slice(8, 10))
      : today < `${month}-01`
        ? 1
        : daysInCalendarMonth(month));

  const dailyValues = await readSheetValues({
    spreadsheetId: salesOsId,
    range: `${quoteTab(SALES_OS_SHEETS.dailyFact)}!A1:Z`
  });
  const dailyFact = parseDailyFact(dailyValues);
  const managerIds = activeManagerIds({ rows: dailyFact, month });
  const names = managerNameMap(dailyFact);
  const layout = layoutForMonth(month);
  const dateCols = new Map(buildMonthDayColumns(month).map((d) => [d.iso, d.col]));

  const tabs: string[] = [];
  let factCellsWritten = 0;
  const indexBody: string[][] = [];

  for (const managerId of managerIds) {
    const managerName = names.get(managerId) || `ID ${managerId}`;
    const tabTitle = managerPredictiveTabTitle({ managerId, managerName });
    tabs.push(tabTitle);
    const factsByDate = aggregateManagerDayFacts({
      dailyFact: dailyFact as Array<Record<string, string>>,
      managerId,
      month
    });
    const totals = monthTotalsFromDayFacts(factsByDate);
    indexBody.push([
      managerId,
      managerName,
      tabTitle,
      String(totals.leads),
      String(totals.deals),
      String(totals.invoices),
      String(totals.sale),
      String(totals.revenue),
      totals.aov != null ? String(totals.aov) : "",
      month,
      syncedAt
    ]);

    const grid = buildManagerPredictiveGrid({ month, managerId, managerName });
    grid[PREDICTIVE_ASOF_DAY_ROW - 1][0] = String(asOfDay);

    // Embed day facts into grid before write (one write per manager tab).
    let embeddedFacts = 0;
    for (const [date, facts] of factsByDate) {
      const col = dateCols.get(date);
      if (col == null) continue;
      for (const key of PREDICTIVE_AUTO_FACT_METRICS) {
        const value = facts[key];
        if (value == null || !Number.isFinite(value as number)) continue;
        const row0 = PREDICTIVE_METRICS[key].factRow - 1;
        while (grid[row0].length <= col) grid[row0].push("");
        grid[row0][col] = String(value);
        embeddedFacts += 1;
      }
    }

    if (!dryRun) {
      await withQuotaRetry(() => ensureSheetTab(spreadsheetId, tabTitle), `ensure ${tabTitle}`);
      await withQuotaRetry(
        () =>
          ensureSheetColumnCapacity({
            spreadsheetId,
            tabTitle,
            requiredColumns: layout.monthCol + 1
          }),
        `cols ${tabTitle}`
      );
      await withQuotaRetry(
        () =>
          ensureSheetRowCapacity({
            spreadsheetId,
            tabTitle,
            requiredRows: PREDICTIVE_ASOF_DAY_ROW + 5
          }),
        `rows ${tabTitle}`
      );
      await withQuotaRetry(
        () =>
          writeSheetValues({
            spreadsheetId,
            range: `${quoteTab(tabTitle)}!A1`,
            clearRange: `${quoteTab(tabTitle)}!A1:AZ55`,
            rows: grid,
            valueInputOption: "USER_ENTERED"
          }),
        `grid ${tabTitle}`
      );
      factCellsWritten += embeddedFacts;
      try {
        const sheetId = await withQuotaRetry(
          () => getSheetIdByTitle(spreadsheetId, tabTitle),
          `sheetId ${tabTitle}`
        );
        if (sheetId != null) {
          await withQuotaRetry(
            () => applyPredictiveTemplateDesign({ spreadsheetId, sheetId, month }),
            `design ${tabTitle}`
          );
        }
      } catch (error) {
        warnings.push(
          `design ${tabTitle}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      // Stay under Sheets write quota (~60/min).
      await sleep(3_000);
    }
  }

  if (!dryRun) {
    await ensureSheetTab(spreadsheetId, PREDICTIVE_MANAGERS_INDEX_TAB);
    await writeSheetValues({
      spreadsheetId,
      range: `${quoteTab(PREDICTIVE_MANAGERS_INDEX_TAB)}!A1`,
      clearRange: `${quoteTab(PREDICTIVE_MANAGERS_INDEX_TAB)}!A:Z`,
      rows: [Array.from(MANAGER_INDEX_COLUMNS), ...indexBody],
      valueInputOption: "RAW"
    });
  }

  if (!managerIds.length) {
    warnings.push("no active managers with facts in period");
  }

  return {
    spreadsheetId,
    month,
    managers: managerIds.length,
    tabs,
    indexRows: indexBody.length,
    factCellsWritten: dryRun ? 0 : factCellsWritten,
    dryRun,
    warnings
  };
}
