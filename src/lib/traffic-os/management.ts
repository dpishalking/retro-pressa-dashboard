/**
 * Traffic Management Layer builders.
 * Aggregates from Attribution (lead cohort). No CPL/ROAS/forecast.
 */

import {
  CAMPAIGN_MANAGEMENT_COLUMNS,
  CHANNEL_MANAGEMENT_COLUMNS,
  LANDING_MANAGEMENT_COLUMNS,
  ORGANIC_TOTAL_TYPES,
  TRAFFIC_ALERTS_COLUMNS,
  TRAFFIC_MANAGEMENT_COLUMNS,
  TRAFFIC_MANAGEMENT_THRESHOLDS,
  TRAFFIC_SALES_COVERAGE_COLUMNS,
  TRAFFIC_TYPE_FACT_COLUMNS,
  type ManagementConfidence,
  type ManagementStatus
} from "@/config/traffic-management";
import {
  TRAFFIC_EXPORT_V2_COLUMNS,
  TRAFFIC_EXPORT_V2_CONTRACT_VERSION
} from "@/lib/traffic-os/export-contract";
import { aov, num, pct, periodOfDay, toMatrix } from "@/lib/traffic-os/utils";

export type AttributionRow = Record<string, string | number>;
export type LandingMapRow = {
  landing_id: string;
  landing_name?: string;
  domain?: string;
  path?: string;
  country?: string;
  language?: string;
  product?: string;
  offer?: string;
};

type Agg = {
  leads: number;
  deals: number;
  invoices: number;
  payments: number;
  revenue: number;
  attributed_leads: number;
  unknown_leads: number;
  fully: number;
  with_payment: number;
  with_revenue: number;
};

const emptyAgg = (): Agg => ({
  leads: 0,
  deals: 0,
  invoices: 0,
  payments: 0,
  revenue: 0,
  attributed_leads: 0,
  unknown_leads: 0,
  fully: 0,
  with_payment: 0,
  with_revenue: 0
});

function addLead(agg: Agg, row: AttributionRow) {
  const hasDeal = String(row.deal_id || "").trim() ? 1 : 0;
  const invoices = num(row.invoice_events);
  const payments = num(row.payments);
  const revenue = num(row.paid_revenue);
  const tt = String(row.traffic_type || "unknown");
  agg.leads += 1;
  agg.deals += hasDeal;
  agg.invoices += invoices;
  agg.payments += payments;
  agg.revenue += revenue;
  if (tt !== "unknown" && tt !== "excluded") agg.attributed_leads += 1;
  if (tt === "unknown") agg.unknown_leads += 1;
  if (String(row.attribution_status) === "fully_attributed") agg.fully += 1;
  if (payments > 0) agg.with_payment += 1;
  if (revenue > 0) agg.with_revenue += 1;
}

function share(part: number, total: number): string {
  return pct(part, total);
}

function coverageOf(agg: Agg): number {
  return agg.leads ? agg.attributed_leads / agg.leads : 0;
}

function paymentLinkage(agg: Agg): number {
  return agg.leads ? agg.with_payment / agg.leads : 0;
}

function revenueLinkage(agg: Agg): number {
  return agg.leads ? agg.with_revenue / agg.leads : 0;
}

function attributionCoverage(agg: Agg): number {
  return agg.leads ? agg.fully / agg.leads : 0;
}

export function classifyManagementStatus(input: {
  trafficType: string;
  sampleSize: number;
  coveragePct: number;
  attributionStatus?: string;
  landingCoveragePct?: number;
}): ManagementStatus {
  const t = TRAFFIC_MANAGEMENT_THRESHOLDS;
  if (input.attributionStatus === "conflict" || input.trafficType === "conflict") return "conflict";
  if (input.trafficType === "unknown") return "unknown";
  if (input.sampleSize < t.minimumSampleSize) return "low_sample";
  if (input.coveragePct < t.minimumChannelCoverage) return "low_coverage";
  if (
    input.landingCoveragePct != null &&
    input.landingCoveragePct < t.minimumLandingCoverage
  ) {
    return "limited";
  }
  if (input.coveragePct < 0.85 || input.sampleSize < t.minimumSampleSize * 2) return "limited";
  return "usable";
}

export function classifyAggregateConfidence(input: {
  fullyShare: number;
  knownShare: number;
  sampleSize: number;
  trafficType?: string;
}): ManagementConfidence {
  if (input.trafficType === "unknown" || input.sampleSize === 0) return "unknown";
  if (input.sampleSize < TRAFFIC_MANAGEMENT_THRESHOLDS.minimumSampleSize) return "low";
  if (input.fullyShare >= 0.5 && input.knownShare >= 0.9) return "high";
  if (input.knownShare >= 0.7) return "medium";
  if (input.knownShare > 0) return "low";
  return "unknown";
}

export function isoWeekKey(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function periodKeys(date: string): { day: string; week: string; month: string } {
  return {
    day: date,
    week: isoWeekKey(date),
    month: periodOfDay(date)
  };
}

export function isOrganicTotalType(trafficType: string): boolean {
  return (ORGANIC_TOTAL_TYPES as readonly string[]).includes(trafficType);
}

export function classifyUnknownReason(row: AttributionRow): string {
  const sourceId = String(row.source_id || "").trim();
  const sourceName = String(row.source_name || "").toLowerCase();
  const utmS = String(row.utm_source || "").trim().toLowerCase();
  const utmM = String(row.utm_medium || "").trim().toLowerCase();
  const landing = String(row.landing_id || "");
  const pair = `${utmS}|${utmM}`;

  if (/\{\{|\}\}/.test(pair) || utmM.includes("{{") || utmS.includes("{{")) return "broken_macro";
  if (
    (utmS === "instagram" || utmS === "ig") &&
    (utmM === "social" || utmM === "")
  ) {
    return "ambiguous_instagram_social";
  }
  if (!utmS && !utmM && (sourceId === "WEB" || sourceName.includes("website"))) return "bare_web";
  if (!utmS && !utmM) return "missing_utm";
  if (landing === "landing:unknown") return "missing_landing";
  if (!sourceId) return "unmapped_source";
  return "other";
}

function managementComment(status: ManagementStatus): string {
  if (status === "usable") return "Sample and coverage meet system defaults (default_not_approved)";
  if (status === "limited") return "Use with caution — coverage or sample limited; attributed-only metrics";
  if (status === "low_sample") return "Sample below minimumSampleSize — do not treat as strong conclusion";
  if (status === "low_coverage") return "Coverage below threshold — do not compare channels on revenue alone";
  if (status === "unknown") return "Honest unknown — not redistributed to paid/organic";
  if (status === "conflict") return "Conflicting mapping — review Source Map";
  return "";
}

export function buildTrafficManagementLayer(input: {
  attributions: AttributionRow[];
  landingMap: LandingMapRow[];
  salesTotals: {
    period: string;
    leads: number;
    deals: number;
    invoice_events: number;
    payments: number;
    paid_revenue: number;
  };
  syncedAt: string;
  periods: string[];
}) {
  const { attributions, landingMap, salesTotals, syncedAt } = input;
  const landingById = new Map(landingMap.map((r) => [r.landing_id, r]));
  const totalLeads = attributions.length;
  const totalDeals = attributions.filter((r) => String(r.deal_id || "").trim()).length;
  const totalPayments = attributions.reduce((s, r) => s + num(r.payments), 0);
  const totalRevenue = attributions.reduce((s, r) => s + num(r.paid_revenue), 0);
  const unknownN = attributions.filter((r) => String(r.traffic_type) === "unknown").length;
  const classifiedN = attributions.filter(
    (r) => !["unknown", "excluded"].includes(String(r.traffic_type))
  ).length;

  // --- 17 Traffic Type Fact (date × type) ---
  const typeDay = new Map<string, Agg & { date: string; traffic_type: string }>();
  const typeMonth = new Map<string, Agg & { month: string; traffic_type: string }>();
  const dayTotals = new Map<string, Agg>();
  const monthTotals = new Map<string, Agg>();

  for (const row of attributions) {
    const date = String(row.date);
    const month = periodOfDay(date);
    const tt = String(row.traffic_type || "unknown");
    const dayKey = `${date}|${tt}`;
    const monthKey = `${month}|${tt}`;
    const d =
      typeDay.get(dayKey) ||
      ({ ...emptyAgg(), date, traffic_type: tt } as Agg & { date: string; traffic_type: string });
    addLead(d, row);
    typeDay.set(dayKey, d);
    const m =
      typeMonth.get(monthKey) ||
      ({ ...emptyAgg(), month, traffic_type: tt } as Agg & { month: string; traffic_type: string });
    addLead(m, row);
    typeMonth.set(monthKey, m);

    const dt = dayTotals.get(date) || emptyAgg();
    addLead(dt, row);
    dayTotals.set(date, dt);
    const mt = monthTotals.get(month) || emptyAgg();
    addLead(mt, row);
    monthTotals.set(month, mt);
  }

  const trafficTypeFact = [...typeDay.values()]
    .map((agg) => {
      const dayTotal = dayTotals.get(agg.date) || emptyAgg();
      const knownShare = coverageOf(agg);
      const conf = classifyAggregateConfidence({
        fullyShare: attributionCoverage(agg),
        knownShare: agg.traffic_type === "unknown" ? 0 : 1,
        sampleSize: agg.leads,
        trafficType: agg.traffic_type
      });
      const dq =
        agg.traffic_type === "unknown"
          ? "unknown"
          : knownShare >= 0.9
            ? "good"
            : knownShare >= 0.7
              ? "acceptable"
              : "limited";
      return {
        date: agg.date,
        traffic_type: agg.traffic_type,
        leads: agg.leads,
        deals: agg.deals,
        invoice_events: agg.invoices,
        payments: agg.payments,
        attributed_paid_revenue: Number(agg.revenue.toFixed(2)),
        average_check: aov(agg.revenue, agg.payments),
        lead_to_deal_cr: pct(agg.deals, agg.leads),
        deal_to_invoice_cr: pct(agg.invoices, agg.deals),
        invoice_to_payment_cr: pct(agg.payments, agg.invoices),
        lead_to_payment_cr: pct(agg.payments, agg.leads),
        lead_share_pct: share(agg.leads, dayTotal.leads),
        deal_share_pct: share(agg.deals, dayTotal.deals),
        payment_share_pct: share(agg.payments, dayTotal.payments),
        revenue_share_pct: share(agg.revenue, dayTotal.revenue),
        attributed_leads: agg.attributed_leads,
        unknown_leads: agg.unknown_leads,
        coverage_pct: Number((knownShare * 100).toFixed(2)),
        confidence: conf,
        data_quality_status: dq,
        source_updated_at: syncedAt,
        sync_updated_at: syncedAt
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.traffic_type.localeCompare(b.traffic_type));

  // --- Channel / Landing / Campaign management ---
  type DimAgg = Agg & {
    channel?: string;
    traffic_type?: string;
    landing_id?: string;
    campaign_id?: string;
    domain?: string;
  };

  const channelMaps = {
    day: new Map<string, DimAgg>(),
    week: new Map<string, DimAgg>(),
    month: new Map<string, DimAgg>()
  };
  const landingMaps = {
    day: new Map<string, DimAgg>(),
    week: new Map<string, DimAgg>(),
    month: new Map<string, DimAgg>()
  };
  const campaignMaps = {
    day: new Map<string, DimAgg>(),
    week: new Map<string, DimAgg>(),
    month: new Map<string, DimAgg>()
  };
  const periodLeadTotals = {
    day: new Map<string, number>(),
    week: new Map<string, number>(),
    month: new Map<string, number>()
  };
  const periodRevenueTotals = {
    day: new Map<string, number>(),
    week: new Map<string, number>(),
    month: new Map<string, number>()
  };

  for (const row of attributions) {
    const date = String(row.date);
    const keys = periodKeys(date);
    const channel = String(row.channel || "Unknown");
    const tt = String(row.traffic_type || "unknown");
    const landingId = String(row.landing_id || "landing:unknown");
    const campaignId = String(row.campaign_key || "campaign:unknown");
    const domain = String(row.domain || "");

    for (const periodType of ["day", "week", "month"] as const) {
      const period = keys[periodType];
      if (!period) continue;
      periodLeadTotals[periodType].set(period, (periodLeadTotals[periodType].get(period) || 0) + 1);
      periodRevenueTotals[periodType].set(
        period,
        (periodRevenueTotals[periodType].get(period) || 0) + num(row.paid_revenue)
      );

      const chKey = `${period}|${channel}|${tt}`;
      const ch =
        channelMaps[periodType].get(chKey) ||
        ({ ...emptyAgg(), channel, traffic_type: tt } as DimAgg);
      addLead(ch, row);
      channelMaps[periodType].set(chKey, ch);

      const landKey = `${period}|${landingId}`;
      const land =
        landingMaps[periodType].get(landKey) ||
        ({ ...emptyAgg(), landing_id: landingId, domain } as DimAgg);
      addLead(land, row);
      if (!land.domain && domain) land.domain = domain;
      landingMaps[periodType].set(landKey, land);

      const campKey = `${period}|${campaignId}`;
      const camp =
        campaignMaps[periodType].get(campKey) ||
        ({
          ...emptyAgg(),
          campaign_id: campaignId,
          channel,
          traffic_type: tt
        } as DimAgg);
      addLead(camp, row);
      campaignMaps[periodType].set(campKey, camp);
    }
  }

  const channelManagement: Array<Record<string, string | number>> = [];
  for (const periodType of ["day", "week", "month"] as const) {
    for (const [key, agg] of channelMaps[periodType]) {
      const [period] = key.split("|");
      const periodLeads = periodLeadTotals[periodType].get(period) || 0;
      const periodRev = periodRevenueTotals[periodType].get(period) || 0;
      const cov = coverageOf(agg);
      const status = classifyManagementStatus({
        trafficType: String(agg.traffic_type),
        sampleSize: agg.leads,
        coveragePct: cov
      });
      const conf = classifyAggregateConfidence({
        fullyShare: attributionCoverage(agg),
        knownShare: cov,
        sampleSize: agg.leads,
        trafficType: String(agg.traffic_type)
      });
      channelManagement.push({
        period_type: periodType,
        period,
        channel_id: `channel:${String(agg.channel).toLowerCase().replace(/\s+/g, "_")}`,
        channel_name: String(agg.channel),
        traffic_type: String(agg.traffic_type),
        leads: agg.leads,
        deals: agg.deals,
        invoice_events: agg.invoices,
        payments: agg.payments,
        attributed_paid_revenue: Number(agg.revenue.toFixed(2)),
        average_check: aov(agg.revenue, agg.payments),
        lead_to_deal_cr: pct(agg.deals, agg.leads),
        deal_to_invoice_cr: pct(agg.invoices, agg.deals),
        invoice_to_payment_cr: pct(agg.payments, agg.invoices),
        lead_to_payment_cr: pct(agg.payments, agg.leads),
        lead_share_pct: share(agg.leads, periodLeads),
        revenue_share_pct: share(agg.revenue, periodRev),
        attribution_coverage_pct: Number((attributionCoverage(agg) * 100).toFixed(2)),
        payment_linkage_pct: Number((paymentLinkage(agg) * 100).toFixed(2)),
        revenue_linkage_pct: Number((revenueLinkage(agg) * 100).toFixed(2)),
        confidence: conf,
        sample_size: agg.leads,
        management_status: status,
        comment: `${managementComment(status)}; attributed_paid_revenue only; threshold_status=${TRAFFIC_MANAGEMENT_THRESHOLDS.threshold_status}`,
        source_updated_at: syncedAt,
        sync_updated_at: syncedAt
      });
    }
  }
  channelManagement.sort(
    (a, b) =>
      String(a.period_type).localeCompare(String(b.period_type)) ||
      String(a.period).localeCompare(String(b.period)) ||
      Number(b.leads) - Number(a.leads)
  );

  const globalLandingCoverage = totalLeads
    ? attributions.filter((r) => String(r.landing_id) !== "landing:unknown").length / totalLeads
    : 0;

  const landingManagement: Array<Record<string, string | number>> = [];
  for (const periodType of ["day", "week", "month"] as const) {
    for (const [key, agg] of landingMaps[periodType]) {
      const [period] = key.split("|");
      const landingId = String(agg.landing_id);
      const meta = landingById.get(landingId);
      const periodLeads = periodLeadTotals[periodType].get(period) || 0;
      const periodRev = periodRevenueTotals[periodType].get(period) || 0;
      const status = classifyManagementStatus({
        trafficType: landingId === "landing:unknown" ? "unknown" : "classified",
        sampleSize: agg.leads,
        coveragePct: globalLandingCoverage,
        landingCoveragePct: globalLandingCoverage
      });
      const conf = classifyAggregateConfidence({
        fullyShare: attributionCoverage(agg),
        knownShare: landingId === "landing:unknown" ? 0 : 1,
        sampleSize: agg.leads,
        trafficType: landingId === "landing:unknown" ? "unknown" : "classified"
      });
      landingManagement.push({
        period_type: periodType,
        period,
        landing_id: landingId,
        landing_name: meta?.landing_name || landingId,
        domain: meta?.domain || String(agg.domain || ""),
        path: meta?.path || "",
        country: meta?.country || "",
        language: meta?.language || "",
        product: meta?.product || "",
        offer: meta?.offer || "",
        leads: agg.leads,
        deals: agg.deals,
        invoice_events: agg.invoices,
        payments: agg.payments,
        attributed_paid_revenue: Number(agg.revenue.toFixed(2)),
        average_check: aov(agg.revenue, agg.payments),
        lead_to_deal_cr: pct(agg.deals, agg.leads),
        deal_to_payment_cr: pct(agg.payments, agg.deals),
        lead_to_payment_cr: pct(agg.payments, agg.leads),
        lead_share_pct: share(agg.leads, periodLeads),
        revenue_share_pct: share(agg.revenue, periodRev),
        landing_coverage_pct: Number((globalLandingCoverage * 100).toFixed(2)),
        attribution_coverage_pct: Number((attributionCoverage(agg) * 100).toFixed(2)),
        confidence: conf,
        sample_size: agg.leads,
        management_status: status,
        comment: `${managementComment(status)}; attributed-only CRs`,
        source_updated_at: syncedAt,
        sync_updated_at: syncedAt
      });
    }
  }
  landingManagement.sort(
    (a, b) =>
      String(a.period_type).localeCompare(String(b.period_type)) ||
      String(a.period).localeCompare(String(b.period)) ||
      Number(b.leads) - Number(a.leads)
  );

  const globalCampaignCoverage = totalLeads
    ? attributions.filter((r) => String(r.campaign_key) !== "campaign:unknown").length / totalLeads
    : 0;

  const campaignManagement: Array<Record<string, string | number>> = [];
  for (const periodType of ["day", "week", "month"] as const) {
    for (const [key, agg] of campaignMaps[periodType]) {
      const [period] = key.split("|");
      const campaignId = String(agg.campaign_id || "campaign:unknown");
      const status = classifyManagementStatus({
        trafficType: String(agg.traffic_type || "unknown"),
        sampleSize: agg.leads,
        coveragePct: globalCampaignCoverage
      });
      const conf = classifyAggregateConfidence({
        fullyShare: attributionCoverage(agg),
        knownShare: campaignId === "campaign:unknown" ? 0 : coverageOf(agg),
        sampleSize: agg.leads,
        trafficType: String(agg.traffic_type)
      });
      campaignManagement.push({
        period_type: periodType,
        period,
        campaign_id: campaignId,
        campaign_name: campaignId.replace(/^campaign:/, ""),
        channel_id: `channel:${String(agg.channel || "Unknown").toLowerCase().replace(/\s+/g, "_")}`,
        traffic_type: String(agg.traffic_type || "unknown"),
        leads: agg.leads,
        deals: agg.deals,
        invoice_events: agg.invoices,
        payments: agg.payments,
        attributed_paid_revenue: Number(agg.revenue.toFixed(2)),
        average_check: aov(agg.revenue, agg.payments),
        lead_to_deal_cr: pct(agg.deals, agg.leads),
        deal_to_payment_cr: pct(agg.payments, agg.deals),
        lead_to_payment_cr: pct(agg.payments, agg.leads),
        campaign_coverage_pct: Number((globalCampaignCoverage * 100).toFixed(2)),
        attribution_coverage_pct: Number((attributionCoverage(agg) * 100).toFixed(2)),
        confidence: conf,
        sample_size: agg.leads,
        management_status: status,
        comment: `${managementComment(status)}; no cost metrics`,
        source_updated_at: syncedAt,
        sync_updated_at: syncedAt
      });
    }
  }
  campaignManagement.sort(
    (a, b) =>
      String(a.period_type).localeCompare(String(b.period_type)) ||
      String(a.period).localeCompare(String(b.period)) ||
      Number(b.leads) - Number(a.leads)
  );

  // --- Sales coverage ---
  const coveredRevenue = totalRevenue;
  const salesRevenue = salesTotals.paid_revenue;
  const uncoveredRevenue = Math.max(0, salesRevenue - coveredRevenue);
  const covPct = (covered: number, sales: number) =>
    sales > 0 ? Number(((covered / sales) * 100).toFixed(2)) : "";

  const coverageStatus = (pctValue: number | string): string => {
    if (pctValue === "") return "pending_definition";
    const v = Number(pctValue);
    if (v >= 95) return "matched";
    if (v >= 50) return "partial_coverage";
    if (v > 0) return "low_coverage";
    return "orphan_sales_event";
  };

  const salesCoverage = [
    {
      period: salesTotals.period,
      metric_id: "leads",
      traffic_os_value: totalLeads,
      sales_os_value: salesTotals.leads,
      covered_value: totalLeads,
      uncovered_value: Math.max(0, salesTotals.leads - totalLeads),
      coverage_pct: covPct(totalLeads, salesTotals.leads),
      status: coverageStatus(covPct(totalLeads, salesTotals.leads)),
      difference_reason: "same CRM lead filter by created_at — expect match",
      definition_status: "confirmed",
      source_updated_at: syncedAt,
      checked_at: syncedAt
    },
    {
      period: salesTotals.period,
      metric_id: "deals",
      traffic_os_value: totalDeals,
      sales_os_value: salesTotals.deals,
      covered_value: totalDeals,
      uncovered_value: Math.max(0, salesTotals.deals - totalDeals),
      coverage_pct: covPct(totalDeals, salesTotals.deals),
      status: "different_grain",
      difference_reason: "orphan_deal_without_lead_or_different_event_date",
      definition_status: "confirmed",
      source_updated_at: syncedAt,
      checked_at: syncedAt
    },
    {
      period: salesTotals.period,
      metric_id: "invoice_events",
      traffic_os_value: attributions.reduce((s, r) => s + num(r.invoice_events), 0),
      sales_os_value: salesTotals.invoice_events,
      covered_value: attributions.reduce((s, r) => s + num(r.invoice_events), 0),
      uncovered_value: Math.max(
        0,
        salesTotals.invoice_events - attributions.reduce((s, r) => s + num(r.invoice_events), 0)
      ),
      coverage_pct: covPct(
        attributions.reduce((s, r) => s + num(r.invoice_events), 0),
        salesTotals.invoice_events
      ),
      status: "different_grain",
      difference_reason: "different_event_date",
      definition_status: "confirmed",
      source_updated_at: syncedAt,
      checked_at: syncedAt
    },
    {
      period: salesTotals.period,
      metric_id: "payments",
      traffic_os_value: totalPayments,
      sales_os_value: salesTotals.payments,
      covered_value: totalPayments,
      uncovered_value: Math.max(0, salesTotals.payments - totalPayments),
      coverage_pct: covPct(totalPayments, salesTotals.payments),
      status: coverageStatus(covPct(totalPayments, salesTotals.payments)),
      difference_reason: "unlinked_payment",
      definition_status: "confirmed",
      source_updated_at: syncedAt,
      checked_at: syncedAt
    },
    {
      period: salesTotals.period,
      metric_id: "paid_revenue",
      traffic_os_value: Number(coveredRevenue.toFixed(2)),
      sales_os_value: Number(salesRevenue.toFixed(2)),
      covered_value: Number(coveredRevenue.toFixed(2)),
      uncovered_value: Number(uncoveredRevenue.toFixed(2)),
      coverage_pct: covPct(coveredRevenue, salesRevenue),
      status: coverageStatus(covPct(coveredRevenue, salesRevenue)),
      difference_reason: "unattributed_revenue_orphan_or_date_grain",
      definition_status: "confirmed",
      source_updated_at: syncedAt,
      checked_at: syncedAt
    }
  ];

  // --- Alerts ---
  const t = TRAFFIC_MANAGEMENT_THRESHOLDS;
  const unknownShare = totalLeads ? unknownN / totalLeads : 0;
  const alerts: Array<Record<string, string | number>> = [];
  const pushAlert = (
    alertType: string,
    severity: string,
    metricId: string,
    actual: number,
    threshold: number,
    message: string,
    action: string,
    entity: { type?: string; id?: string; name?: string } = {}
  ) => {
    alerts.push({
      alert_id: `${alertType}:${metricId}:${salesTotals.period}`,
      alert_date: syncedAt.slice(0, 10),
      alert_type: alertType,
      severity,
      entity_type: entity.type || "traffic_os",
      entity_id: entity.id || "workbook",
      entity_name: entity.name || "Traffic OS",
      metric_id: metricId,
      actual_value: Number(actual.toFixed(4)),
      threshold,
      status: "open",
      message,
      recommended_action: action,
      owner: "marketing_ops",
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt
    });
  };

  if (unknownShare >= t.unknownCriticalThreshold) {
    pushAlert(
      "unknown_share_high",
      "critical",
      "unknown_share",
      unknownShare,
      t.unknownCriticalThreshold,
      `Unknown traffic_type share ${(unknownShare * 100).toFixed(1)}% ≥ critical threshold`,
      "исправить UTM; оставить unknown до появления evidence"
    );
  } else if (unknownShare >= t.unknownWarningThreshold) {
    pushAlert(
      "unknown_share_high",
      "warning",
      "unknown_share",
      unknownShare,
      t.unknownWarningThreshold,
      `Unknown traffic_type share ${(unknownShare * 100).toFixed(1)}% ≥ warning threshold`,
      "проверить mapping; исправить UTM"
    );
  }

  if (globalLandingCoverage < t.minimumLandingCoverage) {
    pushAlert(
      "landing_coverage_low",
      "warning",
      "landing_coverage",
      globalLandingCoverage,
      t.minimumLandingCoverage,
      `Landing coverage ${(globalLandingCoverage * 100).toFixed(1)}% below default`,
      "добавить landing; проверить форму"
    );
  }

  const channelCoverage = totalLeads ? classifiedN / totalLeads : 0;
  if (channelCoverage < t.minimumChannelCoverage) {
    pushAlert(
      "channel_coverage_low",
      "warning",
      "channel_coverage",
      channelCoverage,
      t.minimumChannelCoverage,
      `Channel coverage ${(channelCoverage * 100).toFixed(1)}% below default`,
      "проверить mapping"
    );
  }

  const utmPair =
    totalLeads === 0
      ? 0
      : attributions.filter(
          (r) => String(r.utm_source || "").trim() && String(r.utm_medium || "").trim()
        ).length / totalLeads;
  if (utmPair < 0.5) {
    pushAlert(
      "utm_coverage_low",
      "warning",
      "utm_pair",
      utmPair,
      0.5,
      `UTM pair coverage ${(utmPair * 100).toFixed(1)}%`,
      "исправить UTM"
    );
  }

  if (globalCampaignCoverage < 0.4) {
    pushAlert(
      "campaign_coverage_low",
      "info",
      "campaign_coverage",
      globalCampaignCoverage,
      0.4,
      `Campaign coverage ${(globalCampaignCoverage * 100).toFixed(1)}%`,
      "исправить UTM"
    );
  }

  const payLink = totalLeads ? attributions.filter((r) => num(r.payments) > 0).length / totalLeads : 0;
  if (payLink < t.minimumPaymentLinkage) {
    pushAlert(
      "payment_linkage_low",
      "critical",
      "payment_linkage",
      payLink,
      t.minimumPaymentLinkage,
      `Payment linkage ${(payLink * 100).toFixed(1)}% — attributed revenue not decision-grade`,
      "проверить CRM связь"
    );
  }

  const revLink = totalLeads ? attributions.filter((r) => num(r.paid_revenue) > 0).length / totalLeads : 0;
  if (revLink < t.minimumRevenueLinkage) {
    pushAlert(
      "revenue_linkage_low",
      "critical",
      "revenue_linkage",
      revLink,
      t.minimumRevenueLinkage,
      `Revenue linkage ${(revLink * 100).toFixed(1)}%`,
      "проверить CRM связь"
    );
  }

  const brokenMacro = attributions.filter((r) => classifyUnknownReason(r) === "broken_macro").length;
  if (brokenMacro > 0) {
    pushAlert(
      "broken_macro",
      "warning",
      "broken_macro_leads",
      brokenMacro,
      0,
      `${brokenMacro} leads with broken UTM macros`,
      "исправить broken macro"
    );
  }

  const missingLanding = attributions.filter((r) => String(r.landing_id) === "landing:unknown").length;
  if (missingLanding > totalLeads * 0.4) {
    pushAlert(
      "missing_landing",
      "warning",
      "missing_landing",
      missingLanding / Math.max(totalLeads, 1),
      0.4,
      `Missing landing on ${missingLanding} leads`,
      "добавить landing"
    );
  }

  const conflictN = attributions.filter((r) => String(r.attribution_status) === "conflict").length;
  if (conflictN > 0) {
    pushAlert(
      "conflicting_mapping",
      "warning",
      "conflict",
      conflictN,
      0,
      `${conflictN} conflict attributions`,
      "проверить mapping"
    );
  }

  // --- Export v2 ---
  const exportMap = new Map<
    string,
    Agg & { traffic_type: string; channel: string; landing_id: string; campaign_id: string }
  >();
  for (const row of attributions) {
    const campaignId = String(row.campaign_key || "campaign:unknown");
    const key = `${row.date}|${row.traffic_type}|${row.channel}|${row.landing_id}|${campaignId}`;
    const cur =
      exportMap.get(key) ||
      ({
        ...emptyAgg(),
        traffic_type: String(row.traffic_type),
        channel: String(row.channel),
        landing_id: String(row.landing_id),
        campaign_id: campaignId
      } as Agg & {
        traffic_type: string;
        channel: string;
        landing_id: string;
        campaign_id: string;
      });
    addLead(cur, row);
    exportMap.set(key, cur);
  }

  const dataQualityScore = Number(
    (
      (channelCoverage * 0.4 + globalLandingCoverage * 0.3 + (1 - unknownShare) * 0.3)
    ).toFixed(4)
  );

  const exportRows = [...exportMap.entries()]
    .map(([key, agg]) => {
      const [date] = key.split("|");
      const conf = classifyAggregateConfidence({
        fullyShare: attributionCoverage(agg),
        knownShare: coverageOf(agg),
        sampleSize: agg.leads,
        trafficType: agg.traffic_type
      });
      return {
        date,
        traffic_type: agg.traffic_type,
        channel_id: `channel:${agg.channel.toLowerCase().replace(/\s+/g, "_")}`,
        landing_id: agg.landing_id,
        campaign_id: agg.campaign_id,
        leads: agg.leads,
        deals: agg.deals,
        invoice_events: agg.invoices,
        payments: agg.payments,
        attributed_paid_revenue: Number(agg.revenue.toFixed(2)),
        average_check: aov(agg.revenue, agg.payments),
        lead_to_deal_cr: pct(agg.deals, agg.leads),
        deal_to_invoice_cr: pct(agg.invoices, agg.deals),
        invoice_to_payment_cr: pct(agg.payments, agg.invoices),
        lead_to_payment_cr: pct(agg.payments, agg.leads),
        unknown_leads: agg.unknown_leads,
        attribution_coverage_pct: Number((attributionCoverage(agg) * 100).toFixed(2)),
        payment_linkage_pct: Number((paymentLinkage(agg) * 100).toFixed(2)),
        revenue_linkage_pct: Number((revenueLinkage(agg) * 100).toFixed(2)),
        confidence: conf,
        data_quality_score: dataQualityScore,
        source_updated_at: syncedAt,
        sync_updated_at: syncedAt,
        contract_version: TRAFFIC_EXPORT_V2_CONTRACT_VERSION
      };
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.traffic_type.localeCompare(b.traffic_type) ||
        a.landing_id.localeCompare(b.landing_id)
    );

  // --- 16 Traffic Management summary ---
  const month = salesTotals.period.includes(",")
    ? salesTotals.period.split(",")[0]
    : salesTotals.period || "all";
  const trafficManagement: Array<Record<string, string | number>> = [];

  const pushSummary = (
    summaryBlock: string,
    itemId: string,
    itemName: string,
    metricId: string,
    metricName: string,
    value: number | string,
    opts: {
      share?: string;
      coverage?: number | string;
      confidence?: string;
      status?: string;
      comment?: string;
      comparison?: number | string;
      delta?: number | string;
      deltaPct?: number | string;
      forMonth?: string;
    } = {}
  ) => {
    trafficManagement.push({
      month: opts.forMonth || month,
      summary_block: summaryBlock,
      item_id: itemId,
      item_name: itemName,
      metric_id: metricId,
      metric_name: metricName,
      value,
      share_pct: opts.share ?? "",
      coverage_pct: opts.coverage ?? "",
      confidence: opts.confidence ?? "medium",
      status: opts.status ?? "info",
      comparison_value: opts.comparison ?? "",
      delta: opts.delta ?? "",
      delta_pct: opts.deltaPct ?? "",
      comment: opts.comment ?? "",
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt
    });
  };

  // Overview (all periods rollup)
  pushSummary("traffic_overview", "total", "Total leads", "leads", "Leads", totalLeads, {
    coverage: Number((channelCoverage * 100).toFixed(2)),
    confidence: "medium",
    status: "info",
    comment: "CRM leads in sync periods",
    forMonth: salesTotals.period
  });
  pushSummary(
    "traffic_overview",
    "classified",
    "Classified leads",
    "classified_leads",
    "Classified leads",
    classifiedN,
    {
      share: share(classifiedN, totalLeads),
      coverage: Number((channelCoverage * 100).toFixed(2)),
      forMonth: salesTotals.period
    }
  );
  pushSummary("traffic_overview", "unknown", "Unknown leads", "unknown_leads", "Unknown leads", unknownN, {
    share: share(unknownN, totalLeads),
    coverage: Number(((1 - unknownShare) * 100).toFixed(2)),
    confidence: "unknown",
    status: unknownShare >= t.unknownWarningThreshold ? "warning" : "info",
    forMonth: salesTotals.period
  });
  pushSummary(
    "traffic_overview",
    "unknown_share",
    "Unknown share",
    "unknown_share_pct",
    "Unknown share %",
    Number((unknownShare * 100).toFixed(2)),
    {
      confidence: "medium",
      status: unknownShare >= t.unknownCriticalThreshold ? "critical" : "info",
      forMonth: salesTotals.period
    }
  );
  pushSummary("traffic_overview", "deals", "Linked deals", "deals", "Deals (lead cohort)", totalDeals, {
    coverage: Number(((totalDeals / Math.max(salesTotals.deals, 1)) * 100).toFixed(2)),
    comment: "attributed-only vs Sales deal calendar",
    forMonth: salesTotals.period
  });
  pushSummary(
    "traffic_overview",
    "payments",
    "Linked payments",
    "payments",
    "Payments (attributed)",
    totalPayments,
    {
      coverage: Number(((totalPayments / Math.max(salesTotals.payments, 1)) * 100).toFixed(2)),
      forMonth: salesTotals.period
    }
  );
  pushSummary(
    "traffic_overview",
    "attributed_revenue",
    "Attributed paid revenue",
    "attributed_paid_revenue",
    "Attributed paid revenue",
    Number(totalRevenue.toFixed(2)),
    {
      coverage: covPct(totalRevenue, salesRevenue),
      comparison: Number(salesRevenue.toFixed(2)),
      comment: `NOT total sales revenue; Sales total=${salesRevenue.toFixed(2)}; unattributed=${uncoveredRevenue.toFixed(2)}`,
      confidence: revLink < t.minimumRevenueLinkage ? "low" : "medium",
      status: revLink < t.minimumRevenueLinkage ? "warning" : "info",
      forMonth: salesTotals.period
    }
  );
  pushSummary(
    "traffic_overview",
    "attribution_coverage",
    "Fully attributed share",
    "fully_attributed_share",
    "Fully attributed %",
    Number(
      (
        (attributions.filter((r) => String(r.attribution_status) === "fully_attributed").length /
          Math.max(totalLeads, 1)) *
        100
      ).toFixed(2)
    ),
    { forMonth: salesTotals.period }
  );

  // Paid / organic / other by type (rollup)
  const typeRollup = new Map<string, Agg>();
  for (const row of attributions) {
    const tt = String(row.traffic_type || "unknown");
    const cur = typeRollup.get(tt) || emptyAgg();
    addLead(cur, row);
    typeRollup.set(tt, cur);
  }
  const organicAgg = emptyAgg();
  for (const tt of ORGANIC_TOTAL_TYPES) {
    const part = typeRollup.get(tt);
    if (!part) continue;
    organicAgg.leads += part.leads;
    organicAgg.deals += part.deals;
    organicAgg.invoices += part.invoices;
    organicAgg.payments += part.payments;
    organicAgg.revenue += part.revenue;
    organicAgg.attributed_leads += part.attributed_leads;
    organicAgg.fully += part.fully;
    organicAgg.with_payment += part.with_payment;
    organicAgg.with_revenue += part.with_revenue;
  }

  const emitTypeBlock = (id: string, name: string, agg: Agg, trafficType: string) => {
    const status = classifyManagementStatus({
      trafficType,
      sampleSize: agg.leads,
      coveragePct: coverageOf(agg) || (trafficType === "unknown" ? 0 : 1)
    });
    const conf = classifyAggregateConfidence({
      fullyShare: attributionCoverage(agg),
      knownShare: trafficType === "unknown" ? 0 : 1,
      sampleSize: agg.leads,
      trafficType
    });
    const metrics: Array<[string, string, number | string]> = [
      ["leads", "Leads", agg.leads],
      ["deals", "Deals", agg.deals],
      ["invoice_events", "Invoice events", agg.invoices],
      ["payments", "Payments", agg.payments],
      ["attributed_paid_revenue", "Attributed paid revenue", Number(agg.revenue.toFixed(2))],
      ["average_check", "Average check (attributed)", aov(agg.revenue, agg.payments)],
      ["lead_to_deal_cr", "Lead→Deal CR (attributed-only)", pct(agg.deals, agg.leads)],
      ["deal_to_payment_cr", "Deal→Payment CR (attributed-only)", pct(agg.payments, agg.deals)],
      ["lead_to_payment_cr", "Lead→Payment CR (attributed-only)", pct(agg.payments, agg.leads)],
      ["revenue_share", "Revenue share of attributed", share(agg.revenue, totalRevenue)],
      [
        "attribution_coverage",
        "Fully attributed share",
        Number((attributionCoverage(agg) * 100).toFixed(2))
      ]
    ];
    for (const [metricId, metricName, value] of metrics) {
      pushSummary("traffic_types", id, name, metricId, metricName, value, {
        share: metricId === "leads" ? share(agg.leads, totalLeads) : "",
        coverage: Number((coverageOf(agg) * 100).toFixed(2)),
        confidence: conf,
        status,
        comment: managementComment(status),
        forMonth: salesTotals.period
      });
    }
  };

  emitTypeBlock("paid", "Paid", typeRollup.get("paid") || emptyAgg(), "paid");
  emitTypeBlock("organic_total", "Organic total", organicAgg, "organic_social");
  for (const tt of [
    "organic_social",
    "organic_search",
    "messenger",
    "referral",
    "direct",
    "email",
    "offline",
    "partner",
    "unknown",
    "excluded"
  ]) {
    emitTypeBlock(tt, tt, typeRollup.get(tt) || emptyAgg(), tt);
  }

  // Top channels / landings / campaigns (month grain, top N)
  const monthChannel = channelManagement.filter((r) => r.period_type === "month");
  const topChannels = [...monthChannel].sort((a, b) => Number(b.leads) - Number(a.leads)).slice(0, 10);
  for (const row of topChannels) {
    pushSummary(
      "top_channels",
      String(row.channel_id),
      String(row.channel_name),
      "leads",
      "Leads",
      Number(row.leads),
      {
        share: String(row.lead_share_pct),
        coverage: Number(row.attribution_coverage_pct),
        confidence: String(row.confidence),
        status: String(row.management_status),
        comment: String(row.comment),
        forMonth: String(row.period)
      }
    );
    pushSummary(
      "top_channels",
      String(row.channel_id),
      String(row.channel_name),
      "attributed_paid_revenue",
      "Attributed paid revenue",
      Number(row.attributed_paid_revenue),
      {
        coverage: Number(row.revenue_linkage_pct),
        confidence: String(row.confidence),
        status: String(row.management_status),
        comment: "Do not rank channels by revenue without coverage warning",
        forMonth: String(row.period)
      }
    );
  }

  const monthLanding = landingManagement.filter((r) => r.period_type === "month");
  const topLandings = [...monthLanding].sort((a, b) => Number(b.leads) - Number(a.leads)).slice(0, 15);
  for (const row of topLandings) {
    pushSummary(
      "top_landings",
      String(row.landing_id),
      String(row.landing_name),
      "leads",
      "Leads",
      Number(row.leads),
      {
        share: String(row.lead_share_pct),
        coverage: Number(row.landing_coverage_pct),
        confidence: String(row.confidence),
        status: String(row.management_status),
        forMonth: String(row.period)
      }
    );
  }

  const monthCamp = campaignManagement.filter((r) => r.period_type === "month");
  const topCamps = [...monthCamp].sort((a, b) => Number(b.leads) - Number(a.leads)).slice(0, 10);
  for (const row of topCamps) {
    pushSummary(
      "top_campaigns",
      String(row.campaign_id),
      String(row.campaign_name),
      "leads",
      "Leads",
      Number(row.leads),
      {
        coverage: Number(row.campaign_coverage_pct),
        confidence: String(row.confidence),
        status: String(row.management_status),
        forMonth: String(row.period)
      }
    );
  }

  // Attribution quality
  const statusCounts = new Map<string, number>();
  for (const row of attributions) {
    const st = String(row.attribution_status || "unknown");
    statusCounts.set(st, (statusCounts.get(st) || 0) + 1);
  }
  for (const st of [
    "fully_attributed",
    "source_only",
    "landing_only",
    "campaign_only",
    "unknown",
    "conflict"
  ]) {
    const n = statusCounts.get(st) || 0;
    pushSummary("attribution_quality", st, st, "leads", "Leads", n, {
      share: share(n, totalLeads),
      forMonth: salesTotals.period
    });
  }

  // Sales linkage block
  pushSummary(
    "sales_linkage",
    "sales_revenue",
    "Total Sales paid revenue",
    "total_sales_revenue",
    "Sales OS paid revenue",
    Number(salesRevenue.toFixed(2)),
    {
      comment: "Calendar paid_at; not attributed",
      forMonth: salesTotals.period
    }
  );
  pushSummary(
    "sales_linkage",
    "unattributed_revenue",
    "Unattributed revenue",
    "unattributed_revenue",
    "Unattributed revenue",
    Number(uncoveredRevenue.toFixed(2)),
    {
      coverage: covPct(coveredRevenue, salesRevenue),
      forMonth: salesTotals.period
    }
  );
  pushSummary(
    "sales_linkage",
    "revenue_coverage",
    "Revenue coverage %",
    "revenue_coverage_pct",
    "Revenue coverage %",
    covPct(coveredRevenue, salesRevenue),
    { forMonth: salesTotals.period, status: "warning" }
  );

  // Unknown breakdown
  const unkReasons = new Map<string, number>();
  for (const row of attributions) {
    if (String(row.traffic_type) !== "unknown") continue;
    const reason = classifyUnknownReason(row);
    unkReasons.set(reason, (unkReasons.get(reason) || 0) + 1);
  }
  for (const [reason, n] of [...unkReasons.entries()].sort((a, b) => b[1] - a[1])) {
    pushSummary("unknown_breakdown", reason, reason, "leads", "Unknown leads", n, {
      share: share(n, unknownN || 1),
      confidence: "unknown",
      status: "unknown",
      comment: "Honest residual — not auto-classified",
      forMonth: salesTotals.period
    });
  }

  const coverageSummary = {
    traffic_type_coverage_pct: Number((channelCoverage * 100).toFixed(2)),
    channel_coverage_pct: Number((channelCoverage * 100).toFixed(2)),
    landing_coverage_pct: Number((globalLandingCoverage * 100).toFixed(2)),
    campaign_coverage_pct: Number((globalCampaignCoverage * 100).toFixed(2)),
    deal_linkage_pct: Number(((totalDeals / Math.max(totalLeads, 1)) * 100).toFixed(2)),
    payment_linkage_pct: Number((payLink * 100).toFixed(2)),
    revenue_linkage_pct: Number((revLink * 100).toFixed(2)),
    unknown_share_pct: Number((unknownShare * 100).toFixed(2)),
    fully_attributed_share_pct: Number(
      (
        ((statusCounts.get("fully_attributed") || 0) / Math.max(totalLeads, 1)) *
        100
      ).toFixed(2)
    ),
    attributed_paid_revenue: Number(totalRevenue.toFixed(2)),
    total_sales_revenue: Number(salesRevenue.toFixed(2)),
    unattributed_revenue: Number(uncoveredRevenue.toFixed(2)),
    revenue_coverage_pct: covPct(coveredRevenue, salesRevenue),
    alerts_critical: alerts.filter((a) => a.severity === "critical").length,
    alerts_warning: alerts.filter((a) => a.severity === "warning").length,
    alerts_info: alerts.filter((a) => a.severity === "info").length
  };

  return {
    trafficManagement,
    trafficTypeFact,
    channelManagement,
    landingManagement,
    campaignManagement,
    salesCoverage,
    alerts,
    exportRowsV2: exportRows,
    coverageSummary,
    matrices: {
      trafficManagement: toMatrix(TRAFFIC_MANAGEMENT_COLUMNS, trafficManagement),
      trafficTypeFact: toMatrix(TRAFFIC_TYPE_FACT_COLUMNS, trafficTypeFact),
      channelManagement: toMatrix(CHANNEL_MANAGEMENT_COLUMNS, channelManagement),
      landingManagement: toMatrix(LANDING_MANAGEMENT_COLUMNS, landingManagement),
      campaignManagement: toMatrix(CAMPAIGN_MANAGEMENT_COLUMNS, campaignManagement),
      salesCoverage: toMatrix(TRAFFIC_SALES_COVERAGE_COLUMNS, salesCoverage),
      alerts: toMatrix(TRAFFIC_ALERTS_COLUMNS, alerts),
      exportRowsV2: toMatrix(TRAFFIC_EXPORT_V2_COLUMNS, exportRows)
    }
  };
}

export type TrafficManagementModel = ReturnType<typeof buildTrafficManagementLayer>;
