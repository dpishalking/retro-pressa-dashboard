import { parseSheetNumber } from "@/lib/os-sheets/sales-metric-defs";
import { readSheetValues } from "@/lib/google/sheets-client";
import type { MariaDailyRow } from "@/lib/sales-os/maria-daily";
import { emptyMariaDailyRow } from "@/lib/sales-os/maria-daily";

/** Maria operational truth workbook (Отчет показатели RETRO PRESSA). */
export const MARIA_TRUTH_SPREADSHEET_ID_DEFAULT = "1nNC48IfiUgO86YGvyLH05o6DrBq3jKKprChT09HN2Mc";
export const MARIA_TRUTH_TAB = "Отчет день/месяц";

export function getMariaTruthSpreadsheetId(): string {
  return process.env.MARIA_TRUTH_SPREADSHEET_ID?.trim() || MARIA_TRUTH_SPREADSHEET_ID_DEFAULT;
}

export type MariaTruthSnapshot = {
  reportDate: string;
  yesterday: {
    trafficLeads: number | null;
    organicLeads: number | null;
    invoicesCount: number | null;
    invoicesAmount: number | null;
    annulledCount: number | null;
    annulledAmount: number | null;
    budget: number | null;
    avgCheck: number | null;
  };
  month: {
    trafficLeads: number | null;
    organicLeads: number | null;
    invoicesCount: number | null;
    invoicesAmount: number | null;
    annulledCount: number | null;
    annulledAmount: number | null;
    salesCount: number | null;
    revenue: number | null;
    budget: number | null;
    avgCheck: number | null;
  };
  plan: {
    revenue: number | null;
    sales: number | null;
    runrateRevenue: number | null;
  };
  sourceSpreadsheetId: string;
  sourceTab: string;
  pulledAt: string;
};

function quote(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

export function parseMariaNumber(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  let text = String(raw).trim();
  if (!text) return null;
  text = text
    .replace(/[€$]/g, "")
    .replace(/\bр\.?/gi, "")
    .replace(/%/g, "")
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .trim();
  if (!text || text === "-" || text === "—") return null;
  // European thousands: 21.729,50 or 21 729
  if (/\d,\d{1,2}$/.test(text) && text.includes(".")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (/\d,\d{1,2}$/.test(text)) {
    text = text.replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }
  const n = parseSheetNumber(text);
  return Number.isFinite(n) ? n : null;
}

export function parseMariaReportDate(header: string): string {
  const match = String(header).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) return "";
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function labelKey(label: string): string {
  return String(label)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ё/g, "е")
    .trim();
}

/**
 * Parse Maria "Отчет день/месяц" grid (labels in col A, values in col B;
 * plan block around col G/H; runrate plan around col J).
 */
export function parseMariaTruthGrid(values: string[][]): MariaTruthSnapshot {
  const pulledAt = new Date().toISOString();
  const header = String(values[0]?.[3] ?? values[0]?.[0] ?? "");
  const reportDate = parseMariaReportDate(header);

  const yesterday: MariaTruthSnapshot["yesterday"] = {
    trafficLeads: null,
    organicLeads: null,
    invoicesCount: null,
    invoicesAmount: null,
    annulledCount: null,
    annulledAmount: null,
    budget: null,
    avgCheck: null
  };
  const month: MariaTruthSnapshot["month"] = {
    trafficLeads: null,
    organicLeads: null,
    invoicesCount: null,
    invoicesAmount: null,
    annulledCount: null,
    annulledAmount: null,
    salesCount: null,
    revenue: null,
    budget: null,
    avgCheck: null
  };
  const plan: MariaTruthSnapshot["plan"] = {
    revenue: null,
    sales: null,
    runrateRevenue: null
  };

  let section: "yesterday" | "month" | "" = "";
  for (const line of values) {
    const a = String(line[0] ?? "").trim();
    const b = line[1];
    const g = String(line[6] ?? "").trim();
    const h = line[7];
    const jLabel = String(line[9] ?? "").trim();
    const jVal = line[10];

    if (/показатели за вчера/i.test(a)) {
      section = "yesterday";
      continue;
    }
    if (/показатели за месяц/i.test(a)) {
      section = "month";
      continue;
    }
    if (/^май$/i.test(a) || /^июнь$/i.test(a)) break;

    const key = labelKey(a);
    const num = parseMariaNumber(b);

    if (section === "yesterday") {
      if (key === "лидов трафик") yesterday.trafficLeads = num;
      else if (key === "лидов органика") yesterday.organicLeads = num;
      else if (key === "счетов (шт)") yesterday.invoicesCount = num;
      else if (key === "счетов (евро)") yesterday.invoicesAmount = num;
      else if (key.startsWith("анулированных (шт)") || key.startsWith("аннулированных (шт)")) yesterday.annulledCount = num;
      else if (key.startsWith("аннулированных (евро)") || key.startsWith("анулированных (евро)")) yesterday.annulledAmount = num;
      else if (key === "бюджет") yesterday.budget = num;
      else if (key === "средний чек") yesterday.avgCheck = num;
    }

    if (section === "month") {
      if (key === "лидов трафик (мес)") month.trafficLeads = num;
      else if (key === "лидов органика (мес)") month.organicLeads = num;
      else if (key === "счетов (шт)") month.invoicesCount = num;
      else if (key === "счетов (евро)") month.invoicesAmount = num;
      else if (key.includes("аннулированных счетов") || key.includes("анулированных счетов")) month.annulledCount = num;
      else if (key.startsWith("аннулированных (евро)") || key.startsWith("анулированных (евро)")) month.annulledAmount = num;
      else if (key === "продаж (мес)") month.salesCount = num;
      else if (key === "выручка (мес)") month.revenue = num;
      else if (key === "бюджет (мес)") month.budget = num;
      else if (key === "средний чек") month.avgCheck = num;
    }

    const gKey = labelKey(g);
    if (gKey === "выручка") plan.revenue = parseMariaNumber(h);
    if (gKey === "продажи") plan.sales = parseMariaNumber(h);
    if (labelKey(jLabel) === "план по выручке") plan.runrateRevenue = parseMariaNumber(jVal);
  }

  return {
    reportDate,
    yesterday,
    month,
    plan,
    sourceSpreadsheetId: getMariaTruthSpreadsheetId(),
    sourceTab: MARIA_TRUTH_TAB,
    pulledAt
  };
}

export async function pullMariaTruthSnapshot(input?: {
  spreadsheetId?: string;
  tabTitle?: string;
}): Promise<MariaTruthSnapshot> {
  const spreadsheetId = input?.spreadsheetId?.trim() || getMariaTruthSpreadsheetId();
  const tabTitle = input?.tabTitle?.trim() || MARIA_TRUTH_TAB;
  const values = await readSheetValues({
    spreadsheetId,
    range: `${quote(tabTitle)}!A1:L45`
  });
  const snapshot = parseMariaTruthGrid(values);
  snapshot.sourceSpreadsheetId = spreadsheetId;
  snapshot.sourceTab = tabTitle;
  return snapshot;
}

function numStr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

/**
 * Upsert Maria daily row from truth sheet.
 * Fills invoices from yesterday block. Does not clear paid_* if truth sheet has no day payments
 * (those often come from Maria chat) — only overwrites paid_* when explicitly provided.
 */
export function applyMariaTruthToDaily(input: {
  existing: MariaDailyRow[];
  snapshot: MariaTruthSnapshot;
  syncedAt: string;
}): MariaDailyRow[] {
  const date = input.snapshot.reportDate;
  if (!date) return input.existing;

  const byDate = new Map(input.existing.map((row) => [row.date, { ...row }]));
  const current = byDate.get(date) || emptyMariaDailyRow();
  current.date = date;
  current.invoices_count = numStr(input.snapshot.yesterday.invoicesCount) || current.invoices_count;
  current.invoices_amount = numStr(input.snapshot.yesterday.invoicesAmount) || current.invoices_amount;
  current.notes = `Pulled from truth sheet ${input.snapshot.sourceTab} (${date})`;
  current.source = "maria_truth_sheet";
  current.updated_at = input.syncedAt;
  byDate.set(date, current);

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type MariaSnapshotRow = {
  key: string;
  value: string;
  notes: string;
  updated_at: string;
};

export function mariaSnapshotRows(snapshot: MariaTruthSnapshot): MariaSnapshotRow[] {
  const at = snapshot.pulledAt;
  const y = snapshot.yesterday;
  const m = snapshot.month;
  const p = snapshot.plan;
  return [
    { key: "report_date", value: snapshot.reportDate, notes: "Date from header Отчет за DD.MM.YYYY", updated_at: at },
    { key: "source_spreadsheet_id", value: snapshot.sourceSpreadsheetId, notes: "Maria truth workbook", updated_at: at },
    { key: "source_tab", value: snapshot.sourceTab, notes: "", updated_at: at },
    { key: "yesterday_invoices_count", value: numStr(y.invoicesCount), notes: "Счетов (шт) за вчера", updated_at: at },
    { key: "yesterday_invoices_amount", value: numStr(y.invoicesAmount), notes: "Счетов (евро) за вчера", updated_at: at },
    { key: "yesterday_traffic_leads", value: numStr(y.trafficLeads), notes: "", updated_at: at },
    { key: "yesterday_organic_leads", value: numStr(y.organicLeads), notes: "", updated_at: at },
    { key: "yesterday_budget", value: numStr(y.budget), notes: "Бюджет за вчера (€)", updated_at: at },
    { key: "yesterday_avg_check", value: numStr(y.avgCheck), notes: "Средний чек за вчера", updated_at: at },
    { key: "month_invoices_count", value: numStr(m.invoicesCount), notes: "Счетов (шт) мес", updated_at: at },
    { key: "month_invoices_amount", value: numStr(m.invoicesAmount), notes: "Счетов (евро) мес", updated_at: at },
    { key: "month_sales_count", value: numStr(m.salesCount), notes: "Продаж (мес) — flueger payments", updated_at: at },
    { key: "month_revenue", value: numStr(m.revenue), notes: "Выручка (мес) — flueger revenue", updated_at: at },
    { key: "month_annulled_count", value: numStr(m.annulledCount), notes: "", updated_at: at },
    { key: "month_annulled_amount", value: numStr(m.annulledAmount), notes: "", updated_at: at },
    { key: "plan_revenue", value: numStr(p.revenue), notes: "ПЛАН Выручка", updated_at: at },
    { key: "plan_sales", value: numStr(p.sales), notes: "ПЛАН Продажи", updated_at: at },
    { key: "plan_runrate_revenue", value: numStr(p.runrateRevenue), notes: "План по выручке (runrate block)", updated_at: at },
    { key: "pulled_at", value: at, notes: "", updated_at: at }
  ];
}
