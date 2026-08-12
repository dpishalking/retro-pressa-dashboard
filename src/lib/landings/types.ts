import type { AlxLandingTag } from "@/config/alx-landings";

export type LandingEfficiencySummary = {
  id: string;
  title: string;
  url: string;
  tag: AlxLandingTag;
  href: string;
  hasData: boolean;
  daysWithData: number;
  cpl: number | null;
  roas: number | null;
  landingCr: number | null;
  saleCr: number | null;
};
