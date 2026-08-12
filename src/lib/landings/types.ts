import type { AlxLandingTag } from "@/config/alx-landings";

export type LandingEfficiencySummary = {
  id: string;
  /** retro-pressa.com/life — matches the ALX sheet title */
  title: string;
  siteName: string;
  address: string;
  tag: AlxLandingTag;
  href: string;
  hasData: boolean;
  daysWithData: number;
  monthlyBudget: number | null;
  cpl: number | null;
  /** Month ROAS = Σrevenue / Σspend (ALX landing sheet). */
  roas: number | null;
  /**
   * Cumulative ROAS for calendar days 1..7 of the month.
   * Null when window not mature yet or no spend in window.
   */
  roasD7: number | null;
  /** Cumulative ROAS for calendar days 1..30 of the month. */
  roasD30: number | null;
  roasD7Mature: boolean;
  roasD30Mature: boolean;
  landingCr: number | null;
  saleCr: number | null;
};
