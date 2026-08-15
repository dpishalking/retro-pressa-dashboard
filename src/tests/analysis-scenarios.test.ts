import assert from "node:assert/strict";
import {
  ANALYSIS_SCENARIOS,
  getAnalysisScenario,
  runAnalysisScenario,
  SCENARIO_SAMPLE_THRESHOLDS
} from "@/lib/analytics-os/analysis-scenarios";
import { metricValue } from "@/lib/analytics-os/metric-value";
import type { AnalyticsManagerRow, AnalyticsMetricValue, CeoControlCenterSnapshot } from "@/types/analytics-os";

function m(
  id: string,
  value: number | null,
  plan: number | null = null,
  unit: AnalyticsMetricValue["unit"] = "count"
): AnalyticsMetricValue {
  return metricValue({
    metricId: id,
    value,
    plan,
    status: value == null ? "no_data" : "live",
    source: "test",
    unit,
    asOf: "2026-08-13T12:00:00.000Z"
  });
}

function manager(row: Partial<AnalyticsManagerRow> & Pick<AnalyticsManagerRow, "managerId" | "managerName" | "leads" | "paidOrders">): AnalyticsManagerRow {
  const cr = row.leads > 0 ? row.paidOrders / row.leads : null;
  return {
    conversionRate: cr,
    revenue: row.paidOrders * 74,
    aov: 74,
    revenuePerLead: cr == null ? null : cr * 74,
    productsPerOrder: 1,
    responseMinutes: null,
    responseConfidence: "low",
    isTopPerformer: false,
    ...row
  };
}

function augustSnapshot(overrides: Partial<CeoControlCenterSnapshot> = {}): CeoControlCenterSnapshot {
  const no = (id: string, unit?: AnalyticsMetricValue["unit"]) => m(id, null, null, unit);
  return {
    period: "2026-08",
    legacyPeriodKey: "august-2026",
    asOf: "2026-08-13T12:00:00.000Z",
    filters: { country: null, managerId: null, productId: null },
    availablePeriods: ["2026-08"],
    filterOptions: { countries: [], managers: [], products: [] },
    metrics: {
      revenue: m("revenue", 11439, 46676, "eur"),
      leads: m("leads", 990, 3334),
      paid_leads: m("paid_leads", 764, 2667),
      organic_leads: m("organic_leads", 226, 667),
      paid_orders: m("paid_orders", 154, 667),
      conversion_rate: m("conversion_rate", 0.156, 0.2, "pct"),
      aov: m("aov", 74, 70, "eur"),
      cac: m("cac", 11.4, 6.7, "eur"),
      cpl: m("cpl", 1.78, 1.35, "eur"),
      ad_spend: m("ad_spend", 1761, 4500, "eur"),
      pipeline_stuck_amount: m("pipeline_stuck_amount", 19185, null, "eur")
    },
    plan: {
      planRevenue: m("plan_revenue", 46676, 46676, "eur"),
      factRevenue: m("revenue", 11439, 46676, "eur"),
      forecastRevenue: m("forecast_revenue", Math.round((11439 / 13) * 31), 46676, "eur"),
      gap: m("plan_gap", 11439 - 46676, null, "eur"),
      planCompletion: m("plan_completion", 11439 / 46676, null, "pct"),
      daysElapsed: 13,
      daysRemaining: 18,
      calendarDays: 31,
      forecastSource: "run-rate",
      indicators: [],
      planSource: "test",
      indicatorCount: 0
    },
    revenueTree: { total: m("revenue", 11439, 46676, "eur"), countries: [], products: [], managers: [] },
    funnel: [
      { id: "leads", label: "Лиды", count: 990, status: "live", conversionFromPrevious: null, dropOffFromPrevious: null, medianDaysInStage: null },
      { id: "deals", label: "Сделки", count: 400, status: "live", conversionFromPrevious: null, dropOffFromPrevious: null, medianDaysInStage: null },
      { id: "invoices", label: "Счета", count: 164, status: "live", conversionFromPrevious: null, dropOffFromPrevious: null, medianDaysInStage: null },
      { id: "paid", label: "Оплаты", count: 154, status: "live", conversionFromPrevious: null, dropOffFromPrevious: null, medianDaysInStage: null }
    ],
    managers: [
      manager({ managerId: "1", managerName: "Анна", leads: 80, paidOrders: 25 }),
      manager({ managerId: "2", managerName: "Борис", leads: 70, paidOrders: 8 })
    ],
    products: [],
    crmMissingProducts: { orders: 0, revenue: 0 },
    countries: [],
    customers: {
      customers: no("customers"),
      newCustomers: no("new_customers"),
      repeatCustomers: no("repeat_customers"),
      repeatRate: no("repeat_rate", "pct"),
      avgCustomerRevenue: no("avg_customer_revenue", "eur")
    },
    pipeline: {
      openDeals: no("pipeline_open_deals"),
      pipelineAmount: no("pipeline_amount", "eur"),
      weightedAmount: no("pipeline_weighted", "eur"),
      overdueDeals: no("pipeline_overdue"),
      age: {
        buckets: [],
        stuckOver7d: { deals: 40, amount: 19185 },
        totalAmount: 19185,
        byStage: [],
        activityCoveragePct: null
      }
    },
    marketing: {
      adSpend: m("ad_spend", 1761, 4500, "eur"),
      cpl: m("cpl", 1.78, 1.35, "eur"),
      cac: m("cac", 11.4, 6.7, "eur"),
      roas: m("roas", 6.5, null, "ratio"),
      note: "test"
    },
    productMargin: {
      cogs: no("product_cogs", "eur"),
      grossProfit: no("gross_profit", "eur"),
      marginRate: no("product_margin_rate", "pct"),
      mappedDeals: 0,
      dealsWithProducts: 0,
      dealsTotal: 0,
      lineCoverage: 0,
      source: "test"
    },
    unitEconomics: { units: [], adSpend: 1761, cpl: 1.78, cac: 11.4 },
    production: { status: "no_data", message: "", available: [], missing: [] },
    reconciliation: {
      bitrixRevenue: m("revenue", 11439, null, "eur"),
      mariaRevenue: no("maria_revenue", "eur"),
      svodAttributedRevenue: no("svod_attributed_revenue", "eur"),
      bitrixVsMariaDelta: no("bitrix_vs_maria_delta", "eur"),
      bitrixVsMariaDeltaPct: no("bitrix_vs_maria_delta_pct", "pct")
    },
    sources: [],
    dataQuality: { overallScore: 0, label: "test", mode: "audit_baseline", domains: [] },
    ownerIntelligence: [],
    multiProductOrdersPct: no("multi_product_orders_pct", "pct"),
    delivery: {
      deliveryRevenue: no("delivery_revenue", "eur"),
      productRevenue: m("product_revenue_net", 11439, null, "eur"),
      deliverySharePct: no("delivery_share_pct", "pct"),
      dealsWithDelivery: 0,
      fieldCoveragePct: null
    },
    pricingCompare: [],
    managerBenchmark: { medianCr: 0.2, p80Cr: 0.3, medianRevenuePerLead: null, p80RevenuePerLead: null },
    opportunities: [],
    ...overrides
  };
}

assert.equal(ANALYSIS_SCENARIOS.length, 23);
assert.equal(getAnalysisScenario("missing"), null);
assert.equal(runAnalysisScenario("missing", augustSnapshot()), null);

const s1 = runAnalysisScenario("revenue-plan", augustSnapshot());
assert.ok(s1);
assert.equal(s1.run.readiness, "live");
assert.equal(s1.run.status, "problem");
assert.match(s1.run.headline, /лиды/i);
assert.match(s1.run.diagnosis, /лид/i);
assert.ok(s1.run.findings.some((row) => row.label === "Лиды" && /[-−]/.test(row.value)));
assert.ok(s1.run.actions.some((row) => row.href === "/os/marketing"));

const s20 = runAnalysisScenario("catch-plan", augustSnapshot());
assert.ok(s20);
assert.equal(s20.run.readiness, "live");
const reqRev = s20.run.findings.find((row) => row.label.startsWith("Required revenue"));
assert.ok(reqRev);
assert.match(reqRev.value, /1[\s\u00a0]?958|1958/);
const reqLeads = s20.run.findings.find((row) => row.label.startsWith("Required leads"));
assert.ok(reqLeads);
assert.match(reqLeads.value, /130/);
assert.ok(s20.run.actions.some((row) => row.href === "/predictive"));

const s23 = runAnalysisScenario("month-decomp", augustSnapshot());
assert.ok(s23);
assert.equal(s23.run.status, "problem");
assert.match(s23.run.diagnosis, /лид/i);

const s3 = runAnalysisScenario("cac-up", augustSnapshot());
assert.ok(s3);
assert.ok(s3.run.status === "problem" || s3.run.status === "attention");
assert.match(s3.run.headline, /CAC/i);
assert.match(s3.run.diagnosis, /CPL|CR/i);

const s6 = runAnalysisScenario("marketing-vs-sales", augustSnapshot());
assert.ok(s6);
assert.equal(s6.run.status, "attention");
assert.match(s6.run.diagnosis, /Анна/);
assert.match(s6.run.diagnosis, /Борис/);
assert.ok(!/доказательство/.test(s6.run.diagnosis) || /не доказательство/i.test(s6.run.diagnosis));

const thin = runAnalysisScenario(
  "marketing-vs-sales",
  augustSnapshot({
    managers: [
      manager({ managerId: "1", managerName: "Анна", leads: 3, paidOrders: 1 }),
      manager({ managerId: "2", managerName: "Борис", leads: 2, paidOrders: 0 })
    ]
  })
);
assert.ok(thin);
assert.equal(thin.run.status, "no_data");
assert.match(thin.run.headline, /Недостаточно/i);
assert.ok(thin.run.headline.includes(String(SCENARIO_SAMPLE_THRESHOLDS.minLeadsForManagerCompare)));

const blocked = runAnalysisScenario("creatives-scale", augustSnapshot());
assert.ok(blocked);
assert.equal(blocked.def.readiness, "blocked");
assert.equal(blocked.run.status, "no_data");
assert.match(blocked.run.headline, /нет|Ads|creative/i);

const daily = runAnalysisScenario("daily-delta", augustSnapshot());
assert.ok(daily);
assert.equal(daily.def.readiness, "blocked");
assert.equal(daily.run.readiness, "blocked");

const guided = runAnalysisScenario("cpl-up", augustSnapshot());
assert.ok(guided);
assert.equal(guided.run.readiness, "guided");
assert.ok(guided.run.actions.some((row) => row.href === "/os/marketing"));

const noSnap = runAnalysisScenario("revenue-plan", null);
assert.ok(noSnap);
assert.equal(noSnap.run.readiness, "guided");

console.log("analysis-scenarios tests ok");
