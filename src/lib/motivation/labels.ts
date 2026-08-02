import type {
  MotivationPeriodStatus,
  MotivationResultStatus,
  MonthlyUpdateCategory,
  ReviewSubmissionStatus,
  SalesResourceStatus,
  SalesResourceType
} from "@/types/motivation";

export function periodStatusLabel(status: MotivationPeriodStatus): string {
  switch (status) {
    case "active":
      return "Активный месяц";
    case "calculating":
      return "Результаты рассчитываются";
    case "closed":
      return "Результаты зафиксированы";
    case "archive":
      return "Архив";
    case "draft":
      return "Черновик";
  }
}

export function resultStatusLabel(status: MotivationResultStatus): string {
  switch (status) {
    case "not_started":
      return "Не начато";
    case "in_progress":
      return "В процессе";
    case "completed":
      return "Условие выполнено";
    case "pending_confirmation":
      return "Ожидает подтверждения";
    case "rewarded":
      return "Бонус начислен";
    case "failed":
      return "Условие не выполнено";
  }
}

export function reviewStatusLabel(status: ReviewSubmissionStatus): string {
  switch (status) {
    case "pending":
      return "Ожидает проверки";
    case "approved":
      return "Подтверждён";
    case "rejected":
      return "Отклонён";
    case "needs_clarification":
      return "Нужно уточнение";
  }
}

export function updateCategoryLabel(category: MonthlyUpdateCategory): string {
  switch (category) {
    case "new_tool":
      return "Новый инструмент";
    case "new_landing":
      return "Новый лендинг";
    case "new_product":
      return "Новый продукт";
    case "price_change":
      return "Изменение цены";
    case "new_script":
      return "Новый скрипт";
    case "new_promo":
      return "Новая акция";
    case "process_update":
      return "Обновление процесса";
    case "training":
      return "Обучение";
    case "important":
      return "Важная информация";
  }
}

export function resourceTypeLabel(type: SalesResourceType): string {
  switch (type) {
    case "landing":
      return "Лендинг";
    case "quiz":
      return "Квиз";
    case "script":
      return "Скрипт";
    case "presentation":
      return "Презентация";
    case "calculator":
      return "Калькулятор";
    case "training":
      return "Обучение";
    case "other":
      return "Другое";
  }
}

export function resourceStatusLabel(status: SalesResourceStatus): string {
  switch (status) {
    case "active":
      return "Активен";
    case "testing":
      return "Тестируется";
    case "paused":
      return "Временно не использовать";
    case "archive":
      return "Архив";
  }
}

export function monthTitle(month: number, year: number): string {
  const names = [
    "январь",
    "февраль",
    "март",
    "апрель",
    "май",
    "июнь",
    "июль",
    "август",
    "сентябрь",
    "октябрь",
    "ноябрь",
    "декабрь"
  ];
  const name = names[month - 1] ?? String(month);
  return `${name} ${year}`;
}
