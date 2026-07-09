import { monthlyMetrics, qualityMetrics, targetScenario } from "@/data/demo-data";
import {
  averagePaidCheck,
  invoiceConversion,
  paidCpl,
  salesConversion,
  totalLeads
} from "@/lib/metrics-engine";
import { DRIVER_CATALOG } from "@/lib/digital-twin/drivers";
import type {
  DailyMetrics,
  DialogueQualityMetrics,
  MonthlyMetrics,
  PeriodKey
} from "@/types/metrics";
import { metric, unavailableMetric } from "./metric";
import type { CompanySnapshot } from "./types";

const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);

export function demoMonthly(period: PeriodKey): MonthlyMetrics {
  return monthlyMetrics.find((m) => m.month === period) ?? monthlyMetrics[1]!;
}

export function demoQuality(period: PeriodKey): DialogueQualityMetrics {
  return qualityMetrics.find((m) => m.month === period) ?? qualityMetrics[1]!;
}

export function demoDriverDefaults(): Record<string, number> {
  return Object.fromEntries(DRIVER_CATALOG.map((d) => [d.id, d.actual]));
}

export function fallbackMonthlyFromDemo(period: PeriodKey): MonthlyMetrics {
  return { ...demoMonthly(period) };
}

export function fallbackDriverValues(period: PeriodKey): Record<string, number> {
  const monthly = demoMonthly(period);
  const leads = monthly.paidLeads + monthly.organicLeads;
  const defaults = demoDriverDefaults();

  return {
    ...defaults,
    cpl: safeDiv(monthly.adSpend, monthly.paidLeads),
    adBudget: monthly.adSpend,
    organicLeads: monthly.organicLeads,
    qualRate: safeDiv(monthly.qualifiedLeads, leads),
    salesConversion: safeDiv(monthly.salesCount, leads),
    avgCheck: safeDiv(monthly.revenue, monthly.salesCount),
    managerCount: defaults.managerCount ?? 8,
    leadsPerManager: safeDiv(leads, defaults.managerCount ?? 8)
  };
}

export function mergeDailySeries(bitrixDaily: DailyMetrics[], googleDaily: DailyMetrics[]): DailyMetrics[] {
  const byDate = new Map<string, DailyMetrics>();

  for (const day of bitrixDaily) {
    byDate.set(day.date, { ...day });
  }

  for (const day of googleDaily) {
    const existing = byDate.get(day.date);
    if (existing) {
      byDate.set(day.date, {
        ...existing,
        paidLeads: day.paidLeads,
        organicLeads: day.organicLeads,
        qualifiedLeads: day.qualifiedLeads,
        paidQualifiedLeads: day.paidQualifiedLeads,
        organicQualifiedLeads: day.organicQualifiedLeads,
        adSpend: day.adSpend
      });
    } else {
      byDate.set(day.date, { ...day });
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function buildCanonicalMonthly(input: {
  period: PeriodKey;
  bitrix: MonthlyMetrics | null;
  google: Partial<MonthlyMetrics> | null;
  workingDays: number;
  calendarDays: number;
}): MonthlyMetrics {
  const bitrix = input.bitrix;
  const google = input.google;
  const demo = demoMonthly(input.period);

  const paidLeads = google?.paidLeads ?? bitrix?.paidLeads ?? demo.paidLeads;
  const organicLeads = google?.organicLeads ?? bitrix?.organicLeads ?? demo.organicLeads;
  const qualifiedLeads = google?.qualifiedLeads ?? bitrix?.qualifiedLeads ?? demo.qualifiedLeads;
  const adSpend = google?.adSpend ?? bitrix?.adSpend ?? demo.adSpend;

  const revenue = bitrix?.revenue ?? demo.revenue;
  const salesCount = bitrix?.salesCount ?? demo.salesCount;
  const invoicesCount = bitrix?.invoicesCount ?? demo.invoicesCount;
  const invoicesAmount = bitrix?.invoicesAmount ?? demo.invoicesAmount;
  const cancelledInvoicesCount = bitrix?.cancelledInvoicesCount ?? demo.cancelledInvoicesCount;
  const cancelledInvoicesAmount = bitrix?.cancelledInvoicesAmount ?? demo.cancelledInvoicesAmount;

  return {
    month: input.period,
    paidLeads,
    organicLeads,
    qualifiedLeads,
    invoicesCount,
    invoicesAmount,
    cancelledInvoicesCount,
    cancelledInvoicesAmount,
    salesCount,
    revenue,
    adSpend,
    paidSalesCount: bitrix?.paidSalesCount ?? demo.paidSalesCount,
    workingDays: input.workingDays || demo.workingDays,
    calendarDays: input.calendarDays || demo.calendarDays
  };
}

export function resolveDataMode(sources: Array<{ available: boolean }>): import("./types").SnapshotDataMode {
  const availableCount = sources.filter((s) => s.available).length;
  if (availableCount === 0) return "fallback";
  if (availableCount >= 3) return "live";
  return "partial";
}

/** Client-safe fallback snapshot when server files are unavailable. */
export function buildFallbackCompanySnapshot(period: PeriodKey = "june-2026"): CompanySnapshot {
  const canonical = buildCanonicalMonthly({
    period,
    bitrix: null,
    google: null,
    workingDays: 0,
    calendarDays: 0
  });
  const defaults = demoDriverDefaults();
  const driverFallback = fallbackDriverValues(period);
  const dialogue = demoQuality(period);
  const leads = totalLeads(canonical);
  const managerCount = driverFallback.managerCount ?? 8;

  return {
    version: 1,
    meta: {
      period,
      builtAt: new Date().toISOString(),
      dataMode: "fallback",
      sources: [{ id: "demo_fallback", available: true, updatedAt: null }],
      reconciliations: []
    },
    marketing: {
      paidLeads: metric(canonical.paidLeads, "demo_fallback", null, true),
      organicLeads: metric(canonical.organicLeads, "demo_fallback", null, true),
      qualifiedLeads: metric(canonical.qualifiedLeads, "demo_fallback", null, true),
      adSpend: metric(canonical.adSpend, "demo_fallback", null, true),
      cpl: metric(paidCpl(canonical), "demo_fallback", null, true),
      cpql: metric(safeDiv(canonical.adSpend, Math.max(1, canonical.qualifiedLeads)), "demo_fallback", null, true),
      daily: [],
      markets: [],
      channels: []
    },
    sales: {
      revenue: metric(canonical.revenue, "demo_fallback", null, true),
      salesCount: metric(canonical.salesCount, "demo_fallback", null, true),
      invoicesCount: metric(canonical.invoicesCount, "demo_fallback", null, true),
      invoicesAmount: metric(canonical.invoicesAmount, "demo_fallback", null, true),
      cancelledInvoicesCount: metric(canonical.cancelledInvoicesCount, "demo_fallback", null, true),
      cancelledInvoicesAmount: metric(canonical.cancelledInvoicesAmount, "demo_fallback", null, true),
      averagePaidCheck: metric(averagePaidCheck(canonical), "computed", null, true),
      salesConversion: metric(salesConversion(canonical), "computed", null, true),
      invoiceConversion: metric(invoiceConversion(canonical), "computed", null, true),
      managers: [],
      invoiceCountries: [],
      invoiceManagers: [],
      invoiceProducts: [],
      countryOptions: [],
      productOptions: []
    },
    finance: {
      payroll: metric((defaults.avgSalary ?? 1200) * 16, "demo_fallback", null, false),
      overheadFixed: metric(defaults.overheadFixed ?? 3500, "demo_fallback", null, false),
      unitCost: metric(defaults.unitCost ?? 18.5, "demo_fallback", null, false),
      taxRate: metric(defaults.taxRate ?? 0.12, "demo_fallback", null, false),
      discountRate: metric(defaults.discountRate ?? 0.05, "demo_fallback", null, false),
      deliveryCost: metric(defaults.deliveryCost ?? 8.5, "demo_fallback", null, false),
      cashBalance: unavailableMetric("bank")
    },
    production: {
      productionHours: metric(defaults.productionHours ?? 1600, "demo_fallback", null, false),
      hoursPerOrder: metric(defaults.hoursPerOrder ?? 2.8, "demo_fallback", null, false),
      defectRate: metric(defaults.defectRate ?? 0.03, "demo_fallback", null, false),
      maxOrders: metric(Math.floor(safeDiv(defaults.productionHours ?? 1600, defaults.hoursPerOrder ?? 2.8)), "computed", null, true),
      utilization: metric(0, "computed", null, false)
    },
    hr: {
      managerCount: metric(managerCount, "demo_fallback", null, false),
      productionStaff: metric(defaults.productionStaff ?? 6, "demo_fallback", null, false),
      supportStaff: metric(defaults.supportStaff ?? 2, "demo_fallback", null, false),
      avgSalary: metric(defaults.avgSalary ?? 1200, "demo_fallback", null, false),
      leadsPerManager: metric(safeDiv(leads, managerCount), "computed", null, true),
      managerProductivity: metric(safeDiv(canonical.salesCount, managerCount), "computed", null, true)
    },
    quality: {
      dialogue,
      conversation: null,
      qualityScore: metric(0, "demo_fallback", null, false),
      potentialLostRevenue: metric(0, "demo_fallback", null, false)
    },
    training: {
      activeTrainees: metric(0, "training", null, false),
      completedModules: metric(0, "training", null, false),
      averageQuizScore: metric(0, "training", null, false)
    },
    canonical,
    daily: []
  };
}

export { targetScenario };
