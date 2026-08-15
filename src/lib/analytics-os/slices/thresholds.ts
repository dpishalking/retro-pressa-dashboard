/** Shared sample-size guards for slice ranking and status. */
export const ANALYTICS_SAMPLE_THRESHOLDS = {
  minLeads: 10,
  minSales: 3
};

export function isLowSample(leads: number, sales: number): boolean {
  return leads < ANALYTICS_SAMPLE_THRESHOLDS.minLeads && sales < ANALYTICS_SAMPLE_THRESHOLDS.minSales;
}
