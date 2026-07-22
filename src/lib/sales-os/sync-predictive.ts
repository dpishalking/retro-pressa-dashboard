import {
  batchUpdateSheetValues,
  ensureSheetColumnCapacity,
  readSheetValues,
  writeSheetValues
} from "@/lib/google/sheets-client";
import type { MariaDailyRow } from "@/lib/sales-os/maria-daily";
import { applyPredictiveTemplateDesign, applyPredictiveTrafficLights, getSheetIdByTitle } from "@/lib/sales-os/predictive-design";
import {
  PREDICTIVE_ASOF_DAY_ROW,
  PREDICTIVE_DATE_ROW,
  PREDICTIVE_HEADER_ROW,
  buildTemplatePredictiveGrid,
  buildDateRowUpdates,
  buildFactCellUpdates,
  buildMonthDayColumns,
  buildPlanMonthUpdates,
  buildPtfCellUpdates,
  colLetter,
  collectFactsForMonth,
  daysInCalendarMonth,
  deriveDealsPlanForInvoices,
  formatDisplayDate,
  formatWeekDateRangeLabel,
  getPredictiveSpreadsheetId,
  getPredictiveTabTitle,
  isPredictiveLayoutCurrent,
  layoutForMonth,
  parsePredictiveDateColumns,
  quoteTab
} from "@/lib/sales-os/predictive-model";
import { parseSheetNumber } from "@/lib/os-sheets/sales-metric-defs";
import { pullSvodDailyLeads, pullSvodMonthPlans, type SvodMonthPlans } from "@/lib/sales-os/svod-plans";

export type PredictiveSyncResult = {
  spreadsheetId: string;
  tabTitle: string;
  month: string;
  bootstrapped: boolean;
  datesEnsured: boolean;
  factCellsWritten: number;
  planCellsWritten: number;
  datesFilled: number;
  svodPlans?: Pick<SvodMonthPlans, "revenue" | "sale" | "leads" | "invoices"> & { deals?: number | null };
  dryRun: boolean;
  skipped?: string;
};

async function writeHeaderAndDates(input: {
  spreadsheetId: string;
  tabTitle: string;
  month: string;
}): Promise<void> {
  const { weekBlocks, monthCol } = layoutForMonth(input.month);
  const weekdays = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
  const header = Array.from({ length: monthCol + 1 }, () => "");
  const dates = Array.from({ length: monthCol + 1 }, () => "");
  for (let w = 0; w < weekBlocks.length; w += 1) {
    const block = weekBlocks[w];
    header[block.totalCol] = `Неделя ${w + 1}`;
    for (let d = 0; d < 7; d += 1) header[block.dayCols[d]] = weekdays[d];
  }
  header[monthCol] = "МЕС";
  const monthDays = buildMonthDayColumns(input.month);
  for (const day of monthDays) {
    dates[day.col] = formatDisplayDate(day.iso);
  }
  for (let w = 0; w < weekBlocks.length; w += 1) {
    const weekIsos = monthDays.slice(w * 7, w * 7 + 7).map((d) => d.iso);
    dates[weekBlocks[w].totalCol] = formatWeekDateRangeLabel(weekIsos);
  }
  await writeSheetValues({
    spreadsheetId: input.spreadsheetId,
    range: `${quoteTab(input.tabTitle)}!A${PREDICTIVE_HEADER_ROW}:${colLetter(monthCol)}${PREDICTIVE_DATE_ROW}`,
    rows: [header, dates],
    valueInputOption: "RAW"
  });
}

/**
 * Upsert predictive front: facts + monthly plans from СВОД «План/факт».
 * Fact rows never overwrite plan formulas for CR/AOV.
 */
export async function syncPredictiveSalesFront(input: {
  month: string;
  mariaDaily: MariaDailyRow[];
  mariaSnapshot?: Array<{ key?: string; value?: string }>;
  dailyFact: Array<Record<string, string>>;
  syncedAt: string;
  dryRun?: boolean;
  spreadsheetId?: string;
  tabTitle?: string;
  forceBootstrap?: boolean;
}): Promise<PredictiveSyncResult> {
  const spreadsheetId = input.spreadsheetId || getPredictiveSpreadsheetId();
  const tabTitle = input.tabTitle || getPredictiveTabTitle();
  const dryRun = Boolean(input.dryRun);
  const month = input.month;
  const layout = layoutForMonth(month);
  const gridEnd = `${colLetter(layout.monthCol)}${PREDICTIVE_ASOF_DAY_ROW}`;

  if (!dryRun) {
    await ensureSheetColumnCapacity({
      spreadsheetId,
      tabTitle,
      requiredColumns: layout.monthCol + 1
    });
  }

  let values: string[][] = [];
  try {
    values = await readSheetValues({
      spreadsheetId,
      range: `${quoteTab(tabTitle)}!A1:${gridEnd}`
    });
  } catch {
    values = [];
  }

  const snap = Object.fromEntries(
    (input.mariaSnapshot || []).map((row) => [String(row.key || "").trim(), String(row.value || "").trim()])
  );

  let svod: SvodMonthPlans | null = null;
  try {
    svod = await pullSvodMonthPlans({ month });
  } catch (error) {
    console.warn(`[predictive] svod plans pull failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const planRevenue =
    svod?.revenue ??
    (snap.plan_revenue ? Number(String(snap.plan_revenue).replace(",", ".")) : null);
  const planSales =
    svod?.sale ?? (snap.plan_sales ? Number(String(snap.plan_sales).replace(",", ".")) : null);
  const planLeads = svod?.leads ?? null;
  const planInvoices = svod?.invoices ?? null;

  let dealsFactMonth = 0;
  let invoicesFactMonth = 0;
  for (const row of input.dailyFact) {
    const d = String(row.date || "").slice(0, 10);
    if (!d.startsWith(month)) continue;
    dealsFactMonth += parseSheetNumber(row.deals_created);
    invoicesFactMonth += parseSheetNumber(row.invoices);
  }
  const planDeals = deriveDealsPlanForInvoices({
    planInvoices,
    dealsFact: dealsFactMonth,
    invoicesFact: invoicesFactMonth
  });

  let bootstrapped = false;
  if (input.forceBootstrap || !isPredictiveLayoutCurrent(values, month)) {
    bootstrapped = true;
    const grid = buildTemplatePredictiveGrid({
      month,
      planRevenue: planRevenue != null && Number.isFinite(planRevenue) ? planRevenue : null,
      planSales: planSales != null && Number.isFinite(planSales) ? planSales : null,
      planLeads: planLeads != null && Number.isFinite(planLeads) ? planLeads : null,
      planDeals: planDeals != null && Number.isFinite(planDeals) ? planDeals : null,
      planInvoices: planInvoices != null && Number.isFinite(planInvoices) ? planInvoices : null
    });
    if (!dryRun) {
      await writeSheetValues({
        spreadsheetId,
        range: `${quoteTab(tabTitle)}!A1`,
        clearRange: `${quoteTab(tabTitle)}!A1:AZ55`,
        rows: grid,
        valueInputOption: "USER_ENTERED"
      });
      try {
        const sheetId = await getSheetIdByTitle(spreadsheetId, tabTitle);
        if (sheetId != null) await applyPredictiveTemplateDesign({ spreadsheetId, sheetId, month });
      } catch (error) {
        console.warn(
          `[predictive] design apply failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    values = grid;
  } else if (!dryRun) {
    // Drop leftover SLA / quality rows below the funnel grid.
    await writeSheetValues({
      spreadsheetId,
      range: `${quoteTab(tabTitle)}!A${PREDICTIVE_ASOF_DAY_ROW + 1}`,
      clearRange: `${quoteTab(tabTitle)}!A${PREDICTIVE_ASOF_DAY_ROW + 1}:AZ80`,
      rows: [[""]],
      valueInputOption: "RAW"
    });
  }

  let datesEnsured = false;
  const parsedBefore = parsePredictiveDateColumns(values, month);
  if (!bootstrapped && parsedBefore.size < 7) {
    datesEnsured = true;
    if (!dryRun) {
      await writeHeaderAndDates({ spreadsheetId, tabTitle, month });
      values = await readSheetValues({
        spreadsheetId,
        range: `${quoteTab(tabTitle)}!A1:${gridEnd}`
      });
    }
  } else if (!bootstrapped) {
    const dateUpdate = buildDateRowUpdates({ tabTitle, month, existingValues: values });
    if (dateUpdate) {
      datesEnsured = true;
      if (!dryRun) {
        await writeSheetValues({
          spreadsheetId,
          range: dateUpdate.range,
          rows: dateUpdate.values,
          valueInputOption: "RAW"
        });
        values[PREDICTIVE_DATE_ROW - 1] = dateUpdate.values[0];
      }
    }
  }

  let planCellsWritten = 0;
  const planPayload = {
    revenue: svod?.revenue ?? null,
    sale: svod?.sale ?? null,
    leads: svod?.leads ?? null,
    deals: planDeals,
    invoices: svod?.invoices ?? null
  };
  const svodPlansOut = {
    revenue: planPayload.revenue,
    sale: planPayload.sale,
    leads: planPayload.leads,
    deals: planPayload.deals,
    invoices: planPayload.invoices
  };

  if (!bootstrapped && (svod || planDeals != null)) {
    const planUpdates = buildPlanMonthUpdates({
      tabTitle,
      month,
      plans: planPayload
    });
    planCellsWritten = planUpdates.length;
    if (!dryRun && planUpdates.length) {
      await batchUpdateSheetValues({
        spreadsheetId,
        data: planUpdates,
        valueInputOption: "USER_ENTERED"
      });
    }
  } else if (bootstrapped) {
    planCellsWritten = Object.values(planPayload).filter((v) => v != null && Number.isFinite(v)).length;
  }

  const dateToCol = parsePredictiveDateColumns(values, month);
  if (!dateToCol.size) {
    return {
      spreadsheetId,
      tabTitle,
      month,
      bootstrapped,
      datesEnsured,
      factCellsWritten: 0,
      planCellsWritten,
      datesFilled: 0,
      svodPlans: svodPlansOut,
      dryRun,
      skipped: "no date columns parsed"
    };
  }

  const asOfDate = input.syncedAt.slice(0, 10);

  let svodLeadsByDate: Map<string, { paid: number; organic: number; total: number }> | undefined;
  try {
    svodLeadsByDate = await pullSvodDailyLeads({ month });
  } catch (error) {
    console.warn(`[predictive] svod leads pull failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const factsByDate = collectFactsForMonth({
    month,
    mariaDaily: input.mariaDaily,
    mariaSnapshot: input.mariaSnapshot,
    dailyFact: input.dailyFact,
    svodLeadsByDate
  });

  const updates = buildFactCellUpdates({
    tabTitle,
    dateToCol,
    factsByDate
  });

  if (!dryRun && updates.length) {
    await batchUpdateSheetValues({
      spreadsheetId,
      data: updates,
      valueInputOption: "USER_ENTERED"
    });
  }

  const ptfUpdates = buildPtfCellUpdates({ tabTitle, month });
  if (!dryRun && ptfUpdates.length) {
    await batchUpdateSheetValues({
      spreadsheetId,
      data: ptfUpdates,
      valueInputOption: "USER_ENTERED"
    });
  }

  const asOfDayRaw = Number(asOfDate.slice(8, 10));
  const dim = daysInCalendarMonth(month);
  const asOfDay =
    asOfDate.startsWith(month) && Number.isFinite(asOfDayRaw)
      ? Math.min(Math.max(asOfDayRaw, 1), dim)
      : dim;
  if (!dryRun) {
    await writeSheetValues({
      spreadsheetId,
      range: `${quoteTab(tabTitle)}!A${PREDICTIVE_ASOF_DAY_ROW}`,
      rows: [[asOfDay, "as_of_day"]],
      valueInputOption: "USER_ENTERED"
    });
  }

  if (!dryRun) {
    try {
      const sheetId = await getSheetIdByTitle(spreadsheetId, tabTitle);
      if (sheetId != null) {
        await applyPredictiveTrafficLights({ spreadsheetId, sheetId, month });
      }
    } catch (error) {
      console.warn(
        `[predictive] traffic lights failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    spreadsheetId,
    tabTitle,
    month,
    bootstrapped,
    datesEnsured,
    factCellsWritten: updates.length,
    planCellsWritten,
    datesFilled: factsByDate.size,
    svodPlans: svodPlansOut,
    dryRun
  };
}
