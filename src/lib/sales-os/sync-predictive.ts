import {
  batchUpdateSheetValues,
  ensureSheetColumnCapacity,
  readSheetValues,
  writeSheetValues
} from "@/lib/google/sheets-client";
import type { MariaDailyRow } from "@/lib/sales-os/maria-daily";
import { applyPredictiveTemplateDesign, getSheetIdByTitle } from "@/lib/sales-os/predictive-design";
import {
  PREDICTIVE_ALERT_TABS,
  PREDICTIVE_DATE_ROW,
  PREDICTIVE_HEADER_ROW,
  buildTemplatePredictiveGrid,
  buildDateRowUpdates,
  buildFactCellUpdates,
  buildMonthDayColumns,
  colLetter,
  collectFactsForMonth,
  countDataRows,
  formatDisplayDate,
  getPredictiveSpreadsheetId,
  getPredictiveTabTitle,
  isPredictiveLayoutCurrent,
  layoutForMonth,
  parsePredictiveDateColumns,
  quoteTab,
  type AlertSlaSnapshot
} from "@/lib/sales-os/predictive-model";

export type PredictiveSyncResult = {
  spreadsheetId: string;
  tabTitle: string;
  month: string;
  bootstrapped: boolean;
  datesEnsured: boolean;
  factCellsWritten: number;
  datesFilled: number;
  alertSla?: AlertSlaSnapshot;
  dryRun: boolean;
  skipped?: string;
};

async function pullAlertSlaSnapshot(input: {
  spreadsheetId: string;
  asOfDate: string;
}): Promise<AlertSlaSnapshot> {
  let noReply = 0;
  let unpaid = 0;
  try {
    const noReplyValues = await readSheetValues({
      spreadsheetId: input.spreadsheetId,
      range: `${quoteTab(PREDICTIVE_ALERT_TABS.noReply24h)}!A:A`
    });
    noReply = countDataRows(noReplyValues);
  } catch {
    noReply = 0;
  }
  try {
    const unpaidValues = await readSheetValues({
      spreadsheetId: input.spreadsheetId,
      range: `${quoteTab(PREDICTIVE_ALERT_TABS.unpaidInvoices)}!A:A`
    });
    unpaid = countDataRows(unpaidValues);
  } catch {
    unpaid = 0;
  }
  return {
    asOfDate: input.asOfDate,
    no_reply_24h: noReply,
    unpaid_invoices: unpaid
  };
}

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
    dates[block.totalCol] = `Даты недели ${w + 1}`;
    for (let d = 0; d < 7; d += 1) header[block.dayCols[d]] = weekdays[d];
  }
  header[monthCol] = "МЕС";
  for (const day of buildMonthDayColumns(input.month)) {
    dates[day.col] = formatDisplayDate(day.iso);
  }
  await writeSheetValues({
    spreadsheetId: input.spreadsheetId,
    range: `${quoteTab(input.tabTitle)}!A${PREDICTIVE_HEADER_ROW}:${colLetter(monthCol)}${PREDICTIVE_DATE_ROW}`,
    rows: [header, dates],
    valueInputOption: "RAW"
  });
}

/**
 * Upsert predictive front facts. Never overwrites plan rows after bootstrap.
 * Bootstraps a clean grid once if the tab is empty.
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
  const gridEnd = `${colLetter(layout.monthCol)}40`;

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
  const planRevenue = snap.plan_revenue ? Number(String(snap.plan_revenue).replace(",", ".")) : null;
  const planSales = snap.plan_sales ? Number(String(snap.plan_sales).replace(",", ".")) : null;

  let bootstrapped = false;
  if (input.forceBootstrap || !isPredictiveLayoutCurrent(values, month)) {
    bootstrapped = true;
    const grid = buildTemplatePredictiveGrid({
      month,
      planRevenue: Number.isFinite(planRevenue) ? planRevenue : null,
      planSales: Number.isFinite(planSales) ? planSales : null
    });
    if (!dryRun) {
      await writeSheetValues({
        spreadsheetId,
        range: `${quoteTab(tabTitle)}!A1`,
        clearRange: `${quoteTab(tabTitle)}!A1:AZ40`,
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

  const dateToCol = parsePredictiveDateColumns(values, month);
  if (!dateToCol.size) {
    return {
      spreadsheetId,
      tabTitle,
      month,
      bootstrapped,
      datesEnsured,
      factCellsWritten: 0,
      datesFilled: 0,
      dryRun,
      skipped: "no date columns parsed"
    };
  }

  const asOfDate = input.syncedAt.slice(0, 10);
  let alertSla: AlertSlaSnapshot | undefined;
  try {
    alertSla = await pullAlertSlaSnapshot({ spreadsheetId, asOfDate });
  } catch (error) {
    console.warn(`[predictive] alert SLA pull failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const factsByDate = collectFactsForMonth({
    month,
    mariaDaily: input.mariaDaily,
    mariaSnapshot: input.mariaSnapshot,
    dailyFact: input.dailyFact,
    alertSla
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

  return {
    spreadsheetId,
    tabTitle,
    month,
    bootstrapped,
    datesEnsured,
    factCellsWritten: updates.length,
    datesFilled: factsByDate.size,
    alertSla,
    dryRun
  };
}
