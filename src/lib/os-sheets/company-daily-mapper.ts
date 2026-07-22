import {
  COMPANY_DAILY_COLUMNS,
  COMPANY_DAILY_NUMERIC_COLUMNS,
  type CompanyDailyColumn
} from "@/config/os-sheets";
import type { SalesDailyRow } from "@/lib/os-sheets/sales-mapper";
import type { TrafficSheetRow } from "@/lib/os-sheets/traffic-mapper";

const numericColumnSet = new Set<string>(COMPANY_DAILY_NUMERIC_COLUMNS);

export type CompanyDailyRow = Record<CompanyDailyColumn, string>;
export type CompanyDailySheetCell = string | number;

export function emptyCompanyDailyRow(): CompanyDailyRow {
  return Object.fromEntries(COMPANY_DAILY_COLUMNS.map((column) => [column, ""])) as CompanyDailyRow;
}

export function companyDailyRowToSheetLine(row: CompanyDailyRow): CompanyDailySheetCell[] {
  return COMPANY_DAILY_COLUMNS.map((column) => {
    const raw = row[column] ?? "";
    if (!numericColumnSet.has(column)) return raw;
    if (!raw.trim()) return "";
    const value = Number(raw.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(value) ? value : raw;
  });
}

function toDateKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : null;
}

function numberOrZero(value: string) {
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

type DayAgg = {
  paidLeads: number;
  organicLeads: number;
  adSpend: number;
  dealsCreated: number;
  invoices: number;
  payments: number;
  revenue: number;
};

function ensureDay(map: Map<string, DayAgg>, date: string): DayAgg {
  const existing = map.get(date);
  if (existing) return existing;
  const created = {
    paidLeads: 0,
    organicLeads: 0,
    adSpend: 0,
    dealsCreated: 0,
    invoices: 0,
    payments: 0,
    revenue: 0
  };
  map.set(date, created);
  return created;
}

export function buildCompanyDaily(input: {
  traffic: TrafficSheetRow[];
  salesDaily: SalesDailyRow[];
  periodPrefix: string;
  syncedAt: string;
}): CompanyDailyRow[] {
  const byDate = new Map<string, DayAgg>();

  for (const row of input.traffic) {
    const date = toDateKey(row.date);
    if (!date || !date.startsWith(input.periodPrefix)) continue;
    const day = ensureDay(byDate, date);
    const leads = numberOrZero(row.leads);
    if (row.lead_kind === "organic") day.organicLeads += leads;
    else day.paidLeads += leads;
    day.adSpend += numberOrZero(row.spend);
  }

  for (const row of input.salesDaily) {
    const date = toDateKey(row.date);
    if (!date || !date.startsWith(input.periodPrefix)) continue;
    const day = ensureDay(byDate, date);
    day.dealsCreated += numberOrZero(row.deals_created);
    day.invoices += numberOrZero(row.invoices);
    day.payments += numberOrZero(row.payments);
    day.revenue += numberOrZero(row.revenue);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, agg]) => {
      const row = emptyCompanyDailyRow();
      const leadsTotal = agg.paidLeads + agg.organicLeads;
      row.date = date;
      row.paid_leads = agg.paidLeads ? String(agg.paidLeads) : "";
      row.organic_leads = agg.organicLeads ? String(agg.organicLeads) : "";
      row.leads_total = leadsTotal ? String(leadsTotal) : "";
      row.ad_spend = agg.adSpend ? String(Number(agg.adSpend.toFixed(2))) : "";
      row.deals_created = agg.dealsCreated ? String(agg.dealsCreated) : "";
      row.invoices = agg.invoices ? String(agg.invoices) : "";
      row.payments = agg.payments ? String(agg.payments) : "";
      row.revenue = agg.revenue ? String(Number(agg.revenue.toFixed(2))) : "";
      row.average_check = agg.payments > 0
        ? String(Number((agg.revenue / agg.payments).toFixed(2)))
        : "";
      row.data_status = "live";
      row.last_sync_at = input.syncedAt;
      row.source_of_truth = "computed";
      return row;
    });
}
