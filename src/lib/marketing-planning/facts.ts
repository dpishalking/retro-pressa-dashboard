/**
 * Build Marketing Planning facts from Traffic OS + Sales OS + GA4 + СВОД.
 */

import { getSalesOsSpreadsheetId, SALES_OS_SHEETS } from "@/config/sales-os";
import { getTrafficOsSpreadsheetId, TRAFFIC_OS_SHEETS } from "@/config/traffic-os";
import { readSheetValues } from "@/lib/google/sheets-client";
import { pullSvodDailyLeads } from "@/lib/sales-os/svod-plans";
import { quoteTab } from "@/lib/sales-os/predictive-model";
import { formatCell, ratio } from "./types";

function asRows(values: string[][]): Array<Record<string, string>> {
  if (!values.length) return [];
  const header = values[0].map((c) => String(c || "").trim());
  return values.slice(1).map((raw) =>
    Object.fromEntries(header.map((k, i) => [k, String(raw[i] ?? "").trim()]))
  );
}

function num(raw: string | undefined): number {
  const n = Number(String(raw || "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export type DayTrafficAgg = {
  date: string;
  sessions: number | null;
  users: number | null;
  leads: number | null;
  deals: number | null;
  invoice_events: number | null;
  payments: number | null;
  paid_revenue: number | null;
  spend: number | null;
  paid_leads: number | null;
  organic_leads: number | null;
  unknown_leads: number | null;
  paid_payments: number | null;
  organic_payments: number | null;
  paid_revenue_attr: number | null;
  organic_revenue: number | null;
};

export type MarketingFactsBundle = {
  dailyByDate: Map<string, DayTrafficAgg>;
  channelRows: Array<Record<string, string>>;
  trafficTypeRows: Array<Record<string, string>>;
  landingRows: Array<Record<string, string>>;
  sourceMapRows: Array<Record<string, string>>;
  landingMapRows: Array<Record<string, string>>;
  salesDaily: Array<Record<string, string>>;
  warnings: string[];
};

export async function loadMarketingFacts(input: {
  month: string;
}): Promise<MarketingFactsBundle> {
  const warnings: string[] = [];
  const trafficId = getTrafficOsSpreadsheetId();
  const salesId = getSalesOsSpreadsheetId();
  const q = quoteTab;

  const [
    trafficDaily,
    channelFact,
    typeFact,
    landingFact,
    sourceMap,
    landingMap,
    ga4Channel,
    salesDailyValues
  ] = await Promise.all([
    readSheetValues({ spreadsheetId: trafficId, range: `${q(TRAFFIC_OS_SHEETS.dailyFact)}!A1:Z` }).catch(() => []),
    readSheetValues({ spreadsheetId: trafficId, range: `${q(TRAFFIC_OS_SHEETS.channelFact)}!A1:Z` }).catch(() => []),
    readSheetValues({ spreadsheetId: trafficId, range: `${q(TRAFFIC_OS_SHEETS.trafficTypeFact)}!A1:Z` }).catch(() => []),
    readSheetValues({ spreadsheetId: trafficId, range: `${q(TRAFFIC_OS_SHEETS.landingFact)}!A1:Z` }).catch(() => []),
    readSheetValues({ spreadsheetId: trafficId, range: `${q(TRAFFIC_OS_SHEETS.sourceMap)}!A1:Z` }).catch(() => []),
    readSheetValues({ spreadsheetId: trafficId, range: `${q(TRAFFIC_OS_SHEETS.landingMap)}!A1:Z` }).catch(() => []),
    readSheetValues({
      spreadsheetId: trafficId,
      range: `${q(TRAFFIC_OS_SHEETS.ga4ChannelDaily)}!A1:Z`
    }).catch(() => []),
    readSheetValues({ spreadsheetId: salesId, range: `${q(SALES_OS_SHEETS.dailyFact)}!A1:Z` }).catch(() => [])
  ]);

  const dailyRows = asRows(trafficDaily).filter((r) => String(r.date || "").startsWith(input.month));
  const salesDaily = asRows(salesDailyValues).filter((r) => String(r.date || "").startsWith(input.month));
  const ga4Rows = asRows(ga4Channel).filter((r) => String(r.date || "").startsWith(input.month));
  const typeRows = asRows(typeFact).filter((r) => String(r.date || "").startsWith(input.month));

  let svodLeads: Map<string, { paid: number; organic: number; total: number }> | null = null;
  try {
    svodLeads = await pullSvodDailyLeads({ month: input.month });
  } catch (error) {
    warnings.push(`СВОД daily leads: ${error instanceof Error ? error.message : String(error)}`);
  }

  const sessionsByDate = new Map<string, { sessions: number; users: number }>();
  for (const row of ga4Rows) {
    const d = String(row.date || "").slice(0, 10);
    const cur = sessionsByDate.get(d) || { sessions: 0, users: 0 };
    cur.sessions += num(row.sessions);
    cur.users += num(row.users);
    sessionsByDate.set(d, cur);
  }

  // Sales OS department totals by date (sum managers)
  const salesByDate = new Map<string, { deals: number; invoices: number; payments: number; revenue: number; leads: number }>();
  for (const row of salesDaily) {
    const d = String(row.date || "").slice(0, 10);
    const cur = salesByDate.get(d) || { deals: 0, invoices: 0, payments: 0, revenue: 0, leads: 0 };
    cur.deals += num(row.deals_created);
    cur.invoices += num(row.invoices);
    cur.payments += num(row.payments);
    cur.revenue += num(row.revenue);
    cur.leads += num(row.leads);
    salesByDate.set(d, cur);
  }

  const paidAttrByDate = new Map<string, { payments: number; revenue: number }>();
  const organicAttrByDate = new Map<string, { payments: number; revenue: number }>();
  for (const row of typeRows) {
    const d = String(row.date || "").slice(0, 10);
    const tt = String(row.traffic_type || "");
    const payments = num(row.payments);
    const revenue = num(row.attributed_paid_revenue);
    if (tt === "paid") {
      const cur = paidAttrByDate.get(d) || { payments: 0, revenue: 0 };
      cur.payments += payments;
      cur.revenue += revenue;
      paidAttrByDate.set(d, cur);
    } else if (tt.startsWith("organic") || tt === "referral" || tt === "direct" || tt === "partner" || tt === "messenger") {
      const cur = organicAttrByDate.get(d) || { payments: 0, revenue: 0 };
      cur.payments += payments;
      cur.revenue += revenue;
      organicAttrByDate.set(d, cur);
    }
  }

  const dates = new Set<string>([
    ...dailyRows.map((r) => String(r.date || "").slice(0, 10)),
    ...salesByDate.keys(),
    ...sessionsByDate.keys(),
    ...(svodLeads ? [...svodLeads.keys()] : [])
  ]);

  const dailyByDate = new Map<string, DayTrafficAgg>();
  for (const date of [...dates].sort()) {
    if (!date.startsWith(input.month)) continue;
    const t = dailyRows.find((r) => String(r.date || "").slice(0, 10) === date);
    const s = salesByDate.get(date);
    const ga = sessionsByDate.get(date);
    const sv = svodLeads?.get(date);
    const paidA = paidAttrByDate.get(date);
    const orgA = organicAttrByDate.get(date);

    const payments = s?.payments ?? (t ? num(t.payments) : null);
    const revenue = s?.revenue ?? (t ? num(t.paid_revenue) : null);
    const leads =
      sv?.total ??
      (t ? num(t.leads) : null) ??
      (s?.leads ?? null);

    const spendRaw = t?.svod_spend;
    const spend = spendRaw != null && String(spendRaw).trim() !== "" ? num(spendRaw) : null;

    dailyByDate.set(date, {
      date,
      sessions: ga ? ga.sessions : null,
      users: ga ? ga.users : null,
      leads,
      deals: s?.deals ?? (t ? num(t.deals) : null),
      invoice_events: s?.invoices ?? (t ? num(t.invoices) : null),
      payments,
      paid_revenue: revenue,
      spend,
      paid_leads: sv?.paid ?? (t ? num(t.svod_paid_leads_crm) : null),
      organic_leads: sv?.organic ?? (t ? num(t.svod_organic_leads_crm) : null),
      unknown_leads: t ? num(t.unknown_leads) : null,
      paid_payments: paidA?.payments ?? null,
      organic_payments: orgA?.payments ?? null,
      paid_revenue_attr: paidA?.revenue ?? null,
      organic_revenue: orgA?.revenue ?? null
    });
  }

  if (![...dailyByDate.values()].some((d) => d.sessions != null)) {
    warnings.push("GA4 sessions missing or empty for period");
  }
  if (![...dailyByDate.values()].some((d) => d.spend != null && d.spend > 0)) {
    warnings.push("spend FACT sparse/empty — CPL/CAC/ROAS blocked");
  }

  return {
    dailyByDate,
    channelRows: asRows(channelFact).filter((r) => String(r.date || "").startsWith(input.month)),
    trafficTypeRows: typeRows,
    landingRows: asRows(landingFact).filter((r) => String(r.date || "").startsWith(input.month)),
    sourceMapRows: asRows(sourceMap),
    landingMapRows: asRows(landingMap),
    salesDaily,
    warnings
  };
}

export function monthTotals(daily: Map<string, DayTrafficAgg>) {
  const acc = {
    sessions: 0,
    users: 0,
    leads: 0,
    deals: 0,
    invoice_events: 0,
    payments: 0,
    paid_revenue: 0,
    spend: 0,
    paid_leads: 0,
    organic_leads: 0,
    unknown_leads: 0,
    paid_payments: 0,
    organic_payments: 0,
    paid_revenue_attr: 0,
    organic_revenue: 0,
    hasSessions: false,
    hasSpend: false
  };
  for (const d of daily.values()) {
    if (d.sessions != null) {
      acc.sessions += d.sessions;
      acc.hasSessions = true;
    }
    if (d.users != null) acc.users += d.users;
    if (d.leads != null) acc.leads += d.leads;
    if (d.deals != null) acc.deals += d.deals;
    if (d.invoice_events != null) acc.invoice_events += d.invoice_events;
    if (d.payments != null) acc.payments += d.payments;
    if (d.paid_revenue != null) acc.paid_revenue += d.paid_revenue;
    if (d.spend != null) {
      acc.spend += d.spend;
      acc.hasSpend = true;
    }
    if (d.paid_leads != null) acc.paid_leads += d.paid_leads;
    if (d.organic_leads != null) acc.organic_leads += d.organic_leads;
    if (d.unknown_leads != null) acc.unknown_leads += d.unknown_leads;
    if (d.paid_payments != null) acc.paid_payments += d.paid_payments;
    if (d.organic_payments != null) acc.organic_payments += d.organic_payments;
    if (d.paid_revenue_attr != null) acc.paid_revenue_attr += d.paid_revenue_attr;
    if (d.organic_revenue != null) acc.organic_revenue += d.organic_revenue;
  }
  return {
    ...acc,
    sessions: acc.hasSessions ? acc.sessions : null,
    spend: acc.hasSpend ? acc.spend : null,
    average_check: ratio(acc.paid_revenue, acc.payments),
    session_to_lead_cr: ratio(acc.leads, acc.hasSessions ? acc.sessions : null),
    lead_to_deal_cr: ratio(acc.deals, acc.leads),
    deal_to_invoice_cr: ratio(acc.invoice_events, acc.deals),
    invoice_to_payment_cr: ratio(acc.payments, acc.invoice_events),
    lead_to_payment_cr: ratio(acc.payments, acc.leads),
    cpl: acc.hasSpend ? ratio(acc.spend, acc.paid_leads || acc.leads) : null,
    roas: acc.hasSpend && acc.spend > 0 ? ratio(acc.paid_revenue_attr || acc.paid_revenue, acc.spend) : null
  };
}

export function marketingDailyMatrix(
  daily: Map<string, DayTrafficAgg>,
  syncedAt: string
): string[][] {
  const header = [
    "date",
    "traffic_type",
    "sessions",
    "users",
    "clicks",
    "leads",
    "deals",
    "invoice_events",
    "payments",
    "paid_revenue",
    "spend",
    "average_check",
    "session_to_lead_cr",
    "lead_to_deal_cr",
    "deal_to_invoice_cr",
    "invoice_to_payment_cr",
    "lead_to_payment_cr",
    "cpl",
    "cac",
    "roas",
    "data_quality_status",
    "source_updated_at",
    "sync_updated_at"
  ];
  const rows: string[][] = [];
  for (const d of [...daily.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    const aov = ratio(d.paid_revenue, d.payments);
    const s2l = ratio(d.leads, d.sessions);
    const l2d = ratio(d.deals, d.leads);
    const d2i = ratio(d.invoice_events, d.deals);
    const i2p = ratio(d.payments, d.invoice_events);
    const l2p = ratio(d.payments, d.leads);
    const cpl = d.spend != null ? ratio(d.spend, d.paid_leads || d.leads) : null;
    const roas =
      d.spend != null && d.spend > 0
        ? ratio(d.paid_revenue_attr ?? d.paid_revenue, d.spend)
        : null;
    rows.push([
      d.date,
      "all",
      formatCell(d.sessions),
      formatCell(d.users),
      "",
      formatCell(d.leads),
      formatCell(d.deals),
      formatCell(d.invoice_events),
      formatCell(d.payments),
      formatCell(d.paid_revenue),
      formatCell(d.spend),
      formatCell(aov),
      formatCell(s2l),
      formatCell(l2d),
      formatCell(d2i),
      formatCell(i2p),
      formatCell(l2p),
      formatCell(cpl),
      "",
      formatCell(roas),
      d.spend == null ? "spend_missing" : "ok",
      "",
      syncedAt
    ]);
    // paid / organic lead rows (partial)
    if (d.paid_leads != null || d.paid_revenue_attr != null) {
      rows.push([
        d.date,
        "paid",
        "",
        "",
        "",
        formatCell(d.paid_leads),
        "",
        "",
        formatCell(d.paid_payments),
        formatCell(d.paid_revenue_attr),
        formatCell(d.spend),
        formatCell(ratio(d.paid_revenue_attr, d.paid_payments)),
        "",
        "",
        "",
        "",
        formatCell(ratio(d.paid_payments, d.paid_leads)),
        formatCell(d.spend != null ? ratio(d.spend, d.paid_leads) : null),
        "",
        formatCell(d.spend != null && d.spend > 0 ? ratio(d.paid_revenue_attr, d.spend) : null),
        "partial",
        "",
        syncedAt
      ]);
    }
    if (d.organic_leads != null || d.organic_revenue != null) {
      rows.push([
        d.date,
        "organic",
        "",
        "",
        "",
        formatCell(d.organic_leads),
        "",
        "",
        formatCell(d.organic_payments),
        formatCell(d.organic_revenue),
        "",
        formatCell(ratio(d.organic_revenue, d.organic_payments)),
        "",
        "",
        "",
        "",
        formatCell(ratio(d.organic_payments, d.organic_leads)),
        "",
        "",
        "",
        "partial",
        "",
        syncedAt
      ]);
    }
  }
  return [header, ...rows];
}
