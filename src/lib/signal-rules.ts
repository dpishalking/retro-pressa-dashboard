import { cashRoas, paidCpl, pacingRatio, salesConversion, totalLeads } from "@/lib/metrics-engine";
import type { DialogueQualityMetrics, MonthlyMetrics, Status, TargetScenario } from "@/types/metrics";

export type Signal = {
  status: Status;
  title: string;
  current: string;
  target: string;
  explanation: string;
  action: string;
};

const statusByThreshold = (value: number, green: number, orange: number): Status => {
  if (value >= green) return "green";
  if (value >= orange) return "orange";
  return "red";
};

export const buildSignals = (current: MonthlyMetrics, previous: MonthlyMetrics, quality: DialogueQualityMetrics, target: TargetScenario, elapsedDays = 20): Signal[] => {
  const revenueTempo = pacingRatio(current.revenue, target.targetRevenue, elapsedDays, target.calendarDays);
  const crGap = salesConversion(current) - target.salesConversion;
  const organicDelta = (current.organicLeads - previous.organicLeads) / previous.organicLeads;
  const signals: Signal[] = [
    {
      status: statusByThreshold(revenueTempo, 1, 0.9),
      title: "Темп выручки",
      current: `${(revenueTempo * 100).toFixed(1)}%`,
      target: "100% темпа",
      explanation: "Показывает, идём ли к €100 000 с учётом календарного дня.",
      action: revenueTempo < 1 ? "Усилить дневной план лидов и проверить конверсию менеджеров." : "Сохранять текущий темп и контролировать средний чек."
    },
    {
      status: crGap >= 0 ? "green" : crGap >= -0.02 ? "orange" : "red",
      title: "Конверсия в продажу",
      current: `${(salesConversion(current) * 100).toFixed(1)}%`,
      target: `${(target.salesConversion * 100).toFixed(1)}%`,
      explanation: "CR считается от всех лидов. Счета и продажи периода могут относиться к разным датам создания лида.",
      action: "Разобрать переписки без закрывающего вопроса и усилить квалификацию получателя."
    },
    {
      status: quality.medianResponseMinutes <= 5 ? "green" : quality.medianResponseMinutes <= 10 ? "orange" : "red",
      title: "SLA первого ответа",
      current: `${quality.medianResponseMinutes} мин`,
      target: "≤5 мин",
      explanation: "Медиана ответа выше целевого стандарта снижает шанс закрытия.",
      action: "Проверить расписание смен и очередь необработанных диалогов."
    },
    {
      status: quality.responseOver60MinutesPct <= 5 ? "green" : quality.responseOver60MinutesPct <= 10 ? "orange" : "red",
      title: "Ответы позже часа",
      current: `${quality.responseOver60MinutesPct.toFixed(1)}%`,
      target: "≤5%",
      explanation: "Длинные паузы в переписке ломают импульс покупки.",
      action: "Ввести тревогу по диалогам без ответа дольше 30 минут."
    },
    {
      status: statusByThreshold(quality.personalRecommendationPct / 100, 0.8, 0.6),
      title: "Персональная рекомендация",
      current: `${quality.personalRecommendationPct.toFixed(1)}%`,
      target: "≥80%",
      explanation: "Менеджеры редко помогают клиенту выбрать один лучший вариант.",
      action: "Добавить скрипт рекомендации: повод, получатель, город, год, лучший вариант."
    },
    {
      status: statusByThreshold(quality.visualContentPct / 100, 0.7, 0.5),
      title: "Визуал в переписке",
      current: `${quality.visualContentPct.toFixed(1)}%`,
      target: "≥70%",
      explanation: "Фотографии и примеры недостаточно часто используются для продажи ценности.",
      action: "Собрать быстрые подборки визуалов по рынкам и продуктам."
    },
    {
      status: organicDelta <= -0.25 ? "red" : organicDelta <= -0.15 ? "orange" : "green",
      title: "Органические лиды",
      current: `${current.organicLeads} из ${totalLeads(current)}`,
      target: "без падения >15%",
      explanation: `К прошлому периоду органика изменилась на ${(organicDelta * 100).toFixed(1)}%.`,
      action: "Проверить контент, SEO-страницы, повторные продажи и реферальные источники."
    },
    {
      status: paidCpl(current) <= target.maxPaidCpl ? "green" : paidCpl(current) <= target.maxPaidCpl * 1.15 ? "orange" : "red",
      title: "Стоимость платного лида",
      current: `€${paidCpl(current).toFixed(2)}`,
      target: `≤€${target.maxPaidCpl}`,
      explanation: `Cash ROAS сейчас ${(cashRoas(current) * 100).toFixed(1)}%.`,
      action: "Сохранять CPL, но масштабировать только связки с достаточной конверсией."
    }
  ];

  return signals.sort((a, b) => ({ red: 0, orange: 1, green: 2 }[a.status] - { red: 0, orange: 1, green: 2 }[b.status]));
};
