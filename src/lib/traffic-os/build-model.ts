import {
  ATTRIBUTION_COLUMNS,
  CAMPAIGN_FACT_COLUMNS,
  CAMPAIGN_MAP_COLUMNS,
  CHANNEL_FACT_COLUMNS,
  CRM_LEADS_COLUMNS,
  DAILY_FACT_COLUMNS,
  DATA_QUALITY_COLUMNS,
  LANDING_FACT_COLUMNS,
  LANDING_MAP_COLUMNS,
  MONTHLY_FACT_COLUMNS,
  ORGANIC_RAW_COLUMNS,
  README_COLUMNS,
  RECONCILIATION_COLUMNS,
  SETTINGS_COLUMNS,
  SOURCE_MAP_COLUMNS,
  TRAFFIC_OS_CONTRACT_VERSION,
  TRAFFIC_RAW_COLUMNS,
  getTrafficOsSpreadsheetId,
} from "@/config/traffic-os";
import { TRAFFIC_EXPORT_V3_CONTRACT_VERSION } from "@/lib/traffic-os/export-contract";
import { TRAFFIC_SALES_COVERAGE_COLUMNS, TRAFFIC_ALERTS_COLUMNS } from "@/config/traffic-management";
import {
  MARKETING_OS_CONTRACT_VERSION,
  TRAFFIC_HEALTH_WEIGHTS
} from "@/config/marketing-os";
import { buildMarketingControlLayer } from "@/lib/traffic-os/marketing-home";
import { buildTrafficManagementLayer } from "@/lib/traffic-os/management";
import { buildTrafficSalesAttributionLayer } from "@/lib/traffic-os/sales-attribution";
import { normalizeCountry, languageFromPath } from "@/lib/traffic-os/country-map";
import { buildLandingMapRows, resolveLeadLanding } from "@/lib/traffic-os/landing-map";
import {
  parseSvodDayTrafficRaw,
  parseSvodOrganicRaw,
  type SvodOrganicRawRow,
  type SvodTrafficRawRow
} from "@/lib/traffic-os/parse-svod-raw";
import {
  attributionQuality,
  buildCampaignMapRows,
  buildSourceMapRows,
  resolveTrafficType,
  type SourceMapRow
} from "@/lib/traffic-os/source-map";
import { bitrixSourceName, landingUrlFromSourceName } from "@/lib/traffic-os/taxonomy";
import {
  aov,
  campaignKey,
  dayOfIso,
  num,
  parseLandingUrl,
  pct,
  periodOfDay,
  qualityStatus,
  toMatrix,
  type RowMap
} from "@/lib/traffic-os/utils";

/** Baseline before Identity Layer sprint (2026-07-22 Foundation sync). */
export const IDENTITY_BASELINE = {
  unknown_pct: 67.25,
  landing_coverage_pct: 42.27,
  channel_coverage_pct: 32.75,
  country_coverage_pct: 43.99,
  language_coverage_pct: 0,
  deal_linkage_pct: 44.47,
  revenue_linkage_pct: 7.5,
  source_coverage_pct: 100,
  campaign_coverage_pct: 40.11,
  utm_pair_pct: 44.45
} as const;

export type TrafficOsBuildInput = {
  syncedAt: string;
  periods: string[];
  svodDaySheet: string[][];
  svodOrganicSheet: string[][];
  salesLeads: RowMap[];
  salesDeals: RowMap[];
  salesInvoices: RowMap[];
  salesPayments: RowMap[];
  foundationLeads?: RowMap[];
  foundationContacts?: RowMap[];
  existingSourceMap?: RowMap[];
  existingLandingMap?: RowMap[];
  existingCampaignMap?: RowMap[];
  contractorLandingUrls?: string[];
  previousAlerts?: RowMap[];
  previousTimeline?: RowMap[];
};

function inPeriods(day: string, periods: string[]): boolean {
  if (!periods.length) return true;
  return periods.includes(periodOfDay(day));
}

function foundationByLeadId(rows: RowMap[] | undefined): Map<string, RowMap> {
  const map = new Map<string, RowMap>();
  for (const row of rows || []) {
    const id = String(row.lead_id || "").trim();
    if (id) map.set(id, row);
  }
  return map;
}

export function buildTrafficOsModel(input: TrafficOsBuildInput) {
  const syncedAt = input.syncedAt;
  const foundation = foundationByLeadId(input.foundationLeads);

  const trafficRawAll = parseSvodDayTrafficRaw(input.svodDaySheet);
  const organicRawAll = parseSvodOrganicRaw(input.svodOrganicSheet);
  const trafficRaw = trafficRawAll.filter((row) => inPeriods(row.date, input.periods));
  const organicRaw = organicRawAll.filter((row) => inPeriods(row.date, input.periods));

  const trafficRawByDate = new Map(trafficRaw.map((row) => [row.date, row]));
  const organicRawByDate = new Map(organicRaw.map((row) => [row.date, row]));

  // --- CRM leads (raw) ---
  const crmLeads: Array<Record<string, string | number>> = [];
  const sourceIdSet = new Set<string>();
  const sourceLeadCounts = new Map<string, number>();
  const utmPairCounts = new Map<string, { utm_source: string; utm_medium: string; lead_count: number }>();
  const landingUrlEvidence: Array<{ url: string; evidence: string; form_name?: string }> = [];

  for (const lead of input.salesLeads) {
    const created = String(lead.created_at || "");
    const date = dayOfIso(created);
    if (!date || !inPeriods(date, input.periods)) continue;
    const leadId = String(lead.lead_id || "").trim();
    if (!leadId) continue;
    const raw = foundation.get(leadId);
    const sourceId = String(lead.source_id || "").trim();
    const sourceName = bitrixSourceName(sourceId);
    const sourceDescription = String(raw?.source_description || lead.source_description || "");
    const languageRaw = String(raw?.language_raw || lead.language_raw || "");
    const utmSource = String(lead.utm_source || "").trim();
    const utmMedium = String(lead.utm_medium || "").trim();
    const utmContent = String(lead.utm_content || "").trim();
    const utmCampaign = String(lead.utm_campaign || "").trim();
    const formName = String(lead.form_name || "").trim();
    const countryRaw = String(lead.country_raw || "").trim();
    const countryNorm = normalizeCountry(countryRaw);

    const landing = resolveLeadLanding({
      landingUrl: lead.landing_url,
      web: lead.web,
      sourceDescription,
      utmContent,
      utmCampaign,
      formName,
      sourceName
    });
    if (landing.landing_url) {
      landingUrlEvidence.push({
        url: landing.landing_url,
        evidence: landing.evidence,
        form_name: formName
      });
    }
    const fromName = landingUrlFromSourceName(sourceName);
    if (fromName) {
      landingUrlEvidence.push({ url: fromName, evidence: "bitrix_source_name", form_name: formName });
    }

    if (sourceId) {
      sourceIdSet.add(sourceId);
      sourceLeadCounts.set(sourceId, (sourceLeadCounts.get(sourceId) || 0) + 1);
    }
    if (utmSource || utmMedium) {
      const key = `${utmSource.toLowerCase()}|${utmMedium.toLowerCase()}`;
      const cur = utmPairCounts.get(key) || {
        utm_source: utmSource.toLowerCase(),
        utm_medium: utmMedium.toLowerCase(),
        lead_count: 0
      };
      cur.lead_count += 1;
      utmPairCounts.set(key, cur);
    }

    const parsedLanding = landing.landing_url ? parseLandingUrl(landing.landing_url) : null;
    const language = languageRaw || (parsedLanding ? languageFromPath(parsedLanding.path) : "") || "";

    crmLeads.push({
      lead_id: leadId,
      created_at: created,
      date,
      period: periodOfDay(date),
      status_id: lead.status_id || "",
      source_id: sourceId,
      source_name: sourceName,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: lead.utm_term || "",
      form_name: formName,
      country_raw: countryRaw,
      country_normalized: countryNorm.code,
      language_raw: languageRaw,
      language,
      landing_url: landing.landing_url,
      landing_id: landing.landing_id,
      domain: landing.domain,
      website: landing.website,
      source_description: sourceDescription,
      phone_present: lead.phone_present || "",
      email_present: lead.email_present || "",
      sync_updated_at: syncedAt
    });
  }

  for (const url of input.contractorLandingUrls || []) {
    landingUrlEvidence.push({ url, evidence: "contractor_sheet_title" });
  }

  const sourceMap = buildSourceMapRows({
    sourceIds: [...sourceIdSet],
    utmPairs: [...utmPairCounts.values()],
    sourceLeadCounts,
    existing: input.existingSourceMap,
    syncedAt
  });

  const landingMap = buildLandingMapRows({
    urls: landingUrlEvidence,
    existing: input.existingLandingMap,
    syncedAt
  });
  const landingById = new Map(landingMap.map((row) => [row.landing_id, row]));

  // Enrich CRM language/country from landing map when still empty
  for (const lead of crmLeads) {
    const land = landingById.get(String(lead.landing_id));
    if (!String(lead.language).trim() && land?.language) lead.language = land.language;
    if (!String(lead.country_normalized).trim() && land?.country) lead.country_normalized = land.country;
  }

  // --- Deal / invoice / payment indexes ---
  const dealsByLead = new Map<string, RowMap[]>();
  for (const deal of input.salesDeals) {
    const leadId = String(deal.lead_id || "").trim();
    if (!leadId) continue;
    const list = dealsByLead.get(leadId) || [];
    list.push(deal);
    dealsByLead.set(leadId, list);
  }

  const invoicesByDeal = new Map<string, number>();
  for (const inv of input.salesInvoices) {
    const dealId = String(inv.deal_id || "").trim();
    if (!dealId) continue;
    invoicesByDeal.set(dealId, (invoicesByDeal.get(dealId) || 0) + 1);
  }

  const paymentsByDeal = new Map<string, { count: number; revenue: number }>();
  for (const pay of input.salesPayments) {
    const dealId = String(pay.deal_id || "").trim();
    if (!dealId) continue;
    const cur = paymentsByDeal.get(dealId) || { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += num(pay.amount);
    paymentsByDeal.set(dealId, cur);
  }

  // --- Attribution (evidence join, first deal by created_at) ---
  const attributions: Array<Record<string, string | number>> = [];
  for (const lead of crmLeads) {
    const leadId = String(lead.lead_id);
    const resolved = resolveTrafficType({
      sourceId: String(lead.source_id),
      utmSource: String(lead.utm_source),
      utmMedium: String(lead.utm_medium),
      sourceMap
    });
    const campKey = campaignKey({
      utm_source: String(lead.utm_source),
      utm_medium: String(lead.utm_medium),
      utm_campaign: String(lead.utm_campaign)
    });
    const quality = attributionQuality({
      traffic_type: resolved.traffic_type,
      landing_id: String(lead.landing_id),
      campaign_key: campKey,
      source_id: String(lead.source_id),
      mapping_status: resolved.mapping_status
    });
    const deals = (dealsByLead.get(leadId) || []).slice().sort((a, b) =>
      String(a.created_at || "").localeCompare(String(b.created_at || ""))
    );
    const primary = deals[0];
    const dealId = primary ? String(primary.deal_id || "").trim() : "";
    let invoiceEvents = 0;
    let payments = 0;
    let paidRevenue = 0;
    // Sum ALL deals for the lead (same lead_id evidence — not invented)
    for (const deal of deals) {
      const id = String(deal.deal_id || "").trim();
      if (!id) continue;
      invoiceEvents += invoicesByDeal.get(id) || 0;
      const pay = paymentsByDeal.get(id);
      payments += pay?.count || 0;
      paidRevenue += pay?.revenue || 0;
    }

    attributions.push({
      lead_id: leadId,
      date: String(lead.date),
      traffic_type: resolved.traffic_type,
      channel: resolved.channel,
      source_group: resolved.source_group,
      source_id: String(lead.source_id),
      source_name: String(lead.source_name || resolved.source_name),
      utm_source: String(lead.utm_source),
      utm_medium: String(lead.utm_medium),
      utm_campaign: String(lead.utm_campaign),
      campaign_key: campKey,
      landing_id: String(lead.landing_id),
      domain: String(lead.domain),
      website: String(lead.website),
      form_name: String(lead.form_name),
      country_normalized: String(lead.country_normalized),
      language: String(lead.language),
      deal_id: dealId,
      deal_created_at: primary ? String(primary.created_at || "") : "",
      invoice_events: invoiceEvents,
      payments,
      paid_revenue: Number(paidRevenue.toFixed(2)),
      attribution_method: resolved.method,
      attribution_status: quality.status,
      attribution_confidence: quality.confidence,
      reason: quality.reason,
      mapping_status: resolved.mapping_status,
      sync_updated_at: syncedAt
    });
  }

  const campaignMap = buildCampaignMapRows({
    attributions: attributions.map((row) => ({
      utm_source: String(row.utm_source),
      utm_medium: String(row.utm_medium),
      utm_campaign: String(row.utm_campaign),
      traffic_type: String(row.traffic_type)
    })),
    existing: input.existingCampaignMap,
    syncedAt
  });

  // --- Facts ---
  type Agg = {
    leads: number;
    deals: number;
    invoices: number;
    payments: number;
    paid_revenue: number;
    unknown_leads: number;
  };
  const emptyAgg = (): Agg => ({
    leads: 0,
    deals: 0,
    invoices: 0,
    payments: 0,
    paid_revenue: 0,
    unknown_leads: 0
  });

  const landingFactMap = new Map<string, Agg & { domain: string }>();
  const channelFactMap = new Map<string, Agg & { traffic_type: string; channel: string }>();
  const campaignFactMap = new Map<
    string,
    Agg & {
      date: string;
      campaign_key: string;
      utm_source: string;
      utm_medium: string;
      utm_campaign: string;
      traffic_type: string;
    }
  >();
  const dailyFactMap = new Map<string, Agg>();

  for (const row of attributions) {
    const date = String(row.date);
    const hasDeal = String(row.deal_id || "").trim() ? 1 : 0;
    const invoices = num(row.invoice_events);
    const payments = num(row.payments);
    const revenue = num(row.paid_revenue);
    const unknown = String(row.traffic_type) === "unknown" ? 1 : 0;

    const landKey = `${date}|${row.landing_id}`;
    const land = landingFactMap.get(landKey) || { ...emptyAgg(), domain: String(row.domain) };
    land.leads += 1;
    land.deals += hasDeal;
    land.invoices += invoices;
    land.payments += payments;
    land.paid_revenue += revenue;
    landingFactMap.set(landKey, land);

    const chKey = `${date}|${row.traffic_type}|${row.channel}`;
    const ch =
      channelFactMap.get(chKey) ||
      ({
        ...emptyAgg(),
        traffic_type: String(row.traffic_type),
        channel: String(row.channel)
      } as Agg & { traffic_type: string; channel: string });
    ch.leads += 1;
    ch.deals += hasDeal;
    ch.invoices += invoices;
    ch.payments += payments;
    ch.paid_revenue += revenue;
    ch.unknown_leads += unknown;
    channelFactMap.set(chKey, ch);

    const campKey = `${date}|${row.campaign_key}`;
    const camp =
      campaignFactMap.get(campKey) ||
      ({
        ...emptyAgg(),
        date,
        campaign_key: String(row.campaign_key),
        utm_source: String(row.utm_source),
        utm_medium: String(row.utm_medium),
        utm_campaign: String(row.utm_campaign),
        traffic_type: String(row.traffic_type)
      } as Agg & {
        date: string;
        campaign_key: string;
        utm_source: string;
        utm_medium: string;
        utm_campaign: string;
        traffic_type: string;
      });
    camp.leads += 1;
    camp.deals += hasDeal;
    camp.invoices += invoices;
    camp.payments += payments;
    camp.paid_revenue += revenue;
    campaignFactMap.set(campKey, camp);

    const day = dailyFactMap.get(date) || emptyAgg();
    day.leads += 1;
    day.deals += hasDeal;
    day.invoices += invoices;
    day.payments += payments;
    day.paid_revenue += revenue;
    day.unknown_leads += unknown;
    dailyFactMap.set(date, day);
  }

  const landingFact = [...landingFactMap.entries()]
    .map(([key, agg]) => {
      const [date, landing_id] = key.split("|");
      return {
        date,
        landing_id,
        domain: agg.domain,
        leads: agg.leads,
        deals: agg.deals,
        invoices: agg.invoices,
        payments: agg.payments,
        paid_revenue: Number(agg.paid_revenue.toFixed(2)),
        lead_to_deal_cr: pct(agg.deals, agg.leads),
        deal_to_invoice_cr: pct(agg.invoices, agg.deals),
        invoice_to_payment_cr: pct(agg.payments, agg.invoices),
        lead_to_payment_cr: pct(agg.payments, agg.leads),
        aov: aov(agg.paid_revenue, agg.payments),
        sync_updated_at: syncedAt
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.landing_id.localeCompare(b.landing_id));

  const channelFact = [...channelFactMap.entries()]
    .map(([key, agg]) => {
      const date = key.split("|")[0];
      return {
        date,
        traffic_type: agg.traffic_type,
        channel: agg.channel,
        leads: agg.leads,
        deals: agg.deals,
        invoices: agg.invoices,
        payments: agg.payments,
        paid_revenue: Number(agg.paid_revenue.toFixed(2)),
        unknown_leads: agg.unknown_leads,
        lead_to_deal_cr: pct(agg.deals, agg.leads),
        deal_to_invoice_cr: pct(agg.invoices, agg.deals),
        invoice_to_payment_cr: pct(agg.payments, agg.invoices),
        lead_to_payment_cr: pct(agg.payments, agg.leads),
        aov: aov(agg.paid_revenue, agg.payments),
        sync_updated_at: syncedAt
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.traffic_type.localeCompare(b.traffic_type));

  const campaignFact = [...campaignFactMap.values()]
    .map((agg) => ({
      date: agg.date,
      campaign_key: agg.campaign_key,
      utm_source: agg.utm_source,
      utm_medium: agg.utm_medium,
      utm_campaign: agg.utm_campaign,
      traffic_type: agg.traffic_type,
      leads: agg.leads,
      deals: agg.deals,
      invoices: agg.invoices,
      payments: agg.payments,
      paid_revenue: Number(agg.paid_revenue.toFixed(2)),
      aov: aov(agg.paid_revenue, agg.payments),
      sync_updated_at: syncedAt
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.campaign_key.localeCompare(b.campaign_key));

  const dailyFact = [...dailyFactMap.entries()]
    .map(([date, agg]) => {
      const svodPaid = trafficRawByDate.get(date);
      const svodOrg = organicRawByDate.get(date);
      return {
        date,
        leads: agg.leads,
        deals: agg.deals,
        invoices: agg.invoices,
        payments: agg.payments,
        paid_revenue: Number(agg.paid_revenue.toFixed(2)),
        unknown_leads: agg.unknown_leads,
        svod_paid_leads_crm: svodPaid?.leads_crm ?? 0,
        svod_organic_leads_crm: svodOrg?.leads_crm ?? 0,
        svod_spend: svodPaid?.spend ?? 0,
        aov: aov(agg.paid_revenue, agg.payments),
        sync_updated_at: syncedAt
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const monthlyMap = new Map<string, (typeof dailyFact)[number]>();
  for (const row of dailyFact) {
    const month = periodOfDay(row.date);
    const cur = monthlyMap.get(month) || {
      date: month,
      leads: 0,
      deals: 0,
      invoices: 0,
      payments: 0,
      paid_revenue: 0,
      unknown_leads: 0,
      svod_paid_leads_crm: 0,
      svod_organic_leads_crm: 0,
      svod_spend: 0,
      aov: "",
      sync_updated_at: syncedAt
    };
    cur.leads += row.leads;
    cur.deals += row.deals;
    cur.invoices += row.invoices;
    cur.payments += row.payments;
    cur.paid_revenue = Number((Number(cur.paid_revenue) + Number(row.paid_revenue)).toFixed(2));
    cur.unknown_leads += row.unknown_leads;
    cur.svod_paid_leads_crm += Number(row.svod_paid_leads_crm);
    cur.svod_organic_leads_crm += Number(row.svod_organic_leads_crm);
    cur.svod_spend = Number((Number(cur.svod_spend) + Number(row.svod_spend)).toFixed(2));
    monthlyMap.set(month, cur);
  }
  const monthlyFact = [...monthlyMap.entries()]
    .map(([month, row]) => ({
      month,
      leads: row.leads,
      deals: row.deals,
      invoices: row.invoices,
      payments: row.payments,
      paid_revenue: row.paid_revenue,
      unknown_leads: row.unknown_leads,
      svod_paid_leads_crm: row.svod_paid_leads_crm,
      svod_organic_leads_crm: row.svod_organic_leads_crm,
      svod_spend: row.svod_spend,
      aov: aov(Number(row.paid_revenue), Number(row.payments)),
      sync_updated_at: syncedAt
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // --- Export grain kept for foundation facts; Management Layer builds traffic_export_v2 ---
  const exportMap = new Map<string, Agg & { traffic_type: string; channel: string; landing_id: string }>();
  for (const row of attributions) {
    const key = `${row.date}|${row.traffic_type}|${row.channel}|${row.landing_id}`;
    const cur =
      exportMap.get(key) ||
      ({
        ...emptyAgg(),
        traffic_type: String(row.traffic_type),
        channel: String(row.channel),
        landing_id: String(row.landing_id)
      } as Agg & { traffic_type: string; channel: string; landing_id: string });
    cur.leads += 1;
    cur.deals += String(row.deal_id || "").trim() ? 1 : 0;
    cur.invoices += num(row.invoice_events);
    cur.payments += num(row.payments);
    cur.paid_revenue += num(row.paid_revenue);
    cur.unknown_leads += String(row.traffic_type) === "unknown" ? 1 : 0;
    exportMap.set(key, cur);
  }

  const utmFill =
    crmLeads.length > 0
      ? (crmLeads.filter((r) => String(r.utm_source || "").trim() && String(r.utm_medium || "").trim()).length /
          crmLeads.length) *
        100
      : 0;
  const landingFill =
    crmLeads.length > 0
      ? (crmLeads.filter((r) => String(r.landing_id) !== "landing:unknown").length / crmLeads.length) * 100
      : 0;
  const dataQualityScore = Number(((utmFill * 0.5 + landingFill * 0.5) / 100).toFixed(4));

  // Legacy v1-shaped rows kept only for internal score continuity (not written)
  const exportRowsLegacy = [...exportMap.entries()].map(([key, agg]) => {
    const [date] = key.split("|");
    return {
      date,
      traffic_type: agg.traffic_type,
      channel: agg.channel,
      landing_id: agg.landing_id,
      leads: agg.leads,
      deals: agg.deals,
      invoice_events: agg.invoices,
      payments: agg.payments,
      paid_revenue: Number(agg.paid_revenue.toFixed(2)),
      average_check: aov(agg.paid_revenue, agg.payments),
      lead_to_deal_cr: pct(agg.deals, agg.leads),
      deal_to_invoice_cr: pct(agg.invoices, agg.deals),
      invoice_to_payment_cr: pct(agg.payments, agg.invoices),
      lead_to_payment_cr: pct(agg.payments, agg.leads),
      unknown_leads: agg.unknown_leads,
      data_quality_score: dataQualityScore,
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt,
      contract_version: "traffic_export_v1"
    };
  });
  void exportRowsLegacy;

  // --- Data quality ---
  const dqField = (
    field: string,
    filled: number,
    total: number,
    notes = "",
    entityType = "crm_lead"
  ): Record<string, string | number> => {
    const rate = total ? (filled / total) * 100 : 0;
    return {
      period: input.periods.join(",") || "all",
      entity_type: entityType,
      field_id: field,
      field_name: field,
      records_total: total,
      records_filled: filled,
      fill_rate_pct: Number(rate.toFixed(2)),
      quality_status: qualityStatus(rate),
      source_sheet: entityType === "baseline" ? "IDENTITY_BASELINE" : "07_CRM_Leads",
      notes,
      sync_updated_at: syncedAt
    };
  };
  const totalLeads = crmLeads.length;
  const unknownN = attributions.filter((r) => String(r.traffic_type) === "unknown").length;
  const knownChannelN = attributions.filter((r) => String(r.traffic_type) !== "unknown").length;
  const landingKnownN = crmLeads.filter((r) => String(r.landing_id) !== "landing:unknown").length;
  const countryN = crmLeads.filter((r) => String(r.country_normalized).trim()).length;
  const languageN = crmLeads.filter((r) => String(r.language).trim()).length;
  const campaignN = attributions.filter((r) => String(r.campaign_key) !== "campaign:unknown").length;
  const dealN = attributions.filter((r) => String(r.deal_id).trim()).length;
  const revN = attributions.filter((r) => num(r.paid_revenue) > 0).length;
  const utmPairN = crmLeads.filter(
    (r) => String(r.utm_source).trim() && String(r.utm_medium).trim()
  ).length;
  const fullyN = attributions.filter((r) => String(r.attribution_status) === "fully_attributed").length;
  const conflictN = attributions.filter((r) => String(r.attribution_status) === "conflict").length;
  const missingLandingN = attributions.filter((r) => String(r.attribution_status) === "landing_only" || String(r.landing_id) === "landing:unknown").length;

  const after = {
    unknown_pct: totalLeads ? (unknownN / totalLeads) * 100 : 0,
    landing_coverage_pct: totalLeads ? (landingKnownN / totalLeads) * 100 : 0,
    channel_coverage_pct: totalLeads ? (knownChannelN / totalLeads) * 100 : 0,
    country_coverage_pct: totalLeads ? (countryN / totalLeads) * 100 : 0,
    language_coverage_pct: totalLeads ? (languageN / totalLeads) * 100 : 0,
    deal_linkage_pct: totalLeads ? (dealN / totalLeads) * 100 : 0,
    revenue_linkage_pct: totalLeads ? (revN / totalLeads) * 100 : 0,
    source_coverage_pct: totalLeads
      ? (crmLeads.filter((r) => String(r.source_id).trim()).length / totalLeads) * 100
      : 0,
    campaign_coverage_pct: totalLeads ? (campaignN / totalLeads) * 100 : 0,
    utm_pair_pct: totalLeads ? (utmPairN / totalLeads) * 100 : 0
  };

  const compare = (id: string, before: number, afterValue: number) =>
    dqField(
      id,
      Number(afterValue.toFixed(2)),
      100,
      `before=${before.toFixed(2)} → after=${afterValue.toFixed(2)} (Δ ${(afterValue - before).toFixed(2)}pp)`,
      "identity_coverage"
    );

  const dataQuality = [
    dqField("utm_source", crmLeads.filter((r) => String(r.utm_source).trim()).length, totalLeads),
    dqField("utm_medium", crmLeads.filter((r) => String(r.utm_medium).trim()).length, totalLeads),
    dqField("utm_pair", utmPairN, totalLeads),
    dqField("landing_url", crmLeads.filter((r) => String(r.landing_url).trim()).length, totalLeads),
    dqField("landing_id_known", landingKnownN, totalLeads),
    dqField("source_id", crmLeads.filter((r) => String(r.source_id).trim()).length, totalLeads),
    dqField("source_name", crmLeads.filter((r) => String(r.source_name).trim()).length, totalLeads),
    dqField("channel_known", knownChannelN, totalLeads, "traffic_type != unknown"),
    dqField("campaign_known", campaignN, totalLeads),
    dqField("country_raw", crmLeads.filter((r) => String(r.country_raw).trim()).length, totalLeads),
    dqField("country_normalized", countryN, totalLeads),
    dqField("language_raw", crmLeads.filter((r) => String(r.language_raw).trim()).length, totalLeads),
    dqField("language", languageN, totalLeads, "from CRM or landing path"),
    dqField("deal_linked", dealN, totalLeads, "via 08_Attribution"),
    dqField("payment_linked", attributions.filter((r) => num(r.payments) > 0).length, totalLeads),
    dqField("revenue_linked", revN, totalLeads),
    dqField("unknown_traffic_type", unknownN, totalLeads, "honest unknown share"),
    dqField("fully_attributed", fullyN, totalLeads),
    dqField("conflicts", conflictN, totalLeads),
    dqField("missing_landing", missingLandingN, totalLeads),
    compare("coverage_unknown_pct", IDENTITY_BASELINE.unknown_pct, after.unknown_pct),
    compare("coverage_landing_pct", IDENTITY_BASELINE.landing_coverage_pct, after.landing_coverage_pct),
    compare("coverage_channel_pct", IDENTITY_BASELINE.channel_coverage_pct, after.channel_coverage_pct),
    compare("coverage_country_pct", IDENTITY_BASELINE.country_coverage_pct, after.country_coverage_pct),
    compare("coverage_language_pct", IDENTITY_BASELINE.language_coverage_pct, after.language_coverage_pct),
    compare("coverage_deal_pct", IDENTITY_BASELINE.deal_linkage_pct, after.deal_linkage_pct),
    compare("coverage_revenue_pct", IDENTITY_BASELINE.revenue_linkage_pct, after.revenue_linkage_pct),
    compare("coverage_source_pct", IDENTITY_BASELINE.source_coverage_pct, after.source_coverage_pct),
    compare("coverage_campaign_pct", IDENTITY_BASELINE.campaign_coverage_pct, after.campaign_coverage_pct),
    compare("coverage_utm_pair_pct", IDENTITY_BASELINE.utm_pair_pct, after.utm_pair_pct),
    ...Object.entries(IDENTITY_BASELINE).map(([key, value]) =>
      dqField(`baseline_${key}`, value, 100, "Foundation sync 2026-07-22 before Identity Layer", "baseline")
    )
  ];

  const identityCoverage = { before: IDENTITY_BASELINE, after };

  // --- Reconciliation vs Sales OS ---
  const salesLeadsInPeriod = input.salesLeads.filter((row) => {
    const d = dayOfIso(row.created_at || "");
    return d && inPeriods(d, input.periods);
  }).length;
  const salesDealsInPeriod = input.salesDeals.filter((row) => {
    const d = dayOfIso(row.created_at || "");
    return d && inPeriods(d, input.periods);
  }).length;
  const salesInvoicesInPeriod = input.salesInvoices.filter((row) => {
    const d = dayOfIso(row.invoice_at || "");
    return d && inPeriods(d, input.periods);
  }).length;
  const salesPaymentsInPeriod = input.salesPayments.filter((row) => {
    const d = dayOfIso(row.paid_at || "");
    return d && inPeriods(d, input.periods);
  });
  const salesRevenue = salesPaymentsInPeriod.reduce((sum, row) => sum + num(row.amount), 0);

  const trafficLeads = crmLeads.length;
  const trafficDeals = attributions.filter((r) => String(r.deal_id).trim()).length;
  const trafficInvoices = attributions.reduce((sum, r) => sum + num(r.invoice_events), 0);
  const trafficPayments = attributions.reduce((sum, r) => sum + num(r.payments), 0);
  const trafficRevenue = attributions.reduce((sum, r) => sum + num(r.paid_revenue), 0);

  const enrichment = buildTrafficSalesAttributionLayer({
    periods: input.periods,
    syncedAt,
    salesLeads: input.salesLeads,
    salesDeals: input.salesDeals,
    salesPayments: input.salesPayments,
    salesInvoices: input.salesInvoices,
    attributions,
    foundationContacts: input.foundationContacts
  });

  const management = buildTrafficManagementLayer({
    attributions,
    landingMap: landingMap.map((r) => ({
      landing_id: r.landing_id,
      landing_name: r.landing_name,
      domain: r.domain,
      path: r.path,
      country: r.country,
      language: r.language,
      product: r.product,
      offer: r.offer
    })),
    salesTotals: {
      period: input.periods.join(","),
      leads: salesLeadsInPeriod,
      deals: salesDealsInPeriod,
      invoice_events: salesInvoicesInPeriod,
      payments: salesPaymentsInPeriod.length,
      paid_revenue: salesRevenue
    },
    syncedAt,
    periods: input.periods
  });

  // Prefer payment-calendar enrichment for coverage amounts
  const enrichedAfter = enrichment.enrichmentCoverage.after;
  management.coverageSummary.attributed_paid_revenue = enrichedAfter.attributed_revenue;
  management.coverageSummary.total_sales_revenue = enrichedAfter.total_sales_revenue;
  management.coverageSummary.unattributed_revenue = enrichedAfter.unknown_revenue;
  management.coverageSummary.revenue_coverage_pct = enrichedAfter.revenue_amount_coverage_pct;
  management.coverageSummary.deal_linkage_pct = enrichedAfter.deal_linkage_pct;
  management.coverageSummary.payment_linkage_pct = enrichedAfter.payment_linkage_pct;
  management.coverageSummary.revenue_linkage_pct = enrichedAfter.revenue_linkage_pct;

  const salesCoverage = [...management.salesCoverage, ...enrichment.salesCoverageExtra];
  const exportRows = enrichment.exportRowsV3;

  const recon = (
    checkId: string,
    metric: string,
    trafficValue: number,
    salesValue: number,
    explanation: string,
    statusOverride?: string
  ) => {
    const delta = Number((trafficValue - salesValue).toFixed(2));
    const deltaPct = salesValue ? Number(((delta / salesValue) * 100).toFixed(2)) : "";
    return {
      check_id: checkId,
      period: input.periods.join(","),
      metric,
      traffic_os_value: trafficValue,
      sales_os_value: salesValue,
      delta,
      delta_pct: deltaPct,
      status: statusOverride || (Math.abs(delta) < 0.01 ? "match" : "delta"),
      explanation,
      sync_updated_at: syncedAt
    };
  };

  const reconciliation = [
    recon(
      "leads_count",
      "leads",
      trafficLeads,
      salesLeadsInPeriod,
      "Traffic 07_CRM_Leads from Sales 03_Leads filtered by created_at periods"
    ),
    recon(
      "deals_with_lead",
      "deals_linked_from_leads",
      trafficDeals,
      salesDealsInPeriod,
      "difference_reason=orphan_deal_without_lead|different_event_date; Traffic counts leads with ≥1 deal; Sales counts deals by deal.created_at",
      "different_grain"
    ),
    recon(
      "invoice_events",
      "invoice_events",
      trafficInvoices,
      salesInvoicesInPeriod,
      "difference_reason=different_event_date; Traffic attributes invoices via lead→deal join; Sales filters invoice_at by period",
      "different_grain"
    ),
    recon(
      "payments",
      "payments",
      trafficPayments,
      salesPaymentsInPeriod.length,
      "difference_reason=unlinked_payment|different_event_date; Traffic attributes payments via lead→deal",
      "different_grain"
    ),
    recon(
      "paid_revenue",
      "attributed_paid_revenue_vs_sales",
      Number(trafficRevenue.toFixed(2)),
      Number(salesRevenue.toFixed(2)),
      "difference_reason=unattributed_revenue; Traffic attributed-only; Sales calendar paid_at total",
      "low_coverage"
    ),
    recon(
      "svod_vs_crm_leads",
      "svod_paid_plus_organic_leads_crm",
      trafficRaw.reduce((s, r) => s + r.leads_crm, 0) + organicRaw.reduce((s, r) => s + r.leads_crm, 0),
      trafficLeads,
      "СВОД Лиды CRM (marketing) vs Bitrix CRM leads — expected conflict of definitions",
      "different_grain"
    ),
    recon(
      "unattributed_revenue",
      "unattributed_revenue",
      Number(management.coverageSummary.unattributed_revenue),
      Number(salesRevenue.toFixed(2)),
      "Sales revenue not linked to Traffic attribution",
      "orphan_sales_event"
    )
  ];

  const sourceOnlyN = attributions.filter((r) => String(r.attribution_status) === "source_only").length;
  const landingOnlyN = attributions.filter((r) => String(r.attribution_status) === "landing_only").length;
  const campaignOnlyN = attributions.filter((r) => String(r.attribution_status) === "campaign_only").length;
  const brokenMacroN = attributions.filter((r) => {
    const s = `${r.utm_source}|${r.utm_medium}`;
    return /\{\{|\}\}/.test(s);
  }).length;

  const managementDq = [
    dqField("traffic_type_coverage", knownChannelN, totalLeads, "traffic_type != unknown"),
    dqField("channel_coverage", knownChannelN, totalLeads),
    dqField("landing_coverage", landingKnownN, totalLeads),
    dqField("campaign_coverage", campaignN, totalLeads),
    dqField("country_coverage", countryN, totalLeads),
    dqField("language_coverage", languageN, totalLeads),
    dqField("utm_pair_coverage", utmPairN, totalLeads),
    dqField("deal_linkage", dealN, totalLeads),
    dqField("invoice_linkage", attributions.filter((r) => num(r.invoice_events) > 0).length, totalLeads),
    dqField("payment_linkage", attributions.filter((r) => num(r.payments) > 0).length, totalLeads),
    dqField("revenue_linkage", revN, totalLeads),
    dqField("fully_attributed_share", fullyN, totalLeads),
    dqField("source_only_share", sourceOnlyN, totalLeads),
    dqField("landing_only_share", landingOnlyN, totalLeads),
    dqField("campaign_only_share", campaignOnlyN, totalLeads),
    dqField("unknown_share", unknownN, totalLeads),
    dqField("conflict_share", conflictN, totalLeads),
    dqField("broken_macro_share", brokenMacroN, totalLeads),
    dqField(
      "management_previous_unknown",
      IDENTITY_BASELINE.unknown_pct,
      100,
      `previous=${IDENTITY_BASELINE.unknown_pct} → current=${after.unknown_pct.toFixed(2)}`,
      "management_delta"
    )
  ];

  dataQuality.push(...managementDq);

  const marketing = buildMarketingControlLayer({
    syncedAt,
    periods: input.periods,
    coverageSummary: management.coverageSummary,
    enrichmentCoverage: enrichment.enrichmentCoverage,
    identityCoverage,
    attributions,
    channelManagement: management.channelManagement,
    landingManagement: management.landingManagement,
    sourceMap,
    alerts: management.alerts,
    previousAlerts: input.previousAlerts,
    previousTimeline: input.previousTimeline
  });

  const readme = [
    {
      section: "purpose",
      content:
        "Traffic OS + Marketing Control Layer: open 30_Marketing_Home daily. RAW→Identity→Facts→Management(16–25)→Control(30–33)→99_EXPORT. No forecasts/CPL/ROAS. Mother not cut over."
    },
    {
      section: "spreadsheet_id",
      content: getTrafficOsSpreadsheetId()
    },
    {
      section: "contract",
      content: `${TRAFFIC_OS_CONTRACT_VERSION} / export ${TRAFFIC_EXPORT_V3_CONTRACT_VERSION} / management traffic_management_v1 / attribution_enrichment_v1 / ${MARKETING_OS_CONTRACT_VERSION}`
    },
    {
      section: "daily_home",
      content: "30_Marketing_Home — Traffic Health, Priorities, monitors. Detail: 31 Unknown, 32 DQ, 33 Timeline."
    },
    {
      section: "taxonomy",
      content:
        "paid|organic_social|organic_search|referral|direct|partner|messenger|email|offline|unknown|excluded"
    },
    {
      section: "rule",
      content: "Unmapped sources stay unknown. organic_total excludes messenger/email/offline/partner."
    },
    {
      section: "revenue",
      content: "attributed_paid_revenue only; total Sales revenue shown separately in 21_Traffic_Sales_Coverage"
    },
    {
      section: "mother",
      content: "Mother must not ingest Traffic 99_EXPORT as canon yet."
    }
  ];

  const settings = [
    { key: "contract_version", value: TRAFFIC_OS_CONTRACT_VERSION, notes: "", updated_at: syncedAt },
    {
      key: "export_contract_version",
      value: TRAFFIC_EXPORT_V3_CONTRACT_VERSION,
      notes: "Active 99_EXPORT",
      updated_at: syncedAt
    },
    {
      key: "management_contract_version",
      value: "traffic_management_v1",
      notes: "",
      updated_at: syncedAt
    },
    {
      key: "marketing_os_contract_version",
      value: MARKETING_OS_CONTRACT_VERSION,
      notes: "Control layer sheets 30–33",
      updated_at: syncedAt
    },
    { key: "periods", value: input.periods.join(","), notes: "last sync filter", updated_at: syncedAt },
    {
      key: "threshold_status",
      value: "default_not_approved",
      notes: "Management + health weights are system defaults",
      updated_at: syncedAt
    },
    {
      key: "health_weight_unknown",
      value: String(TRAFFIC_HEALTH_WEIGHTS.unknown),
      notes: "Traffic Health Score weight",
      updated_at: syncedAt
    },
    {
      key: "health_weight_channel_coverage",
      value: String(TRAFFIC_HEALTH_WEIGHTS.channel_coverage),
      notes: "Traffic Health Score weight",
      updated_at: syncedAt
    },
    {
      key: "health_weight_landing_coverage",
      value: String(TRAFFIC_HEALTH_WEIGHTS.landing_coverage),
      notes: "Traffic Health Score weight",
      updated_at: syncedAt
    },
    {
      key: "health_weight_revenue_coverage",
      value: String(TRAFFIC_HEALTH_WEIGHTS.revenue_coverage),
      notes: "Traffic Health Score weight",
      updated_at: syncedAt
    },
    {
      key: "health_weight_broken_utm",
      value: String(TRAFFIC_HEALTH_WEIGHTS.broken_utm),
      notes: "Traffic Health Score weight",
      updated_at: syncedAt
    },
    {
      key: "health_weight_freshness",
      value: String(TRAFFIC_HEALTH_WEIGHTS.freshness),
      notes: "Traffic Health Score weight",
      updated_at: syncedAt
    },
    {
      key: "sales_os_spreadsheet_id",
      value: "1Zj_jLoJzJx0zuzJK0ZJIFKaS5TTQR_WyctAevB1ARwY",
      notes: "CRM join source",
      updated_at: syncedAt
    },
    {
      key: "svod_spreadsheet_id",
      value: "1nItFm1eqBMVBJF1ZSBuBKZX-g03wx5v60l7h7Pqey4M",
      notes: "Marketing day/Органика",
      updated_at: syncedAt
    },
    { key: "last_sync_at", value: syncedAt, notes: "", updated_at: syncedAt }
  ];

  return {
    readme,
    settings,
    sourceMap,
    landingMap,
    campaignMap,
    trafficRaw: trafficRaw.map((row) => ({ ...row, sync_updated_at: syncedAt })),
    organicRaw: organicRaw.map((row) => ({ ...row, sync_updated_at: syncedAt })),
    crmLeads,
    attributions,
    landingFact,
    channelFact,
    campaignFact,
    dailyFact,
    monthlyFact,
    dataQuality,
    reconciliation,
    trafficManagement: management.trafficManagement,
    trafficTypeFact: management.trafficTypeFact,
    channelManagement: management.channelManagement,
    landingManagement: management.landingManagement,
    campaignManagement: management.campaignManagement,
    salesCoverage,
    alerts: marketing.marketingAlerts,
    joinQuality: enrichment.joinQuality,
    revenueAttribution: enrichment.revenueAttribution,
    attributionGaps: enrichment.attributionGaps,
    marketingHome: marketing.marketingHome,
    unknownCenter: marketing.unknownCenter,
    dataQualityCenter: marketing.dataQualityCenter,
    marketingTimeline: marketing.marketingTimeline,
    trafficHealth: marketing.trafficHealth,
    exportRows,
    coverageSummary: management.coverageSummary,
    matrices: {
      readme: toMatrix(README_COLUMNS, readme),
      settings: toMatrix(SETTINGS_COLUMNS, settings),
      sourceMap: toMatrix(SOURCE_MAP_COLUMNS, sourceMap),
      landingMap: toMatrix(LANDING_MAP_COLUMNS, landingMap),
      campaignMap: toMatrix(CAMPAIGN_MAP_COLUMNS, campaignMap),
      trafficRaw: toMatrix(
        TRAFFIC_RAW_COLUMNS,
        trafficRaw.map((row) => ({ ...row, sync_updated_at: syncedAt }))
      ),
      organicRaw: toMatrix(
        ORGANIC_RAW_COLUMNS,
        organicRaw.map((row) => ({ ...row, sync_updated_at: syncedAt }))
      ),
      crmLeads: toMatrix(CRM_LEADS_COLUMNS, crmLeads),
      attributions: toMatrix(ATTRIBUTION_COLUMNS, attributions),
      landingFact: toMatrix(LANDING_FACT_COLUMNS, landingFact),
      channelFact: toMatrix(CHANNEL_FACT_COLUMNS, channelFact),
      campaignFact: toMatrix(CAMPAIGN_FACT_COLUMNS, campaignFact),
      dailyFact: toMatrix(DAILY_FACT_COLUMNS, dailyFact),
      monthlyFact: toMatrix(MONTHLY_FACT_COLUMNS, monthlyFact),
      dataQuality: toMatrix(DATA_QUALITY_COLUMNS, dataQuality),
      reconciliation: toMatrix(RECONCILIATION_COLUMNS, reconciliation),
      trafficManagement: management.matrices.trafficManagement,
      trafficTypeFact: management.matrices.trafficTypeFact,
      channelManagement: management.matrices.channelManagement,
      landingManagement: management.matrices.landingManagement,
      campaignManagement: management.matrices.campaignManagement,
      salesCoverage: toMatrix(TRAFFIC_SALES_COVERAGE_COLUMNS, salesCoverage),
      alerts: toMatrix(TRAFFIC_ALERTS_COLUMNS, marketing.marketingAlerts),
      joinQuality: enrichment.matrices.joinQuality,
      revenueAttribution: enrichment.matrices.revenueAttribution,
      attributionGaps: enrichment.matrices.attributionGaps,
      marketingHome: marketing.matrices.marketingHome,
      unknownCenter: marketing.matrices.unknownCenter,
      dataQualityCenter: marketing.matrices.dataQualityCenter,
      marketingTimeline: marketing.matrices.marketingTimeline,
      exportRows: enrichment.matrices.exportRowsV3
    },
    stats: {
      trafficRaw: trafficRaw.length,
      organicRaw: organicRaw.length,
      crmLeads: crmLeads.length,
      attributions: attributions.length,
      sourceMap: sourceMap.length,
      landingMap: landingMap.length,
      campaignMap: campaignMap.length,
      landingFact: landingFact.length,
      channelFact: channelFact.length,
      campaignFact: campaignFact.length,
      dailyFact: dailyFact.length,
      monthlyFact: monthlyFact.length,
      dataQuality: dataQuality.length,
      reconciliation: reconciliation.length,
      trafficManagement: management.trafficManagement.length,
      trafficTypeFact: management.trafficTypeFact.length,
      channelManagement: management.channelManagement.length,
      landingManagement: management.landingManagement.length,
      campaignManagement: management.campaignManagement.length,
      salesCoverage: salesCoverage.length,
      alerts: marketing.marketingAlerts.length,
      joinQuality: enrichment.joinQuality.length,
      revenueAttribution: enrichment.revenueAttribution.length,
      attributionGaps: enrichment.attributionGaps.length,
      marketingHome: marketing.stats.marketingHome,
      unknownCenter: marketing.stats.unknownCenter,
      dataQualityCenter: marketing.stats.dataQualityCenter,
      marketingTimeline: marketing.stats.marketingTimeline,
      traffic_health_score: marketing.stats.traffic_health_score,
      exportRows: exportRows.length,
      unknownShare:
        attributions.length > 0
          ? attributions.filter((r) => String(r.traffic_type) === "unknown").length / attributions.length
          : 0,
      fullyAttributedShare:
        attributions.length > 0
          ? attributions.filter((r) => String(r.attribution_status) === "fully_attributed").length /
            attributions.length
          : 0
    },
    identityCoverage,
    enrichmentCoverage: enrichment.enrichmentCoverage
  };
}

export type TrafficOsModel = ReturnType<typeof buildTrafficOsModel>;
export type { SourceMapRow, SvodTrafficRawRow, SvodOrganicRawRow };
