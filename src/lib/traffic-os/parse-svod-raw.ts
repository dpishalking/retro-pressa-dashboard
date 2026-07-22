import { parseSvodDayDate, parseSvodPlanNumber } from "@/lib/sales-os/svod-plans";
import { findHeaderIndex, num } from "@/lib/traffic-os/utils";

export type SvodTrafficRawRow = {
  date: string;
  source_sheet: string;
  spend: number;
  clicks: number;
  leads_crm: number;
  qualified_leads: number;
  sales_count_svod: number;
  revenue_svod: number;
};

export type SvodOrganicRawRow = {
  date: string;
  source_sheet: string;
  impressions: number;
  clicks: number;
  leads_sheet: number;
  leads_crm: number;
  qualified_leads: number;
  sales_count_svod: number;
  revenue_svod: number;
};

/** Parse СВОД `day` into raw evidence rows (skip totals row). */
export function parseSvodDayTrafficRaw(values: string[][], sourceSheet = "day"): SvodTrafficRawRow[] {
  if (values.length < 3) return [];
  const header = values[0] || [];
  const spendCol = findHeaderIndex(header, "Расход");
  const revenueCol = findHeaderIndex(header, "Выручка");
  const clicksCol = findHeaderIndex(header, "Клики");
  const leadsCrmCol = findHeaderIndex(header, "Лиды CRM", "лиды crm");
  const qlCol = findHeaderIndex(header, "Квал. лиды", "Квал лиды");
  const salesCol = findHeaderIndex(header, "Кол-во продаж");
  const out: SvodTrafficRawRow[] = [];
  for (const row of values.slice(2)) {
    const date = parseSvodDayDate(row[0] || "");
    if (!date) continue;
    out.push({
      date,
      source_sheet: sourceSheet,
      spend: spendCol >= 0 ? num(row[spendCol]) : 0,
      clicks: clicksCol >= 0 ? num(row[clicksCol]) : 0,
      leads_crm: leadsCrmCol >= 0 ? num(row[leadsCrmCol]) : 0,
      qualified_leads: qlCol >= 0 ? num(row[qlCol]) : 0,
      sales_count_svod: salesCol >= 0 ? num(row[salesCol]) : 0,
      revenue_svod: revenueCol >= 0 ? num(row[revenueCol]) : 0
    });
  }
  return out;
}

/** Parse СВОД `Органика` into raw evidence rows. */
export function parseSvodOrganicRaw(values: string[][], sourceSheet = "Органика"): SvodOrganicRawRow[] {
  if (values.length < 3) return [];
  const header = values[0] || [];
  const revenueCol = findHeaderIndex(header, "Выручка");
  const impressionsCol = findHeaderIndex(header, "Показы");
  const clicksCol = findHeaderIndex(header, "Клики");
  const leadsSheetCol = findHeaderIndex(header, "Лиды");
  const leadsCrmCol = findHeaderIndex(header, "Лиды CRM");
  // Prefer exact CRM col; if "Лиды" matched CRM incorrectly, re-find
  const leadsCrmExact = header.findIndex(
    (h) =>
      String(h || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase() === "лиды crm"
  );
  const crmCol = leadsCrmExact >= 0 ? leadsCrmExact : leadsCrmCol;
  const leadsOnlyCol =
    leadsSheetCol >= 0 && leadsSheetCol !== crmCol
      ? leadsSheetCol
      : header.findIndex((h) => String(h || "").replace(/\s+/g, " ").trim().toLowerCase() === "лиды");
  const qlCol = findHeaderIndex(header, "Квал. лиды");
  const salesCol = findHeaderIndex(header, "Кол-во продаж");
  const out: SvodOrganicRawRow[] = [];
  for (const row of values.slice(2)) {
    const date = parseSvodDayDate(row[0] || "");
    if (!date) continue;
    out.push({
      date,
      source_sheet: sourceSheet,
      impressions: impressionsCol >= 0 ? num(row[impressionsCol]) : 0,
      clicks: clicksCol >= 0 ? num(row[clicksCol]) : 0,
      leads_sheet: leadsOnlyCol >= 0 ? num(row[leadsOnlyCol]) : 0,
      leads_crm: crmCol >= 0 ? num(row[crmCol]) : 0,
      qualified_leads: qlCol >= 0 ? num(row[qlCol]) : 0,
      sales_count_svod: salesCol >= 0 ? num(row[salesCol]) : 0,
      revenue_svod: revenueCol >= 0 ? num(row[revenueCol]) : 0
    });
  }
  return out;
}

export function extractLandingUrlsFromSheetTitles(titles: string[]): string[] {
  const urls: string[] = [];
  for (const title of titles) {
    const t = String(title || "").trim();
    if (/^https?:\/\//i.test(t) || /\.(com|net|lv|ee|de|es)\b/i.test(t)) {
      urls.push(t.split(/\s+/)[0]);
    }
  }
  return urls;
}

export { parseSvodPlanNumber };
