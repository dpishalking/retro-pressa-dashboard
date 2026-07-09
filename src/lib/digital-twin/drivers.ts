import type { DriverInput, Scenario } from "./types";
import { applyOverrides, clampDriverValue, enrichDrivers } from "./driver-bounds";

export { applyOverrides, enrichDrivers, clampDriverValue, getDriverBounds, getDriverInputPrecision, getDriverInputStep, roundDriverValue, driverValueToInput, driverValueFromInput, normalizeDriverInput } from "./driver-bounds";
export { safeDiv } from "./math";

export const DRIVER_CATALOG: DriverInput[] = [
  // Marketing
  { id: "cpl", label: "CPL (платные лиды)", category: "marketing", unit: "currency", actual: 2.01, plan: 3.0, owner: "Маркетинг", editable: true, description: "Стоимость платного лида" },
  { id: "cpm", label: "CPM", category: "marketing", unit: "currency", actual: 4.2, plan: 5.0, owner: "Маркетинг", editable: true },
  { id: "ctr", label: "CTR", category: "marketing", unit: "percent", actual: 0.032, plan: 0.035, owner: "Маркетинг", editable: true },
  { id: "adBudget", label: "Рекламный бюджет", category: "marketing", unit: "currency", actual: 4548, plan: 10000, owner: "Маркетинг", editable: true },
  { id: "organicLeads", label: "Органические лиды", category: "marketing", unit: "count", actual: 450, plan: 600, owner: "Маркетинг", editable: true },

  // Sales
  { id: "qualRate", label: "Конверсия в квал-лид", category: "sales", unit: "percent", actual: 0.668, plan: 0.72, owner: "РОП", editable: true },
  { id: "salesConversion", label: "Конверсия в продажу", category: "sales", unit: "percent", actual: 0.1675, plan: 0.28, owner: "РОП", editable: true },
  { id: "avgCheck", label: "Средний чек", category: "sales", unit: "currency", actual: 74.85, plan: 80, owner: "РОП", editable: true },
  { id: "upsellRate", label: "Upsell %", category: "sales", unit: "percent", actual: 0.12, plan: 0.18, owner: "РОП", editable: true },
  { id: "crossSellRate", label: "Cross-sell %", category: "sales", unit: "percent", actual: 0.08, plan: 0.12, owner: "РОП", editable: true },
  { id: "managerCount", label: "Менеджеры", category: "sales", unit: "count", actual: 8, plan: 12, owner: "РОП", editable: true },
  { id: "leadsPerManager", label: "Лидов на менеджера/мес", category: "sales", unit: "count", actual: 339, plan: 375, owner: "РОП", editable: true },

  // Production
  { id: "unitCost", label: "Себестоимость заказа", category: "production", unit: "currency", actual: 18.5, plan: 17.0, owner: "Производство", editable: true },
  { id: "productionHours", label: "Производственные часы/мес", category: "production", unit: "hours", actual: 1600, plan: 2000, owner: "Производство", editable: true },
  { id: "hoursPerOrder", label: "Часов на заказ", category: "production", unit: "hours", actual: 2.8, plan: 2.5, owner: "Производство", editable: true },
  { id: "defectRate", label: "Брак %", category: "production", unit: "percent", actual: 0.03, plan: 0.02, owner: "Производство", editable: true },
  { id: "deliveryCost", label: "Стоимость доставки", category: "production", unit: "currency", actual: 8.5, plan: 8.0, owner: "Логистика", editable: true },

  // HR
  { id: "avgSalary", label: "Средняя зарплата", category: "hr", unit: "currency", actual: 1200, plan: 1300, owner: "HR", editable: true },
  { id: "productionStaff", label: "Производственный персонал", category: "hr", unit: "count", actual: 6, plan: 8, owner: "HR", editable: true },
  { id: "supportStaff", label: "Поддержка", category: "hr", unit: "count", actual: 2, plan: 3, owner: "HR", editable: true },
  { id: "managerProductivity", label: "Продаж на менеджера/мес", category: "hr", unit: "count", actual: 57, plan: 105, owner: "HR", editable: true },

  // Finance
  { id: "taxRate", label: "Налоговая ставка", category: "finance", unit: "percent", actual: 0.12, plan: 0.12, owner: "Финансы", editable: true },
  { id: "overheadFixed", label: "Постоянные расходы", category: "finance", unit: "currency", actual: 3500, plan: 4000, owner: "Финансы", editable: true },
  { id: "discountRate", label: "Средняя скидка", category: "finance", unit: "percent", actual: 0.05, plan: 0.03, owner: "Финансы", editable: true },
  { id: "repeatSalesRate", label: "Повторные продажи %", category: "finance", unit: "percent", actual: 0.15, plan: 0.22, owner: "Финансы", editable: true }
];

export const STRATEGIC_GOAL = {
  targetRevenue: 100_000,
  targetNetMargin: 0.30
};

export const DEFAULT_SCENARIOS: Scenario[] = [
  { id: "baseline", name: "Baseline", description: "Текущие драйверы без изменений", overrides: {} },
  {
    id: "optimistic",
    name: "Optimistic",
    description: "Рост конверсии и среднего чека",
    overrides: { salesConversion: 0.28, avgCheck: 86, cpl: 1.75 }
  },
  {
    id: "conservative",
    name: "Conservative",
    description: "Снижение CPL, умеренный рост",
    overrides: { cpl: 1.8, adBudget: 8000, salesConversion: 0.22 }
  },
  {
    id: "aggressive",
    name: "Aggressive",
    description: "Масштабирование: +5 менеджеров, +40% производство",
    overrides: { managerCount: 13, productionHours: 2240, adBudget: 15000, avgCheck: 82 }
  }
];

export function getDriverValue(drivers: DriverInput[], id: string, overrides?: Partial<Record<string, number>>): number {
  if (overrides && overrides[id] !== undefined) {
    const driver = drivers.find((d) => d.id === id);
    return driver ? clampDriverValue(driver, overrides[id]!) : overrides[id]!;
  }
  const driver = drivers.find((d) => d.id === id);
  return driver?.actual ?? 0;
}
