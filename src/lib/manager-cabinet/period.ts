import { periodCalendarBounds } from "@/lib/analytics-os/period";
import type { AnalyticsPeriod } from "@/types/analytics-os";
import type { CabinetWindow } from "@/lib/manager-cabinet/types";

export const CABINET_WINDOWS: CabinetWindow[] = ["month", "h1", "h2"];

export function isCabinetWindow(value: string | null | undefined): value is CabinetWindow {
  return value === "month" || value === "h1" || value === "h2";
}

export function parseCabinetWindow(value: string | null | undefined): CabinetWindow {
  return isCabinetWindow(value) ? value : "month";
}

export function cabinetWindowBounds(
  period: AnalyticsPeriod,
  window: CabinetWindow
): { start: string; end: string } {
  const { start, end } = periodCalendarBounds(period);
  if (window === "h1") {
    return { start, end: `${period}-15` };
  }
  if (window === "h2") {
    return { start: `${period}-16`, end };
  }
  return { start, end };
}

export function cabinetWindowLabel(window: CabinetWindow): string {
  if (window === "h1") return "1–15";
  if (window === "h2") return "16–конец";
  return "месяц";
}
