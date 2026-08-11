/** Client-safe marketing predictive slice (no Node / Sheets imports). */

export type MarketingPredictiveScope = "general" | "organic" | "paid";

export function normalizeMarketingPredictiveScope(raw: string | null | undefined): MarketingPredictiveScope {
  if (raw === "organic" || raw === "paid" || raw === "general") return raw;
  return "general";
}
