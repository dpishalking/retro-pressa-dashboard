import { getSalesOsSpreadsheetId, SALES_OS_SHEETS } from "@/config/sales-os";
import { periodToIsoMonth } from "@/lib/financial-report/period";
import { buildCanonicalFinancialReport } from "@/lib/financial-report/build";
import { readSheetValues } from "@/lib/google/sheets-client";
import { loadMarketingFacts, monthTotals } from "@/lib/marketing-planning/facts";
import { forecastAdditive } from "@/lib/marketing-planning/rules";
import {
  DEPARTMENT_SCOPE_ID,
  PREDICTION_EXPORT_COLUMNS,
  type PredictionExportRow
} from "@/lib/sales-os/prediction/contract";
import {
  completedDaysThrough,
  datesInMonth,
  resolveForecastAsOf
} from "@/lib/sales-os/prediction/periods";
import { quoteTab } from "@/lib/sales-os/predictive-model";
import type { PeriodKey } from "@/types/metrics";
import type { PredictiveDomainBlock, PredictiveMetricRow, PredictiveOverview } from "./types";

const SALES_METRIC_LABELS: Record<string, { label: string; unit: PredictiveMetricRow["unit"] }> = {
  paid_revenue: { label: "Выручка (paid)", unit: "eur" },
  payments: { label: "Оплаты", unit: "count" },
  average_check: { label: "Средний чек", unit: "eur" },
  leads: { label: "Лиды", unit: "count" },
  deals: { label: "Сделки", unit: "count" },
  lead_to_payment_cr: { label: "CR лид → оплата", unit: "ratio" }
};

function todayIsoRiga(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

function parseNum(raw: string | null | undefined): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function asExportRows(values: string[][]): PredictionExportRow[] {
  if (!values.length) return [];
  const header = values[0].map((c) => String(c ?? "").trim());
  const idx = Object.fromEntries(PREDICTION_EXPORT_COLUMNS.map((col) => [col, header.indexOf(col)]));
  if (PREDICTION_EXPORT_COLUMNS.some((col) => (idx[col] ?? -1) < 0)) return [];

  return values.slice(1).map((raw) => {
    const row = {} as PredictionExportRow;
    for (const col of PREDICTION_EXPORT_COLUMNS) {
      row[col] = String(raw[idx[col]!] ?? "").trim();
    }
    return row;
  });
}

async function loadSalesBlock(isoMonth: string, today: string): Promise<PredictiveDomainBlock> {
  const base: PredictiveDomainBlock = {
    domain: "sales",
    title: "Продажи",
    subtitle: "Sales Prediction Layer: план / факт / run-rate по отделу.",
    status: "blocked",
    message: "Нет данных prediction export.",
    method: "calendar_run_rate",
    asOf: resolveForecastAsOf({ month: isoMonth, today }),
    updatedAt: null,
    metrics: [],
    notes: []
  };

  try {
    const spreadsheetId = getSalesOsSpreadsheetId();
    const values = await readSheetValues({
      spreadsheetId,
      range: `${quoteTab(SALES_OS_SHEETS.predictionExport)}!A1:Z`
    });
    const rows = asExportRows(values).filter(
      (row) =>
        row.period === isoMonth &&
        row.scope_type === "department" &&
        (row.scope_id === DEPARTMENT_SCOPE_ID || row.scope_id === "all" || row.scope_id === "")
    );

    if (!rows.length) {
      base.status = "partial";
      base.message = "Лист 98_PREDICTION_EXPORT пуст или без строк отдела за период. Запустите sync Sales Prediction.";
      base.notes.push("Источник: Sales OS → 98_PREDICTION_EXPORT");
      return base;
    }

    const preferred = [
      "paid_revenue",
      "payments",
      "average_check",
      "leads",
      "deals",
      "lead_to_payment_cr"
    ];
    const byMetric = new Map(rows.map((row) => [row.metric_id, row]));
    const metrics: PredictiveMetricRow[] = preferred
      .map((id) => byMetric.get(id))
      .filter((row): row is PredictionExportRow => Boolean(row))
      .map((row) => {
        const meta = SALES_METRIC_LABELS[row.metric_id] ?? {
          label: row.metric_id,
          unit: "count" as const
        };
        return {
          id: row.metric_id,
          label: meta.label,
          unit: meta.unit,
          plan: parseNum(row.plan_value),
          fact: parseNum(row.fact_value),
          forecast: parseNum(row.run_rate_value),
          gapToPlan: parseNum(row.gap_to_plan),
          status: row.status || "UNKNOWN",
          method: row.forecast_method || "calendar_run_rate"
        };
      });

    const latest = rows
      .map((row) => row.sync_updated_at || row.forecast_as_of)
      .filter(Boolean)
      .sort()
      .at(-1);

    return {
      ...base,
      status: metrics.length ? "ok" : "partial",
      message: metrics.length
        ? "Актуальный прогноз отдела из Sales Prediction Layer."
        : "Строки есть, но ключевые метрики не найдены.",
      asOf: rows[0]?.forecast_as_of || base.asOf,
      updatedAt: latest || null,
      metrics,
      notes: ["Источник: Sales OS → 98_PREDICTION_EXPORT", `Метод: ${rows[0]?.forecast_method || "calendar_run_rate"}`]
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      message: error instanceof Error ? error.message : "Не удалось загрузить продажи"
    };
  }
}

async function loadMarketingBlock(isoMonth: string, today: string): Promise<PredictiveDomainBlock> {
  const asOf = resolveForecastAsOf({ month: isoMonth, today });
  const elapsedDays = completedDaysThrough(isoMonth, asOf).length;
  const totalDays = datesInMonth(isoMonth).length;

  const base: PredictiveDomainBlock = {
    domain: "marketing",
    title: "Маркетинг",
    subtitle: "Календарный run-rate по лидам, сессиям, расходам и атрибутированной выручке.",
    status: "blocked",
    message: "Нет маркетинговых фактов.",
    method: "calendar_run_rate",
    asOf,
    updatedAt: null,
    metrics: [],
    notes: []
  };

  try {
    const facts = await loadMarketingFacts({ month: isoMonth });
    const totals = monthTotals(facts.dailyByDate);
    const metricDefs: Array<{
      id: string;
      label: string;
      unit: PredictiveMetricRow["unit"];
      fact: number | null;
      forecastAllowed: boolean;
    }> = [
      {
        id: "sessions",
        label: "Сессии",
        unit: "count",
        fact: totals.hasSessions ? totals.sessions : null,
        forecastAllowed: totals.hasSessions
      },
      {
        id: "leads",
        label: "Лиды",
        unit: "count",
        fact: totals.leads || null,
        forecastAllowed: totals.leads > 0
      },
      {
        id: "paid_leads",
        label: "Платные лиды",
        unit: "count",
        fact: totals.paid_leads || null,
        forecastAllowed: totals.paid_leads > 0
      },
      {
        id: "spend",
        label: "Рекламный spend",
        unit: "eur",
        fact: totals.hasSpend ? totals.spend : null,
        forecastAllowed: totals.hasSpend
      },
      {
        id: "paid_revenue",
        label: "Выручка (атриб.)",
        unit: "eur",
        fact: totals.paid_revenue_attr || totals.paid_revenue || null,
        forecastAllowed: (totals.paid_revenue_attr || totals.paid_revenue) > 0
      }
    ];

    const metrics: PredictiveMetricRow[] = metricDefs.map((def) => {
      const forecast = def.forecastAllowed
        ? forecastAdditive({
            method: "calendar_run_rate",
            factToDate: def.fact,
            elapsedDays,
            totalDays
          })
        : { value: null, status: "BLOCKED" as const, confidence: "unsupported" };

      return {
        id: def.id,
        label: def.label,
        unit: def.unit,
        plan: null,
        fact: def.fact,
        forecast: forecast.value,
        gapToPlan: null,
        status: forecast.status,
        method: "calendar_run_rate"
      };
    });

    const hasAny = metrics.some((m) => m.fact != null);
    return {
      ...base,
      status: hasAny ? (facts.warnings.length ? "partial" : "ok") : "partial",
      message: hasAny
        ? "Прогноз marketing planning (calendar run-rate). Воронка CR в v1 заблокирована."
        : "Факты за период не собрались — проверьте Traffic OS / Sales OS.",
      updatedAt: new Date().toISOString(),
      metrics,
      notes: [
        "Источник: Traffic OS + Sales OS daily facts",
        ...facts.warnings.slice(0, 3)
      ]
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      message: error instanceof Error ? error.message : "Не удалось загрузить маркетинг"
    };
  }
}

async function loadFinanceBlock(period: PeriodKey): Promise<PredictiveDomainBlock> {
  const base: PredictiveDomainBlock = {
    domain: "finance",
    title: "Финансы",
    subtitle: "Trailing daily run-rate по выручке, прибыли и cash на горизонтах 7 / 30 / 90 дней.",
    status: "blocked",
    message: "Нет финансового отчёта.",
    method: "trailing_daily_run_rate",
    asOf: null,
    updatedAt: null,
    metrics: [],
    notes: []
  };

  try {
    const report = await buildCanonicalFinancialReport({ period, mode: "FACT" });
    const points = report.forecast?.points ?? [];
    const metrics: PredictiveMetricRow[] = points.flatMap((point) => [
      {
        id: `revenue_${point.horizonDays}d`,
        label: `Выручка · ${point.horizonDays}д`,
        unit: "eur",
        plan: null,
        fact: report.summary?.revenue ?? null,
        forecast: point.revenue,
        gapToPlan: null,
        status: "FORECAST",
        method: point.method
      },
      {
        id: `profit_${point.horizonDays}d`,
        label: `Чистая прибыль · ${point.horizonDays}д`,
        unit: "eur",
        plan: null,
        fact: report.summary?.netProfit ?? null,
        forecast: point.netProfit,
        gapToPlan: null,
        status: "FORECAST",
        method: point.method
      }
    ]);

    // Keep a compact set: 30d focus + daily rates
    const compact = [
      {
        id: "daily_revenue_rate",
        label: "Дневной темп выручки",
        unit: "eur" as const,
        plan: null,
        fact: report.forecast?.dailyRunRateRevenue ?? null,
        forecast: report.forecast?.dailyRunRateRevenue ?? null,
        gapToPlan: null,
        status: "FORECAST",
        method: "trailing_daily_run_rate"
      },
      {
        id: "daily_profit_rate",
        label: "Дневной темп прибыли",
        unit: "eur" as const,
        plan: null,
        fact: report.forecast?.dailyRunRateProfit ?? null,
        forecast: report.forecast?.dailyRunRateProfit ?? null,
        gapToPlan: null,
        status: "FORECAST",
        method: "trailing_daily_run_rate"
      },
      ...metrics.filter((m) => m.id.includes("_30d") || m.id.includes("_90d"))
    ];

    return {
      ...base,
      status: compact.length ? "ok" : "partial",
      message: "Финансовый прогноз на основе company snapshot (trailing run-rate).",
      asOf: report.builtAt?.slice(0, 10) ?? null,
      updatedAt: report.builtAt ?? null,
      metrics: compact,
      notes: ["Источник: Financial Report / company snapshot", "Это не сценарий digital twin — только fact → run-rate"]
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      message: error instanceof Error ? error.message : "Не удалось загрузить финансы"
    };
  }
}

export async function loadPredictiveOverview(period: PeriodKey): Promise<PredictiveOverview> {
  const isoMonth = periodToIsoMonth(period);
  const today = todayIsoRiga();
  const [sales, marketing, finance] = await Promise.all([
    loadSalesBlock(isoMonth, today),
    loadMarketingBlock(isoMonth, today),
    loadFinanceBlock(period)
  ]);

  return {
    period,
    isoMonth,
    generatedAt: new Date().toISOString(),
    domains: { sales, marketing, finance }
  };
}
