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

  let whyBody = "Недостаточно данных Bitrix для надёжного разбора драйверов.";
  let whyStatus: OwnerIntelligenceCard["status"] = "no_data";

  if (input.hasBitrixData && revenue != null && plan != null && plan > 0) {
    whyStatus = "calculated";
    const completion = revenue / plan;
    const forecastGap = forecast != null ? forecast - plan : null;
    if (forecastGap != null && forecastGap < 0) {
      whyBody = `Прогноз выручки ниже плана на ${Math.abs(Math.round((forecastGap / plan) * 1000) / 10)}%. Основной драйвер: темп оплаченных заказов. AOV ${aov != null ? `€${Math.round(aov)}` : "н/д"}.`;
    } else if (completion < 1) {
      whyBody = `Факт ${Math.round(completion * 1000) / 10}% плана. Нужно ускорить закрытие оплат при текущем среднем чеке.`;
    } else {
      whyBody = `Факт на уровне или выше плана (${Math.round(completion * 1000) / 10}%). Контролировать качество лидов и маржу.`;
    }
  }

  let whatToDoBody = "Нет расчёта: нужны Revenue, Plan и AOV.";
  let whatToDoStatus: OwnerIntelligenceCard["status"] = "no_data";
  if (revenue != null && plan != null && aov != null && aov > 0) {
    const gap = Math.max(0, plan - revenue);
    const ordersNeeded = Math.ceil(gap / aov);
    whatToDoStatus = "calculated";
    whatToDoBody =
      gap <= 0
        ? "План по выручке закрыт или превышен. Фокус: удержать CR и не раздувать CPL."
        : `Чтобы закрыть разрыв плана при текущем AOV, нужно примерно ${ordersNeeded} дополнительных оплаченных заказов.`;
  }

  const moneyParts: string[] = [];
  if (input.topCountry) {
    moneyParts.push(`Крупнейшая страна: ${input.topCountry.name} (€${Math.round(input.topCountry.revenue).toLocaleString("ru-RU")}).`);
  }
  if (input.topManager && input.topManager.revenue > 0) {
    moneyParts.push(`Топ менеджер: ${input.topManager.managerName} (€${Math.round(input.topManager.revenue).toLocaleString("ru-RU")}).`);
  }
  if (input.pipeline.pipelineAmount.value != null) {
    moneyParts.push(`Открытый pipeline: €${Math.round(input.pipeline.pipelineAmount.value).toLocaleString("ru-RU")}.`);
  }
  const whereBody = moneyParts.length
    ? moneyParts.join(" ")
    : "Нет данных для opportunity map.";
  const whereStatus: OwnerIntelligenceCard["status"] = moneyParts.length ? "calculated" : "no_data";

  return [
    { id: "why", title: "WHY?", body: whyBody, status: whyStatus },
    { id: "what_to_do", title: "WHAT TO DO?", body: whatToDoBody, status: whatToDoStatus },
    {
      id: "what_if",
      title: "WHAT IF?",
      body: "Сценарный симулятор уже есть в Digital Twin. Не дублируем расчёт здесь.",
      status: "calculated",
      href: "/digital-twin"
    },
    { id: "where_is_the_money", title: "WHERE IS THE MONEY?", body: whereBody, status: whereStatus },
    {
      id: "what_breaks_at_x10",
      title: "WHAT BREAKS AT ×10?",
      body: "Capacity analytics requires production instrumentation. Нет live production timestamps.",
      status: "no_data"
    }
  ];
}
