import { PREDICTIVE_UI } from "@/config/predictive-ui";
import { periodToIsoMonth } from "@/lib/financial-report/period";
import { buildCanonicalFinancialReport } from "@/lib/financial-report/build";
import { readSheetValues } from "@/lib/google/sheets-client";
import {
  loadMarketingPredictiveModel,
  normalizeMarketingPredictiveScope,
  type MarketingPredictiveScope
} from "@/lib/marketing-planning/load-marketing-predictive";
import {
  DEPARTMENT_SCOPE_ID,
  PREDICTION_EXPORT_COLUMNS,
  type PredictionExportRow
} from "@/lib/sales-os/prediction/contract";
import { resolveForecastAsOf } from "@/lib/sales-os/prediction/periods";
import { quoteTab } from "@/lib/sales-os/predictive-model";
import { pullSvodPaidOrganicPlans } from "@/lib/sales-os/svod-plans";
import type { PeriodKey } from "@/types/metrics";
import { readPredictiveFrontGrid } from "./read-front-grid";
import type { PredictiveDomainBlock, PredictiveMetricRow, PredictiveOverview } from "./types";

const SALES_METRIC_ORDER = [
  "paid_revenue",
  "payments",
  "average_check",
  "leads",
  "deals",
  "invoice_events",
  "lead_to_payment_cr"
];

const SALES_METRIC_LABELS: Record<string, { label: string; unit: PredictiveMetricRow["unit"] }> = {
  paid_revenue: { label: "Выручка", unit: "eur" },
  payments: { label: "Оплаты", unit: "count" },
  average_check: { label: "Средний чек", unit: "eur" },
  leads: { label: "Лиды", unit: "count" },
  deals: { label: "Сделки", unit: "count" },
  invoice_events: { label: "Счета", unit: "count" },
  lead_to_payment_cr: { label: "CR лид → оплата", unit: "ratio" },
  cpl: { label: "CPL", unit: "eur" }
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

/** CEO «План/факт» → metric_id map (ОБЩИЕ block). */
async function loadCeoPlans(isoMonth: string): Promise<Map<string, number>> {
  const bundle = await pullSvodPaidOrganicPlans({
    month: isoMonth,
    spreadsheetId: PREDICTIVE_UI.plans.spreadsheetId(),
    tabTitle: PREDICTIVE_UI.plans.tabTitle()
  });
  const out = new Map<string, number>();
  if (!bundle) return out;
  const slice = bundle.obshie;
  if (slice.revenue != null) out.set("paid_revenue", slice.revenue);
  if (slice.sale != null) out.set("payments", slice.sale);
  if (slice.leads != null) out.set("leads", slice.leads);
  if (slice.invoices != null) out.set("invoice_events", slice.invoices);
  if (slice.aov != null) out.set("average_check", slice.aov);
  if (slice.crLeadSale != null) out.set("lead_to_payment_cr", slice.crLeadSale);
  if (slice.crLeadInvoice != null) out.set("lead_to_deal_cr", slice.crLeadInvoice);
  if (slice.cpl != null) out.set("cpl", slice.cpl);
  if (slice.spend != null) out.set("spend", slice.spend);
  return out;
}

async function loadSalesFromExport(
  isoMonth: string,
  plans: Map<string, number>
): Promise<{ metrics: PredictiveMetricRow[]; updatedAt: string | null; asOf: string | null } | null> {
  const spreadsheetId = PREDICTIVE_UI.sales.spreadsheetId();
  const values = await readSheetValues({
    spreadsheetId,
    range: `${quoteTab(PREDICTIVE_UI.sales.exportTab)}!A1:Z`
  });
  const rows = asExportRows(values).filter(
    (row) =>
      row.period === isoMonth &&
      row.scope_type === "department" &&
      (row.scope_id === DEPARTMENT_SCOPE_ID || row.scope_id === "sales" || row.scope_id === "all" || row.scope_id === "")
  );
  if (!rows.length) return null;

  const byMetric = new Map(rows.map((row) => [row.metric_id, row]));
  const metrics = SALES_METRIC_ORDER.map((id) => {
    const row = byMetric.get(id);
    const meta = SALES_METRIC_LABELS[id] ?? { label: id, unit: "count" as const };
    const plan = plans.get(id) ?? parseNum(row?.plan_value);
    const fact = parseNum(row?.fact_value);
    const forecast = parseNum(row?.run_rate_value);
    const gap = plan != null && forecast != null ? forecast - plan : parseNum(row?.gap_to_plan);
    return {
      id,
      label: meta.label,
      unit: meta.unit,
      plan,
      fact,
      forecast,
      gapToPlan: gap,
      status: row?.status || (plan == null ? "NO_PLAN" : "UNKNOWN"),
      method: row?.forecast_method || "calendar_run_rate"
    };
  }).filter((m) => m.plan != null || m.fact != null || m.forecast != null);

  const latest = rows
    .map((row) => row.sync_updated_at || row.forecast_as_of)
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    metrics,
    updatedAt: latest || null,
    asOf: rows[0]?.forecast_as_of || null
  };
}

async function loadSalesFromFront(
  plans: Map<string, number>
): Promise<{ metrics: PredictiveMetricRow[]; monthLabel: string; notes: string[] } | null> {
  const grid = await readPredictiveFrontGrid({
    spreadsheetId: PREDICTIVE_UI.sales.frontSpreadsheetId(),
    tabTitle: PREDICTIVE_UI.sales.frontTabTitle()
  });
  if (!grid.ok) return null;

  const byKey = new Map(grid.metrics.map((m) => [m.key, m]));
  const metrics = SALES_METRIC_ORDER.map((id) => {
    const row = byKey.get(id);
    const meta = SALES_METRIC_LABELS[id] ?? { label: id, unit: "count" as const };
    const plan = plans.get(id) ?? row?.plan ?? null;
    const fact = row?.fact ?? null;
    const forecast = row?.forecast ?? null;
    return {
      id,
      label: meta.label,
      unit: meta.unit,
      plan,
      fact,
      forecast,
      gapToPlan: plan != null && forecast != null ? forecast - plan : null,
      status: row?.status || (plan == null ? "NO_PLAN" : "UNKNOWN"),
      method: "calendar_run_rate"
    };
  }).filter((m) => m.plan != null || m.fact != null || m.forecast != null);

  return {
    metrics,
    monthLabel: grid.monthLabel,
    notes: [
      `Источник front: ${grid.tabTitle}`,
      ...grid.errors.slice(0, 3)
    ]
  };
}

async function loadSalesBlock(isoMonth: string, today: string): Promise<PredictiveDomainBlock> {
  const base: PredictiveDomainBlock = {
    domain: "sales",
    title: "Продажи",
    subtitle: "План из Finance «План/факт» · факт/прогноз из Sales Prediction / предиктивного фронта.",
    status: "blocked",
    message: "Нет данных продаж за период.",
    method: "calendar_run_rate",
    asOf: resolveForecastAsOf({ month: isoMonth, today }),
    updatedAt: null,
    metrics: [],
    notes: []
  };

  try {
    const plans = await loadCeoPlans(isoMonth);
    const fromExport = await loadSalesFromExport(isoMonth, plans);
    if (fromExport?.metrics.length) {
      return {
        ...base,
        status: plans.size ? "ok" : "partial",
        message: plans.size
          ? "План из Finance «План/факт», факт/прогноз из 98_PREDICTION_EXPORT."
          : "Факт/прогноз из 98_PREDICTION_EXPORT. План за период в «План/факт» не найден.",
        asOf: fromExport.asOf || base.asOf,
        updatedAt: fromExport.updatedAt,
        metrics: fromExport.metrics,
        notes: [
          `Планы: RP | Finance → ${PREDICTIVE_UI.plans.tabTitle()} (gid=${PREDICTIVE_UI.plans.sheetGid})`,
          `Факт/прогноз: Sales OS → ${PREDICTIVE_UI.sales.exportTab}`
        ]
      };
    }

    const fromFront = await loadSalesFromFront(plans);
    if (fromFront?.metrics.length) {
      return {
        ...base,
        status: "partial",
        message: `Export за ${isoMonth} пуст — показан фронт «${PREDICTIVE_UI.sales.frontTabTitle()}» (${fromFront.monthLabel || "месяц листа"}). Планы: Finance «План/факт».`,
        metrics: fromFront.metrics,
        notes: [
          `Планы: RP | Finance → ${PREDICTIVE_UI.plans.tabTitle()} (gid=${PREDICTIVE_UI.plans.sheetGid})`,
          ...fromFront.notes
        ]
      };
    }

    if (plans.size) {
      return {
        ...base,
        status: "partial",
        message: `Есть план за ${isoMonth} в «План/факт», но нет факта/прогноза в export и на фронте.`,
        metrics: [...plans.entries()].map(([id, plan]) => {
          const meta = SALES_METRIC_LABELS[id] ?? { label: id, unit: "count" as const };
          return {
            id,
            label: meta.label,
            unit: meta.unit,
            plan,
            fact: null,
            forecast: null,
            gapToPlan: null,
            status: "NO_PLAN",
            method: "calendar_run_rate"
          };
        }),
        notes: [`Планы: RP | Finance → ${PREDICTIVE_UI.plans.tabTitle()} (gid=${PREDICTIVE_UI.plans.sheetGid})`]
      };
    }

    return {
      ...base,
      status: "partial",
      message: `Нет строк Sales Prediction за ${isoMonth}. Синхронизируйте Sales Prediction или обновите «Предиктивка продажи».`,
      notes: [
        `Планы: RP | Finance → ${PREDICTIVE_UI.plans.tabTitle()}`,
        `Front fallback: ${PREDICTIVE_UI.sales.frontTabTitle()}`
      ]
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      message: error instanceof Error ? error.message : "Не удалось загрузить продажи"
    };
  }
}

async function loadMarketingBlock(
  isoMonth: string,
  today: string,
  scope: MarketingPredictiveScope = "general"
): Promise<PredictiveDomainBlock> {
  const scopeTitles: Record<MarketingPredictiveScope, string> = {
    general: "Маркетинг · общая",
    organic: "Маркетинг · органика",
    paid: "Маркетинг · платный трафик"
  };
  const base: PredictiveDomainBlock = {
    domain: "marketing",
    title: scopeTitles[scope],
    subtitle: "План · факт по дням · прогноз calendar_run_rate. Месяц можно развернуть по дням.",
    status: "blocked",
    message: "Нет данных маркетинга.",
    method: "calendar_run_rate",
    asOf: resolveForecastAsOf({ month: isoMonth, today }),
    updatedAt: null,
    metrics: [],
    notes: [],
    days: []
  };

  try {
    const model = await loadMarketingPredictiveModel({ isoMonth, scope });
    return {
      ...base,
      status: model.status,
      message: model.message,
      asOf: model.asOf || base.asOf,
      updatedAt: new Date().toISOString(),
      method: model.method,
      metrics: model.metrics.map((m) => ({
        id: m.id,
        label: m.label,
        unit: m.unit,
        plan: m.plan,
        fact: m.fact,
        forecast: m.forecast,
        gapToPlan: m.gapToPlan,
        status: m.status,
        method: model.method
      })),
      days: model.days.map((d) => ({
        date: d.date,
        leads: d.leads,
        deals: d.deals,
        invoiceEvents: d.invoiceEvents,
        payments: d.payments,
        paidRevenue: d.paidRevenue,
        spend: d.spend,
        averageCheck: d.averageCheck,
        cpl: d.cpl,
        leadToPaymentCr: d.leadToPaymentCr,
        completeness: d.completeness
      })),
      notes: model.notes
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
    const metrics: PredictiveMetricRow[] = [
      {
        id: "daily_revenue_rate",
        label: "Дневной темп выручки",
        unit: "eur",
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
        unit: "eur",
        plan: null,
        fact: report.forecast?.dailyRunRateProfit ?? null,
        forecast: report.forecast?.dailyRunRateProfit ?? null,
        gapToPlan: null,
        status: "FORECAST",
        method: "trailing_daily_run_rate"
      },
      ...points
        .filter((point) => point.horizonDays === 30 || point.horizonDays === 90)
        .flatMap((point) => [
          {
            id: `revenue_${point.horizonDays}d`,
            label: `Выручка · ${point.horizonDays}д`,
            unit: "eur" as const,
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
            unit: "eur" as const,
            plan: null,
            fact: report.summary?.netProfit ?? null,
            forecast: point.netProfit,
            gapToPlan: null,
            status: "FORECAST",
            method: point.method
          }
        ])
    ];

    return {
      ...base,
      status: metrics.length ? "ok" : "partial",
      message: "Финансовый прогноз на основе company snapshot (trailing run-rate).",
      asOf: report.builtAt?.slice(0, 10) ?? null,
      updatedAt: report.builtAt ?? null,
      metrics,
      notes: ["Источник: Financial Report / company snapshot"]
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      message: error instanceof Error ? error.message : "Не удалось загрузить финансы"
    };
  }
}

export async function loadPredictiveOverview(
  period: PeriodKey,
  options?: { marketingScope?: MarketingPredictiveScope | string | null }
): Promise<PredictiveOverview> {
  const isoMonth = periodToIsoMonth(period);
  const today = todayIsoRiga();
  const marketingScope = normalizeMarketingPredictiveScope(options?.marketingScope);
  const [sales, marketing, finance] = await Promise.all([
    loadSalesBlock(isoMonth, today),
    loadMarketingBlock(isoMonth, today, marketingScope),
    loadFinanceBlock(period)
  ]);

  return {
    period,
    isoMonth,
    generatedAt: new Date().toISOString(),
    domains: { sales, marketing, finance }
  };
}
