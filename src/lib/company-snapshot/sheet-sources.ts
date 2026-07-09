import { readFile } from "node:fs/promises";
import path from "node:path";
import { readGoogleServiceAccount, readSheetValues } from "@/lib/google/sheets-client";
import type { PeriodKey } from "@/types/metrics";
import type { SnapshotSourceId } from "./types";

export type SheetMetricRow = {
  metricId: string;
  value: number;
};

export type SheetSourceConfig = {
  sourceId: SnapshotSourceId;
  envSpreadsheetKey: string;
  envGidKey?: string;
  label: string;
};

export const SHEET_SOURCE_CONFIGS: SheetSourceConfig[] = [
  { sourceId: "google_finance", envSpreadsheetKey: "GOOGLE_FINANCE_SHEET_ID", envGidKey: "GOOGLE_FINANCE_SHEET_GID", label: "Google Finance" },
  { sourceId: "google_payroll", envSpreadsheetKey: "GOOGLE_PAYROLL_SHEET_ID", envGidKey: "GOOGLE_PAYROLL_SHEET_GID", label: "Google Payroll" },
  { sourceId: "google_production", envSpreadsheetKey: "GOOGLE_PRODUCTION_SHEET_ID", envGidKey: "GOOGLE_PRODUCTION_SHEET_GID", label: "Google Production" }
];

const metricAliases: Record<string, string[]> = {
  payroll: ["payroll", "фот", "fot", "зарплаты"],
  overheadFixed: ["overhead", "overheadfixed", "постоянные", "fixed_costs"],
  unitCost: ["unitcost", "себестоимость", "cogs_unit"],
  taxRate: ["taxrate", "налог", "налоги", "tax"],
  discountRate: ["discount", "скидка", "discountrate"],
  deliveryCost: ["delivery", "доставка", "deliverycost"],
  productionHours: ["productionhours", "часы", "hours"],
  hoursPerOrder: ["hoursperorder", "часов_заказ"],
  defectRate: ["defect", "брак", "defectrate"],
  avgSalary: ["avgsalary", "зарплата", "salary"],
  productionStaff: ["productionstaff", "производство_персонал"],
  supportStaff: ["supportstaff", "поддержка"],
  managerCount: ["managercount", "менеджеры"],
  cashBalance: ["cash", "остаток", "balance", "cashbalance"]
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseMetricValue(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchMetricId(header: string): string | null {
  const normalized = normalizeHeader(header);
  for (const [metricId, aliases] of Object.entries(metricAliases)) {
    if (aliases.some((alias) => normalized.includes(alias))) return metricId;
  }
  return null;
}

export function parseSheetMetrics(rows: string[][]): SheetMetricRow[] {
  if (rows.length < 2) return [];

  const header = rows[0] ?? [];
  const valueRow = rows[1] ?? [];
  const result: SheetMetricRow[] = [];

  header.forEach((cell, index) => {
    const metricId = matchMetricId(cell);
    if (!metricId) return;
    const value = parseMetricValue(valueRow[index] ?? "");
    if (value === null) return;
    result.push({ metricId, value });
  });

  return result;
}

export async function readConfiguredSheetMetrics(
  config: SheetSourceConfig,
  period: PeriodKey
): Promise<{ metrics: SheetMetricRow[]; updatedAt: string | null; available: boolean }> {
  const spreadsheetId = process.env[config.envSpreadsheetKey]?.trim();
  if (!spreadsheetId || !readGoogleServiceAccount()) {
    return { metrics: [], updatedAt: null, available: false };
  }

  try {
    const gid = config.envGidKey ? process.env[config.envGidKey]?.trim() : undefined;
    const range = process.env[`${config.envSpreadsheetKey}_RANGE`]?.trim() || "A1:Z10";
    const rows = await readSheetValues({ spreadsheetId, range, gid });
    const metrics = parseSheetMetrics(rows);
    return {
      metrics,
      updatedAt: new Date().toISOString(),
      available: metrics.length > 0
    };
  } catch {
    return { metrics: [], updatedAt: null, available: false };
  }
}

export async function readBankBalance(): Promise<{ value: number | null; updatedAt: string | null; available: boolean }> {
  const filePath = process.env.BANK_BALANCE_FILE?.trim();
  if (!filePath) return { value: null, updatedAt: null, available: false };

  try {
    const raw = await readFile(path.resolve(filePath), "utf8");
    const parsed = JSON.parse(raw) as { balance?: number; updatedAt?: string };
    if (typeof parsed.balance !== "number") return { value: null, updatedAt: null, available: false };
    return { value: parsed.balance, updatedAt: parsed.updatedAt ?? null, available: true };
  } catch {
    return { value: null, updatedAt: null, available: false };
  }
}

export async function loadAllSheetSources(period: PeriodKey) {
  const entries = await Promise.all(
    SHEET_SOURCE_CONFIGS.map(async (config) => ({
      config,
      ...(await readConfiguredSheetMetrics(config, period))
    }))
  );

  const bank = await readBankBalance();

  return { entries, bank };
}
