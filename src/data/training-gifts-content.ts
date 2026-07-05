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
    coverImage: "https://static.tildacdn.net/tild6532-6461-4436-b730-383563383362/2.webp",
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
      description: "https://static.tildacdn.net/tild6532-6461-4436-b730-383563383362/2.webp",
      emotions: "https://static.tildacdn.net/tild6532-6461-4436-b730-383563383362/2.webp",
      purchaseReasons: "https://static.tildacdn.net/tild6532-6461-4436-b730-383563383362/2.webp"
    }
  },
  "retro-newspaper": {
    coverImage: "https://static.tildacdn.net/tild3637-6264-4336-a534-613633376664/3_.webp",
    shortDescription:
      "Газета, где главный герой — ваш близкий человек. Подарок, который сразу становится частью праздника.",
    description:
      "Полностью созданный под конкретного человека газетный выпуск. Внутри — фото, заголовки, статьи, поздравления, истории, шутки, важные даты и личные детали. Человек открывает выпуск и видит себя на первой полосе. Формат подходит для электронного PDF или печатной газеты.",
    targetAudience:
      "Для именинников, юбиляров, пар на свадьбу, выпускников, коллег, руководителей, семей и команд, которым нужен личный и яркий подарок с эмоцией.",
    clientProblems:
      "Клиент хочет необычный подарок, у него есть фотографии и истории, но не хочет долгой подготовки. Нужен формат, который можно читать вслух за столом и который сразу создаёт эффект «это про меня».",
    emotions:
      "Удивление, радость, смех, ощущение личного внимания, вовлечённость всех гостей, подарок становится частью праздника, а не лежит в пакете.",
    purchaseReasons:
      "День рождения, юбилей, свадьба, выпускной, корпоратив, когда хочется поздравить с эмоцией и сделать подарок «про него», а не купить готовую вещь.",
    objections:
      "«А что туда писать?»\n«У нас мало материала»\n«Не получится ли слишком долго?»\n«Вы помогаете написать текст?»",
    presentationGuide:
      "Снимайте страх клиента: мы делаем выпуск с нуля по его материалам и помогаем с текстом. Показывайте первую полосу с фото и заголовком, внутренние полосы с историями. Главный триггер — «это про меня?». Газету захотят читать все за столом.",
    sectionImages: {
      description: "https://static.tildacdn.net/tild3637-6264-4336-a534-613633376664/3_.webp",
      presentationGuide: "https://static.tildacdn.net/tild3637-6264-4336-a534-613633376664/3_.webp",
      emotions: "https://static.tildacdn.net/tild3637-6264-4336-a534-613633376664/3_.webp"
    }
  },
  "gift-edition": {
    coverImage: "https://static.tildacdn.net/tild3461-3131-4533-a462-623130626535/4_.webp",
    shortDescription:
      "Полноценный глянцевый журнал, полностью посвящённый одному человеку. Подарок с сильным вау-эффектом.",
    description:
      "Глянцевый журнал с обложкой, статьями, интервью, фотографиями, поздравлениями, историями, цитатами и красивой журнальной подачей. Минимум 16 страниц. Стоимость зависит от количества страниц и уровня персонализации. Это настоящее печатное издание про человека — не альбом и не открытка.",
    targetAudience:
      "Для тех, кто хочет сделать более объёмный, солидный и эффектный подарок близкому человеку, руководителю, партнёру, юбиляру или важному гостю.",
    clientProblems:
      "Клиент хочет не вещь, а признание и статусный жест. Обычный подарок выглядит слишком слабо — нужен формат, который выглядит дорого, весомо и по-настоящему лично.",
    emotions:
      "Удивление, гордость, слёзы радости, статусный эффект, желание показывать журнал всем вокруг, ощущение, что человеку уделили особое внимание.",
    purchaseReasons:
      "Большой юбилей, семейный праздник высокого уровня, свадьба, подарок руководителю, годовщина, когда хочется создать ощущение настоящего печатного издания про человека.",
    objections:
      "«Это будет слишком дорого?»\n«Мы успеем к дате?»\n«Сколько материала нужно собрать?»\n«А не получится ли слишком пафосно?»",
    presentationGuide:
      "Продавайте ощущение значимости: «о тебе можно написать целый журнал». Показывайте структуру — обложка, интервью, фото, дизайнерские развороты. Для крупных поводов говорите языком статуса и признания. Уточняйте, что цена зависит от объёма страниц.",
    sectionImages: {
      description: "https://static.tildacdn.net/tild3461-3131-4533-a462-623130626535/4_.webp",
      emotions: "https://static.tildacdn.net/tild3461-3131-4533-a462-623130626535/4_.webp",
      purchaseReasons: "https://static.tildacdn.net/tild3461-3131-4533-a462-623130626535/4_.webp"
    }
  },
  "family-history": {
    coverImage: "https://static.tildacdn.net/tild3363-6634-4431-a434-626533633638/5_.webp",
    shortDescription:
      "Семейные истории, фотографии и воспоминания, собранные в настоящую книгу в твёрдом переплёте.",
    description:
      "Книга в твёрдом переплёте, где собраны воспоминания, фотографии, истории, важные события, слова близких, семейные легенды и фрагменты жизни человека или целой семьи. Можно собрать материал через анкету или живое интервью. Это наследие, которое можно передавать детям и внукам.",
    targetAudience:
      "Для семей, которые хотят сохранить историю близкого человека, семьи, любви, рода или важного жизненного периода. Особенно — дети и внуки, которые хотят успеть записать истории, пока их можно услышать.",
    clientProblems:
      "Воспоминания теряются, фото лежат без подписей, а семейные истории живут только в голове у старших. Клиент хочет сохранить всё это сейчас, пока источник ещё рядом.",
    emotions:
      "Тепло, уважение к прошлому, чувство семейного наследия, благодарность, спокойствие, ощущение, что важные истории не пропадут и останутся для будущих поколений.",
    purchaseReasons:
      "Юбилей бабушки или дедушки 60, 70, 80, 90 лет, годовщина свадьбы родителей, семейный подарок от детей и внуков, память о важном человеке.",
    objections:
      "«У нас мало материала»\n«Это слишком личная тема»\n«Не знаю, с чего начать»\n«А вдруг истории уже поздно собирать?»",
    presentationGuide:
      "Подчёркивайте срочность: пока человек может рассказать сам, нужно успеть сохранить его голос и детали. Объясняйте, что мы помогаем на каждом этапе — анкета или интервью. Книга — не альбом, а живое наследие для всей семьи.",
    sectionImages: {
      description: "https://static.tildacdn.net/tild3363-6634-4431-a434-626533633638/5_.webp",
      targetAudience: "https://static.tildacdn.net/tild3363-6634-4431-a434-626533633638/5_.webp",
      emotions: "https://static.tildacdn.net/tild3363-6634-4431-a434-626533633638/5_.webp"
    }
  },
  "company-history": {
    coverImage: "https://static.tildacdn.net/tild3130-3137-4638-b039-623766343032/ChatGPT_Image_26__20.webp",
    shortDescription:
      "Регулярная бумажная хроника семьи. Подарок, который приходит снова и снова и держит родных ближе.",
    description:
      "Семейная газета, которую можно выпускать раз в месяц, квартал, полгода или год. Семья присылает новости, фотографии, детские фразы, достижения, поездки, праздники и важные даты — мы превращаем это в настоящую газету, печатаем и отправляем родным. Особенно силён для семей, которые живут в разных городах и странах.",
    targetAudience:
      "Для больших семей, детей и внуков, живущих за границей, семей с пожилыми родственниками и всех, кому важна настоящая семейная связь, а не переписка в мессенджерах.",
    clientProblems:
      "Новости тонут в чатах, фото остаются в телефонах, общая семейная память распадается. Нужен регулярный ритуал, который удерживает семью вместе и делает отношения осязаемыми.",
    emotions:
      "Тепло, ощущение родства, забота, причастность, радость от ожидания нового выпуска, чувство, что тебя помнят и ждут, даже если вы живёте далеко друг от друга.",
    purchaseReasons:
      "Родственники живут далеко, семья хочет сохранить свою историю, много фото и новостей теряется в телефоне, хочется поддерживать связь с бабушкой и дедушкой, уже дарили семейную газету и хотят повторять.",
    objections:
      "«Зачем бумага, если есть мессенджеры?»\n«Кто будет собирать материалы?»\n«Насколько часто это нужно делать?»\n«А не станет ли это лишним?»",
    presentationGuide:
      "Говорите, что это не подписка на бумагу, а подписка на семейную память. Показывайте ритм — выпуск раз в месяц, квартал или год. Подчёркивайте, что бабушки и дедушки особенно ценят бумажную хронику с новостями детей и внуков.",
    sectionImages: {
      description: "https://static.tildacdn.net/tild3130-3137-4638-b039-623766343032/ChatGPT_Image_26__20.webp",
      clientProblems: "https://static.tildacdn.net/tild3130-3137-4638-b039-623766343032/ChatGPT_Image_26__20.webp",
      purchaseReasons: "https://static.tildacdn.net/tild3130-3137-4638-b039-623766343032/ChatGPT_Image_26__20.webp"
    }
  },
  "passport-discovery": {
    coverImage: "https://static.tildacdn.net/tild6339-3765-4839-a239-363565613436/_.webp",
    sectionImages: {
      description: "https://static.tildacdn.net/tild6339-3765-4839-a239-363565613436/_.webp",
      targetAudience: "https://static.tildacdn.net/tild6339-3765-4839-a239-363565613436/_.webp",
      emotions: "https://static.tildacdn.net/tild6339-3765-4839-a239-363565613436/_.webp"
    }
  },
  "passport-alcoholic": {
    coverImage: "https://static.tildacdn.net/tild3564-3662-4637-b064-313138376231/IMG_5570.webp",
    sectionImages: {
      description: "https://static.tildacdn.net/tild3564-3662-4637-b064-313138376231/IMG_5570.webp",
      targetAudience: "https://static.tildacdn.net/tild3564-3662-4637-b064-313138376231/IMG_5570.webp",
      emotions: "https://static.tildacdn.net/tild3564-3662-4637-b064-313138376231/IMG_5570.webp"
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
