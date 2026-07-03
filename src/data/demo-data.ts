import { importAndAnalyzeConversations } from "@/lib/conversation-intelligence";
import type { DailyMetrics, DialogueQualityMetrics, ManagerMetrics, MarketMetrics, MonthlyMetrics, TargetScenario } from "@/types/metrics";

export const monthlyMetrics: MonthlyMetrics[] = [
  {
    month: "may-2026",
    paidLeads: 2036,
    organicLeads: 651,
    qualifiedLeads: 1746,
    invoicesCount: 456,
    invoicesAmount: 31063,
    cancelledInvoicesCount: 41,
    cancelledInvoicesAmount: 2569,
    salesCount: 390,
    revenue: 27066,
    adSpend: 4346,
    paidSalesCount: null,
    workingDays: 21,
    calendarDays: 31
  },
  {
    month: "june-2026",
    paidLeads: 2260,
    organicLeads: 450,
    qualifiedLeads: 1810,
    invoicesCount: 460,
    invoicesAmount: 41360,
    cancelledInvoicesCount: 26,
    cancelledInvoicesAmount: 2043.7,
    salesCount: 454,
    revenue: 33981,
    adSpend: 4548,
    paidSalesCount: null,
    workingDays: 21,
    calendarDays: 30
  },
  {
    month: "july-2026",
    paidLeads: 0,
    organicLeads: 0,
    qualifiedLeads: 0,
    invoicesCount: 0,
    invoicesAmount: 0,
    cancelledInvoicesCount: 0,
    cancelledInvoicesAmount: 0,
    salesCount: 0,
    revenue: 0,
    adSpend: 0,
    paidSalesCount: null,
    workingDays: 23,
    calendarDays: 31
  }
];

export const qualityMetrics: DialogueQualityMetrics[] = [
  {
    month: "may-2026",
    targetDialogs: 2048,
    meaningfulDialogs: 1480,
    medianResponseMinutes: 11,
    responseUnder5MinutesPct: 38.4,
    responseOver60MinutesPct: 18.3,
    recipientQualificationPct: 9.1,
    deliveryDeadlineQualificationPct: 18.7,
    personalRecommendationPct: 2.8,
    visualContentPct: 32,
    shippingPriceMentionPct: 46.6,
    fullFinalPricePct: 4.3,
    directClosingQuestionPct: 14.6,
    checkoutMarkerPct: 15.1,
    paymentMarkerPct: 11.7,
    extendedOfferPct: 88.9
  },
  {
    month: "june-2026",
    targetDialogs: 1608,
    meaningfulDialogs: 1169,
    medianResponseMinutes: 14,
    responseUnder5MinutesPct: 34.2,
    responseOver60MinutesPct: 22.8,
    recipientQualificationPct: 13.2,
    deliveryDeadlineQualificationPct: 21.4,
    personalRecommendationPct: 18.2,
    visualContentPct: 26.7,
    shippingPriceMentionPct: 41.5,
    fullFinalPricePct: 6.1,
    directClosingQuestionPct: 17.1,
    checkoutMarkerPct: 19.1,
    paymentMarkerPct: 16.5,
    extendedOfferPct: 89.6
  }
];

export const targetScenario: TargetScenario = {
  targetRevenue: 100000,
  calendarDays: 30,
  totalLeads: 4500,
  paidLeads: 3900,
  organicLeads: 600,
  salesConversion: 0.28,
  salesCount: 1260,
  averagePaidCheck: 80,
  monthlyAdSpendMin: 10000,
  monthlyAdSpendMax: 12000,
  maxPaidCpl: 3
};

export const dailyMetrics: DailyMetrics[] = Array.from({ length: 30 }, (_, index) => {
  const day = index + 1;
  const wave = Math.sin(day / 3) * 0.08 + 1;
  const paidLeads = Math.round((74 + day * 0.6) * wave);
  const organicLeads = Math.max(9, Math.round(18 - day * 0.15 + Math.cos(day / 4) * 3));
  const qualifiedLeads = Math.round((paidLeads + organicLeads) * 0.67);
  const paidQualifiedLeads = Math.round(paidLeads * 0.67);
  const organicQualifiedLeads = Math.max(0, qualifiedLeads - paidQualifiedLeads);
  const salesCount = Math.round((13 + day * 0.12) * wave);
  const averagePaidCheck = 72 + (day % 5) * 1.4;
  const revenue = Math.round(salesCount * averagePaidCheck);
  return {
    date: `2026-06-${String(day).padStart(2, "0")}`,
    paidLeads,
    organicLeads,
    qualifiedLeads,
    paidQualifiedLeads,
    organicQualifiedLeads,
    invoicesCount: Math.round(salesCount * 1.04),
    invoicesAmount: Math.round(salesCount * averagePaidCheck * 1.06),
    salesCount,
    revenue,
    adSpend: Math.round(paidLeads * 2.01),
    averagePaidCheck,
    activeManagers: day % 6 === 0 ? 4 : 5
  };
});

export const marketMetrics: MarketMetrics[] = [
  ["Балтия", 620, 120, 112, 9100, 1080, 116, 10300, 81.25, 18000],
  ["Германия / DACH", 540, 68, 86, 7450, 1180, 91, 8600, 86.63, 19000],
  ["Беларусь", 315, 74, 66, 4380, 525, 71, 5150, 66.36, 9000],
  ["Казахстан", 280, 48, 51, 3560, 470, 55, 4200, 69.8, 8000],
  ["Израиль", 205, 32, 31, 2850, 450, 35, 3500, 91.94, 8500],
  ["Россия / Молдова / Украина", 210, 92, 72, 4620, 420, 76, 5200, 64.17, 13500],
  ["Другие страны", 90, 16, 36, 2021, 423, 16, 4410, 56.14, 24000]
].map(([market, paidLeads, organicLeads, sales, revenue, adSpend, invoicesCount, invoicesAmount, averagePaidCheck, targetRevenue]) => ({
  period: "june-2026",
  market: String(market),
  paidLeads: Number(paidLeads),
  organicLeads: Number(organicLeads),
  sales: Number(sales),
  revenue: Number(revenue),
  adSpend: Number(adSpend),
  invoicesCount: Number(invoicesCount),
  invoicesAmount: Number(invoicesAmount),
  averagePaidCheck: Number(averagePaidCheck),
  targetRevenue: Number(targetRevenue),
  targetCpl: 3,
  targetConversion: 0.28,
  targetAverageCheck: 80
}));

export const managerMetrics: ManagerMetrics[] = [
  ["Анна", 618, 441, 107, 102, 8250, 8, 55, 22, 28, 48, 11, 32],
  ["Илья", 532, 384, 94, 88, 6900, 14, 30, 9, 12, 25, 3, 15],
  ["Мария", 486, 350, 86, 81, 6420, 9, 49, 16, 21, 35, 7, 19],
  ["София", 391, 286, 73, 69, 5370, 18, 28, 10, 14, 22, 4, 13],
  ["Даниил", 683, 477, 100, 114, 7041, 12, 42, 11, 19, 31, 5, 18]
].map(([manager, newLeads, meaningfulDialogs, invoicesCount, sales, revenue, medianResponseMinutes, responseUnder5MinutesPct, recipientQualificationPct, personalRecommendationPct, visualContentPct, fullFinalPricePct, directClosingQuestionPct]) => ({
  period: "june-2026",
  manager: String(manager),
  newLeads: Number(newLeads),
  recentClientsLast10Days: 0,
  lastClientAt: null,
  meaningfulDialogs: Number(meaningfulDialogs),
  invoicesCount: Number(invoicesCount),
  sales: Number(sales),
  revenue: Number(revenue),
  medianResponseMinutes: Number(medianResponseMinutes),
  responseUnder5MinutesPct: Number(responseUnder5MinutesPct),
  recipientQualificationPct: Number(recipientQualificationPct),
  personalRecommendationPct: Number(personalRecommendationPct),
  visualContentPct: Number(visualContentPct),
  fullFinalPricePct: Number(fullFinalPricePct),
  directClosingQuestionPct: Number(directClosingQuestionPct)
}));

const demoConversationCsv = `date,channel,dialog_id,sender,manager,text,outcome,amount
2026-06-02T09:02:00,Instagram,ig-101,client,Анна,"Здравствуйте, нужен подарок папе на юбилей. Что можете посоветовать?",,
2026-06-02T09:04:00,Instagram,ig-101,Анна,Анна,"Рекомендую оригинальную газету за дату рождения и комплект с рамкой. Для юбилея это самый сильный вариант.",,
2026-06-02T09:06:00,Instagram,ig-101,client,Анна,"Сколько стоит и успеет ли доставка к 15 числу?",,
2026-06-02T09:09:00,Instagram,ig-101,Анна,Анна,"Итого 86 евро вместе с доставкой, отправим завтра, к 15 числу успевает. Оформляем?",invoice,86
2026-06-02T09:18:00,Instagram,ig-101,client,Анна,"Да, давайте ссылку на оплату.",order,86
2026-06-04T14:10:00,WhatsApp,wa-202,client,Илья,"Какая цена газеты с доставкой в Германию?",,
2026-06-04T14:36:00,WhatsApp,wa-202,Илья,Илья,"Цена от 59 евро.",,
2026-06-04T15:02:00,WhatsApp,wa-202,client,Илья,"А доставка сколько дней и сколько стоит?",,
2026-06-04T18:40:00,WhatsApp,wa-202,client,Илья,"Наверное пока не актуально, поздно отвечаете.",lost,
2026-06-05T11:01:00,Telegram,tg-303,client,Мария,"Нужен подарок мужу на день рождения, но я сомневаюсь какой выпуск выбрать.",,
2026-06-05T11:05:00,Telegram,tg-303,Мария,Мария,"Лучше взять газету за дату рождения мужа, добавим поздравительный вкладыш и фото примеры.",,
2026-06-05T11:07:00,Telegram,tg-303,client,Мария,"Дорого?",,
2026-06-05T11:09:00,Telegram,tg-303,Мария,Мария,"Полная сумма 74 евро: газета, вкладыш, упаковка и доставка. Могу оформить заказ сейчас.",invoice,74
2026-06-05T11:15:00,Telegram,tg-303,client,Мария,"Оформляем.",order,74
2026-06-08T16:20:00,Website,web-404,client,София,"Хочу узнать сроки доставки в Латвию.",,
2026-06-08T17:12:00,Website,web-404,София,София,"Доставляем.",,
2026-06-09T12:20:00,Website,web-404,София,София,"Актуально ещё подобрать подарок?",,
2026-06-09T14:00:00,Website,web-404,client,София,"Нет, уже купили другое.",lost,
2026-06-10T10:00:00,Instagram,ig-505,client,Даниил,"Посоветуйте подарок коллеге, нужен корпоративный вариант.",,
2026-06-10T10:03:00,Instagram,ig-505,Даниил,Даниил,"Есть комплект: газета, рамка и открытка. Конкретно для коллеги лучше нейтральный выпуск с датой компании.",,
2026-06-10T10:05:00,Instagram,ig-505,client,Даниил,"Сколько итого?",,
2026-06-10T10:07:00,Instagram,ig-505,Даниил,Даниил,"Итого 92 евро с доставкой. Срок изготовления 1 день, можем отправить завтра.",invoice,92
2026-06-10T10:11:00,Instagram,ig-505,client,Даниил,"Ок, оплачиваем.",order,92`;

export const conversationIntelligenceDemo = importAndAnalyzeConversations([
  {
    filename: "demo-conversations.csv",
    content: demoConversationCsv,
    defaultChannel: "manual"
  }
]);
