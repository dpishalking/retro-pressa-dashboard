import {
  COMPANY_MONTHLY_COLUMNS,
  COMPANY_MONTHLY_MANUAL_COLUMNS,
  COMPANY_MONTHLY_NUMERIC_COLUMNS,
  OS_SPREADSHEET_ID,
  OS_SVOD_SPREADSHEET_ID,
  OS_SVOD_TAB,
  OS_TABS,
  RECONCILIATION_COLUMNS,
  type CompanyMonthlyColumn
} from "@/config/os-sheets";
import { emptyCompanyDailyRow, type CompanyDailyRow } from "@/lib/os-sheets/company-daily-mapper";
import { COMPANY_DAILY_COLUMNS } from "@/config/os-sheets";
import { financeRowFromSheetLine, type FinanceRow } from "@/lib/os-sheets/finance-mapper";
import { preserveManualColumns, safeReplaceSheet } from "@/lib/os-sheets/safe-write";
import { withSyncRun } from "@/lib/os-sheets/sync-runs";
import {
  formatSheetNumberColumns,
  getSheetIdByTitle,
  readGoogleServiceAccount,
  readSheetValues
} from "@/lib/google/sheets-client";
import { currentPeriodKey } from "@/lib/conversation-periods";
import type { PeriodKey } from "@/types/metrics";

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function num(value: string) {
  const parsed = Number(
    String(value ?? "")
      .replace(/[€\u00a0\s]/g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function periodToMonth(period: PeriodKey) {
  if (period === "may-2026") return "2026-05";
  if (period === "june-2026") return "2026-06";
  return "2026-07";
}

function parseSvodMonthLabel(label: string): string | null {
  const raw = label.toLowerCase().replace(/\s/g, "");
  if (raw.includes("мая") || raw.includes("май")) return "2026-05";
  if (raw.includes("июн")) return "2026-06";
  if (raw.includes("июл")) return "2026-07";
  return null;
}

async function readCompanyDaily(spreadsheetId: string): Promise<CompanyDailyRow[]> {
  try {
    const values = await readSheetValues({ spreadsheetId, range: `${quoteTab(OS_TABS.companyDaily)}!A1:M` });
    if (!values.length) return [];
    const [header, ...lines] = values;
    return lines.map((line) => {
      const row = emptyCompanyDailyRow();
      header.forEach((rawKey, index) => {
        const key = rawKey.trim() as keyof CompanyDailyRow;
        if (!COMPANY_DAILY_COLUMNS.includes(key as typeof COMPANY_DAILY_COLUMNS[number])) return;
        row[key] = String(line[index] ?? "").trim();
      });
      return row;
    }).filter((row) => Boolean(row.date));
  } catch {
    return [];
  }
}

async function readFinance(spreadsheetId: string): Promise<FinanceRow[]> {
  try {
    const values = await readSheetValues({ spreadsheetId, range: `${quoteTab(OS_TABS.financeDaily)}!A1:V` });
    if (!values.length) return [];
    const [header, ...lines] = values;
    return lines.map((line) => financeRowFromSheetLine(header, line)).filter((row): row is FinanceRow => Boolean(row));
  } catch {
    return [];
  }
}

async function readExistingMonthly(spreadsheetId: string): Promise<Array<Record<CompanyMonthlyColumn, string>>> {
  try {
    const values = await readSheetValues({ spreadsheetId, range: `${quoteTab(OS_TABS.companyMonthly)}!A1:U` });
    if (!values.length) return [];
    const [header, ...lines] = values;
    return lines.map((line) => {
      const row = Object.fromEntries(COMPANY_MONTHLY_COLUMNS.map((column) => [column, ""])) as Record<CompanyMonthlyColumn, string>;
      header.forEach((rawKey, index) => {
        const key = rawKey.trim() as CompanyMonthlyColumn;
        if (!COMPANY_MONTHLY_COLUMNS.includes(key)) return;
        row[key] = String(line[index] ?? "").trim();
      });
      return row;
    }).filter((row) => Boolean(row.month));
  } catch {
    return [];
  }
}

async function readSvodMonthly(): Promise<Map<string, { revenue: number; leads: number; spend: number; sales: number }>> {
  try {
    const values = await readSheetValues({
      spreadsheetId: OS_SVOD_SPREADSHEET_ID,
      range: `'${OS_SVOD_TAB}'!A1:I20`
    });
    const map = new Map<string, { revenue: number; leads: number; spend: number; sales: number }>();
    for (const line of values.slice(1)) {
      const month = parseSvodMonthLabel(String(line[0] || ""));
      if (!month) continue;
      map.set(month, {
        spend: num(String(line[1] || "")),
        revenue: num(String(line[2] || "")),
        leads: num(String(line[4] || "")),
        sales: num(String(line[6] || ""))
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function syncOsCompanyMonthlyToSheet(options: {
  period?: PeriodKey;
  spreadsheetId?: string;
  dryRun?: boolean;
} = {}) {
  if (!readGoogleServiceAccount()) throw new Error("Google service account is not configured");
  const period = options.period ?? currentPeriodKey();
  const spreadsheetId = options.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  const syncedAt = new Date().toISOString();
  const month = periodToMonth(period);

  const [daily, finance, existing, svod] = await Promise.all([
    readCompanyDaily(spreadsheetId),
    readFinance(spreadsheetId),
    readExistingMonthly(spreadsheetId),
    readSvodMonthly()
  ]);

  const monthDaily = daily.filter((row) => row.date.startsWith(month));
  const monthFinance = finance.filter((row) => row.date.startsWith(month));
  const svodRow = svod.get(month);

  let trafficLeads = 0;
  let organicLeads = 0;
  let crmDeals = 0;
  let invoices = 0;
  let payments = 0;
  let osRevenue = 0;
  let adSpend = 0;
  let dataAsOf = "";
  for (const row of monthDaily) {
    trafficLeads += num(row.paid_leads);
    organicLeads += num(row.organic_leads);
    crmDeals += num(row.deals_created);
    invoices += num(row.invoices);
    payments += num(row.payments);
    osRevenue += num(row.revenue);
    adSpend += num(row.ad_spend);
    if (row.date > dataAsOf) dataAsOf = row.date;
  }

  let payroll = 0;
  let opex = 0;
  for (const row of monthFinance) {
    payroll += num(row.payroll);
    opex += num(row.opex);
  }

  const svodRevenue = svodRow?.revenue ?? 0;
  const delta = osRevenue - svodRevenue;
  const deltaPct = svodRevenue > 0 ? (delta / svodRevenue) * 100 : 0;
  const avgCheck = payments > 0 ? osRevenue / payments : 0;
  const cpl = trafficLeads > 0 ? adSpend / trafficLeads : 0;
  const cac = payments > 0 ? adSpend / payments : 0;
  const roas = adSpend > 0 ? (svodRevenue || osRevenue) / adSpend : 0;
  const grossProfit = "";
  const operatingProfit = osRevenue - adSpend - payroll - opex;

  const incoming: Record<CompanyMonthlyColumn, string> = {
    month,
    traffic_leads: trafficLeads ? String(trafficLeads) : "",
    organic_leads: organicLeads ? String(organicLeads) : "",
    crm_deals: crmDeals ? String(crmDeals) : "",
    invoices: invoices ? String(invoices) : "",
    payments: payments ? String(payments) : "",
    os_paid_revenue: osRevenue ? String(Number(osRevenue.toFixed(2))) : "",
    svod_attributed_revenue: svodRevenue ? String(Number(svodRevenue.toFixed(2))) : "",
    revenue_reconciliation_delta: String(Number(delta.toFixed(2))),
    revenue_reconciliation_delta_pct: String(Number(deltaPct.toFixed(2))),
    ad_spend: adSpend ? String(Number(adSpend.toFixed(2))) : "",
    cpl: cpl ? String(Number(cpl.toFixed(2))) : "",
    cac: cac ? String(Number(cac.toFixed(2))) : "",
    roas: roas ? String(Number((roas * 100).toFixed(2))) : "",
    average_check: avgCheck ? String(Number(avgCheck.toFixed(2))) : "",
    payroll: payroll ? String(Number(payroll.toFixed(2))) : "",
    opex: opex ? String(Number(opex.toFixed(2))) : "",
    gross_profit: grossProfit,
    operating_profit: String(Number(operatingProfit.toFixed(2))),
    data_as_of: dataAsOf,
    sync_updated_at: syncedAt
  };

  const mergedMap = new Map(existing.map((row) => [row.month, row]));
  mergedMap.set(month, incoming);
  const preserved = preserveManualColumns({
    existingRows: existing,
    incomingRows: [...mergedMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
    key: "month",
    manualColumns: COMPANY_MONTHLY_MANUAL_COLUMNS
  });

  const sheetRows = preserved.map((row) => COMPANY_MONTHLY_COLUMNS.map((column) => {
    const raw = row[column] ?? "";
    if (!(COMPANY_MONTHLY_NUMERIC_COLUMNS as readonly string[]).includes(column)) return raw;
    if (!raw.trim()) return "";
    const value = Number(raw.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(value) ? value : raw;
  }));

  if (options.dryRun) {
    return { ok: true as const, period, month, rowsWritten: sheetRows.length, dryRun: true, syncedAt, osRevenue, svodRevenue };
  }

  return withSyncRun({
    syncName: "os-company-monthly",
    source: "company_daily+svod+finance",
    target: OS_TABS.companyMonthly,
    spreadsheetId,
    startedAt: syncedAt,
    schemaVersion: "1",
    triggerType: "script"
  }, async () => {
    await safeReplaceSheet({
      spreadsheetId,
      tabTitle: OS_TABS.companyMonthly,
      expectedColumns: COMPANY_MONTHLY_COLUMNS,
      rows: sheetRows,
      clearRange: `${quoteTab(OS_TABS.companyMonthly)}!A:U`
    });
    const sheetId = await getSheetIdByTitle(spreadsheetId, OS_TABS.companyMonthly);
    if (sheetId !== null) {
      const columnIndexes = COMPANY_MONTHLY_NUMERIC_COLUMNS
        .map((column) => COMPANY_MONTHLY_COLUMNS.indexOf(column))
        .filter((index) => index >= 0);
      await formatSheetNumberColumns({ spreadsheetId, sheetId, columnIndexes });
    }
    return {
      ok: true as const,
      period,
      month,
      rowsWritten: sheetRows.length,
      rowsRead: monthDaily.length,
      dryRun: false,
      syncedAt,
      osRevenue,
      svodRevenue
    };
  });
}

export async function syncOsReconciliationToSheet(options: {
  period?: PeriodKey;
  spreadsheetId?: string;
  dryRun?: boolean;
} = {}) {
  if (!readGoogleServiceAccount()) throw new Error("Google service account is not configured");
  const period = options.period ?? currentPeriodKey();
  const spreadsheetId = options.spreadsheetId?.trim() || OS_SPREADSHEET_ID;
  const syncedAt = new Date().toISOString();
  const month = periodToMonth(period);

  const monthlyValues = await readSheetValues({ spreadsheetId, range: `${quoteTab(OS_TABS.companyMonthly)}!A1:U` }).catch(() => [] as string[][]);
  const header = monthlyValues[0] || [];
  const monthIdx = header.indexOf("month");
  const osIdx = header.indexOf("os_paid_revenue");
  const svodIdx = header.indexOf("svod_attributed_revenue");
  const trafficIdx = header.indexOf("traffic_leads");
  const paymentsIdx = header.indexOf("payments");
  const row = monthlyValues.slice(1).find((line) => String(line[monthIdx] || "") === month);
  const osRevenue = row ? num(String(row[osIdx] || "")) : 0;
  const svodRevenue = row ? num(String(row[svodIdx] || "")) : 0;
  const trafficLeads = row ? num(String(row[trafficIdx] || "")) : 0;
  const payments = row ? num(String(row[paymentsIdx] || "")) : 0;

  const finance = await readFinance(spreadsheetId);
  const financePaid = finance.filter((item) => item.date.startsWith(month)).reduce((sum, item) => sum + num(item.paid_orders), 0);
  const financeRevenue = finance.filter((item) => item.date.startsWith(month)).reduce((sum, item) => sum + num(item.fact_revenue), 0);

  const mk = (
    metricId: string,
    sourceA: string,
    valueA: number,
    sourceB: string,
    valueB: number,
    status: string,
    comment: string,
    owner: string
  ) => {
    const delta = valueA - valueB;
    const deltaPct = valueB !== 0 ? (delta / valueB) * 100 : 0;
    return [
      month,
      metricId,
      sourceA,
      valueA,
      sourceB,
      valueB,
      Number(delta.toFixed(2)),
      Number(deltaPct.toFixed(2)),
      status,
      comment,
      owner,
      syncedAt
    ];
  };

  const rows = [
    mk(
      "os_paid_revenue_vs_svod",
      "Payments/Company_Daily",
      osRevenue,
      "СВОД График",
      svodRevenue,
      "not_comparable",
      "Different definitions: OS Bitrix WON vs marketing attributed revenue",
      "finance"
    ),
    mk(
      "traffic_leads_vs_manual_1406",
      "Traffic_Daily/СВОД day",
      trafficLeads,
      "manual_report",
      1406,
      "pending_definition",
      "Manual card 1406 vs СВОД/Traffic raw (~1802). Do not auto-force equality.",
      "marketing"
    ),
    mk(
      "payments_vs_finance_paid_orders",
      "Company_Daily.payments",
      payments,
      "Finance_Daily.paid_orders",
      financePaid,
      Math.abs(payments - financePaid) <= 1 ? "matched" : "warning",
      "Should align; investigate if warning",
      "finance"
    ),
    mk(
      "os_revenue_vs_finance_fact",
      "Company_Daily.revenue",
      osRevenue,
      "Finance_Daily.fact_revenue",
      financeRevenue,
      Math.abs(osRevenue - financeRevenue) < 1 ? "matched" : "warning",
      "Both from paid Orders; small float diffs ok",
      "finance"
    )
  ];

  if (options.dryRun) {
    return { ok: true as const, rowsWritten: rows.length, dryRun: true, syncedAt };
  }

  return withSyncRun({
    syncName: "os-reconciliation",
    source: "company_monthly+finance",
    target: OS_TABS.reconciliation,
    spreadsheetId,
    startedAt: syncedAt,
    schemaVersion: "1",
    triggerType: "script"
  }, async () => {
    await safeReplaceSheet({
      spreadsheetId,
      tabTitle: OS_TABS.reconciliation,
      expectedColumns: RECONCILIATION_COLUMNS,
      rows,
      clearRange: `${quoteTab(OS_TABS.reconciliation)}!A:L`
    });
    return { ok: true as const, rowsWritten: rows.length, rowsRead: rows.length, dryRun: false, syncedAt };
  });
}
