import { readdir } from "node:fs/promises";
import path from "node:path";
import { readBitrixSnapshot, type BitrixSnapshot } from "@/lib/bitrix/snapshot-store";
import { getCompanySnapshot, readCompanySnapshot } from "@/lib/company-snapshot";
import { cashRoas, revenuePlanCompletion } from "@/lib/metrics-engine";
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
  filterSnapshot,
  type AnalyticsFilters
} from "@/lib/analytics-os/aggregate-from-bitrix";
import { buildOwnerIntelligence } from "@/lib/analytics-os/owner-intelligence";
import {
  compareListVsSold,
  countUniqueLeadsWithHistory,
  managerBenchmark,
  opportunityGaps,
  pipelineAgeAnalysis,
  sumDelivery,
  type LeadIdentity
} from "@/lib/analytics-os/decision-extras";
import { metricValue, noDataMetric } from "@/lib/analytics-os/metric-value";
import {
  analyticsPeriodToLegacy,
  currentAnalyticsPeriod,
  daysElapsedInPeriod,
  defaultAnalyticsPeriod,
  knownLegacyAnalyticsPeriods,
  parseAnalyticsPeriod,
  periodCalendarBounds
} from "@/lib/analytics-os/period";
import { pullMonthlyPlanIndicators, pullSvodDailyLeads, sumSvodVerifiedLeads } from "@/lib/sales-os/svod-plans";
import {
  aggregateMargins,
  aggregateProductMargins,
  loadProductHubMarginCatalog
} from "@/lib/product-hub/sku-margin-catalog";
import { buildUnitEconomicsUnits } from "@/lib/analytics-os/unit-economics-units";
import { hydrateDealProducts, isMissingProductLabel } from "@/lib/bitrix/gift-type-resolver";
import type {
  AnalyticsPlanIndicator,
  AnalyticsProductMargin,
  CeoControlCenterSnapshot,
  AnalyticsPeriod
} from "@/types/analytics-os";
import type { PeriodKey } from "@/types/metrics";

const MONTHLY_PLAN_SOURCE_LABEL = "Таблица «План/факт»";
const SVOD_VERIFIED_LEADS_SOURCE = "СВОД day · Лиды CRM (ALX+Органика)";

function rigaDateIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

/** Calendar yesterday in Europe/Riga (СВОД usually closes the previous day). */
function rigaYesterdayIso(now = new Date()): string {
  const today = rigaDateIso(now);
  const [y, m, d] = today.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

function mapPlanIndicators(
  indicators: Awaited<ReturnType<typeof pullMonthlyPlanIndicators>>["indicators"]
): AnalyticsPlanIndicator[] {
  return indicators.map((item) => ({
    id: `${item.section}|${item.label}|${item.row}`,
    section: item.section,
    label: item.label,
    value: item.unit === "pct" && item.value > 1 ? item.value / 100 : item.value,
    unit: item.unit,
    source: MONTHLY_PLAN_SOURCE_LABEL
  }));
}

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
        if (key === "august-2026") return "2026-08";
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
    // Open month often has stale €0 cache — rebuild once from Google/СВОД.
    const live = await getCompanySnapshot({
      period: legacy,
      forceRebuild: !cached || !(cached.canonical?.adSpend > 0)
    });
    const spend = live.snapshot.canonical.adSpend ?? null;
    return {
      value: spend != null && spend > 0 ? spend : null,
      asOf: live.snapshot.meta?.builtAt ?? null,
      source: "company-snapshot (Sheets/СВОД)"
    };
  } catch {
    return { value: null, asOf: null, source: "company-snapshot" };
  }
}

async function loadPriorLeadIdentities(period: AnalyticsPeriod): Promise<LeadIdentity[]> {
  const prior = (await listAvailablePeriods()).filter((p) => p < period);
  const out: LeadIdentity[] = [];
  for (const p of prior) {
    const snap = await loadBitrixForPeriod(p);
    if (!snap) continue;
    for (const lead of snap.leads || []) {
      out.push({
        id: lead.id,
        phones: lead.phones || [],
        emails: lead.emails || [],
        contactId: lead.contactId ?? null
      });
    }
  }
  return out;
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

  let monthlyPlanBundle: Awaited<ReturnType<typeof pullMonthlyPlanIndicators>> | null = null;
  try {
    monthlyPlanBundle = await pullMonthlyPlanIndicators({ month: period });
  } catch {
    monthlyPlanBundle = null;
  }
  const planIndicators = mapPlanIndicators(monthlyPlanBundle?.indicators || []);
  const planRevenueTarget =
    monthlyPlanBundle?.obshie?.revenue ??
    monthlyPlanBundle?.channels?.obshie.revenue ??
    targetScenario.targetRevenue;
  const planSource =
    monthlyPlanBundle?.obshie?.revenue != null
      ? MONTHLY_PLAN_SOURCE_LABEL
      : "targetScenario / North Star (fallback)";
  const planLeads = monthlyPlanBundle?.channels?.obshie.leads ?? monthlyPlanBundle?.obshie?.leads ?? null;
  const planPaidLeads = monthlyPlanBundle?.channels?.paid.leads ?? null;
  const planOrganicLeads = monthlyPlanBundle?.channels?.organic.leads ?? null;
  const planSales = monthlyPlanBundle?.channels?.obshie.sale ?? monthlyPlanBundle?.obshie?.sale ?? null;
  const planAov = monthlyPlanBundle?.channels?.obshie.aov ?? monthlyPlanBundle?.obshie?.aov ?? null;
  const planSpend = monthlyPlanBundle?.channels?.obshie.spend ?? null;
  const planCrSale = monthlyPlanBundle?.channels?.obshie.crLeadSale ?? null;

  let adSpendInfo = await loadAdSpend(legacy);
  const mariaRevenueValue = await loadMariaMonthRevenue(period);

  if (!snapshot) {
    return emptySnapshot({
      period,
      legacyPeriodKey: legacy,
      availablePeriods,
      planRevenueTarget,
      planIndicators,
      planSource,
      calendarDays,
      daysElapsed,
      daysRemaining,
      filters,
      mariaRevenueValue,
      adSpendInfo
    });
  }

  const filtered = filterSnapshot(snapshot, filters);
  /** СВОД `day` has no country/manager grain — slice KPIs must use Bitrix. */
  const leadsSliced = Boolean(filters.country || filters.managerId);
  const currentMonth = currentAnalyticsPeriod(now);
  const throughDate = period >= currentMonth ? rigaYesterdayIso(now) : null;
  const reportingAsOf = throughDate ?? asOf;
  const through = (value: string | null | undefined) =>
    !throughDate || !value || value.slice(0, 10) <= throughDate;
  const paidDeals = filtered.paidDeals.filter((deal) => through(deal.paymentDate || deal.closeDate)).map(hydrateDealProducts);
  const invoiceDeals = filtered.invoiceDeals.filter((deal) => through(deal.invoiceDate)).map(hydrateDealProducts);
  const openPipeline = filtered.openPipeline.map(hydrateDealProducts);
  const leads = filtered.leads.filter((lead) => through(lead.dateCreate));
  const tree = aggregateRevenueTree(paidDeals);
  const funnel = aggregateFunnel({ leads, invoiceDeals, paidDeals });
  const managers = aggregateManagers({ leads, paidDeals });
  const historyLeads = await loadPriorLeadIdentities(period);
  const uniqueLeadStats = countUniqueLeadsWithHistory(leads, historyLeads);
  const deliveryStats = sumDelivery(paidDeals);
  const bench = managerBenchmark(leads, paidDeals);

  let marginCatalog: Awaited<ReturnType<typeof loadProductHubMarginCatalog>> | null = null;
  try {
    marginCatalog = await loadProductHubMarginCatalog();
  } catch {
    marginCatalog = null;
  }
  const marginAgg = marginCatalog ? aggregateMargins(paidDeals, marginCatalog) : null;
  const productMarginMap = marginCatalog ? aggregateProductMargins(paidDeals, marginCatalog) : undefined;
  const products = aggregateProducts(paidDeals, productMarginMap);
  const countries = aggregateCountries({ paidDeals, leads });
  const customers = aggregateCustomers(paidDeals);
  const aov = aovFromBitrix(tree.revenue, tree.orders);
  const productAov = aovFromBitrix(deliveryStats.productRevenue, tree.orders);

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
  const forecastSource = "если текущий темп сохранится";

  const revenueMetric = metricValue({
    metricId: "revenue",
    value: tree.revenue,
    status: "live",
    asOf: reportingAsOf,
    source: "Bitrix SPA Счета type/31: Оплачено + Дата завершения",
    confidence: "high",
    plan: leadsSliced ? null : planRevenueTarget,
    unit: "eur"
  });

  const uniqueCr =
    uniqueLeadStats.unique > 0 ? paidDeals.length / uniqueLeadStats.unique : null;

  // KPI «Лиды» = verified СВОД `day` «Лиды CRM» (уже ALX+Органика), не Bitrix и не day+Органика.
  // Bitrix cards / unique remain in the subtitle for reconciliation.
  let svodVerified: Awaited<ReturnType<typeof pullSvodDailyLeads>> | null = null;
  try {
    svodVerified = await pullSvodDailyLeads({ month: period });
  } catch {
    svodVerified = null;
  }
  const verifiedLeads = svodVerified
    ? sumSvodVerifiedLeads(svodVerified, { month: period, throughDate })
    : null;
  if (verifiedLeads && verifiedLeads.spend > 0) {
    adSpendInfo = {
      value: verifiedLeads.spend,
      asOf: verifiedLeads.lastDay,
      source: "СВОД day · расход MTD"
    };
  }

  const hasVerifiedLeads = verifiedLeads !== null;
  const slicedLeadCount = uniqueLeadStats.coverageWithIdentity > 0.3 ? uniqueLeadStats.unique : leads.length;
  const leadsMetric = leadsSliced
    ? metricValue({
        metricId: "leads",
        value: slicedLeadCount,
        status: "live",
        asOf: reportingAsOf,
        source: "Bitrix leads · фильтр страны/менеджера",
        unit: "count",
        confidence: uniqueLeadStats.coverageWithIdentity > 0.3 ? "medium" : "low",
        plan: null
      })
    : metricValue({
        metricId: "leads",
        value: hasVerifiedLeads ? verifiedLeads.total : null,
        status: hasVerifiedLeads ? "live" : "no_data",
        asOf: verifiedLeads?.lastDay ?? asOf,
        source: SVOD_VERIFIED_LEADS_SOURCE,
        unit: "count",
        confidence: hasVerifiedLeads ? "high" : "low",
        plan: planLeads
      });

  const paidLeadsMetric = leadsSliced
    ? metricValue({
        metricId: "paid_leads",
        value: null,
        status: "no_data",
        asOf: reportingAsOf,
        source: "СВОД без разреза по стране/менеджеру",
        unit: "count",
        plan: null
      })
    : metricValue({
        metricId: "paid_leads",
        value: hasVerifiedLeads ? verifiedLeads.paid : null,
        status: hasVerifiedLeads ? "live" : "no_data",
        asOf: verifiedLeads?.lastDay ?? asOf,
        source: SVOD_VERIFIED_LEADS_SOURCE,
        unit: "count",
        confidence: hasVerifiedLeads ? "high" : "low",
        plan:
          planPaidLeads ??
          (planLeads != null && planOrganicLeads != null ? Math.max(0, planLeads - planOrganicLeads) : null)
      });

  const organicLeadsMetric = leadsSliced
    ? metricValue({
        metricId: "organic_leads",
        value: null,
        status: "no_data",
        asOf: reportingAsOf,
        source: "СВОД без разреза по стране/менеджеру",
        unit: "count",
        plan: null
      })
    : metricValue({
        metricId: "organic_leads",
        value: hasVerifiedLeads ? verifiedLeads.organic : null,
        status: hasVerifiedLeads ? "live" : "no_data",
        asOf: verifiedLeads?.lastDay ?? asOf,
        source: SVOD_VERIFIED_LEADS_SOURCE,
        unit: "count",
        confidence: hasVerifiedLeads ? "high" : "low",
        plan: planOrganicLeads
      });

  const ordersMetric = metricValue({
    metricId: "paid_orders",
    value: tree.orders,
    status: "live",
    asOf: reportingAsOf,
    source: "Bitrix paidDeals",
    unit: "count",
    plan: leadsSliced ? null : planSales
  });

  const aovMetric = metricValue({
    metricId: "aov",
    value: aov,
    status: aov == null ? "no_data" : "calculated",
    asOf: reportingAsOf,
    source: "cash / paid orders (incl. delivery)",
    unit: "eur",
    confidence: "high",
    plan: leadsSliced ? null : planAov
  });

  const productAovMetric = metricValue({
    metricId: "product_aov",
    value: productAov,
    status: productAov == null ? "no_data" : "calculated",
    asOf: reportingAsOf,
    source: "(cash − delivery) / paid orders",
    unit: "eur",
    confidence: "high"
  });

  const verifiedCr = leadsSliced
    ? slicedLeadCount > 0
      ? paidDeals.length / slicedLeadCount
      : null
    : verifiedLeads && verifiedLeads.total > 0
      ? paidDeals.length / verifiedLeads.total
      : null;
  const crMetric = metricValue({
    metricId: "conversion_rate",
    value: verifiedCr,
    status: verifiedCr == null ? "no_data" : "calculated",
    asOf: leadsSliced ? reportingAsOf : verifiedLeads?.lastDay ?? asOf,
    source: leadsSliced
      ? "Bitrix paid orders / Bitrix leads (фильтр)"
      : "Bitrix paid orders / СВОД verified leads (same cutoff)",
    unit: "pct",
    confidence: verifiedCr == null ? "low" : leadsSliced ? "medium" : "medium",
    plan: leadsSliced ? null : planCrSale
  });

  const bitrixCardsMetric = metricValue({
    metricId: "bitrix_cards",
    value: leads.length,
    status: "live",
    asOf: reportingAsOf,
    source: "Bitrix leads DATE_CREATE in period",
    unit: "count",
    confidence: "high",
    decisionHint: "Все карточки CRM, включая повторные чаты"
  });

  const uniqueLeadsMetric = metricValue({
    metricId: "unique_leads",
    value: uniqueLeadStats.unique,
    status: "calculated",
    asOf: reportingAsOf,
    source: "Bitrix leads · phone/email/contact · history May→prior",
    unit: "count",
    confidence: uniqueLeadStats.coverageWithIdentity > 0.5 ? "medium" : "low",
    decisionHint:
      uniqueLeadStats.coverageWithIdentity > 0.3
        ? `Повторные ≈ ${uniqueLeadStats.duplicateApprox} · с телефоном/email ${Math.round(uniqueLeadStats.coverageWithIdentity * 100)}%`
        : "Мало телефонов и email — обновите синк Битрикс"
  });

  const uniqueCrMetric = metricValue({
    metricId: "unique_conversion_rate",
    value: uniqueCr,
    status: uniqueCr == null ? "no_data" : "calculated",
    asOf: reportingAsOf,
    source: "paid_orders / unique_leads",
    unit: "pct",
    confidence: uniqueLeadStats.coverageWithIdentity > 0.5 ? "medium" : "low",
    decisionHint: "Оплаты / уникальные люди"
  });

  const repeatMetric = metricValue({
    metricId: "repeat_rate",
    value: customers.repeatRate,
    status: customers.repeatRate == null ? "no_data" : "calculated",
    asOf,
    source: "customer_key from paid deals",
    unit: "pct",
    confidence: "medium",
    decisionHint: "Доля повторных покупателей за период"
  });

  const adSpendMetric =
    adSpendInfo.value == null
      ? metricValue({
          metricId: "ad_spend",
          value: null,
          status: "no_data",
          asOf: null,
          source: "СВОД / company-snapshot",
          unit: "eur",
          plan: planSpend,
          decisionHint: "Нет spend в snapshot"
        })
      : metricValue({
          metricId: "ad_spend",
          value: adSpendInfo.value,
          status: "manual",
          asOf: adSpendInfo.asOf,
          source: adSpendInfo.source,
          confidence: "medium",
          unit: "eur",
          plan: planSpend
        });

  const cplValue =
    leadsSliced || adSpendInfo.value == null || !verifiedLeads || verifiedLeads.total <= 0
      ? null
      : adSpendInfo.value / verifiedLeads.total;
  const cplMetric = leadsSliced
    ? noDataMetric("cpl", "ad_spend / leads", "Расход СВОД без разреза по стране — CPL не считаем", "eur")
    : metricValue({
        metricId: "cpl",
        value: cplValue,
        status: cplValue == null ? "no_data" : "calculated",
        asOf: verifiedLeads?.lastDay ?? adSpendInfo.asOf,
        source: "ad_spend / СВОД verified leads",
        confidence: cplValue == null ? "low" : "medium",
        unit: "eur",
        decisionHint: "Расход / верифицированные лиды"
      });

  const cacMetric =
    leadsSliced
      ? noDataMetric("cac", "marketing", "Расход СВОД без разреза по стране — CAC не считаем", "eur")
      : adSpendInfo.value == null || customers.newCustomers <= 0
        ? noDataMetric("cac", "marketing", "Нужны реклама и новые покупатели", "eur")
        : metricValue({
            metricId: "cac",
            value: adSpendInfo.value / customers.newCustomers,
            status: "calculated",
            asOf: adSpendInfo.asOf,
            source: "ad_spend / new paid customers — PARTIAL",
            confidence: "low",
            unit: "eur",
            decisionHint: "Реклама / новые покупатели"
          });

  const roasMetric =
    leadsSliced
      ? noDataMetric("roas", "revenue / ad_spend", "Расход СВОД без разреза по стране — ROAS не считаем", "ratio")
      : adSpendInfo.value == null || adSpendInfo.value <= 0
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

  const marginCoverage = marginAgg?.lineCoverage ?? 0;
  const marginStatus =
    marginAgg?.grossProfit == null
      ? "no_data"
      : marginCoverage >= 0.7
        ? "calculated"
        : "manual";
  const marginConfidence =
    marginAgg?.grossProfit == null ? "low" : marginCoverage >= 0.7 ? "high" : "medium";

  const grossProfitMetric =
    marginAgg?.grossProfit == null
      ? noDataMetric("gross_profit", "Product Hub", "Нет себестоимости по позициям заказа", "eur")
      : metricValue({
          metricId: "gross_profit",
          value: marginAgg.grossProfit,
          status: marginStatus,
          asOf: marginCatalog?.loadedAt ?? asOf,
          source: marginAgg.source,
          confidence: marginConfidence,
          unit: "eur",
          decisionHint: `€${Math.round(marginAgg.mappedRevenue).toLocaleString("ru-RU")} из €${Math.round(marginAgg.revenue).toLocaleString("ru-RU")} с себестоимостью · ${marginAgg.dealsWithProducts} из ${marginAgg.dealsTotal} оплат`
        });

  const contributionMetric =
    marginAgg?.grossProfit == null
      ? noDataMetric(
          "contribution_margin",
          "Product Hub COGS − ad spend",
          "Нужен COGS; комиссии платёжек ещё не вычтены",
          "pct"
        )
      : metricValue({
          metricId: "contribution_margin",
          value:
            marginAgg.mappedRevenue > 0
              ? (marginAgg.grossProfit - (adSpendInfo.value ?? 0)) / marginAgg.mappedRevenue
              : null,
          status: "calculated",
          asOf: marginCatalog?.loadedAt ?? asOf,
          source: "Валовая на (cash−доставка) − реклама / product cash с COGS",
          confidence: "medium",
          unit: "pct",
          decisionHint: "Доставка уже вне базы выручки; комиссии ещё нет"
        });

  const productMarginBlock: AnalyticsProductMargin = {
    cogs:
      marginAgg?.cogs == null
        ? noDataMetric("product_cogs", "Product Hub", "COGS не сопоставлен", "eur")
        : metricValue({
            metricId: "product_cogs",
            value: marginAgg.cogs,
            status: marginStatus,
            asOf: marginCatalog?.loadedAt ?? asOf,
            source: marginAgg.source,
            confidence: marginConfidence,
            unit: "eur"
          }),
    grossProfit: grossProfitMetric,
    marginRate:
      marginAgg?.marginRate == null
        ? noDataMetric("product_margin_rate", "Product Hub", undefined, "pct")
        : metricValue({
            metricId: "product_margin_rate",
            value: marginAgg.marginRate,
            status: marginStatus,
            asOf: marginCatalog?.loadedAt ?? asOf,
            source: marginAgg.source,
            confidence: marginConfidence,
            unit: "pct"
          }),
    mappedDeals: marginAgg?.dealsFullyMapped ?? 0,
    dealsWithProducts: marginAgg?.dealsWithProducts ?? 0,
    dealsTotal: paidDeals.length,
    lineCoverage: marginCoverage,
    source: marginAgg?.source || "Product Hub unavailable"
  };

  const productionLoad = noDataMetric("production_load", "Производство", "Пока нет данных по загрузке", "pct");
  const cashMetric = noDataMetric("cash", "Финансы", "Касса пока не подключена", "eur");

  const deliveryHasField = (deliveryStats.fieldCoveragePct || 0) > 0;
  const deliveryBlock = {
    deliveryRevenue: metricValue({
      metricId: "delivery_revenue",
      value: deliveryHasField ? deliveryStats.delivery : null,
      status: deliveryHasField ? "live" : "no_data",
      asOf,
      source: "Bitrix UF «Доставка цена»",
      unit: "eur" as const,
      confidence: "high" as const,
      decisionHint: deliveryHasField
        ? `${deliveryStats.dealsWithDelivery} сделок с доставкой > 0`
        : "Поле не в снапшоте — обновите Bitrix sync"
    }),
    productRevenue: metricValue({
      metricId: "product_revenue_net",
      value: deliveryHasField ? deliveryStats.productRevenue : null,
      status: deliveryHasField ? "calculated" : "no_data",
      asOf,
      source: "cash − delivery",
      unit: "eur" as const,
      confidence: "high" as const,
      decisionHint: "Касса без доставки"
    }),
    deliverySharePct: metricValue({
      metricId: "delivery_share_pct",
      value: deliveryHasField ? deliveryStats.deliverySharePct : null,
      status: deliveryHasField ? "calculated" : "no_data",
      asOf,
      source: "delivery / cash",
      unit: "pct" as const,
      confidence: "high" as const
    }),
    dealsWithDelivery: deliveryStats.dealsWithDelivery,
    fieldCoveragePct: deliveryStats.fieldCoveragePct
  };

  const pricingCompare = compareListVsSold(paidDeals, marginCatalog).slice(0, 15);

  // Prefer full open pipeline from snapshot; fallback to invoice deals still in P
  const openDeals =
    openPipeline.length > 0
      ? openPipeline
      : invoiceDeals.filter((d) => d.stageSemanticId === "P");
  const pipelineAmount = openDeals.reduce((s, d) => s + (d.opportunity || 0), 0);
  const age = pipelineAgeAnalysis(openDeals, now);
  const pipelineSource =
    openPipeline.length > 0
      ? "Bitrix openPipeline STAGE_SEMANTIC_ID=P"
      : "Bitrix invoice deals STAGE_SEMANTIC_ID=P (fallback)";

  const pipeline = {
    openDeals: metricValue({
      metricId: "pipeline_open_deals",
      value: openDeals.length,
      status: "live",
      asOf,
      source: pipelineSource,
      unit: "count",
      confidence: openPipeline.length > 0 ? "high" : "medium"
    }),
    pipelineAmount: metricValue({
      metricId: "pipeline_amount",
      value: pipelineAmount,
      status: "live",
      asOf,
      source: `Sum OPPORTUNITY · ${pipelineSource}`,
      unit: "eur",
      confidence: openPipeline.length > 0 ? "high" : "medium",
      decisionHint: "Сумма открытых сделок"
    }),
    weightedAmount: noDataMetric("pipeline_weighted", "Bitrix", "Нет взвешенной суммы воронки"),
    overdueDeals: metricValue({
      metricId: "pipeline_stuck_over_7d",
      value: age.stuckOver7d.deals,
      status: openDeals.length ? "calculated" : "no_data",
      asOf,
      source:
        (age.activityCoveragePct || 0) > 0.5
          ? "Open deals idle ≥ 8 days since LAST_ACTIVITY_TIME"
          : "Open deals idle ≥ 8 days (LAST_ACTIVITY fallback DATE_CREATE)",
      unit: "count",
      confidence: (age.activityCoveragePct || 0) > 0.5 ? "high" : "medium",
      decisionHint:
        age.stuckOver7d.deals > 0
          ? `Без ответа ≥ 8 дней · €${Math.round(age.stuckOver7d.amount).toLocaleString("ru-RU")}`
          : "Нет сделок без ответа дольше 8 дней"
    }),
    age
  };

  const pipelineStuckAmountMetric = metricValue({
    metricId: "pipeline_stuck_amount",
    value: age.stuckOver7d.amount,
    status: openDeals.length ? "calculated" : "no_data",
    asOf,
    source: pipeline.overdueDeals.source,
    unit: "eur",
    confidence: pipeline.overdueDeals.confidence,
    decisionHint:
      age.stuckOver7d.deals > 0
        ? `${age.stuckOver7d.deals} сделок без касания ≥ 8 дней`
        : "Нет зависших сделок"
  });

  const opportunities = opportunityGaps({
    countries,
    managers: bench.rows,
    medianCountryCr: null,
    medianManagerRpl: bench.medianRevenuePerLead
  });

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
    countries: [
      ...new Set(
        [...snapshot.paidDeals, ...snapshot.leads]
          .map((row) => row.country)
          .filter((country): country is string => Boolean(country))
      )
    ].sort(),
    managers: [...new Map(
      [...snapshot.leads, ...snapshot.paidDeals]
        .filter((row) => row.assignedById)
        .map((row) => [
          row.assignedById,
          { id: row.assignedById, name: row.managerName || row.assignedById }
        ])
    ).values()],
    products: [...new Map(
      snapshot.paidDeals.flatMap((deal) => {
        const p = deal.products.find((x) => x.productId || x.productName);
        if (!p) return [];
        const id = p.productId || p.productName;
        if (!id) return [];
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
      paid_leads: paidLeadsMetric,
      organic_leads: organicLeadsMetric,
      bitrix_cards: bitrixCardsMetric,
      unique_leads: uniqueLeadsMetric,
      paid_orders: ordersMetric,
      conversion_rate: crMetric,
      unique_conversion_rate: uniqueCrMetric,
      aov: aovMetric,
      product_aov: productAovMetric,
      cac: cacMetric,
      repeat_rate: repeatMetric,
      pipeline_amount: pipeline.pipelineAmount,
      pipeline_stuck_amount: pipelineStuckAmountMetric,
      production_load: productionLoad,
      overdue: pipeline.overdueDeals,
      cash: cashMetric,
      cpl: cplMetric,
      roas: roasMetric,
      contribution_margin: contributionMetric,
      ad_spend: adSpendMetric,
      delivery_revenue: deliveryBlock.deliveryRevenue,
      product_revenue_net: deliveryBlock.productRevenue,
      delivery_share_pct: deliveryBlock.deliverySharePct
    },
    plan: {
      planRevenue: metricValue({
        metricId: "plan_revenue",
        value: planRevenueTarget,
        status: monthlyPlanBundle?.obshie?.revenue != null ? "live" : "manual",
        asOf,
        source: planSource,
        unit: "eur",
        confidence: monthlyPlanBundle?.obshie?.revenue != null ? "high" : "medium"
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
      forecastSource,
      indicators: planIndicators,
      planSource,
      indicatorCount: planIndicators.length
    },
    revenueTree: {
      total: revenueMetric,
      countries: tree.countries.slice(0, 8),
      products: tree.products.filter((row) => !isMissingProductLabel(row.name)).slice(0, 8),
      managers: tree.managers.slice(0, 8)
    },
    funnel,
    managers,
    products: products.rows.filter((row) => !isMissingProductLabel(row.productName)).slice(0, 20),
    crmMissingProducts: {
      orders: products.missingOrders,
      revenue: products.missingRevenue
    },
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
    productMargin: productMarginBlock,
    unitEconomics: {
      units: buildUnitEconomicsUnits({
        paidDeals,
        leads,
        catalog: marginCatalog,
        adSpend: adSpendInfo.value,
        cpl: cplMetric.value,
        cac: cacMetric.value
      }),
      adSpend: adSpendInfo.value,
      cpl: cplMetric.value,
      cac: cacMetric.value
    },
    delivery: deliveryBlock,
    pricingCompare,
    managerBenchmark: {
      medianCr: bench.medianCr,
      p80Cr: bench.p80Cr,
      medianRevenuePerLead: bench.medianRevenuePerLead,
      p80RevenuePerLead: bench.p80RevenuePerLead
    },
    opportunities,
    production: {
      status: "no_data",
      message: "Статусы производства пока нет.",
      available: ["Нормы сроков из Product Hub", "COGS из 00_INDEX / SKU_MAP"],
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
        id: "monthly_plan",
        name: "План/факт",
        connection: planIndicators.length > 0 ? "connected" : "partial",
        lastSync: asOf,
        note:
          planIndicators.length > 0
            ? `${planIndicators.length} показателей · ${period}`
            : "Нет колонки плана за период"
      },
      {
        id: "maria",
        name: "Maria",
        connection: mariaRevenueValue == null ? "partial" : "connected",
        lastSync: null,
        note: mariaRevenueValue == null ? "Месяц недоступен" : "Оперативный факт"
      },
      {
        id: "product_hub",
        name: "Product Hub COGS",
        connection: marginAgg?.grossProfit != null ? "connected" : "partial",
        lastSync: marginCatalog?.loadedAt ?? null,
        note:
          marginAgg?.grossProfit != null
            ? `Маржа ${Math.round((marginAgg.marginRate || 0) * 100)}% · линии ${Math.round(marginCoverage * 100)}%`
            : "00_INDEX / SKU_MAP недоступны"
      },
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
  planIndicators: AnalyticsPlanIndicator[];
  planSource: string;
  calendarDays: number;
  daysElapsed: number;
  daysRemaining: number;
  filters: AnalyticsFilters;
  mariaRevenueValue: number | null;
  adSpendInfo: { value: number | null; asOf: string | null; source: string };
}): CeoControlCenterSnapshot {
  const no = (id: string, source: string, unit?: "eur" | "count" | "pct" | "ratio") =>
    noDataMetric(id, source, "Нет данных за период", unit);

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
      revenue: no("revenue", "Bitrix оплаченные счета", "eur"),
      gross_profit: no("gross_profit", "Finance", "eur"),
      leads: no("leads", "Bitrix", "count"),
      paid_leads: no("paid_leads", "СВОД", "count"),
      organic_leads: no("organic_leads", "СВОД", "count"),
      bitrix_cards: no("bitrix_cards", "Bitrix", "count"),
      unique_leads: no("unique_leads", "Bitrix", "count"),
      paid_orders: no("paid_orders", "Bitrix", "count"),
      conversion_rate: no("conversion_rate", "calculated", "pct"),
      unique_conversion_rate: no("unique_conversion_rate", "calculated", "pct"),
      aov: no("aov", "calculated", "eur"),
      product_aov: no("product_aov", "calculated", "eur"),
      product_revenue_net: no("product_revenue_net", "Bitrix", "eur"),
      delivery_revenue: no("delivery_revenue", "Bitrix", "eur"),
      delivery_share_pct: no("delivery_share_pct", "calculated", "pct"),
      cac: no("cac", "marketing", "eur"),
      repeat_rate: no("repeat_rate", "customers", "pct"),
      pipeline_amount: pipeline.pipelineAmount,
      pipeline_stuck_amount: no("pipeline_stuck_amount", "Bitrix", "eur"),
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
        status: input.planIndicators.length > 0 ? "live" : "manual",
        source: input.planSource,
        unit: "eur"
      }),
      factRevenue: no("revenue", "Bitrix оплаченные счета", "eur"),
      forecastRevenue: no("forecast_revenue", "run-rate", "eur"),
      gap: no("plan_gap", "plan", "eur"),
      planCompletion: no("plan_completion", "plan", "pct"),
      daysElapsed: input.daysElapsed,
      daysRemaining: input.daysRemaining,
      calendarDays: input.calendarDays,
      forecastSource: "n/a",
      indicators: input.planIndicators,
      planSource: input.planSource,
      indicatorCount: input.planIndicators.length
    },
    revenueTree: {
      total: no("revenue", "Bitrix оплаченные счета", "eur"),
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
    crmMissingProducts: { orders: 0, revenue: 0 },
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
    productMargin: {
      cogs: no("product_cogs", "Product Hub", "eur"),
      grossProfit: no("gross_profit", "Product Hub", "eur"),
      marginRate: no("product_margin_rate", "Product Hub", "pct"),
      mappedDeals: 0,
      dealsWithProducts: 0,
      dealsTotal: 0,
      lineCoverage: 0,
      source: "Product Hub unavailable"
    },
    unitEconomics: {
      units: [],
      adSpend: input.adSpendInfo.value,
      cpl: null,
      cac: null
    },
    delivery: {
      deliveryRevenue: no("delivery_revenue", "Bitrix", "eur"),
      productRevenue: no("product_revenue_net", "Bitrix", "eur"),
      deliverySharePct: no("delivery_share_pct", "Bitrix", "pct"),
      dealsWithDelivery: 0,
      fieldCoveragePct: null
    },
    pricingCompare: [],
    managerBenchmark: {
      medianCr: null,
      p80Cr: null,
      medianRevenuePerLead: null,
      p80RevenuePerLead: null
    },
    opportunities: [],
    production: {
      status: "no_data",
      message: "Статусы производства пока нет.",
      available: ["Нормы сроков из Product Hub", "COGS из 00_INDEX / SKU_MAP"],
      missing: ["старт производства", "конец производства", "дата отправки", "дата доставки"]
    },
    reconciliation: {
      bitrixRevenue: no("revenue", "Bitrix оплаченные счета", "eur"),
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
      { id: "product_hub", name: "Product Hub COGS", connection: "partial", lastSync: null },
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
