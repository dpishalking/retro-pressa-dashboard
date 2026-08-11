/** Business timezone for calendar cohort grains (day/week/month labels). */
export const SALES_CYCLE_TIMEZONE = "Europe/Riga";

/** Lookback window for contact → lead fallback matching (days). */
export const LEAD_MATCH_LOOKBACK_DAYS = Number(process.env.SALES_CYCLE_LEAD_LOOKBACK_DAYS || 90);

/**
 * D0 / D1 use elapsed hours (not calendar day).
 * D0 = [0, 24h), D1 = [24h, 48h).
 */
export const CYCLE_BUCKETS = [
  { id: "D0", label: "D0 (<24ч)", minHours: 0, maxHours: 24 },
  { id: "D1", label: "D1 (24–48ч)", minHours: 24, maxHours: 48 },
  { id: "D2-3", label: "D2–3", minHours: 48, maxHours: 96 },
  { id: "D4-7", label: "D4–7", minHours: 96, maxHours: 192 },
  { id: "D8-14", label: "D8–14", minHours: 192, maxHours: 360 },
  { id: "D15-30", label: "D15–30", minHours: 360, maxHours: 720 },
  { id: "D31-60", label: "D31–60", minHours: 720, maxHours: 1440 },
  { id: "D60+", label: "D60+", minHours: 1440, maxHours: Number.POSITIVE_INFINITY }
] as const;

/** Cumulative maturity checkpoints (elapsed hours upper bound, inclusive for “by Dx”). */
export const MATURITY_CHECKPOINTS = [
  { id: "D0", hours: 24 },
  { id: "D1", hours: 48 },
  { id: "D3", hours: 96 },
  { id: "D7", hours: 192 },
  { id: "D14", hours: 360 },
  { id: "D30", hours: 720 },
  { id: "D60", hours: 1440 }
] as const;

/** Phase 1 “final” cohort revenue window (not LTV). */
export const FINAL_REVENUE_HOURS = 720; // D30

export const MIN_MATURE_COHORTS_FOR_FORECAST = Number(process.env.SALES_CYCLE_MIN_MATURE_COHORTS || 5);
