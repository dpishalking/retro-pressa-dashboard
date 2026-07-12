import { readBitrixSnapshot } from "@/lib/bitrix/snapshot-store";
import { readGa4Snapshot } from "@/lib/google/ga4-snapshot-store";
import { readGoogleTrafficSnapshot } from "@/lib/google/snapshot-store";
import { campaignsMatch, normalizeCampaignSlug } from "@/lib/utm-standards";
import type { PeriodKey } from "@/types/metrics";

export type UtmCampaignAttributionRow = {
  campaign: string;
  campaignSlug: string;
  ga4Sessions: number;
  ga4Compliant: boolean;
  sheetsLeads: number;
  sheetsSpend: number;
  bitrixLeads: number;
  bitrixWonDeals: number;
  bitrixRevenue: number;
  status: "ok" | "ga4_only" | "sheets_only" | "bitrix_only" | "mismatch";
};

export type UtmAuditSummary = {
  period: PeriodKey;
  ga4Sessions: number;
  compliantSessionShare: number;
  sessionsWithoutUtm: number;
  unassignedShare: number;
  bitrixLeadsWithUtm: number;
  bitrixLeadsTotal: number;
  bitrixLeadsWithLanding: number;
  sheetsCampaigns: number;
  issues: string[];
};

export type UtmAuditPayload = {
  summary: UtmAuditSummary;
  campaigns: UtmCampaignAttributionRow[];
  landingPages: Array<{
    landingPage: string;
    ga4Sessions: number;
    bitrixLeads: number;
    bitrixWonDeals: number;
    bitrixRevenue: number;
    source: string;
    medium: string;
  }>;
};

function normalizeLandingPath(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.includes("retro-pressa.com")) {
    try {
      return new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`).pathname;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function addCampaignBucket(
  buckets: Map<string, UtmCampaignAttributionRow>,
  campaign: string,
  patch: Partial<UtmCampaignAttributionRow>
) {
  const slug = normalizeCampaignSlug(campaign) || campaign.trim().toLowerCase();
  const key = slug || "(empty)";
  const current = buckets.get(key) ?? {
    campaign: campaign || "(empty)",
    campaignSlug: slug,
    ga4Sessions: 0,
    ga4Compliant: false,
    sheetsLeads: 0,
    sheetsSpend: 0,
    bitrixLeads: 0,
    bitrixWonDeals: 0,
    bitrixRevenue: 0,
    status: "mismatch"
  };
  buckets.set(key, {
    ...current,
    ...patch,
    campaign: current.campaign === "(empty)" ? campaign || "(empty)" : current.campaign,
    campaignSlug: slug || current.campaignSlug
  });
}

export async function buildUtmAudit(period: PeriodKey): Promise<UtmAuditPayload> {
  const [ga4, sheets, bitrix] = await Promise.all([
    readGa4Snapshot(period),
    readGoogleTrafficSnapshot(period),
    readBitrixSnapshot(period)
  ]);

  const buckets = new Map<string, UtmCampaignAttributionRow>();
  const issues: string[] = [];

  for (const row of ga4?.byCampaign ?? []) {
    if (!row.campaign || row.campaign === "(not set)") continue;
    addCampaignBucket(buckets, row.campaign, {
      ga4Sessions: row.sessions,
      ga4Compliant: row.compliant
    });
  }

  for (const row of sheets?.rows ?? []) {
    if (!row.campaign) continue;
    const existing = Array.from(buckets.values()).find((item) => campaignsMatch(item.campaign, row.campaign));
    const keyCampaign = existing?.campaign ?? row.campaign;
    const bucket = buckets.get(normalizeCampaignSlug(keyCampaign) || keyCampaign.trim().toLowerCase());
    addCampaignBucket(buckets, keyCampaign, {
      sheetsLeads: (bucket?.sheetsLeads ?? 0) + row.paidLeads + row.organicLeads,
      sheetsSpend: (bucket?.sheetsSpend ?? 0) + row.spend
    });
  }

  const leads = bitrix?.leads ?? [];
  const deals = bitrix?.deals ?? [];
  const wonDeals = deals.filter((deal) => deal.stageSemanticId === "S");

  for (const lead of leads) {
    if (!lead.utmCampaign) continue;
    const existing = Array.from(buckets.values()).find((item) => campaignsMatch(item.campaign, lead.utmCampaign));
    const keyCampaign = existing?.campaign ?? lead.utmCampaign;
    const bucket = buckets.get(normalizeCampaignSlug(keyCampaign) || keyCampaign.trim().toLowerCase());
    addCampaignBucket(buckets, keyCampaign, {
      bitrixLeads: (bucket?.bitrixLeads ?? 0) + 1
    });
  }

  for (const deal of wonDeals) {
    if (!deal.utmCampaign) continue;
    const existing = Array.from(buckets.values()).find((item) => campaignsMatch(item.campaign, deal.utmCampaign));
    const keyCampaign = existing?.campaign ?? deal.utmCampaign;
    const bucket = buckets.get(normalizeCampaignSlug(keyCampaign) || keyCampaign.trim().toLowerCase());
    addCampaignBucket(buckets, keyCampaign, {
      bitrixWonDeals: (bucket?.bitrixWonDeals ?? 0) + 1,
      bitrixRevenue: (bucket?.bitrixRevenue ?? 0) + deal.opportunity
    });
  }

  const campaigns = Array.from(buckets.values())
    .map((row) => {
      const hasGa4 = row.ga4Sessions > 0;
      const hasSheets = row.sheetsLeads > 0 || row.sheetsSpend > 0;
      const hasBitrix = row.bitrixLeads > 0;
      let status: UtmCampaignAttributionRow["status"] = "ok";
      if (hasGa4 && !hasSheets && !hasBitrix) status = "ga4_only";
      else if (!hasGa4 && hasSheets && !hasBitrix) status = "sheets_only";
      else if (!hasGa4 && !hasSheets && hasBitrix) status = "bitrix_only";
      else if ((hasGa4 && hasSheets && row.ga4Sessions > 0 && row.sheetsLeads === 0) || (!row.ga4Compliant && hasGa4)) {
        status = "mismatch";
      }
      return { ...row, status };
    })
    .sort((a, b) => b.ga4Sessions - a.ga4Sessions || b.sheetsLeads - a.sheetsLeads || b.bitrixLeads - a.bitrixLeads);

  const leadsById = new Map(leads.map((lead) => [lead.id, lead] as const));

  type LandingStats = { ga4Sessions: number; bitrixLeads: number; bitrixWonDeals: number; bitrixRevenue: number; source: string; medium: string };
  const emptyLanding = (source = "", medium = ""): LandingStats => ({ ga4Sessions: 0, bitrixLeads: 0, bitrixWonDeals: 0, bitrixRevenue: 0, source, medium });
  const landingMap = new Map<string, LandingStats>();
  for (const row of ga4?.byLanding ?? []) {
    const key = row.landingPage;
    const current = landingMap.get(key) ?? emptyLanding(row.source, row.medium);
    landingMap.set(key, { ...current, ga4Sessions: current.ga4Sessions + row.sessions });
  }
  for (const lead of leads) {
    const path = normalizeLandingPath(lead.landingPage);
    if (!path) continue;
    const current = landingMap.get(path) ?? emptyLanding(lead.utmSource ?? "", lead.utmMedium ?? "");
    landingMap.set(path, { ...current, bitrixLeads: current.bitrixLeads + 1 });
  }
  for (const deal of wonDeals) {
    const path = normalizeLandingPath(deal.landingPage)
      || normalizeLandingPath(deal.leadId ? leadsById.get(deal.leadId)?.landingPage ?? null : null);
    if (!path) continue;
    const current = landingMap.get(path) ?? emptyLanding();
    landingMap.set(path, {
      ...current,
      bitrixWonDeals: current.bitrixWonDeals + 1,
      bitrixRevenue: current.bitrixRevenue + deal.opportunity
    });
  }

  const landingPages = Array.from(landingMap.entries())
    .map(([landingPage, stats]) => ({ landingPage, ...stats }))
    .sort((a, b) => b.bitrixRevenue - a.bitrixRevenue || b.ga4Sessions - a.ga4Sessions)
    .slice(0, 20);

  const bitrixLeadsWithUtm = leads.filter((lead) => lead.utmCampaign || lead.utmSource || lead.utmMedium).length;
  const bitrixLeadsWithLanding = leads.filter((lead) => lead.landingPage).length;

  if ((ga4?.summary.compliantSessionShare ?? 0) < 0.5) {
    issues.push("Меньше половины сессий идут с корректной парой utm_source/utm_medium.");
  }
  if ((ga4?.summary.unassignedShare ?? 0) > 0.25) {
    issues.push("Unassigned в GA4 выше 25% — проверьте ссылки в рекламных кабинетах.");
  }
  if (bitrixLeadsWithUtm < leads.length * 0.5) {
    issues.push("В Bitrix UTM заполнены менее чем у половины лидов — нужен скрипт на сайте.");
  }
  if (bitrixLeadsWithLanding < leads.length * 0.2) {
    issues.push("Landing page почти не попадает в Bitrix — подключите utm-capture.js на сайте.");
  }

  return {
    summary: {
      period,
      ga4Sessions: ga4?.summary.sessions ?? 0,
      compliantSessionShare: ga4?.summary.compliantSessionShare ?? 0,
      sessionsWithoutUtm: ga4?.summary.sessionsWithoutUtm ?? 0,
      unassignedShare: ga4?.summary.unassignedShare ?? 0,
      bitrixLeadsWithUtm,
      bitrixLeadsTotal: leads.length,
      bitrixLeadsWithLanding,
      sheetsCampaigns: new Set((sheets?.rows ?? []).map((row) => row.campaign).filter(Boolean)).size,
      issues
    },
    campaigns: campaigns.slice(0, 30),
    landingPages
  };
}
