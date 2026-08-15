/** Professional neutral palette for Predictive Sheets (RGB 0–1). */

import { PM_SHEETS } from "@/config/predictive-sheets";

export function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const h = hex.replace("#", "");
  const n = Number.parseInt(h, 16);
  return {
    red: ((n >> 16) & 255) / 255,
    green: ((n >> 8) & 255) / 255,
    blue: (n & 255) / 255
  };
}

export const PM_COLORS = {
  dark: hexToRgb("#0F172A"),
  text: hexToRgb("#172033"),
  textSecondary: hexToRgb("#64748B"),
  background: hexToRgb("#FFFFFF"),
  secondaryBg: hexToRgb("#F8FAFC"),
  headerBg: hexToRgb("#F1F5F9"),
  blueAccent: hexToRgb("#2563EB"),
  planRow: hexToRgb("#F8FAFC"),
  ptfRow: hexToRgb("#FAFBFC"),
  border: hexToRgb("#E2E8F0"),
  input: hexToRgb("#F0F7FF"),
  greenBg: hexToRgb("#DCFCE7"),
  greenText: hexToRgb("#166534"),
  yellowBg: hexToRgb("#FEF3C7"),
  yellowText: hexToRgb("#92400E"),
  redBg: hexToRgb("#FEE2E2"),
  redText: hexToRgb("#991B1B"),
  noDataBg: hexToRgb("#F1F5F9"),
  noDataText: hexToRgb("#64748B"),
  white: hexToRgb("#FFFFFF"),
  currentWeek: hexToRgb("#DBEAFE"),
  futureWeek: hexToRgb("#F8FAFC"),
  sectionHeader: hexToRgb("#0F172A")
} as const;

export const PM_STATUS = {
  onTrack: "● В норме",
  risk: "● Риск",
  offTrack: "● Срыв",
  noData: "● Нет данных",
  noPlan: "● Нет плана"
} as const;

export const PM_STATUS_CF = [
  { text: "В норме", bg: PM_COLORS.greenBg, fg: PM_COLORS.greenText },
  { text: "Риск", bg: PM_COLORS.yellowBg, fg: PM_COLORS.yellowText },
  { text: "Срыв", bg: PM_COLORS.redBg, fg: PM_COLORS.redText },
  { text: "Нет данных", bg: PM_COLORS.noDataBg, fg: PM_COLORS.noDataText },
  { text: "Нет плана", bg: PM_COLORS.noDataBg, fg: PM_COLORS.noDataText }
] as const;

export const PM_SECTION_LABEL: Record<string, string> = {
  "BUSINESS OUTCOME": "LAG",
  "LEAD KPI": "LEAD",
  CHANNELS: "LEAD",
  "SALES FUNNEL": "LEAD",
  GUARDRAILS: "Ограничения",
  CAPACITY: "Ёмкость",
  "LEAD GENERATION": "LEAD",
  FUNNEL: "LEAD",
  ACTIVITY: "LEAD",
  PNL: "LAG",
  UNIT: "Ограничения",
  PAYROLL: "ФОТ"
};

export function pmSectionLabel(section: string): string {
  return PM_SECTION_LABEL[section] || section;
}

export const PM_TYPE_LABEL: Record<string, string> = {
  LAG: "Результат",
  LEAD_1: "Драйвер",
  LEAD_2: "Драйвер",
  ACTIVITY: "Активность",
  CAPACITY: "Ёмкость",
  GUARDRAIL: "Ограничение"
};

/** Detail PM columns: metric + numbers. No type / owner / category / comment. 0-based. */
export const PM_COL = {
  metric: 0,
  plan: 1,
  ptd: 2,
  w1: 3,
  fact: 8,
  forecast: 9,
  gap: 10,
  pace: 11,
  status: 12,
  count: 13
} as const;

export const PM_COLUMN_WIDTHS = [
  220, // A metric
  110, // B plan
  110, // C plan to date
  118, // D W1
  118, // E W2
  118, // F W3
  118, // G W4
  118, // H W5
  110, // I fact
  110, // J forecast
  100, // K gap
  120, // L pace
  120 // M status
] as const;

export const PM_HEADERS_LEFT = ["Метрика", "План", "На дату"] as const;
export const PM_HEADERS_RIGHT = ["Факт", "Прогноз", "Разрыв", "Темп", "Статус"] as const;

export function pmWeekHeader(index: number, label: string, isCurrent: boolean): string {
  return `Н${index} ${label}${isCurrent ? " ●" : ""}`;
}

export function pmHeaders(weekLabels: string[]): string[] {
  const weeks = Array.from({ length: 5 }, (_, i) => weekLabels[i] || `Н${i + 1}`);
  return [...PM_HEADERS_LEFT, ...weeks, ...PM_HEADERS_RIGHT];
}

export const PM_FOCUS: Record<string, string> = {
  [PM_SHEETS.marketingGeneral]: "Смотрим: выручка, счета",
  [PM_SHEETS.marketingPaid]: "Смотрим: выручка, CPL",
  [PM_SHEETS.marketingOrganic]: "Смотрим: выручка, конверсия лид → оплата",
  [PM_SHEETS.salesGeneral]: "Смотрим: выручка, счета",
  [PM_SHEETS.salesNadezhda]: "Смотрим: выручка, ФОТ · Надежда",
  [PM_SHEETS.salesAnastasia]: "Смотрим: выручка, ФОТ · Анастасия",
  [PM_SHEETS.salesElena]: "Смотрим: выручка, ФОТ · Елена",
  [PM_SHEETS.finance]: "Смотрим: касса, ФОТ, вклад после рекламы",
  [PM_SHEETS.motivation]: "Смотрим: чек 80 €, лид→оплата 20%"
};
