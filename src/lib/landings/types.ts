import type { AlxLandingTag } from "@/config/alx-landings";

export type LandingEfficiencySummary = {
  id: string;
  siteName: string;
  address: string;
  tag: AlxLandingTag;
  href: string;
  hasData: boolean;
  daysWithData: number;
  monthlyBudget: number | null;
  cpl: number | null;
  roas: number | null;
  landingCr: number | null;
  saleCr: number | null;
};
