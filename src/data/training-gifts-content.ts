import type { ProductMaterial, ProductSectionKey, ProductTrainingModule } from "@/types/training";

export type GiftSiteContent = {
  coverImage: string;
  shortDescription?: string;
  description?: string;
  targetAudience?: string;
  clientProblems?: string;
  emotions?: string;
  purchaseReasons?: string;
  objections?: string;
  presentationGuide?: string;
  sectionImages?: Partial<Record<ProductSectionKey, string>>;
};

/** Картинки и тексты с https://retro-pressa.com/gifts */
export const giftSiteContent: Record<string, GiftSiteContent> = {
  "personal-newspaper": {
    coverImage: "https://static.tildacdn.net/tild6335-3161-4537-b433-353738363539/1_.webp",
    shortDescription:
      "Настоящее издание из даты, которая важна для человека. Подарок-машина времени, который запускает воспоминания и разговоры.",
    description:
      "Оригинальная газета или журнал, выпущенные в конкретный день и год: день рождения, годовщину, юбилей компании или другую важную дату. Человек получает физический фрагмент прошлого, который можно открыть, прочитать и показать за праздничным столом. Это не сувенир и не стилизация — реальное издание из прошлого, которое сразу цепляет эмоцией.",
    targetAudience:
      "Для мамы, папы, бабушки, дедушки, руководителя, коллеги, учителя, тренера, друга, супруга и человека, у которого уже многое есть.",
    clientProblems:
      "Клиенту нужен небанальный подарок с историей, а стандартные сувениры не вызывают эмоцию. Хочется дать человеку не просто вещь, а личный смысл, тёплое чувство заботы и повод для разговора за столом.",
    emotions:
      "Эффект удивления, ностальгия, семейные разговоры, повод для тёплого тоста, ощущение «ты правда обо мне подумал», желание сохранить подарок как артефакт и показывать близким.",
    purchaseReasons:
      "День рождения, юбилей, годовщина свадьбы, памятная дата, семейный праздник, подарок руководителю или коллеге, юбилей компании.",
    objections:
      "«А подойдёт ли дата?»\n«Найдётся ли нужное издание?»\n«Что делать, если точной газеты за дату нет?»\n«Не будет ли это выглядеть как обычный сувенир?»",
    presentationGuide:
      "Объясняйте, что мы продаём не бумагу, а момент из прошлого. Подчёркивайте, что это реальное издание, которое можно открыть, прочитать и показать за столом. Если точной даты нет — подберём близкий вариант. Переводите разговор с вещи на реакцию получателя: удивление, воспоминания, семейные разговоры.",
    sectionImages: {
      description: "https://static.tildacdn.net/tild6335-3161-4537-b433-353738363539/1_.webp",
      targetAudience: "https://static.tildacdn.net/tild6335-3161-4537-b433-353738363539/1_.webp",
      emotions: "https://static.tildacdn.net/tild6335-3161-4537-b433-353738363539/1_.webp"
    }
  },
  "personal-magazine": {
    coverImage: "https://static.tildacdn.net/tild3637-6264-4336-a534-613633376664/3_.webp",
    shortDescription:
      "История человека, собранная через газетные заголовки каждого года его жизни. Подарок про память, эпоху и прожитую историю.",
    description:
      "Подарочная книга, в которой каждый год жизни человека раскрывается через атмосферу времени: газетные страницы, события, заголовки, новости, контекст эпохи. Первая часть может начинаться с издания за день, месяц или год рождения. Человек буквально проходит свою жизнь заново — это не альбом, а ощущение целой прожитой истории.",
    targetAudience:
      "Для родителей, бабушек, дедушек, мужа, жены, юбиляра, руководителя, учителя, тренера и человека, чью жизнь хочется показать как большую историю.",
    clientProblems:
      "Клиент хочет глубокий и редкий подарок, который не выглядит случайным. Нужно не просто поздравление, а вещь с долгой памятью, сильной эмоциональной глубиной и ощущением масштаба прожитой жизни.",
    emotions:
      "Сильный вау-эффект, уважение, ощущение прожитой эпохи, семейные разговоры, благодарность за внимание, желание листать книгу всей семьёй снова и снова.",
    purchaseReasons:
      "Юбилей 50, 60, 70, 80, 90 лет, большой семейный юбилей, подарок папе или маме, подарок дедушке или бабушке, торжественное поздравление с речью, подарок человеку, которого хочется глубоко отметить.",
    objections:
      "«Это не слишком сложно?»\n«Не получится ли слишком объёмно?»\n«А точно хватит газет на все годы?»\n«Кому вообще нужен такой подарок?»",
    presentationGuide:
      "Говорите, что мы показываем жизнь человека через время — не набор фотографий, а целую эпоху. Подчёркивайте физический вес книги, вау-эффект при вручении и то, что это подарок, который хочется листать всей семьёй. Особенно силён для людей 50+ и старше.",
    sectionImages: {
      description: "https://static.tildacdn.net/tild3637-6264-4336-a534-613633376664/3_.webp",
      emotions: "https://static.tildacdn.net/tild3637-6264-4336-a534-613633376664/3_.webp",
      purchaseReasons: "https://static.tildacdn.net/tild3637-6264-4336-a534-613633376664/3_.webp"
    }
  },
  "retro-newspaper": {
    coverImage: "https://static.tildacdn.net/tild6532-6461-4436-b730-383563383362/2.webp",
    shortDescription:
      "Точная копия ретро-газеты или журнала за дату рождения, в которую вставлены ваши фото и поздравительный текст. Всё остальное — как в оригинале.",
    description:
      "За основу берётся скан оригинального издания — Правда, Известия, региональная газета или журнал вроде «Наука и жизнь». Мы вставляем до 7 фото и поздравительный текст на выбранную страницу. Человек получает газету из своего дня, читает её — и неожиданно находит себя внутри.",
    targetAudience:
      "Для тех, кому нравится идея газеты из даты рождения, но хочется добавить личное поздравление с фото — маме, папе, мужу, жене, юбиляру, коллеге.",
    clientProblems:
      "Клиент хочет личный подарок с атмосферой эпохи, но не знает, что написать. Часто думает, что мы вставим фото прямо в оригинал из архива.",
    emotions:
      "Двойной вау-эффект: ностальгия по ретро-изданию, потом неожиданное личное открытие на внутренней странице. Газету читают, передают из рук в руки, обсуждают.",
    purchaseReasons:
      "День рождения, юбилей, когда хочется совместить газету из даты рождения с личным поздравлением и фото.",
    objections:
      "«Это не оригинал — клиенту не понравится»\n«Вы вставите фото в оригинальную газету?»\n«А что туда писать?»\n«У нас мало фото»",
    presentationGuide:
      "Объясняйте: это копия оригинала с фото и текстом, а не вставка в архивный экземпляр. Рекомендуйте размещать поздравление на 2–3 или последней странице — эффект сильнее. Если клиент не знает, что писать — есть программа-помощник.",
    sectionImages: {
      description: "https://static.tildacdn.net/tild6532-6461-4436-b730-383563383362/2.webp",
      presentationGuide: "https://static.tildacdn.net/tild6532-6461-4436-b730-383563383362/2.webp",
      emotions: "https://static.tildacdn.net/tild6532-6461-4436-b730-383563383362/2.webp"
    }
  },
  "gift-edition": {
    coverImage: "https://static.tildacdn.net/tild3461-3131-4533-a462-623130626535/4_.webp",
    shortDescription:
      "Два продукта с нуля: быстрая персонализированная газета Party Page (А4, 1–2 дня) и глянцевый персональный журнал (от 16 страниц). Оба без архива — полностью про человека.",
    description:
      "Party Page — газета А4 с тематическими шаблонами, создаётся за 1–2 дня, от 45 €. Журнал — настоящий глянец с нуля, минимум 16 страниц, от 240 €. Контент через анкеты и платформы — клиент не пишет статьи сам.",
    targetAudience:
      "Party Page — когда нужен быстрый личный подарок с известной темой. Журнал — когда нужен премиальный масштабный подарок на юбилей или семейный праздник.",
    clientProblems:
      "Страх сложности и сроков. Для журнала — цена и боязнь самому писать статьи и собирать материал. На оба продукта — «успеем ли к дате?»",
    emotions:
      "Газета — быстрый вау-эффект, гости читают и обсуждают. Журнал — гордость, «обо мне написали целый номер», статусный глянец.",
    purchaseReasons:
      "Party Page: срочный подарок, известная тема, можно распечатать и подарить в тот же день. Журнал: большой юбилей, премиальный статусный подарок.",
    objections:
      "«Мне что, самому писать статьи?»\n«Я буду целыми днями собирать материал»\n«240 евро — это дорого»\n«Сколько страниц выбрать?»",
    presentationGuide:
      "Срочно и знают тему → Party Page. Масштабный юбилей → журнал. Снимайте страх про тексты — нужны ответы на вопросы. Не хочет собирать материал → редактор-менеджер от 180 €.",
    sectionImages: {
      description: "https://static.tildacdn.net/tild3461-3131-4533-a462-623130626535/4_.webp",
      emotions: "https://static.tildacdn.net/tild3461-3131-4533-a462-623130626535/4_.webp",
      purchaseReasons: "https://static.tildacdn.net/tild3461-3131-4533-a462-623130626535/4_.webp"
    }
  }
};

function sectionImageMaterials(productId: string, sectionImages?: Partial<Record<ProductSectionKey, string>>): ProductMaterial[] {
  if (!sectionImages) return [];

  return Object.entries(sectionImages).map(([sectionKey, url], index) => ({
    id: `img-${productId}-${sectionKey}`,
    type: "image" as const,
    title: "Фото с сайта Retro Pressa",
    url,
    sectionKey: sectionKey as ProductSectionKey,
    sortOrder: index + 2
  }));
}

export function applyGiftSiteContent(product: ProductTrainingModule): ProductTrainingModule {
  const gift = giftSiteContent[product.id];
  if (!gift) return product;

  const imageMaterials = sectionImageMaterials(product.id, gift.sectionImages);
  const existingIds = new Set(imageMaterials.map((item) => item.id));
  const preservedMaterials = product.materials.filter((item) => !existingIds.has(item.id) && item.type !== "image");

  return {
    ...product,
    coverImage: gift.coverImage,
    shortDescription: gift.shortDescription ?? product.shortDescription,
    description: gift.description ?? product.description,
    targetAudience: gift.targetAudience ?? product.targetAudience,
    clientProblems: gift.clientProblems ?? product.clientProblems,
    emotions: gift.emotions ?? product.emotions,
    purchaseReasons: gift.purchaseReasons ?? product.purchaseReasons,
    objections: gift.objections ?? product.objections,
    presentationGuide: gift.presentationGuide ?? product.presentationGuide,
    materials: [...preservedMaterials, ...imageMaterials]
  };
}

export function applyGiftSiteContentToCatalog(products: ProductTrainingModule[]) {
  return products.map(applyGiftSiteContent);
}

export function applyGiftSiteImages(product: ProductTrainingModule): ProductTrainingModule {
  const gift = giftSiteContent[product.id];
  if (!gift) return product;

  const imageMaterials = sectionImageMaterials(product.id, gift.sectionImages);
  const imageIds = new Set(imageMaterials.map((item) => item.id));
  const preservedMaterials = product.materials.filter((item) => !imageIds.has(item.id) && item.type !== "image");

  return {
    ...product,
    coverImage: gift.coverImage,
    materials: [...preservedMaterials, ...imageMaterials]
  };
}

export function applyGiftSiteImagesToCatalog(products: ProductTrainingModule[]) {
  return products.map(applyGiftSiteImages);
}
