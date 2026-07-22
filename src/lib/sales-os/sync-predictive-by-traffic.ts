import {
  batchUpdateSheetValues,
  ensureSheetColumnCapacity,
  ensureSheetRowCapacity,
  ensureSheetTab,
  writeSheetValues
} from "@/lib/google/sheets-client";
import { applyPredictiveTemplateDesign, getSheetIdByTitle } from "@/lib/sales-os/predictive-design";
import {
  PREDICTIVE_ASOF_DAY_ROW,
  daysInCalendarMonth,
  deriveDealsPlanForInvoices,
  getPredictiveSpreadsheetId,
  layoutForMonth,
  quoteTab
} from "@/lib/sales-os/predictive-model";
import {
  TRAFFIC_CHANNELS,
  TRAFFIC_DIAGNOSIS_START_ROW,
  buildTrafficChannelGrid,
  buildTrafficDiagnosisRows,
  buildTrafficFactCellUpdates,
  parseTrafficDateColumns,
  trafficTabTitleForChannel
} from "@/lib/sales-os/predictive-by-traffic-model";
import {
  aggregateTrafficChannelDaily,
  buildTrafficDiagnosis,
  mergeSvodLeadsIntoTrafficFacts,
  sumTrafficChannel,
  type TrafficChannel,
  type TrafficDaySplit
} from "@/lib/sales-os/traffic-channel-facts";
import { pullSvodPaidOrganicPlans } from "@/lib/sales-os/svod-plans";

export type TrafficSyncResult = {
  spreadsheetId: string;
  tabs: string[];
  month: string;
  bootstrapped: boolean;
  factCellsWritten: number;
  datesFilled: number;
  diagnosisLines: number;
  dryRun: boolean;
  skipped?: string;
};

async function syncOneTrafficChannel(input: {
  spreadsheetId: string;
  month: string;
  channel: TrafficChannel;
  plans: Awaited<ReturnType<typeof pullSvodPaidOrganicPlans>>;
  factsByDate: Map<string, TrafficDaySplit>;
  paidMonth: ReturnType<typeof sumTrafficChannel>;
  organicMonth: ReturnType<typeof sumTrafficChannel>;
  asOfDay: number;
  dryRun: boolean;
}): Promise<{ tabTitle: string; factCellsWritten: number; diagnosisLines: number; skipped?: string }> {
  const tabTitle = trafficTabTitleForChannel(input.channel);
  const layout = layoutForMonth(input.month);
  const channelPlans = input.channel === "paid" ? input.plans?.paid : input.plans?.organic;
  const channelMonth = input.channel === "paid" ? input.paidMonth : input.organicMonth;
  const planDeals = deriveDealsPlanForInvoices({
    planInvoices: channelPlans?.invoices,
    dealsFact: channelMonth.deals,
    invoicesFact: channelMonth.invoices
  });

  if (!input.dryRun) {
    await ensureSheetTab(input.spreadsheetId, tabTitle);
    await ensureSheetColumnCapacity({
      spreadsheetId: input.spreadsheetId,
      tabTitle,
      requiredColumns: layout.monthCol + 1
    });
    await ensureSheetRowCapacity({
      spreadsheetId: input.spreadsheetId,
      tabTitle,
      requiredRows: TRAFFIC_DIAGNOSIS_START_ROW + 20
    });
  }

  const grid = buildTrafficChannelGrid({
    month: input.month,
    channel: input.channel,
    plans: channelPlans,
    planDeals
  });

  if (!input.dryRun) {
    await writeSheetValues({
      spreadsheetId: input.spreadsheetId,
      range: `${quoteTab(tabTitle)}!A1`,
      clearRange: `${quoteTab(tabTitle)}!A1:AZ80`,
      rows: grid,
      valueInputOption: "USER_ENTERED"
    });
  }

  const dateToCol = parseTrafficDateColumns(grid, input.month);
  if (!dateToCol.size) {
    return { tabTitle, factCellsWritten: 0, diagnosisLines: 0, skipped: "no date columns parsed" };
  }

  const updates = buildTrafficFactCellUpdates({
    tabTitle,
    month: input.month,
    channel: input.channel,
    dateToCol,
    factsByDate: input.factsByDate
  });

  if (!input.dryRun && updates.length) {
    await batchUpdateSheetValues({
      spreadsheetId: input.spreadsheetId,
      data: updates,
      valueInputOption: "USER_ENTERED"
    });
  }

  const diagnosis = buildTrafficDiagnosis({
    paid: input.paidMonth,
    organic: input.organicMonth,
    paidPlanLeads: input.plans?.paid.leads,
    organicPlanLeads: input.plans?.organic.leads
  }).filter((line) => line.channel === input.channel || line.channel === "both");

  const diagHeader =
    input.channel === "paid"
      ? [
          ["Где мы теряем деньги", ""],
          ["(автодиагностика платного потока — без CPL/ROAS)", ""]
        ]
      : [
          ["Где мы теряем деньги", ""],
          ["(автодиагностика органики — без CPL/ROAS)", ""]
        ];
  const diagRows = [...diagHeader, ...buildTrafficDiagnosisRows(diagnosis.map((d) => ({ title: d.title, body: d.body })))];

  if (!input.dryRun) {
    await writeSheetValues({
      spreadsheetId: input.spreadsheetId,
      range: `${quoteTab(tabTitle)}!A${PREDICTIVE_ASOF_DAY_ROW}`,
      rows: [[input.asOfDay, "as_of_day"]],
      valueInputOption: "USER_ENTERED"
    });
    await writeSheetValues({
      spreadsheetId: input.spreadsheetId,
      range: `${quoteTab(tabTitle)}!A${TRAFFIC_DIAGNOSIS_START_ROW}`,
      rows: diagRows,
      valueInputOption: "RAW"
    });

    try {
      const sheetId = await getSheetIdByTitle(input.spreadsheetId, tabTitle);
      if (sheetId != null) {
        await applyPredictiveTemplateDesign({
          spreadsheetId: input.spreadsheetId,
          sheetId,
          month: input.month
        });
      }
    } catch (error) {
      console.warn(
        `[traffic] design failed (${tabTitle}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    tabTitle,
    factCellsWritten: updates.length,
    diagnosisLines: diagnosis.length
  };
}

/**
 * Two sheets: Paid and Organic — same design as main predictive front.
 * Plans from СВОД; leads from day+Органика; money from Bitrix SOURCE_ID.
 */
export async function syncPredictiveByTraffic(input: {
  month: string;
  leads: Array<{
    created_at?: string;
    source_id?: string;
    status_id?: string;
    lead_id?: string;
    utm_source?: string;
    utm_medium?: string;
  }>;
  deals: Array<Record<string, string>>;
  invoiceEvents?: Array<Record<string, string>>;
  paymentEvents?: Array<Record<string, string>>;
  syncedAt: string;
  dryRun?: boolean;
  spreadsheetId?: string;
  forceBootstrap?: boolean;
}): Promise<TrafficSyncResult> {
  const spreadsheetId = input.spreadsheetId || getPredictiveSpreadsheetId();
  const dryRun = Boolean(input.dryRun);
  const month = input.month;

  let plans = null as Awaited<ReturnType<typeof pullSvodPaidOrganicPlans>>;
  try {
    plans = await pullSvodPaidOrganicPlans({ month });
  } catch (error) {
    console.warn(
      `[traffic] svod plans failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Leads/deals/invoices/sales from one Bitrix/vault funnel (same channel rules).
  // Do NOT overlay СВОД leads here — mixing SVOD leads with Bitrix deals breaks CR (e.g. 9→58 = 644%).
  const factsByDate = aggregateTrafficChannelDaily({
    month,
    leads: input.leads,
    deals: input.deals,
    invoiceEvents: input.invoiceEvents,
    paymentEvents: input.paymentEvents
  });
  const paidMonth = sumTrafficChannel(factsByDate, "paid", month);
  const organicMonth = sumTrafficChannel(factsByDate, "organic", month);

  const asOfDate = input.syncedAt.slice(0, 10);
  const asOfDayRaw = Number(asOfDate.slice(8, 10));
  const dim = daysInCalendarMonth(month);
  const asOfDay =
    asOfDate.startsWith(month) && Number.isFinite(asOfDayRaw)
      ? Math.min(Math.max(asOfDayRaw, 1), dim)
      : dim;

  let factCellsWritten = 0;
  let diagnosisLines = 0;
  const tabs: string[] = [];
  const skips: string[] = [];

  for (const channel of TRAFFIC_CHANNELS) {
    const result = await syncOneTrafficChannel({
      spreadsheetId,
      month,
      channel,
      plans,
      factsByDate,
      paidMonth,
      organicMonth,
      asOfDay,
      dryRun
    });
    tabs.push(result.tabTitle);
    factCellsWritten += result.factCellsWritten;
    diagnosisLines += result.diagnosisLines;
    if (result.skipped) skips.push(`${result.tabTitle}: ${result.skipped}`);
  }

  return {
    spreadsheetId,
    tabs,
    month,
    bootstrapped: true,
    factCellsWritten,
    datesFilled: factsByDate.size,
    diagnosisLines,
    dryRun,
    skipped: skips.length ? skips.join("; ") : undefined
  };
}
