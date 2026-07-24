import { readSheetValues } from "@/lib/google/sheets-client";

/**
 * СВОД_RetroPressa → tab «План/факт» (ОБЩИЕ monthly plan columns).
 * https://docs.google.com/spreadsheets/d/1nItFm1eqBMVBJF1ZSBuBKZX-g03wx5v60l7h7Pqey4M
 */

export const SVOD_PLAN_SPREADSHEET_ID_DEFAULT = "1nItFm1eqBMVBJF1ZSBuBKZX-g03wx5v60l7h7Pqey4M";
export const SVOD_PLAN_TAB_DEFAULT = "План/факт";

export function getSvodPlanSpreadsheetId(): string {
  return process.env.SVOD_PLAN_SPREADSHEET_ID?.trim() || SVOD_PLAN_SPREADSHEET_ID_DEFAULT;
}

export function getSvodPlanTabTitle(): string {
  return process.env.SVOD_PLAN_TAB?.trim() || SVOD_PLAN_TAB_DEFAULT;
}

const MONTH_NAMES_RU = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь"
] as const;

export type SvodMonthPlans = {
  month: string;
  planCol: number;
  revenue: number | null;
  sale: number | null;
  leads: number | null;
  invoices: number | null;
  aov: number | null;
};

export function parseSvodPlanNumber(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text || text.startsWith("#")) return null;
  const cleaned = text
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace(/[€$%]/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function monthNameRuGenitiveOrNominative(month: string): string {
  const idx = Number(month.slice(5, 7)) - 1;
  return MONTH_NAMES_RU[idx] || "";
}

/** Find 0-based plan column for YYYY-MM on header rows 1–2. */
export function findSvodPlanColumn(values: string[][], month: string): number | null {
  const want = monthNameRuGenitiveOrNominative(month);
  if (!want) return null;
  const header = values[0] || [];
  const sub = values[1] || [];
  for (let col = 0; col < Math.max(header.length, sub.length); col += 1) {
    const name = String(header[col] || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const kind = String(sub[col] || "")
      .trim()
      .toLowerCase();
    if (name === want && kind.startsWith("план")) return col;
  }
  return null;
}

function normalizeMetricLabel(raw: string): string {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Parse ОБЩИЕ block only (stop at Facebook / next channel section). */
export function parseSvodObshiePlans(values: string[][], month: string): SvodMonthPlans | null {
  const planCol = findSvodPlanColumn(values, month);
  if (planCol == null) return null;

  const out: SvodMonthPlans = {
    month,
    planCol,
    revenue: null,
    sale: null,
    leads: null,
    invoices: null,
    aov: null
  };

  let inObshie = false;
  for (let r = 2; r < values.length; r += 1) {
    const label = normalizeMetricLabel(values[r]?.[0] || "");
    if (!label) continue;
    if (label.startsWith("общие")) {
      inObshie = true;
      continue;
    }
    if (
      label.startsWith("facebook") ||
      label.startsWith("яндекс") ||
      label.startsWith("google") ||
      label.startsWith("vk") ||
      label.startsWith("органик")
    ) {
      if (inObshie) break;
      continue;
    }
    if (!inObshie && label !== "выручка") continue;
    if (label === "выручка") inObshie = true;

    const value = parseSvodPlanNumber(values[r]?.[planCol]);
    if (value == null) continue;

    if (label === "выручка") out.revenue = value;
    else if (label === "лиды") out.leads = value;
    else if (label.startsWith("счета")) out.invoices = value;
    else if (label.startsWith("оплаты")) out.sale = value;
    else if (label.includes("средний чек") && label.includes("оплат")) out.aov = value;
  }

  const hasAny = [out.revenue, out.sale, out.leads, out.invoices, out.aov].some((v) => v != null);
  return hasAny ? out : null;
}

export const SVOD_PAID_LEADS_TAB_DEFAULT = "day";
export const SVOD_ORGANIC_LEADS_TAB_DEFAULT = "Органика";

export function getSvodPaidLeadsTab(): string {
  return process.env.SVOD_PAID_LEADS_TAB?.trim() || SVOD_PAID_LEADS_TAB_DEFAULT;
}

export function getSvodOrganicLeadsTab(): string {
  return process.env.SVOD_ORGANIC_LEADS_TAB?.trim() || SVOD_ORGANIC_LEADS_TAB_DEFAULT;
}

export type SvodDayLeads = {
  paid: number;
  organic: number;
  total: number;
};

/** Parse DD.MM.YYYY from СВОД day sheets. */
export function parseSvodDayDate(raw: string): string | null {
  const text = String(raw || "").trim();
  const m = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function findLeadsCrmColumn(header: string[]): number {
  const normalized = header.map((h) =>
    String(h || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );
  const exact = normalized.findIndex((h) => h === "лиды crm" || h === "лиды сrm");
  if (exact >= 0) return exact;
  return normalized.findIndex((h) => h.includes("лиды") && h.includes("crm"));
}

/** Paid (`day`) + organic (`Органика`) → daily lead totals. */
export function parseSvodDailyLeads(input: {
  paidSheet: string[][];
  organicSheet: string[][];
  month?: string;
}): Map<string, SvodDayLeads> {
  const out = new Map<string, SvodDayLeads>();
  const ensure = (iso: string) => {
    let row = out.get(iso);
    if (!row) {
      row = { paid: 0, organic: 0, total: 0 };
      out.set(iso, row);
    }
    return row;
  };

  const paidCol = findLeadsCrmColumn(input.paidSheet[0] || []);
  if (paidCol >= 0) {
    for (const row of input.paidSheet.slice(2)) {
      const iso = parseSvodDayDate(row[0] || "");
      if (!iso) continue;
      if (input.month && !iso.startsWith(input.month)) continue;
      const n = parseSvodPlanNumber(row[paidCol]) ?? 0;
      const item = ensure(iso);
      item.paid = n;
      item.total = item.paid + item.organic;
    }
  }

  const organicCol = findLeadsCrmColumn(input.organicSheet[0] || []);
  if (organicCol >= 0) {
    for (const row of input.organicSheet.slice(2)) {
      const iso = parseSvodDayDate(row[0] || "");
      if (!iso) continue;
      if (input.month && !iso.startsWith(input.month)) continue;
      const n = parseSvodPlanNumber(row[organicCol]) ?? 0;
      const item = ensure(iso);
      item.organic = n;
      item.total = item.paid + item.organic;
    }
  }

  return out;
}

export async function pullSvodDailyLeads(input?: {
  month?: string;
  spreadsheetId?: string;
}): Promise<Map<string, SvodDayLeads>> {
  const spreadsheetId = input?.spreadsheetId || getSvodPlanSpreadsheetId();
  const paidTab = getSvodPaidLeadsTab();
  const organicTab = getSvodOrganicLeadsTab();
  const quote = (t: string) => `'${t.replace(/'/g, "''")}'`;
  const [paidSheet, organicSheet] = await Promise.all([
    readSheetValues({ spreadsheetId, range: `${quote(paidTab)}!A1:N400` }),
    readSheetValues({ spreadsheetId, range: `${quote(organicTab)}!A1:J400` })
  ]);
  return parseSvodDailyLeads({ paidSheet, organicSheet, month: input?.month });
}

export async function pullSvodMonthPlans(input: {
  month: string;
  spreadsheetId?: string;
  tabTitle?: string;
}): Promise<SvodMonthPlans | null> {
  const spreadsheetId = input.spreadsheetId || getSvodPlanSpreadsheetId();
  const tabTitle = input.tabTitle || getSvodPlanTabTitle();
  const values = await readSheetValues({
    spreadsheetId,
    range: `'${tabTitle.replace(/'/g, "''")}'!A1:Z80`
  });
  return parseSvodObshiePlans(values, input.month);
}

/** Metric slice shared by ОБЩИЕ / Paid / Organic blocks. */
export type SvodSalesPlanSlice = {
  revenue: number | null;
  sale: number | null;
  leads: number | null;
  invoices: number | null;
  aov: number | null;
  /** Lead → Invoice plan rate (0–1), from «Конверсия Лид в счет». */
  crLeadInvoice: number | null;
  /** Lead → Sale plan rate (0–1), from «Конверсия Лид в оплату». */
  crLeadSale: number | null;
  /** Invoice → Sale plan rate (0–1), from «Счет в оплату». */
  crInvoiceSale: number | null;
  /** Marketing: CPL plan when present on СВОД. */
  cpl: number | null;
  /** Marketing: Budget/spend plan when present on СВОД. */
  spend: number | null;
};

export type SvodPaidOrganicPlans = {
  month: string;
  planCol: number;
  obshie: SvodSalesPlanSlice;
  paid: SvodSalesPlanSlice;
  organic: SvodSalesPlanSlice;
  /** Named paid-ad sections that were summed into `paid` (e.g. Facebook). */
  paidSections: string[];
};

const EMPTY_SLICE = (): SvodSalesPlanSlice => ({
  revenue: null,
  sale: null,
  leads: null,
  invoices: null,
  aov: null,
  crLeadInvoice: null,
  crLeadSale: null,
  crInvoiceSale: null,
  cpl: null,
  spend: null
});

function addSlice(a: SvodSalesPlanSlice, b: SvodSalesPlanSlice): SvodSalesPlanSlice {
  const sum = (x: number | null, y: number | null): number | null => {
    if (x == null && y == null) return null;
    return (x ?? 0) + (y ?? 0);
  };
  const prefer = (x: number | null, y: number | null): number | null => x ?? y;
  return {
    revenue: sum(a.revenue, b.revenue),
    sale: sum(a.sale, b.sale),
    leads: sum(a.leads, b.leads),
    invoices: sum(a.invoices, b.invoices),
    aov: prefer(a.aov, b.aov),
    crLeadInvoice: prefer(a.crLeadInvoice, b.crLeadInvoice),
    crLeadSale: prefer(a.crLeadSale, b.crLeadSale),
    crInvoiceSale: prefer(a.crInvoiceSale, b.crInvoiceSale),
    cpl: prefer(a.cpl, b.cpl),
    spend: sum(a.spend, b.spend)
  };
}

/** SVOD stores percents as 22 or 22% → normalize to 0–1 for Sheets percent cells. */
export function svodRateToUnit(value: number): number {
  if (!Number.isFinite(value)) return value;
  return value > 1 ? value / 100 : value;
}

function applyMetricToSlice(slice: SvodSalesPlanSlice, label: string, value: number): void {
  if (label === "выручка") slice.revenue = value;
  else if (label === "лиды") slice.leads = value;
  else if (label.startsWith("счета")) slice.invoices = value;
  else if (label.startsWith("оплаты")) slice.sale = value;
  else if (label.includes("средний чек") && label.includes("оплат")) slice.aov = value;
  else if (label.includes("конверсия") && label.includes("лид") && label.includes("счет")) {
    slice.crLeadInvoice = svodRateToUnit(value);
  } else if (label.includes("конверсия") && label.includes("лид") && label.includes("оплат")) {
    slice.crLeadSale = svodRateToUnit(value);
  } else if (label.startsWith("счет в оплат")) {
    slice.crInvoiceSale = svodRateToUnit(value);
  } else if (label === "cpl") slice.cpl = value;
  else if (label.startsWith("бюджет") || label === "budget" || label === "spend") slice.spend = value;
}

function isPaidAdSection(label: string): boolean {
  return (
    label.startsWith("facebook") ||
    label.startsWith("яндекс") ||
    label.startsWith("google") ||
    label.startsWith("vk") ||
    label.startsWith("платн") ||
    label === "paid"
  );
}

function isOrganicSection(label: string): boolean {
  return label.startsWith("органик") || label === "organic";
}

function isSectionHeader(label: string): boolean {
  return (
    label.startsWith("общие") ||
    isPaidAdSection(label) ||
    isOrganicSection(label) ||
    label.startsWith("расход")
  );
}

/**
 * Parse Paid (= sum of Facebook / Yandex / Google / VK …) and Organic blocks
 * from СВОД «План/факт». Captures Budget/CPL for marketing; ignores ROAS/ROI/ROMI.
 */
export function parseSvodPaidOrganicPlans(values: string[][], month: string): SvodPaidOrganicPlans | null {
  const planCol = findSvodPlanColumn(values, month);
  if (planCol == null) return null;

  const out: SvodPaidOrganicPlans = {
    month,
    planCol,
    obshie: EMPTY_SLICE(),
    paid: EMPTY_SLICE(),
    organic: EMPTY_SLICE(),
    paidSections: []
  };

  type Mode = "none" | "obshie" | "paid" | "organic" | "skip";
  let mode: Mode = "none";
  let paidAccum = EMPTY_SLICE();

  for (let r = 2; r < values.length; r += 1) {
    const label = normalizeMetricLabel(values[r]?.[0] || "");
    if (!label) continue;

    if (label.startsWith("общие")) {
      mode = "obshie";
      continue;
    }
    if (isOrganicSection(label)) {
      if (mode === "paid" || out.paidSections.length) {
        out.paid = addSlice(out.paid, paidAccum);
        paidAccum = EMPTY_SLICE();
      }
      mode = "organic";
      continue;
    }
    if (isPaidAdSection(label)) {
      if (mode === "paid") {
        out.paid = addSlice(out.paid, paidAccum);
        paidAccum = EMPTY_SLICE();
      }
      mode = "paid";
      out.paidSections.push(String(values[r]?.[0] || "").trim());
      continue;
    }
    if (label.startsWith("расход")) break;
    if (isSectionHeader(label)) {
      if (mode === "paid") {
        out.paid = addSlice(out.paid, paidAccum);
        paidAccum = EMPTY_SLICE();
      }
      mode = "skip";
      continue;
    }

    if (mode === "none" || mode === "skip") continue;
    if (label === "roas" || label === "roi" || label === "romi") {
      continue;
    }

    const value = parseSvodPlanNumber(values[r]?.[planCol]);
    if (value == null) continue;

    if (mode === "obshie") applyMetricToSlice(out.obshie, label, value);
    else if (mode === "organic") applyMetricToSlice(out.organic, label, value);
    else if (mode === "paid") applyMetricToSlice(paidAccum, label, value);
  }

  if (mode === "paid") out.paid = addSlice(out.paid, paidAccum);

  const hasAny = [out.obshie, out.paid, out.organic].some((s) =>
    [s.revenue, s.sale, s.leads, s.invoices, s.aov, s.cpl, s.spend].some((v) => v != null)
  );
  return hasAny ? out : null;
}

export async function pullSvodPaidOrganicPlans(input: {
  month: string;
  spreadsheetId?: string;
  tabTitle?: string;
}): Promise<SvodPaidOrganicPlans | null> {
  const spreadsheetId = input.spreadsheetId || getSvodPlanSpreadsheetId();
  const tabTitle = input.tabTitle || getSvodPlanTabTitle();
  const values = await readSheetValues({
    spreadsheetId,
    range: `'${tabTitle.replace(/'/g, "''")}'!A1:Z120`
  });
  return parseSvodPaidOrganicPlans(values, input.month);
}
