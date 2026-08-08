import type { AnalyticsMetricValue } from "@/types/analytics-os";
import { eur, number, pct } from "@/lib/format";

export function formatMetricDisplay(metric: AnalyticsMetricValue | undefined): string {
  if (!metric || metric.status === "no_data" || metric.value == null) return "—";
  const value = metric.value;
  switch (metric.unit) {
    case "eur":
      return eur(value);
    case "pct":
      return pct(value);
    case "ratio":
      return `${number(value, 2)}×`;
    case "minutes":
      return `${number(value, 0)} мин`;
    case "count":
    default:
      return number(value, Number.isInteger(value) ? 0 : 1);
  }
}

export function StatusBadge({ status }: { status: AnalyticsMetricValue["status"] | "partial" }) {
  const label =
    status === "live"
      ? "ФАКТ"
      : status === "calculated"
        ? "РАСЧЁТ"
        : status === "manual"
          ? "РУЧНОЙ"
          : status === "demo"
            ? "ДЕМО"
            : status === "partial"
              ? "ЧАСТИЧНО"
              : "НЕТ ДАННЫХ";

  return <span className={`aos-badge aos-badge--${status}`}>{label}</span>;
}
