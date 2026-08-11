/**
 * Read plan / fact / прогноз month totals (МЕС column) from Sales-Planning UX grids.
 */

import { readSheetValues } from "@/lib/google/sheets-client";
import { quoteTab } from "@/lib/sales-os/predictive-model";

export type FrontGridMetric = {
  key: string;
  label: string;
  unit: "eur" | "count" | "ratio";
  plan: number | null;
  fact: number | null;
  forecast: number | null;
  status: string;
};

export type FrontGridReadResult = {
  ok: boolean;
  spreadsheetId: string;
  tabTitle: string;
  monthLabel: string;
  mesCol: number;
  metrics: FrontGridMetric[];
  errors: string[];
};

const METRIC_ALIASES: Record<string, { key: string; label: string; unit: FrontGridMetric["unit"] }> = {
  revenue: { key: "paid_revenue", label: "Выручка", unit: "eur" },
  sale: { key: "payments", label: "Оплаты", unit: "count" },
  sales: { key: "payments", label: "Оплаты", unit: "count" },
  invoices: { key: "invoice_events", label: "Счета", unit: "eur" },
  aov: { key: "average_check", label: "Средний чек", unit: "eur" },
  leads: { key: "leads", label: "Лиды", unit: "count" },
  deals: { key: "deals", label: "Сделки", unit: "count" },
  cpl: { key: "cpl", label: "CPL", unit: "eur" },
  "cr l → deal": { key: "lead_to_deal_cr", label: "CR лид → сделка", unit: "ratio" },
  "cr l → sale": { key: "lead_to_payment_cr", label: "CR лид → оплата", unit: "ratio" },
  "cr deal → inv": { key: "deal_to_invoice_cr", label: "CR сделка → счёт", unit: "ratio" },
  "cr inv → sale": { key: "invoice_to_payment_cr", label: "CR счёт → оплата", unit: "ratio" }
};

function normalizeRole(raw: string): "plan" | "fact" | "forecast" | null {
  const v = raw.trim().toLowerCase();
  if (v === "план" || v === "plan") return "plan";
  if (v === "факт" || v === "fact") return "fact";
  if (v === "прогноз" || v === "ptf" || v === "forecast" || v === "run_rate") return "forecast";
  return null;
}

export function parseFrontNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let text = String(raw).trim();
  if (!text || text === "-" || text === "—" || /^NO_PLAN$/i.test(text) || /^BLOCKED/i.test(text)) {
    return null;
  }
  const isPct = /%/.test(text);
  text = text
    .replace(/€/g, "")
    .replace(/%/g, "")
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return isPct ? n / 100 : n;
}

function metricMeta(label: string): { key: string; label: string; unit: FrontGridMetric["unit"] } | null {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (METRIC_ALIASES[normalized]) return METRIC_ALIASES[normalized];
  for (const [alias, meta] of Object.entries(METRIC_ALIASES)) {
    if (normalized.includes(alias)) return meta;
  }
  return {
    key: normalized.replace(/[^a-z0-9]+/g, "_"),
    label: label.trim(),
    unit: "count"
  };
}

function findMesCol(headerRow: string[]): number {
  for (let i = headerRow.length - 1; i >= 0; i -= 1) {
    const cell = String(headerRow[i] ?? "")
      .trim()
      .toUpperCase();
    if (cell === "МЕС" || cell === "MES" || cell === "MONTH") return i;
  }
  return -1;
}

function statusFromValues(plan: number | null, fact: number | null, forecast: number | null): string {
  if (plan == null) return forecast != null || fact != null ? "NO_PLAN" : "UNKNOWN";
  const compare = forecast ?? fact;
  if (compare == null) return "NO_PLAN";
  if (compare >= plan * 0.98) return compare > plan * 1.02 ? "ABOVE_PLAN" : "ON_PLAN";
  return "BELOW_PLAN";
}

export async function readPredictiveFrontGrid(input: {
  spreadsheetId: string;
  tabTitle: string;
}): Promise<FrontGridReadResult> {
  const errors: string[] = [];
  const values = await readSheetValues({
    spreadsheetId: input.spreadsheetId,
    range: `${quoteTab(input.tabTitle)}!A1:BZ80`
  });

  if (!values.length) {
    return {
      ok: false,
      spreadsheetId: input.spreadsheetId,
      tabTitle: input.tabTitle,
      monthLabel: "",
      mesCol: -1,
      metrics: [],
      errors: ["Лист пуст"]
    };
  }

  const header = (values[1] || values[0] || []).map((c) => String(c ?? ""));
  const mesCol = findMesCol(header);
  if (mesCol < 0) {
    return {
      ok: false,
      spreadsheetId: input.spreadsheetId,
      tabTitle: input.tabTitle,
      monthLabel: String(values[0]?.[2] ?? ""),
      mesCol: -1,
      metrics: [],
      errors: ["Не найдена колонка МЕС"]
    };
  }

  const monthLabel = String(values[0]?.[2] ?? "").trim();
  const byKey = new Map<string, FrontGridMetric>();
  let current: FrontGridMetric | null = null;

  for (let r = 3; r < values.length; r += 1) {
    const row = values[r] || [];
    const colA = String(row[0] ?? "").trim();
    const colB = String(row[1] ?? "").trim();
    const role = normalizeRole(colB) || normalizeRole(colA);
    const mesRaw = String(row[mesCol] ?? "").trim();

    if (colA && !role) {
      // section headers like "Опережающие метрики"
      continue;
    }

    if (colA && role === "plan") {
      const meta = metricMeta(colA);
      if (!meta) continue;
      current = {
        key: meta.key,
        label: meta.label,
        unit: meta.unit,
        plan: parseFrontNumber(mesRaw),
        fact: null,
        forecast: null,
        status: "UNKNOWN"
      };
      byKey.set(meta.key, current);
      continue;
    }

    if (!current) continue;
    if (role === "fact") {
      // Skip percent-looking values on additive metrics (broken sheet formulas)
      const parsed = parseFrontNumber(mesRaw);
      if (current.unit !== "ratio" && /%/.test(mesRaw)) {
        current.fact = null;
      } else {
        current.fact = parsed;
      }
      continue;
    }
    if (role === "forecast") {
      const parsed = parseFrontNumber(mesRaw);
      if (current.unit !== "ratio" && /%/.test(mesRaw)) {
        current.forecast = null;
        errors.push(`${current.label}: прогноз в МЕС похож на % — пропущен`);
      } else {
        current.forecast = parsed;
      }
    }
  }

  const metrics = [...byKey.values()].map((metric) => ({
    ...metric,
    status: statusFromValues(metric.plan, metric.fact, metric.forecast)
  }));

  return {
    ok: metrics.some((m) => m.plan != null || m.fact != null || m.forecast != null),
    spreadsheetId: input.spreadsheetId,
    tabTitle: input.tabTitle,
    monthLabel,
    mesCol,
    metrics,
    errors
  };
}
