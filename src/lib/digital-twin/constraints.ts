import type { ConstraintResult, DriverInput } from "./types";
import { getDriverValue, safeDiv } from "./drivers";
import { runMarketingEngine, runProductionEngine, runSalesEngine } from "./engines";

type PipelineSlice = {
  drivers: DriverInput[];
  marketing: ReturnType<typeof runMarketingEngine>;
  sales: ReturnType<typeof runSalesEngine>;
  production: ReturnType<typeof runProductionEngine>;
};

export function detectConstraints(pipeline: PipelineSlice): ConstraintResult[] {
  const { drivers, marketing, sales, production } = pipeline;
  const managerCount = getDriverValue(drivers, "managerCount");
  const leadsPerManager = getDriverValue(drivers, "leadsPerManager");
  const conversion = getDriverValue(drivers, "salesConversion");

  const marketingCapacity = marketing.totalLeads;
  const salesCapacity = Math.floor(managerCount * leadsPerManager);
  const salesOutputCapacity = Math.floor(salesCapacity * conversion);
  const productionCapacity = production.maxOrders;

  const demand = sales.qualLeads;
  const fulfilledSales = Math.min(demand, salesOutputCapacity, productionCapacity);

  const constraints: ConstraintResult[] = [
    {
      id: "marketing",
      department: "Маркетинг",
      label: "Генерация лидов",
      capacity: marketingCapacity,
      demand: marketingCapacity,
      utilization: 1,
      isBottleneck: false,
      owner: "Маркетинг"
    },
    {
      id: "sales",
      department: "Продажи",
      label: "Обработка лидов",
      capacity: salesCapacity,
      demand: marketing.totalLeads,
      utilization: safeDiv(marketing.totalLeads, salesCapacity),
      isBottleneck: false,
      owner: "РОП",
      suggestion: marketing.totalLeads > salesCapacity
        ? `Добавить ${Math.ceil((marketing.totalLeads - salesCapacity) / leadsPerManager)} менеджеров`
        : undefined
    },
    {
      id: "sales-conversion",
      department: "Продажи",
      label: "Конверсия в продажу",
      capacity: salesOutputCapacity,
      demand: sales.qualLeadsConstrained,
      utilization: safeDiv(sales.qualLeadsConstrained, salesOutputCapacity),
      isBottleneck: false,
      owner: "РОП"
    },
    {
      id: "production",
      department: "Производство",
      label: "Производственная мощность",
      capacity: productionCapacity,
      demand: sales.sales,
      utilization: safeDiv(sales.sales, productionCapacity),
      isBottleneck: false,
      owner: "Производство",
      suggestion: sales.sales > productionCapacity
        ? `Увеличить мощность на ${Math.ceil(((sales.sales - productionCapacity) / productionCapacity) * 100)}%`
        : undefined
    }
  ];

  const bottleneck = constraints
    .filter((c) => c.id !== "marketing")
    .reduce((max, c) => (c.utilization > max.utilization ? c : max), constraints[1]);

  return constraints.map((c) => ({
    ...c,
    isBottleneck: c.id === bottleneck.id && bottleneck.utilization > 0.85
  }));
}

export function suggestConstraintRelief(
  bottleneck: ConstraintResult,
  drivers: DriverInput[]
): string {
  const managerCount = getDriverValue(drivers, "managerCount");
  const leadsPerManager = getDriverValue(drivers, "leadsPerManager");

  if (bottleneck.id === "sales") {
    const extra = Math.ceil((bottleneck.demand - bottleneck.capacity) / leadsPerManager);
    return `Если добавить ${extra} менеджеров, отдел продаж сможет обработать ${bottleneck.demand} лидов`;
  }
  if (bottleneck.id === "production") {
    const extraHours = Math.ceil((bottleneck.demand - bottleneck.capacity) * getDriverValue(drivers, "hoursPerOrder"));
    return `Если добавить ${extraHours} производственных часов, мощность вырастет до ${bottleneck.demand} заказов`;
  }
  if (bottleneck.id === "sales-conversion") {
    return `Повышение конверсии на 2 п.п. даст +${Math.round(bottleneck.demand * 0.02)} продаж при текущей команде из ${managerCount} менеджеров`;
  }
  return "Оптимизируйте драйверы вверх по цепочке";
}
