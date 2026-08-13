import { analyticsPeriodToLegacy } from "@/lib/analytics-os/period";
import { readBitrixSnapshot, type BitrixSnapshotDeal } from "@/lib/bitrix/snapshot-store";
import { batchUpdateSheetValues, readSheetValues } from "@/lib/google/sheets-client";
import { moscowIsoMonth, moscowYesterdayIso } from "@/lib/moscow-time";
import { pullMariaTruthSnapshot } from "@/lib/sales-os/maria-truth";
import {
  findSvodFactColumn,
  getMonthlyPlanSpreadsheetId,
  getMonthlyPlanTabTitle,
  getSvodOrganicLeadsTab,
  getSvodPaidLeadsTab,
  getSvodPlanSpreadsheetId,
  parseSvodDailyLeads,
  sumSvodVerifiedLeads
} from "@/lib/sales-os/svod-plans";
import { isPaidLeadSourceId } from "@/lib/sales-os/traffic-channel-facts";
import { parseSvodDayTrafficRaw, parseSvodOrganicRaw } from "@/lib/traffic-os/parse-svod-raw";
import type { AnalyticsPeriod } from "@/types/analytics-os";

export type MonthlyPlanFactSlice = {
  revenue: number | null;
  spend: number | null;
  leads: number | null;
  qualifiedLeads: number | null;
  invoices: number | null;
  sales: number | null;
};

export type MonthlyPlanFactSources = {
  obshie: MonthlyPlanFactSlice;
  facebook: MonthlyPlanFactSlice;
  yandex: MonthlyPlanFactSlice;
  organic: MonthlyPlanFactSlice;
};

export type MonthlyPlanFactCell = {
  row: number;
  section: string;
  label: string;
  value: number;
};

const EMPTY_SLICE = (): MonthlyPlanFactSlice => ({
  revenue: null,
  spend: null,
  leads: null,
  qualifiedLeads: null,
  invoices: null,
  sales: null
});

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function a1Col(index0: number): string {
  let n = index0 + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function roundCount(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function roundMoney(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function pct(num: number | null, den: number | null): number | null {
  if (num == null || den == null || den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

function roasPct(revenue: number | null, spend: number | null): number | null {
  if (revenue == null || spend == null || spend <= 0) return null;
  return Math.round((revenue / spend) * 1000) / 10;
}

function normalizeLabel(raw: string): string {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function rowLabel(row: string[] | undefined): string {
  const a = String(row?.[0] || "").replace(/\s+/g, " ").trim();
  if (a) return a;
  return String(row?.[1] || "").replace(/\s+/g, " ").trim();
}

function throughIso(value: string | null | undefined, throughDate: string | null | undefined): boolean {
  if (!throughDate || !value) return true;
  return value.slice(0, 10) <= throughDate;
}

function dealRevenue(deal: BitrixSnapshotDeal): number {
  return Number(deal.invoiceAmount) || Number(deal.opportunity) || 0;
}

function bitrixChannelSlice(
  snapshot: Awaited<ReturnType<typeof readBitrixSnapshot>>,
  throughDate: string | null | undefined,
  paid: boolean
): Pick<MonthlyPlanFactSlice, "revenue" | "invoices" | "sales"> {
  if (!snapshot) return { revenue: null, invoices: null, sales: null };
  const match = (deal: BitrixSnapshotDeal) => isPaidLeadSourceId(deal.sourceId) === paid;
  const invoices = snapshot.deals.filter(
    (deal) => match(deal) && throughIso(deal.invoiceDate || deal.dateCreate, throughDate)
  );
  const paidDeals = snapshot.paidDeals.filter(
    (deal) => match(deal) && throughIso(deal.closeDate, throughDate)
  );
  return {
    invoices: invoices.length || null,
    sales: paidDeals.length || null,
    revenue: paidDeals.reduce((sum, deal) => sum + dealRevenue(deal), 0) || null
  };
}

function sectionKind(label: string): "obshie" | "facebook" | "yandex" | "organic" | "skip" | null {
  if (!label) return null;
  if (label.startsWith("общие")) return "obshie";
  if (label.startsWith("facebook") || label.startsWith("meta") || label.startsWith("insta")) return "facebook";
  if (label.startsWith("яндекс") || label.startsWith("yandex")) return "yandex";
  if (label.startsWith("органик")) return "organic";
  if (
    label.startsWith("расход") ||
    label.startsWith("основные") ||
    label.startsWith("накладные") ||
    label.startsWith("административ")
  ) {
    return "skip";
  }
  return null;
}

export function factValueForLabel(labelRaw: string, slice: MonthlyPlanFactSlice): number | null {
  const label = normalizeLabel(labelRaw);
  if (!label) return null;
  if (label === "выручка") return roundMoney(slice.revenue);
  if (label.startsWith("бюджет") || label === "spend") return roundMoney(slice.spend);
  if (label === "roas") return roasPct(slice.revenue, slice.spend);
  if (label === "лиды") return roundCount(slice.leads);
  if (label === "cpl") {
    if (slice.spend == null || slice.leads == null || slice.leads <= 0) return null;
    return roundMoney(slice.spend / slice.leads);
  }
  if (label.includes("квал") && label.includes("лид") && !label.includes("%")) {
    return roundCount(slice.qualifiedLeads);
  }
  if (label.includes("%") && label.includes("квал")) return pct(slice.qualifiedLeads, slice.leads);
  if (label.startsWith("счета")) return roundCount(slice.invoices);
  if (label.startsWith("оплаты")) return roundCount(slice.sales);
  if (label.includes("конверсия") && label.includes("лид") && label.includes("счет")) {
    return pct(slice.invoices, slice.leads);
  }
  if (label.includes("конверсия") && label.includes("лид") && label.includes("оплат")) {
    return pct(slice.sales, slice.leads);
  }
  if (label.startsWith("счет в оплат")) return pct(slice.sales, slice.invoices);
  if (label.includes("средний чек") && label.includes("счет")) {
    if (slice.revenue == null || slice.invoices == null || slice.invoices <= 0) return null;
    return roundMoney(slice.revenue / slice.invoices);
  }
  if (label.includes("средний чек") && label.includes("оплат")) {
    if (slice.revenue == null || slice.sales == null || slice.sales <= 0) return null;
    return roundMoney(slice.revenue / slice.sales);
  }
  if (label === "cac") {
    if (slice.spend == null || slice.sales == null || slice.sales <= 0) return null;
    return roundMoney(slice.spend / slice.sales);
  }
  if (label === "roi" || label === "romi") {
    if (slice.revenue == null || slice.spend == null || slice.spend <= 0) return null;
    return pct(slice.revenue - slice.spend, slice.spend);
  }
  return null;
}

export function collectMonthlyPlanFactCells(
  values: string[][],
  sources: MonthlyPlanFactSources
): MonthlyPlanFactCell[] {
  const out: MonthlyPlanFactCell[] = [];
  let section: keyof MonthlyPlanFactSources | "skip" | null = null;
  for (let r = 2; r < values.length; r += 1) {
    const labelRaw = rowLabel(values[r]);
    if (!labelRaw) continue;
    const kind = sectionKind(normalizeLabel(labelRaw));
    if (kind) {
      section = kind;
      continue;
    }
    if (!section || section === "skip") continue;
    const value = factValueForLabel(labelRaw, sources[section]);
    if (value == null) continue;
    out.push({ row: r + 1, section, label: labelRaw, value });
  }
  return out;
}

export async function loadMonthlyPlanFactSources(input: {
  month: string;
  throughDate?: string | null;
}): Promise<MonthlyPlanFactSources> {
  const svodId = getSvodPlanSpreadsheetId();
  const paidTab = getSvodPaidLeadsTab();
  const organicTab = getSvodOrganicLeadsTab();
  const quote = quoteTab;
  const legacy = analyticsPeriodToLegacy(input.month as AnalyticsPeriod);
  const [paidSheet, organicSheet, maria, bitrix] = await Promise.all([
    readSheetValues({ spreadsheetId: svodId, range: `${quote(paidTab)}!A1:N400` }),
    readSheetValues({ spreadsheetId: svodId, range: `${quote(organicTab)}!A1:J400` }),
    pullMariaTruthSnapshot().catch(() => null),
    legacy ? readBitrixSnapshot(legacy).catch(() => null) : Promise.resolve(null)
  ]);

  const daily = parseSvodDailyLeads({ paidSheet, organicSheet, month: input.month });
  const verified = sumSvodVerifiedLeads(daily, { month: input.month, throughDate: input.throughDate });
  const dayRows = parseSvodDayTrafficRaw(paidSheet).filter((row) => {
    if (!row.date.startsWith(input.month)) return false;
    if (input.throughDate && row.date > input.throughDate) return false;
    return true;
  });
  const organicRows = parseSvodOrganicRaw(organicSheet).filter((row) => {
    if (!row.date.startsWith(input.month)) return false;
    if (input.throughDate && row.date > input.throughDate) return false;
    return true;
  });

  const paidRevenue = dayRows.reduce((sum, row) => sum + row.revenue_svod, 0);
  const paidSales = dayRows.reduce((sum, row) => sum + row.sales_count_svod, 0);
  const paidQl = dayRows.reduce((sum, row) => sum + row.qualified_leads, 0);
  const organicRevenue = organicRows.reduce((sum, row) => sum + row.revenue_svod, 0);
  const organicSales = organicRows.reduce((sum, row) => sum + row.sales_count_svod, 0);
  const organicQl = organicRows.reduce((sum, row) => sum + row.qualified_leads, 0);

  const mariaMonth = maria?.month;
  const obshieRevenue = mariaMonth?.revenue ?? paidRevenue + organicRevenue;
  const obshieSales = mariaMonth?.salesCount ?? paidSales + organicSales;
  const obshieInvoices = mariaMonth?.invoicesCount ?? null;
  const obshieSpend = verified.spend || mariaMonth?.budget || null;
  const facebookBitrix = bitrixChannelSlice(bitrix, input.throughDate, true);
  const organicBitrix = bitrixChannelSlice(bitrix, input.throughDate, false);

  return {
    obshie: {
      revenue: obshieRevenue || null,
      spend: obshieSpend || null,
      leads: verified.total || null,
      qualifiedLeads: paidQl + organicQl || null,
      invoices: obshieInvoices,
      sales: obshieSales || null
    },
    facebook: {
      revenue: paidRevenue || facebookBitrix.revenue,
      spend: verified.spend || null,
      leads: verified.paid || null,
      qualifiedLeads: paidQl || null,
      invoices: facebookBitrix.invoices,
      sales: paidSales || facebookBitrix.sales
    },
    yandex: EMPTY_SLICE(),
    organic: {
      revenue: organicRevenue || organicBitrix.revenue,
      spend: null,
      leads: verified.organic || null,
      qualifiedLeads: organicQl || null,
      invoices: organicBitrix.invoices,
      sales: organicSales || organicBitrix.sales
    }
  };
}

export async function syncMonthlyPlanFacts(input?: {
  month?: string;
  dryRun?: boolean;
}): Promise<{
  ok: true;
  month: string;
  spreadsheetId: string;
  tabTitle: string;
  factCol: string;
  throughDate: string | null;
  written: number;
  skippedFormulas: number;
  cells: Array<{ a1: string; section: string; label: string; value: number }>;
  dryRun: boolean;
}> {
  const month = input?.month?.trim() || moscowIsoMonth();
  const throughDate = month >= moscowIsoMonth() ? moscowYesterdayIso() : null;
  const spreadsheetId = getMonthlyPlanSpreadsheetId();
  const tabTitle = getMonthlyPlanTabTitle();
  const range = `${quoteTab(tabTitle)}!A1:Z160`;
  const [values, formulaGrid] = await Promise.all([
    readSheetValues({ spreadsheetId, range }),
    readSheetValues({ spreadsheetId, range, valueRenderOption: "FORMULA" })
  ]);
  const factCol = findSvodFactColumn(values, month);
  if (factCol == null) {
    throw new Error(`В «${tabTitle}» нет колонки Факт для ${month}`);
  }

  const sources = await loadMonthlyPlanFactSources({ month, throughDate });
  const cells = collectMonthlyPlanFactCells(values, sources);
  const col = a1Col(factCol);
  const updates: Array<{ range: string; values: Array<Array<string | number>> }> = [];
  const writtenCells: Array<{ a1: string; section: string; label: string; value: number }> = [];
  let skippedFormulas = 0;

  for (const cell of cells) {
    const existing = String(formulaGrid[cell.row - 1]?.[factCol] ?? "").trim();
    if (existing.startsWith("=")) {
      skippedFormulas += 1;
      continue;
    }
    const a1 = `${quoteTab(tabTitle)}!${col}${cell.row}`;
    updates.push({ range: a1, values: [[cell.value]] });
    writtenCells.push({ a1: `${col}${cell.row}`, section: cell.section, label: cell.label, value: cell.value });
  }

  if (!input?.dryRun && updates.length) {
    await batchUpdateSheetValues({
      spreadsheetId,
      data: updates,
      valueInputOption: "USER_ENTERED"
    });
  }

  return {
    ok: true,
    month,
    spreadsheetId,
    tabTitle,
    factCol: col,
    throughDate,
    written: input?.dryRun ? 0 : writtenCells.length,
    skippedFormulas,
    cells: writtenCells,
    dryRun: Boolean(input?.dryRun)
  };
}
