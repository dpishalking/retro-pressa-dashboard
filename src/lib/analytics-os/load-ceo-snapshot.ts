import { readdir } from "node:fs/promises";
import path from "node:path";
import { readBitrixSnapshot, type BitrixSnapshot } from "@/lib/bitrix/snapshot-store";
import { getCompanySnapshot, readCompanySnapshot } from "@/lib/company-snapshot";
import { cashRoas, paidCpl, revenuePlanCompletion } from "@/lib/metrics-engine";
import { targetScenario } from "@/data/demo-data";
import {
  aggregateCountries,
  aggregateCustomers,
  aggregateFunnel,
  aggregateManagers,
  aggregateProducts,
  aggregateRevenueTree,
  aovFromBitrix,
  buildMonthlyFromBitrix,
  conversionFromBitrix,
  filterSnapshot,
  type AnalyticsFilters
} from "@/lib/analytics-os/aggregate-from-bitrix";
import { buildOwnerIntelligence } from "@/lib/analytics-os/owner-intelligence";
import { metricValue, noDataMetric } from "@/lib/analytics-os/metric-value";
import {
  analyticsPeriodToLegacy,
  daysElapsedInPeriod,
  defaultAnalyticsPeriod,
  knownLegacyAnalyticsPeriods,
  parseAnalyticsPeriod,
  periodCalendarBounds
} from "@/lib/analytics-os/period";
import type { CeoControlCenterSnapshot, AnalyticsPeriod } from "@/types/analytics-os";
import type { PeriodKey } from "@/types/metrics";

const AUDIT_DATA_QUALITY = {
  overallScore: 52,
  label: "AUDIT BASELINE",
  mode: "audit_baseline" as const,
  domains: [
    { id: "sales", name: "Sales", score: 78 },
    { id: "marketing", name: "Marketing", score: 48 },
    { id: "product", name: "Product", score: 42 },
    { id: "finance", name: "Finance", score: 45 },
    { id: "operations", name: "Operations", score: 28 }
  ]
};

async function listAvailablePeriods(): Promise<AnalyticsPeriod[]> {
  const fromLegacy = knownLegacyAnalyticsPeriods();
  const dir = path.join(process.cwd(), "data", "bitrix-snapshots");
  try {
    const files = await readdir(dir);
    const isoFromFiles = files
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.replace(/\.json$/, ""))
      .map((key) => {
        if (/^\d{4}-\d{2}$/.test(key)) return key;
        if (key === "may-2026") return "2026-05";
        if (key === "june-2026") return "2026-06";
        if (key === "july-2026") return "2026-07";
        return null;
      })
      .filter((v): v is AnalyticsPeriod => Boolean(v));
    return [...new Set([...fromLegacy, ...isoFromFiles])].sort();
  } catch {
    return fromLegacy;
  }
}

async function loadBitrixForPeriod(period: AnalyticsPeriod): Promise<BitrixSnapshot | null> {
  const legacy = analyticsPeriodToLegacy(period);
  if (legacy) {
    const snap = await readBitrixSnapshot(legacy);
    if (snap) return snap;
  }
  // Future: ISO-named snapshot files
  try {
    const isoPath = path.join(process.cwd(), "data", "bitrix-snapshots", `${period}.json`);
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(isoPath, "utf8");
    const parsed = JSON.parse(raw) as BitrixSnapshot;
    if (parsed?.version === 2 && Array.isArray(parsed.paidDeals)) return parsed;
  } catch {
    /* no iso snapshot */
  }
  return null;
}

async function loadAdSpend(legacy: PeriodKey | null): Promise<{ value: number | null; asOf: string | null; source: string }> {
  if (!legacy) return { value: null, asOf: null, source: "company-snapshot" };
  try {
    const cached = await readCompanySnapshot(legacy);
    if (cached?.canonical?.adSpend != null && cached.canonical.adSpend > 0) {
      return {
        value: cached.canonical.adSpend,
        asOf: cached.meta?.builtAt ?? null,
        source: "company-snapshot (Sheets/СВОД)"
      };
    }
    const live = await getCompanySnapshot({ period: legacy, forceRebuild: false });
    const spend = live.snapshot.canonical.adSpend ?? null;
    return {
      value: spend && spend > 0 ? spend : spend,
      asOf: live.snapshot.meta?.builtAt ?? null,
      source: "company-snapshot (Sheets/СВОД)"
    };
  } catch {
    return { value: null, asOf: null, source: "company-snapshot" };
  }
}

async function loadMariaMonthRevenue(period: AnalyticsPeriod): Promise<number | null> {
  try {
    const { sumMariaMonth, MARIA_DAILY_SEED } = await import("@/lib/sales-os/maria-daily");
    const seedSum = sumMariaMonth(MARIA_DAILY_SEED, period);
    if (seedSum.paidAmount > 0) return seedSum.paidAmount;
    return null;
  } catch {
    return null;
  }
}

export type LoadCeoSnapshotOptions = {
  period?: string | null;
  country?: string | null;
  managerId?: string | null;
  productId?: string | null;
  now?: Date;
};

export async function loadCeoSnapshot(options: LoadCeoSnapshotOptions = {}): Promise<CeoControlCenterSnapshot> {
  const now = options.now ?? new Date();
  const availablePeriods = await listAvailablePeriods();
  const requested = options.period ? parseAnalyticsPeriod(options.period, now) : defaultAnalyticsPeriod(availablePeriods, now);
  const period = requested;
  const legacy = analyticsPeriodToLegacy(period);
  const filters: AnalyticsFilters = {
    country: options.country || null,
    managerId: options.managerId || null,
    productId: options.productId || null
  };

  const snapshot = await loadBitrixForPeriod(period);
  const asOf = snapshot?.createdAt ?? null;
  const { calendarDays } = periodCalendarBounds(period);
  const daysElapsed = daysElapsedInPeriod(period, now);
  const daysRemaining = Math.max(0, calendarDays - daysElapsed);
  const planRevenueTarget = targetScenario.targetRevenue;

  const adSpendInfo = await loadAdSpend(legacy);
  const mariaRevenueValue = await loadMariaMonthRevenue(period);

  if (!snapshot) {
    return emptySnapshot({
      period,
      legacyPeriodKey: legacy,
      availablePeriods,
      planRevenueTarget,
      calendarDays,
      daysElapsed,
      daysRemaining,
      filters,
      mariaRevenueValue,
      adSpendInfo
    });
  }

  const { paidDeals, invoiceDeals, leads } = filterSnapshot(snapshot, filters);
  const tree = aggregateRevenueTree(paidDeals);
  const funnel = aggregateFunnel({ leads, invoiceDeals, paidDeals });
  const managers = aggregateManagers({ leads, paidDeals });
  const products = aggregateProducts(paidDeals);
  const countries = aggregateCountries({ paidDeals, leads });
  const customers = aggregateCustomers(paidDeals);
  const conversion = conversionFromBitrix(leads.length, paidDeals.length);
  const aov = aovFromBitrix(tree.revenue, tree.orders);

  const monthly = buildMonthlyFromBitrix({
    paidDeals,
    invoiceDeals,
    leads,
    adSpend: adSpendInfo.value ?? 0,
    periodLabel: legacy || "july-2026"
  });

  const runRate =
    daysElapsed > 0 ? (tree.revenue / daysElapsed) * calendarDays : null;
  const forecastValue = runRate;
  const forecastSource = "темп факта × дни месяца";

  const revenueMetric = metricValue({
    metricId: "revenue",
    value: tree.revenue,
    status: "live",
    asOf,
    source: "Bitrix WON (CLOSEDATE + STAGE_SEMANTIC_ID=S)",
    confidence: "high",
    plan: planRevenueTarget,
    unit: "eur",
    decisionHint: "Основная выручка — Bitrix оплаты"
  });

  const leadsMetric = metricValue({
    metricId: "leads",
    value: leads.length,
    status: "live",
    asOf,
    source: "Bitrix leads (DATE_CREATE in period snapshot)",
    unit: "count"
  });

  const ordersMetric = metricValue({
    metricId: "paid_orders",
    value: tree.orders,
    status: "live",
    asOf,
    source: "Bitrix paidDeals",
    unit: "count"
  });

  const aovMetric = metricValue({
    metricId: "aov",
    value: aov,
    status: aov == null ? "no_data" : "calculated",
    asOf,
    source: "metrics-engine averagePaidCheck / Bitrix",
    unit: "eur",
    confidence: "high"
  });

  const crMetric = metricValue({
    metricId: "conversion_rate",
    value: conversion,
    status: conversion == null ? "no_data" : "calculated",
    asOf,
    source: "paid_orders / leads (period snapshot)",
    unit: "pct",
    confidence: "medium",
    decisionHint: "Конверсия за период"
  });

  const repeatMetric = metricValue({
    metricId: "repeat_rate",
    value: customers.repeatRate,
    status: customers.repeatRate == null ? "no_data" : "calculated",
    asOf,
    source: "customer_key from paid deals",
    unit: "pct",
    confidence: "medium"
  });

  const adSpendMetric =
    adSpendInfo.value == null
      ? noDataMetric("ad_spend", "СВОД / company-snapshot", "Нет spend в snapshot", "eur")
      : metricValue({
          metricId: "ad_spend",
          value: adSpendInfo.value,
          status: "manual",
          asOf: adSpendInfo.asOf,
          source: adSpendInfo.source,
          confidence: "medium",
          unit: "eur"
        });

  const cplMetric =
    adSpendInfo.value == null || !monthly.paidLeads
      ? metricValue({
          metricId: "cpl",
          value: adSpendInfo.value != null && leads.length > 0 ? adSpendInfo.value / leads.length : null,
          status: adSpendInfo.value == null ? "no_data" : "calculated",
          asOf: adSpendInfo.asOf,
          source: "ad_spend / leads (aggregate Sheets) — PARTIAL",
          confidence: "low",
          unit: "eur"
        })
      : metricValue({
          metricId: "cpl",
          value: paidCpl({ ...monthly, paidLeads: Math.max(1, leads.length) }),
          status: "calculated",
          asOf: adSpendInfo.asOf,
          source: "ad_spend / leads — PARTIAL (no Ads API)",
          confidence: "low",
          unit: "eur"
        });

  // Fix CPL: use leads.length as denominator when paidLeads is 0 in our monthly builder
  if (cplMetric.value == null && adSpendInfo.value != null && leads.length > 0) {
    cplMetric.value = adSpendInfo.value / leads.length;
    cplMetric.status = "calculated";
  }

  const cacMetric =
    adSpendInfo.value == null || customers.newCustomers <= 0
      ? noDataMetric("cac", "ad_spend / new customers", "Нужны spend и new customers", "eur")
      : metricValue({
          metricId: "cac",
          value: adSpendInfo.value / customers.newCustomers,
          status: "calculated",
          asOf: adSpendInfo.asOf,
          source: "ad_spend / new paid customers — PARTIAL",
          confidence: "low",
          unit: "eur"
        });

  const roasMetric =
    adSpendInfo.value == null || adSpendInfo.value <= 0
      ? noDataMetric("roas", "revenue / ad_spend", undefined, "ratio")
      : metricValue({
          metricId: "roas",
          value: cashRoas({ ...monthly, adSpend: adSpendInfo.value }),
          status: "calculated",
          asOf: adSpendInfo.asOf,
          source: "cash ROAS — PARTIAL (Sheets spend)",
          confidence: "low",
          unit: "ratio"
        });

  const grossProfitMetric = noDataMetric(
    "gross_profit",
    "Finance / COGS",
    "Order-level COGS not available",
    "eur"
  );

  const contributionMetric = noDataMetric(
    "contribution_margin",
    "variable costs",
    "Shipping, fees, actual COGS missing",
    "pct"
  );

  const productionLoad = noDataMetric("production_load", "Производство", "Нет связи", "pct");
  const cashMetric = noDataMetric("cash", "Финансы", "Касса пока не подключена", "eur");

  // Pipeline: open invoices still in progress (semantic P) from invoice deals list
  const openDeals = invoiceDeals.filter((d) => d.stageSemanticId === "P");
  const pipelineAmount = openDeals.reduce((s, d) => s + (d.opportunity || 0), 0);

  const pipeline = {
    openDeals: metricValue({
      metricId: "pipeline_open_deals",
      value: openDeals.length,
      status: "live",
      asOf,
      source: "Bitrix invoice deals STAGE_SEMANTIC_ID=P",
      unit: "count",
      confidence: "medium"
    }),
    pipelineAmount: metricValue({
      metricId: "pipeline_amount",
      value: pipelineAmount,
      status: "live",
      asOf,
      source: "Sum OPPORTUNITY open invoice deals",
      unit: "eur",
      confidence: "medium"
    }),
    weightedAmount: noDataMetric("pipeline_weighted", "Bitrix foundation pipeline", "Weighted amount not in analytics snapshot"),
    overdueDeals: noDataMetric("pipeline_overdue", "Bitrix foundation pipeline", "Overdue flags not in analytics snapshot")
  };

  const planCompletionValue = revenuePlanCompletion(tree.revenue, planRevenueTarget);
  const gapValue = tree.revenue - planRevenueTarget;

  const mariaMetric =
    mariaRevenueValue == null
      ? noDataMetric("maria_revenue", "Maria truth sheet", "Maria month total unavailable", "eur")
      : metricValue({
          metricId: "maria_revenue",
          value: mariaRevenueValue,
          status: "manual",
          asOf,
          source: "Maria operational truth",
          unit: "eur",
          confidence: "medium"
        });

  const bitrixVsMariaDelta =
    mariaRevenueValue == null
      ? noDataMetric("bitrix_vs_maria_delta", "reconciliation", undefined, "eur")
      : metricValue({
          metricId: "bitrix_vs_maria_delta",
          value: tree.revenue - mariaRevenueValue,
          status: "calculated",
          asOf,
          source: "Bitrix − Maria",
          unit: "eur"
        });

  const bitrixVsMariaDeltaPct =
    mariaRevenueValue == null || mariaRevenueValue === 0
      ? noDataMetric("bitrix_vs_maria_delta_pct", "reconciliation", undefined, "pct")
      : metricValue({
          metricId: "bitrix_vs_maria_delta_pct",
          value: (tree.revenue - mariaRevenueValue) / mariaRevenueValue,
          status: "calculated",
          asOf,
          source: "(Bitrix − Maria) / Maria",
          unit: "pct"
        });

  const ownerIntelligence = buildOwnerIntelligence({
    revenue: tree.revenue,
    planRevenue: planRevenueTarget,
    aov,
    paidOrders: tree.orders,
    forecastRevenue: forecastValue,
    topCountry: tree.countries[0] ?? null,
    topManager: managers[0] ?? null,
    pipeline,
    hasBitrixData: true
  });

  const filterOptions = {
    countries: [...new Set(snapshot.paidDeals.map((d) => d.country).filter(Boolean))].sort(),
    managers: [...new Map(
      [...snapshot.leads, ...snapshot.paidDeals].map((row) => [
        row.assignedById,
        { id: row.assignedById, name: row.managerName || row.assignedById }
      ])
    ).values()],
    products: [...new Map(
      snapshot.paidDeals.flatMap((deal) => {
        const p = deal.products.find((x) => x.productId || x.productName);
        if (!p) return [];
        const id = p.productId || p.productName;
        return [[id, { id, name: p.productName || p.productId }]] as const;
      })
    ).values()]
  };

  return {
    period,
    legacyPeriodKey: legacy,
    asOf,
    filters: {
      country: filters.country ?? null,
      managerId: filters.managerId ?? null,
      productId: filters.productId ?? null
    },
    availablePeriods,
    filterOptions,
    metrics: {
      revenue: revenueMetric,
      gross_profit: grossProfitMetric,
      leads: leadsMetric,
      paid_orders: ordersMetric,
      conversion_rate: crMetric,
      aov: aovMetric,
      cac: cacMetric,
      repeat_rate: repeatMetric,
      pipeline_amount: pipeline.pipelineAmount,
      production_load: productionLoad,
      overdue: pipeline.overdueDeals,
      cash: cashMetric,
      cpl: cplMetric,
      roas: roasMetric,
      contribution_margin: contributionMetric,
      ad_spend: adSpendMetric
    },
    plan: {
      planRevenue: metricValue({
        metricId: "plan_revenue",
        value: planRevenueTarget,
        status: "manual",
        asOf,
        source: "targetScenario / North Star plan",
        unit: "eur",
        confidence: "medium"
      }),
      factRevenue: revenueMetric,
      forecastRevenue: metricValue({
        metricId: "forecast_revenue",
        value: forecastValue,
        status: forecastValue == null ? "no_data" : "calculated",
        asOf,
        source: forecastSource,
        unit: "eur",
        confidence: "medium"
      }),
      gap: metricValue({
        metricId: "plan_gap",
        value: forecastValue != null ? forecastValue - planRevenueTarget : gapValue,
        status: "calculated",
        asOf,
        source: "forecast − plan (or fact − plan)",
        unit: "eur"
      }),
      planCompletion: metricValue({
        metricId: "plan_completion",
        value: planCompletionValue,
        status: "calculated",
        asOf,
        source: "fact / plan",
        unit: "pct"
      }),
      daysElapsed,
      daysRemaining,
      calendarDays,
      forecastSource
    },
    revenueTree: {
      total: revenueMetric,
      countries: tree.countries.slice(0, 8),
      products: tree.products.slice(0, 8),
      managers: tree.managers.slice(0, 8)
    },
    funnel,
    managers,
    products: products.rows.slice(0, 20),
    countries: countries.slice(0, 20),
    customers: {
      customers: metricValue({
        metricId: "customers",
        value: customers.customers,
        status: "calculated",
        asOf,
        source: "customer_key from paid deals",
        unit: "count"
      }),
      newCustomers: metricValue({
        metricId: "new_customers",
        value: customers.newCustomers,
        status: "calculated",
        asOf,
        source: "paid_orders_count = 1 in period view",
        unit: "count",
        confidence: "medium"
      }),
      repeatCustomers: metricValue({
        metricId: "repeat_customers",
        value: customers.repeatCustomers,
        status: "calculated",
        asOf,
        source: "paid_orders_count > 1",
        unit: "count",
        confidence: "medium"
      }),
      repeatRate: repeatMetric,
      avgCustomerRevenue: metricValue({
        metricId: "avg_customer_revenue",
        value: customers.avgCustomerRevenue,
        status: customers.avgCustomerRevenue == null ? "no_data" : "calculated",
        asOf,
        source: "LTV proxy (period paid revenue / customers)",
        unit: "eur",
        confidence: "medium",
        decisionHint: "LTV частично"
      })
    },
    pipeline,
    marketing: {
      adSpend: adSpendMetric,
      cpl: cplMetric,
      cac: cacMetric,
      roas: roasMetric,
      note: "Маркетинг частично. Детали — в разделе Реклама."
    },
    production: {
      status: "no_data",
      message: "Статусы производства пока нет.",
      available: ["Нормы сроков из Product Hub"],
      missing: [
        "старт производства",
        "конец производства",
        "дата отправки",
        "дата доставки"
      ]
    },
    reconciliation: {
      bitrixRevenue: revenueMetric,
      mariaRevenue: mariaMetric,
      svodAttributedRevenue: noDataMetric(
        "svod_attributed_revenue",
        "СВОД / Traffic OS",
        "Not loaded in Phase 1 facade (Traffic→Mother blocked)",
        "eur"
      ),
      bitrixVsMariaDelta,
      bitrixVsMariaDeltaPct
    },
    sources: [
      { id: "bitrix", name: "Bitrix24", connection: "connected", lastSync: asOf },
      { id: "sales_os", name: "Sales OS", connection: "partial", lastSync: null, note: "Экспорт опционально" },
      { id: "mother", name: "Mother OS", connection: "partial", lastSync: null, note: "Заказы через Bitrix" },
      { id: "traffic_os", name: "Traffic OS", connection: "partial", lastSync: null, note: "Cutover закрыт" },
      { id: "ga4", name: "GA4", connection: "connected", lastSync: null, note: "Раздел Реклама" },
      { id: "svod", name: "СВОД", connection: "partial", lastSync: adSpendInfo.asOf, note: "Расход сводно" },
      {
        id: "maria",
        name: "Maria",
        connection: mariaRevenueValue == null ? "partial" : "connected",
        lastSync: null,
        note: mariaRevenueValue == null ? "Месяц недоступен" : "Оперативный факт"
      },
      { id: "product_hub", name: "Product Hub", connection: "partial", lastSync: null },
      { id: "open_lines", name: "Open Lines", connection: "connected", lastSync: null, note: "Диалоги" },
      { id: "meta_ads", name: "Meta Ads API", connection: "not_connected", lastSync: null },
      { id: "google_ads", name: "Google Ads API", connection: "not_connected", lastSync: null }
    ],
    dataQuality: AUDIT_DATA_QUALITY,
    ownerIntelligence,
    multiProductOrdersPct: metricValue({
      metricId: "multi_product_orders_pct",
      value: products.multiProductOrdersPct,
      status: products.multiProductOrdersPct == null ? "no_data" : "calculated",
      asOf,
      source: "paid deals with productrows > 1 — Attach proxy PARTIAL",
      unit: "pct",
      confidence: "low"
    })
  };
}

function emptySnapshot(input: {
  period: AnalyticsPeriod;
  legacyPeriodKey: PeriodKey | null;
  availablePeriods: AnalyticsPeriod[];
  planRevenueTarget: number;
  calendarDays: number;
  daysElapsed: number;
  daysRemaining: number;
  filters: AnalyticsFilters;
  mariaRevenueValue: number | null;
  adSpendInfo: { value: number | null; asOf: string | null; source: string };
}): CeoControlCenterSnapshot {
  const no = (id: string, source: string, unit?: "eur" | "count" | "pct" | "ratio") =>
    noDataMetric(id, source, "Bitrix snapshot missing for period", unit);

  const pipeline = {
    openDeals: no("pipeline_open_deals", "Bitrix", "count"),
    pipelineAmount: no("pipeline_amount", "Bitrix", "eur"),
    weightedAmount: no("pipeline_weighted", "Bitrix", "eur"),
    overdueDeals: no("pipeline_overdue", "Bitrix", "count")
  };

  return {
    period: input.period,
    legacyPeriodKey: input.legacyPeriodKey,
    asOf: null,
    filters: {
      country: input.filters.country ?? null,
      managerId: input.filters.managerId ?? null,
      productId: input.filters.productId ?? null
    },
    availablePeriods: input.availablePeriods,
    filterOptions: { countries: [], managers: [], products: [] },
    metrics: {
      revenue: no("revenue", "Bitrix WON", "eur"),
      gross_profit: no("gross_profit", "Finance", "eur"),
      leads: no("leads", "Bitrix", "count"),
      paid_orders: no("paid_orders", "Bitrix", "count"),
      conversion_rate: no("conversion_rate", "calculated", "pct"),
      aov: no("aov", "calculated", "eur"),
      cac: no("cac", "marketing", "eur"),
      repeat_rate: no("repeat_rate", "customers", "pct"),
      pipeline_amount: pipeline.pipelineAmount,
      production_load: no("production_load", "Production", "pct"),
      overdue: pipeline.overdueDeals,
      cash: no("cash", "Finance", "eur"),
      cpl: no("cpl", "marketing", "eur"),
      roas: no("roas", "marketing", "ratio"),
      contribution_margin: no("contribution_margin", "Finance", "pct"),
      ad_spend: input.adSpendInfo.value == null
        ? no("ad_spend", "СВОД", "eur")
        : metricValue({
            metricId: "ad_spend",
            value: input.adSpendInfo.value,
            status: "manual",
            asOf: input.adSpendInfo.asOf,
            source: input.adSpendInfo.source,
            unit: "eur",
            confidence: "medium"
          })
    },
    plan: {
      planRevenue: metricValue({
        metricId: "plan_revenue",
        value: input.planRevenueTarget,
        status: "manual",
        source: "targetScenario",
        unit: "eur"
      }),
      factRevenue: no("revenue", "Bitrix WON", "eur"),
      forecastRevenue: no("forecast_revenue", "run-rate", "eur"),
      gap: no("plan_gap", "plan", "eur"),
      planCompletion: no("plan_completion", "plan", "pct"),
      daysElapsed: input.daysElapsed,
      daysRemaining: input.daysRemaining,
      calendarDays: input.calendarDays,
      forecastSource: "n/a"
    },
    revenueTree: {
      total: no("revenue", "Bitrix WON", "eur"),
      countries: [],
      products: [],
      managers: []
    },
    funnel: [
      { id: "leads", label: "Лиды", count: null, status: "no_data", conversionFromPrevious: null, dropOffFromPrevious: null, medianDaysInStage: null },
      { id: "deals", label: "Сделки", count: null, status: "no_data", conversionFromPrevious: null, dropOffFromPrevious: null, medianDaysInStage: null },
      { id: "invoices", label: "Счета", count: null, status: "no_data", conversionFromPrevious: null, dropOffFromPrevious: null, medianDaysInStage: null },
      { id: "paid", label: "Оплаты", count: null, status: "no_data", conversionFromPrevious: null, dropOffFromPrevious: null, medianDaysInStage: null }
    ],
    managers: [],
    products: [],
    countries: [],
    customers: {
      customers: no("customers", "Bitrix", "count"),
      newCustomers: no("new_customers", "Bitrix", "count"),
      repeatCustomers: no("repeat_customers", "Bitrix", "count"),
      repeatRate: no("repeat_rate", "Bitrix", "pct"),
      avgCustomerRevenue: no("avg_customer_revenue", "Bitrix", "eur")
    },
    pipeline,
    marketing: {
      adSpend: no("ad_spend", "СВОД", "eur"),
      cpl: no("cpl", "marketing", "eur"),
      cac: no("cac", "marketing", "eur"),
      roas: no("roas", "marketing", "ratio"),
      note: "Нет снимка Bitrix за период."
    },
    production: {
      status: "no_data",
      message: "Статусы производства пока нет.",
      available: ["Нормы сроков из Product Hub"],
      missing: ["старт производства", "конец производства", "дата отправки", "дата доставки"]
    },
    reconciliation: {
      bitrixRevenue: no("revenue", "Bitrix WON", "eur"),
      mariaRevenue:
        input.mariaRevenueValue == null
          ? no("maria_revenue", "Maria", "eur")
          : metricValue({
              metricId: "maria_revenue",
              value: input.mariaRevenueValue,
              status: "manual",
              source: "Maria",
              unit: "eur"
            }),
      svodAttributedRevenue: no("svod_attributed_revenue", "СВОД", "eur"),
      bitrixVsMariaDelta: no("bitrix_vs_maria_delta", "reconciliation", "eur"),
      bitrixVsMariaDeltaPct: no("bitrix_vs_maria_delta_pct", "reconciliation", "pct")
    },
    sources: [
      { id: "bitrix", name: "Bitrix24", connection: "partial", lastSync: null, note: `Нет снимка за ${input.period}` },
      { id: "meta_ads", name: "Meta Ads API", connection: "not_connected", lastSync: null },
      { id: "google_ads", name: "Google Ads API", connection: "not_connected", lastSync: null }
    ],
    dataQuality: AUDIT_DATA_QUALITY,
    ownerIntelligence: buildOwnerIntelligence({
      revenue: null,
      planRevenue: input.planRevenueTarget,
      aov: null,
      paidOrders: null,
      forecastRevenue: null,
      topCountry: null,
      topManager: null,
      pipeline,
      hasBitrixData: false
    }),
    multiProductOrdersPct: no("multi_product_orders_pct", "Bitrix", "pct")
  };
}
