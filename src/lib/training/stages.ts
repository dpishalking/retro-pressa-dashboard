import type { TrainingStageId } from "@/types/training";

export type TrainingStageConfig = {
  id: TrainingStageId;
  title: string;
  description: string;
  href: string;
  order: number;
  accent: string;
};

export const TRAINING_STAGES: TrainingStageConfig[] = [
  {
    id: "products",
    title: "Этап 1. Продукт",
    description: "Изучаем линейку подарков: смысл каждого продукта, кому предлагать, как объяснять ценность и сдавать тест.",
    href: "/training/products",
    order: 1,
    accent: "text-rose-600 bg-rose-50"
  },
  {
    id: "crm",
    title: "Этап 2. CRM",
    description: "Битрикс24: где смотреть заявки, как вести клиента, фиксировать переписку и не терять контекст.",
    href: "/training/crm",
    order: 2,
    accent: "text-blue-600 bg-blue-50"
  },
  {
    id: "practice",
    title: "Этап 3. Практика",
    description: "Тренировочный бот в Telegram: ролевые диалоги в разных сценариях. Плюс короткие тесты перед практикой.",
    href: "/training/practice",
    order: 3,
    accent: "text-emerald-600 bg-emerald-50"
  }
];

export function getStageConfig(id: TrainingStageId) {
  return TRAINING_STAGES.find((stage) => stage.id === id);
}
