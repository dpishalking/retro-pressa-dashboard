export type WatchedLanding = {
  id: string;
  label: string;
  pageUrl: string;
  sourceIds: string[];
  /** Substrings matched against source description, title and UTM campaign. */
  needles: string[];
};

export const WATCHED_LANDINGS: WatchedLanding[] = [
  {
    id: "lifehistory",
    label: "Life History",
    pageUrl: "https://giftboost.website/lifehistory",
    sourceIds: ["UC_LFHIST"],
    needles: ["giftboost.website/lifehistory", "lifehistory"]
  },
  {
    id: "architecture",
    label: "Архитектура",
    pageUrl: "https://giftboost.website/architecture",
    sourceIds: ["UC_ARCHITECTURE"],
    needles: ["giftboost.website/architecture", "architecture-form"]
  }
];

export type LandingMatchInput = {
  sourceId: string;
  sourceDescription: string;
  title: string;
  utmCampaign: string;
};

export function activeLandings(only = process.env.LANDING_LEAD_ALERT_ONLY || ""): WatchedLanding[] {
  const ids = only
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!ids.length) return WATCHED_LANDINGS;
  return WATCHED_LANDINGS.filter((landing) => ids.includes(landing.id));
}

export function matchLanding(input: LandingMatchInput, landings = activeLandings()): WatchedLanding | null {
  const sourceId = input.sourceId.trim();
  const blob = `${input.sourceDescription} ${input.title} ${input.utmCampaign}`.toLowerCase();
  for (const landing of landings) {
    if (sourceId && landing.sourceIds.includes(sourceId)) return landing;
    if (landing.needles.some((needle) => blob.includes(needle.toLowerCase()))) return landing;
  }
  return null;
}

export function pageUrlFromLead(landing: WatchedLanding, sourceDescription: string): string {
  const match = sourceDescription.match(/https?:\/\/[^\s]+/i);
  return match?.[0] || landing.pageUrl;
}
