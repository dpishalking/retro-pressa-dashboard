import type { OwnerIntelligenceCard } from "@/types/analytics-os";
import type { AnalyticsNamedAmount, AnalyticsManagerRow, AnalyticsPipeline } from "@/types/analytics-os";

export function buildOwnerIntelligence(input: {
  revenue: number | null;
  planRevenue: number | null;
  aov: number | null;
  paidOrders: number | null;
  forecastRevenue: number | null;
  topCountry: AnalyticsNamedAmount | null;
  topManager: AnalyticsManagerRow | null;
  pipeline: AnalyticsPipeline;
  hasBitrixData: boolean;
}): OwnerIntelligenceCard[] {
  const plan = input.planRevenue;
  const revenue = input.revenue;
  const aov = input.aov;
  const forecast = input.forecastRevenue;

  let whyBody = "Мало данных Bitrix.";
  let whyStatus: OwnerIntelligenceCard["status"] = "no_data";

  if (input.hasBitrixData && revenue != null && plan != null && plan > 0) {
    whyStatus = "calculated";
    const completion = revenue / plan;
    const forecastGap = forecast != null ? forecast - plan : null;
    if (forecastGap != null && forecastGap < 0) {
      whyBody = `Прогноз ниже плана на ${Math.abs(Math.round((forecastGap / plan) * 1000) / 10)}%. Причина: темп оплат. Чек ${aov != null ? `€${Math.round(aov)}` : "н/д"}.`;
    } else if (completion < 1) {
      whyBody = `Факт ${Math.round(completion * 1000) / 10}% плана. Нужны оплаты.`;
    } else {
      whyBody = `Факт ${Math.round(completion * 1000) / 10}% плана и выше. Контроль: лиды и маржа.`;
    }
  }

  let whatToDoBody = "Нужны: выручка, план, средний чек.";
  let whatToDoStatus: OwnerIntelligenceCard["status"] = "no_data";
  if (revenue != null && plan != null && aov != null && aov > 0) {
    const gap = Math.max(0, plan - revenue);
    const ordersNeeded = Math.ceil(gap / aov);
    whatToDoStatus = "calculated";
    whatToDoBody =
      gap <= 0
        ? "План закрыт. Фокус: конверсия и CPL."
        : `До плана нужно около ${ordersNeeded} оплат при текущем чеке.`;
  }

  const moneyParts: string[] = [];
  if (input.topCountry) {
    moneyParts.push(`Страна №1: ${input.topCountry.name} (€${Math.round(input.topCountry.revenue).toLocaleString("ru-RU")}).`);
  }
  if (input.topManager && input.topManager.revenue > 0) {
    moneyParts.push(`Менеджер №1: ${input.topManager.managerName} (€${Math.round(input.topManager.revenue).toLocaleString("ru-RU")}).`);
  }
  if (input.pipeline.pipelineAmount.value != null) {
    moneyParts.push(`Открытая воронка: €${Math.round(input.pipeline.pipelineAmount.value).toLocaleString("ru-RU")}.`);
  }
  const whereBody = moneyParts.length ? moneyParts.join(" ") : "Нет данных.";
  const whereStatus: OwnerIntelligenceCard["status"] = moneyParts.length ? "calculated" : "no_data";

  return [
    { id: "why", title: "ПОЧЕМУ?", body: whyBody, status: whyStatus },
    { id: "what_to_do", title: "ЧТО ДЕЛАТЬ?", body: whatToDoBody, status: whatToDoStatus },
    {
      id: "what_if",
      title: "ЧТО ЕСЛИ?",
      body: "Сценарии — в Digital Twin.",
      status: "calculated",
      href: "/digital-twin"
    },
    { id: "where_is_the_money", title: "ГДЕ ДЕНЬГИ?", body: whereBody, status: whereStatus },
    {
      id: "what_breaks_at_x10",
      title: "×10?",
      body: "Нужны данные производства.",
      status: "no_data"
    }
  ];
}
