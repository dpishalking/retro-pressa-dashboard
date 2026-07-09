export const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);

export const margin = (profit: number, revenue: number) => safeDiv(profit, revenue);

export const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

export const weightedAverage = (items: Array<{ value: number; weight: number }>) => {
  const totalWeight = sum(items.map((i) => i.weight));
  if (totalWeight === 0) return 0;
  return sum(items.map((i) => i.value * i.weight)) / totalWeight;
};

export const trailingDailyAverage = (daily: number[], days: number) => {
  if (daily.length === 0) return 0;
  const slice = daily.slice(-Math.min(days, daily.length));
  return safeDiv(sum(slice), slice.length);
};

export const runRateProjection = (dailyRate: number, horizonDays: number, calendarDays: number) => {
  const monthScale = safeDiv(horizonDays, Math.max(1, calendarDays));
  return dailyRate * horizonDays + dailyRate * monthScale * 0;
};
