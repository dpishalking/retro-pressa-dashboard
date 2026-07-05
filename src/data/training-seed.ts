import type { ProductTrainingModule, TrainingUser } from "@/types/training";

const now = new Date().toISOString();

export const trainingUsers: TrainingUser[] = [
  { id: "anna", name: "Анна", role: "manager" },
  { id: "ilya", name: "Илья", role: "manager" },
  { id: "maria", name: "Мария", role: "manager" },
  { id: "admin", name: "Администратор", role: "admin" }
];

function stubProduct(
  id: string,
  title: string,
  shortDescription: string,
  sortOrder: number
): ProductTrainingModule {
  return {
    id,
    title,
    shortDescription,
    coverImage: `https://picsum.photos/seed/${id}/800/500`,
    passingScore: 80,
    description: `${title} — обучающий модуль в разработке. Скоро здесь появятся материалы и тест.`,
    targetAudience: "Материал будет добавлен администратором.",
    clientProblems: "Материал будет добавлен администратором.",
    emotions: "Материал будет добавлен администратором.",
    purchaseReasons: "Материал будет добавлен администратором.",
    objections: "Материал будет добавлен администратором.",
    presentationGuide: "Материал будет добавлен администратором.",
    materials: [],
    questions: [],
    sortOrder,
    createdAt: now,
    updatedAt: now
  };
}

export const personalNewspaperProduct: ProductTrainingModule = {
  id: "personal-newspaper",
  title: "Персональная газета",
  shortDescription:
    "Подарок в формате настоящего газетного выпуска, где главным героем становится конкретный человек.",
  coverImage: "https://picsum.photos/seed/personal-newspaper/800/500",
  passingScore: 80,
  description:
    "Персональная газета — это подарок, оформленный как настоящий газетный выпуск, где главным героем становится конкретный человек. Внутри можно рассказать его историю, достижения, важные события, воспоминания, поздравления от близких и значимые моменты жизни.",
  targetAudience:
    "Муж, жена, родители, руководитель, друг, коллега, клиент, партнёр — любой человек, которому важно показать личное внимание и ценность.",
  clientProblems:
    "Клиент хочет подарить что-то личное и запоминающееся, но не знает, как упаковать историю человека. Нужен подарок, который вызывает эмоции, а не выглядит как стандартный сувенир.",
  emotions:
    "Удивление, трогательность, ощущение «про меня действительно подумали», гордость за свою историю, благодарность за внимание к деталям.",
  purchaseReasons:
    "День рождения, юбилей, годовщина, свадьба, корпоративный подарок, подарок руководителю, подарок родителям, выход на пенсию.",
  objections:
    "«А что туда писать?»\n«У меня мало информации»\n«Это долго?»\n«А будет ли выглядеть дорого?»\n«А если человек не любит пафос?»",
  presentationGuide:
    "Важно объяснить клиенту, что задача подарка — не просто красиво выглядеть, а показать человеку его ценность через личную историю, воспоминания и внимание к деталям. Подчеркните, что даже небольшие факты и воспоминания превращаются в сильный эмоциональный подарок.",
  materials: [
    {
      id: "mat-video-1",
      type: "video",
      title: "Как презентовать персональную газету",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      sortOrder: 1
    },
    {
      id: "mat-image-1",
      type: "image",
      title: "Пример обложки",
      url: "https://picsum.photos/seed/newspaper-cover/900/600",
      sortOrder: 2
    },
    {
      id: "mat-image-2",
      type: "image",
      title: "Пример разворота",
      url: "https://picsum.photos/seed/newspaper-spread/900/600",
      sortOrder: 3
    },
    {
      id: "mat-doc-1",
      type: "document",
      title: "Презентация продукта (PDF)",
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      sortOrder: 4
    },
    {
      id: "mat-text-1",
      type: "text",
      title: "Чек-лист презентации",
      content:
        "1. Спросите, для кого подарок и какой повод.\n2. Объясните, что это история человека, а не просто печатный сувенир.\n3. Покажите примеры страниц и обложки.\n4. Снимите страх «мало информации» — достаточно 5–7 фактов.\n5. Закройте на эмоцию: «Представьте реакцию получателя».",
      sortOrder: 5
    },
    {
      id: "mat-link-1",
      type: "link",
      title: "Примеры работ в портфолио",
      url: "https://example.com/portfolio/personal-newspaper",
      sortOrder: 6
    }
  ],
  questions: [
    {
      id: "q1",
      text: "Что является главным смыслом персональной газеты?",
      type: "single",
      sortOrder: 1,
      answers: [
        { id: "q1-a1", text: "Просто красивый сувенир", isCorrect: false },
        { id: "q1-a2", text: "Подарок про конкретного человека и его историю", isCorrect: true },
        { id: "q1-a3", text: "Обычная открытка", isCorrect: false },
        { id: "q1-a4", text: "Каталог фотографий", isCorrect: false }
      ]
    },
    {
      id: "q2",
      text: "Для каких поводов подходит персональная газета?",
      type: "single",
      sortOrder: 2,
      answers: [
        { id: "q2-a1", text: "День рождения", isCorrect: false },
        { id: "q2-a2", text: "Юбилей", isCorrect: false },
        { id: "q2-a3", text: "Годовщина", isCorrect: false },
        { id: "q2-a4", text: "Все варианты выше", isCorrect: true }
      ]
    },
    {
      id: "q3",
      text: "Какое главное возражение может быть у клиента?",
      type: "single",
      sortOrder: 3,
      answers: [
        { id: "q3-a1", text: "«У меня мало информации»", isCorrect: true },
        { id: "q3-a2", text: "«Я не люблю читать новости»", isCorrect: false },
        { id: "q3-a3", text: "«Мне не нужна обычная газета»", isCorrect: false }
      ]
    },
    {
      id: "q4",
      text: "Что должен донести менеджер при презентации?",
      type: "single",
      sortOrder: 4,
      answers: [
        { id: "q4-a1", text: "Что это дешёвый подарок", isCorrect: false },
        { id: "q4-a2", text: "Что это подарок про внимание, историю и эмоции", isCorrect: true },
        { id: "q4-a3", text: "Что это просто печатный материал", isCorrect: false }
      ]
    },
    {
      id: "q5",
      text: "Какие эмоции должен вызвать подарок? (выберите все подходящие)",
      type: "multiple",
      sortOrder: 5,
      answers: [
        { id: "q5-a1", text: "Удивление", isCorrect: true },
        { id: "q5-a2", text: "Безразличие", isCorrect: false },
        { id: "q5-a3", text: "Ощущение «про меня подумали»", isCorrect: true },
        { id: "q5-a4", text: "Раздражение", isCorrect: false }
      ]
    }
  ],
  sortOrder: 1,
  createdAt: now,
  updatedAt: now
};

export const trainingProductsSeed: ProductTrainingModule[] = [
  personalNewspaperProduct,
  stubProduct("personal-magazine", "Персональный журнал", "Журнал с персональной историей и визуальным storytelling.", 2),
  stubProduct("retro-newspaper", "Ретро-газета", "Газета в ретро-стиле с атмосферой эпохи и личной историей.", 3),
  stubProduct("gift-edition", "Подарочный выпуск", "Тематический выпуск для особого повода и сильной эмоции.", 4),
  stubProduct("family-history", "Семейная история", "Семейный архив, воспоминания и хроника поколений.", 5),
  stubProduct("company-history", "История компании", "Корпоративная история в формате медиа-выпуска.", 6),
  stubProduct("vip-gift", "VIP-подарок", "Премиальный формат для особых клиентов и статусных поводов.", 7),
  stubProduct("corporate-gift", "Корпоративный подарок", "Подарок для команды, партнёров и ключевых клиентов.", 8)
];

export type TrainingCatalog = {
  version: 1;
  products: ProductTrainingModule[];
  updatedAt: string;
};

export function createTrainingCatalogSeed(): TrainingCatalog {
  return {
    version: 1,
    products: trainingProductsSeed,
    updatedAt: now
  };
}
