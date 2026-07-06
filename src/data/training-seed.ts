import type { ProductMaterial, ProductTrainingModule, TrainingUser } from "@/types/training";
import { applyGiftSiteContentToCatalog, applyGiftSiteImagesToCatalog } from "@/data/training-gifts-content";
import { applySheetContentToCatalog } from "@/data/training-sheet-content";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";

const now = new Date().toISOString();

export const trainingUsers: TrainingUser[] = [
  { id: "anna", name: "Анна", role: "manager" },
  { id: "ilya", name: "Илья", role: "manager" },
  { id: "maria", name: "Мария", role: "manager" },
  { id: "admin", name: "Администратор", role: "admin" }
];

type SeedProduct = Omit<ProductTrainingModule, "createdAt" | "updatedAt">;

function createProductSeed(input: SeedProduct): ProductTrainingModule {
  return {
    ...input,
    createdAt: now,
    updatedAt: now
  };
}

function textMaterial(id: string, title: string, content: string, sortOrder = 1): ProductMaterial {
  return {
    id,
    type: "text",
    title,
    content,
    sortOrder
  };
}

function videoMaterial(
  id: string,
  title: string,
  content: string,
  sortOrder = 1,
  videoUrl?: string
): ProductMaterial {
  return {
    id,
    type: "video",
    title,
    content,
    sortOrder,
    url: videoUrl,
    embedUrl: videoUrl ? normalizeVideoEmbedUrl(videoUrl) : undefined
  };
}

export const birthDateNewspaperProduct = createProductSeed({
  id: "personal-newspaper",
  title: "Оригинал газеты со дня рождения",
  shortDescription:
    "Настоящая газета или журнал из важной даты. Подарок-машина времени, который запускает воспоминания и разговоры.",
  coverImage: "https://picsum.photos/seed/personal-newspaper/800/500",
  passingScore: 80,
  sortOrder: 1,
  description:
    "Оригинал газеты со дня рождения — это не сувенир, а настоящий кусочек прошлого. Мы подбираем реальное издание из конкретной даты, чтобы человек мог подержать в руках газету или журнал из дня рождения, юбилея, годовщины свадьбы или другого важного события. Такой подарок сразу цепляет эмоцией и становится поводом для разговора за столом.",
  targetAudience:
    "Папы, дедушки, мамы, бабушки, руководители, коллеги, учителя, тренеры и люди, у которых уже всё есть.",
  clientProblems:
    "Клиенту нужен небанальный подарок с историей, а стандартные сувениры не вызывают эмоцию. Хочется дать человеку не просто вещь, а личный смысл и тёплое чувство заботы.",
  emotions:
    "Ностальгия, удивление, разговоры о прошлом, улыбка, чувство «ты правда обо мне подумал», желание пересматривать и показывать близким.",
  purchaseReasons:
    "День рождения, юбилей, годовщина свадьбы, юбилей компании, любой важный личный или семейный повод.",
  objections:
    "«А подойдёт ли дата?»\n«Найдётся ли нужное издание?»\n«Не будет ли это выглядеть как обычный сувенир?»\n«Что если человек не любит пафос?»",
  presentationGuide:
    "Объясняйте, что мы продаём не бумагу, а момент из прошлого. Подчёркивайте реальность издания, эмоциональный эффект и то, что подарок становится началом разговора, а не предметом на полке. Если клиент сомневается, переводите разговор с вещи на реакцию получателя: именно это делает продукт ценным.",
  materials: [
    videoMaterial(
      "video-original-newspaper",
      "Видео для менеджеров",
      "Короткий видеоразбор: кому предлагать, как вытянуть дату и повод, и почему это не сувенир, а эмоциональный триггер.",
      1,
      "https://youtu.be/nkz1umEMcOk"
    ),
    textMaterial(
      "mat-original-newspaper",
      "Ключевые акценты",
      "• Реальная газета или журнал из конкретной даты, а не стилизация.\n• Подарок работает как машина времени и запускает воспоминания.\n• Сильнее всего эмоция проявляется за праздничным столом или при семейном вручении.\n• Главная реакция получателя — удивление, тепло и желание рассказывать истории.\n• Хороший вопрос для клиента: «Есть ли у вас важная дата, которую хочется вернуть?»"
    ),
    textMaterial(
      "mat-original-newspaper-sales",
      "Что говорить клиенту",
      "• Сначала ищем повод и дату, потом уже формат.\n• Этот подарок цепляет людей, у которых всё есть.\n• Мы не продаём обычную газету, мы возвращаем человека в его день.\n• Лучше всего продукт работает, когда хочется не просто поздравить, а тронуть.\n• Если нужен мягкий и тёплый подарок, это один из самых надёжных вариантов."
    )
  ],
  questions: [
    {
      id: "personal-newspaper-q1",
      text: "Что является главным смыслом газеты из важной даты?",
      type: "single",
      sortOrder: 1,
      answers: [
        { id: "personal-newspaper-q1-a1", text: "Просто красивый сувенир", isCorrect: false },
        { id: "personal-newspaper-q1-a2", text: "Реальное издание из конкретного дня, которое возвращает в прошлое", isCorrect: true },
        { id: "personal-newspaper-q1-a3", text: "Обычная открытка", isCorrect: false }
      ]
    },
    {
      id: "personal-newspaper-q2",
      text: "Для каких поводов этот подарок подходит особенно хорошо?",
      type: "single",
      sortOrder: 2,
      answers: [
        { id: "personal-newspaper-q2-a1", text: "Только для дня рождения", isCorrect: false },
        { id: "personal-newspaper-q2-a2", text: "Для юбилея, годовщины, свадьбы и любого важного события", isCorrect: true },
        { id: "personal-newspaper-q2-a3", text: "Только для корпоративных подарков", isCorrect: false }
      ]
    },
    {
      id: "personal-newspaper-q3",
      text: "Какую реакцию чаще всего вызывает этот продукт?",
      type: "single",
      sortOrder: 3,
      answers: [
        { id: "personal-newspaper-q3-a1", text: "Желание убрать подарок на полку", isCorrect: false },
        { id: "personal-newspaper-q3-a2", text: "Разговоры, воспоминания и ощущение заботы", isCorrect: true },
        { id: "personal-newspaper-q3-a3", text: "Равнодушие", isCorrect: false }
      ]
    },
    {
      id: "personal-newspaper-q4",
      text: "Кому этот продукт подходит особенно хорошо?",
      type: "single",
      sortOrder: 4,
      answers: [
        { id: "personal-newspaper-q4-a1", text: "Только детям до 10 лет", isCorrect: false },
        { id: "personal-newspaper-q4-a2", text: "Папе, дедушке, руководителю и человеку, у которого «всё есть»", isCorrect: true },
        { id: "personal-newspaper-q4-a3", text: "Только подросткам", isCorrect: false }
      ]
    },
    {
      id: "personal-newspaper-q5",
      text: "Что важнее всего подчеркнуть в продаже?",
      type: "single",
      sortOrder: 5,
      answers: [
        { id: "personal-newspaper-q5-a1", text: "Что это самая дешёвая бумага на рынке", isCorrect: false },
        { id: "personal-newspaper-q5-a2", text: "Что мы продаём не «старую газету», а эмоциональный момент за праздничным столом", isCorrect: true },
        { id: "personal-newspaper-q5-a3", text: "Что это обязательно стилизация под ретро", isCorrect: false }
      ]
    },
    {
      id: "personal-newspaper-q6",
      text: "Какую задачу клиента закрывает этот подарок?",
      type: "single",
      sortOrder: 6,
      answers: [
        { id: "personal-newspaper-q6-a1", text: "Нужен подарок, который не уберут на полку и вызовет настоящую эмоцию", isCorrect: true },
        { id: "personal-newspaper-q6-a2", text: "Нужен универсальный канцтовар", isCorrect: false },
        { id: "personal-newspaper-q6-a3", text: "Нужен подарок без повода и без даты", isCorrect: false }
      ]
    },
    {
      id: "personal-newspaper-q7",
      text: "Как описано ключевое обещание продукта?",
      type: "single",
      sortOrder: 7,
      answers: [
        { id: "personal-newspaper-q7-a1", text: "Подарить машину времени в день рождения", isCorrect: true },
        { id: "personal-newspaper-q7-a2", text: "Подарить цифровую подписку на новости", isCorrect: false },
        { id: "personal-newspaper-q7-a3", text: "Подарить пустую обложку без содержания", isCorrect: false }
      ]
    },
    {
      id: "personal-newspaper-q8",
      text: "Что делать, если точной газеты за нужную дату нет?",
      type: "single",
      sortOrder: 8,
      answers: [
        { id: "personal-newspaper-q8-a1", text: "Сразу отказать клиенту", isCorrect: false },
        { id: "personal-newspaper-q8-a2", text: "Предложить следующий день или журнал за месяц и год рождения", isCorrect: true },
        { id: "personal-newspaper-q8-a3", text: "Продать любую случайную газету без объяснения", isCorrect: false }
      ]
    },
    {
      id: "personal-newspaper-q9",
      text: "Чем этот продукт принципиально отличается от сувенира?",
      type: "single",
      sortOrder: 9,
      answers: [
        { id: "personal-newspaper-q9-a1", text: "Это реальное издание из конкретной даты, а не стилизация", isCorrect: true },
        { id: "personal-newspaper-q9-a2", text: "Это копия без привязки к дате", isCorrect: false },
        { id: "personal-newspaper-q9-a3", text: "Это только PDF-версия для печати дома", isCorrect: false }
      ]
    },
    {
      id: "personal-newspaper-q10",
      text: "Что можно дополнительно подобрать к подарку?",
      type: "single",
      sortOrder: 10,
      answers: [
        { id: "personal-newspaper-q10-a1", text: "Только прозрачный пакет", isCorrect: false },
        { id: "personal-newspaper-q10-a2", text: "Красивую упаковку: конверт, папку или тубус", isCorrect: true },
        { id: "personal-newspaper-q10-a3", text: "Только электронную открытку", isCorrect: false }
      ]
    },
    {
      id: "personal-newspaper-q11",
      text: "Какие региональные издания упоминаются в материалах Retro Pressa?",
      type: "single",
      sortOrder: 11,
      answers: [
        { id: "personal-newspaper-q11-a1", text: "Только США и Канада", isCorrect: false },
        { id: "personal-newspaper-q11-a2", text: "Латвия, Литва и Эстония", isCorrect: true },
        { id: "personal-newspaper-q11-a3", text: "Только Москва", isCorrect: false }
      ]
    },
    {
      id: "personal-newspaper-q12",
      text: "Куда возможна доставка по материалам Retro Pressa?",
      type: "single",
      sortOrder: 12,
      answers: [
        { id: "personal-newspaper-q12-a1", text: "Только по одному городу", isCorrect: false },
        { id: "personal-newspaper-q12-a2", text: "По всему миру", isCorrect: true },
        { id: "personal-newspaper-q12-a3", text: "Только самовывоз из офиса", isCorrect: false }
      ]
    },
    {
      id: "personal-newspaper-q13",
      text: "Как правильно отработать возражение «не будет ли это обычным сувениром»?",
      type: "single",
      sortOrder: 13,
      answers: [
        { id: "personal-newspaper-q13-a1", text: "Сравнить цену с конкурентами", isCorrect: false },
        { id: "personal-newspaper-q13-a2", text: "Перевести разговор на реакцию получателя: удивление, воспоминания, семейные разговоры", isCorrect: true },
        { id: "personal-newspaper-q13-a3", text: "Сказать, что это массовый товар без истории", isCorrect: false }
      ]
    },
    {
      id: "personal-newspaper-q14",
      text: "Какой вопрос полезно задать клиенту на старте?",
      type: "single",
      sortOrder: 14,
      answers: [
        { id: "personal-newspaper-q14-a1", text: "«Какой у вас бюджет на канцтовары?»", isCorrect: false },
        { id: "personal-newspaper-q14-a2", text: "«Есть ли у вас важная дата, которую хочется вернуть?»", isCorrect: true },
        { id: "personal-newspaper-q14-a3", text: "«Нужен ли подарок без повода?»", isCorrect: false }
      ]
    },
    {
      id: "personal-newspaper-q15",
      text: "С чего менеджер должен начать подбор продукта?",
      type: "single",
      sortOrder: 15,
      answers: [
        { id: "personal-newspaper-q15-a1", text: "Сразу с упаковки", isCorrect: false },
        { id: "personal-newspaper-q15-a2", text: "С повода и даты, потом уже формата", isCorrect: true },
        { id: "personal-newspaper-q15-a3", text: "С выбора доставки без уточнения даты", isCorrect: false }
      ]
    }
  ]
});

export const lifeBookProduct = createProductSeed({
  id: "personal-magazine",
  title: "Книга жизни в заголовках газет",
  shortDescription:
    "Книга, где жизнь человека собрана из настоящих газет за каждый год. Подарок про память, эпоху и прожитую историю.",
  coverImage: "https://picsum.photos/seed/personal-magazine/800/500",
  passingScore: 80,
  sortOrder: 2,
  description:
    "Книга жизни в заголовках газет — это сшитая книга из газет за каждый год жизни человека. Первая страница посвящена дню рождения, а дальше идёт год за годом, чтобы человек буквально прошёл свою жизнь заново через заголовки, события и атмосферу эпохи. Это очень сильный подарок для юбилеев и больших семейных поводов.",
  targetAudience:
    "Родители, бабушки и дедушки, супруги, руководители, учителя и люди, которым хочется показать ценность прожитой жизни.",
  clientProblems:
    "Клиент хочет глубокий и редкий подарок, который не выглядит случайным. Нужно не просто поздравление, а вещь с долгой памятью и сильной эмоциональной глубиной.",
  emotions:
    "Вау-эффект, уважение, ощущение прожитой эпохи, семейные разговоры, благодарность за внимание и желание перелистывать книгу снова и снова.",
  purchaseReasons:
    "Юбилей 40+, 50+, 60+, 70+, 80+, годовщина, семейный праздник, подарок от детей или внуков, признание жизненного пути.",
  objections:
    "«Это не слишком сложно?»\n«Не получится ли слишком объёмно?»\n«А точно хватит газет на все годы?»\n«Кому вообще нужен такой подарок?»",
  presentationGuide:
    "Говорите, что мы показываем жизнь человека через время. Это не набор фотографий, а ощущение целой эпохи. Особенно сильный эффект подарок даёт для старшего поколения и людей с длинной историей семьи. Если клиент ищет нечто глубокое, ведите его к мысли о наследии, а не о полиграфии.",
  materials: [
    videoMaterial(
      "video-life-book",
      "Видео для менеджеров",
      "Сюда загрузим видео о том, как продавать книгу жизни: почему сильнее всего она работает на юбилеях и как объяснить ценность каждой страницы.",
      1
    ),
    textMaterial(
      "mat-life-book",
      "Как продавать книгу жизни",
      "• Один год жизни = один газетный блок, поэтому книга читается как история.\n• Первая страница всегда начинается с даты рождения.\n• Особенно сильна книга для людей 40+ и старше, когда важна глубина и память.\n• Главная ценность — ощущение прожитой жизни, а не просто полиграфия.\n• Полезная фраза в продаже: «Это подарок, который показывает целую эпоху жизни человека». "
    ),
    textMaterial(
      "mat-life-book-sales",
      "Что подчёркивать",
      "• Это подарок для больших дат, когда одного поздравления уже мало.\n• Подходит, если клиент хочет показать уважение к жизненному пути человека.\n• Лучше всего работает с семейной историей и тёплыми воспоминаниями.\n• Люди часто реагируют не на факты, а на ощущение прожитого времени."
    )
  ],
  questions: [
    {
      id: "personal-magazine-q1",
      text: "Что лежит в основе книги жизни?",
      type: "single",
      sortOrder: 1,
      answers: [
        { id: "personal-magazine-q1-a1", text: "Фотоколлаж из семейного архива", isCorrect: false },
        { id: "personal-magazine-q1-a2", text: "Газеты за каждый год жизни человека", isCorrect: true },
        { id: "personal-magazine-q1-a3", text: "Обычный альбом с подписями", isCorrect: false }
      ]
    },
    {
      id: "personal-magazine-q2",
      text: "Для кого этот подарок особенно силён?",
      type: "single",
      sortOrder: 2,
      answers: [
        { id: "personal-magazine-q2-a1", text: "Для подростков", isCorrect: false },
        { id: "personal-magazine-q2-a2", text: "Для людей 40+, 50+, 60+, 70+ и старше", isCorrect: true },
        { id: "personal-magazine-q2-a3", text: "Только для корпоративных клиентов", isCorrect: false }
      ]
    },
    {
      id: "personal-magazine-q3",
      text: "Какой главный эффект должен почувствовать получатель?",
      type: "single",
      sortOrder: 3,
      answers: [
        { id: "personal-magazine-q3-a1", text: "Что его жизнь — это целая история", isCorrect: true },
        { id: "personal-magazine-q3-a2", text: "Что подарок был выбран случайно", isCorrect: false },
        { id: "personal-magazine-q3-a3", text: "Что это просто печатный артефакт", isCorrect: false }
      ]
    }
  ]
});

export const partyPageProduct = createProductSeed({
  id: "retro-newspaper",
  title: "PARTYPAGE — персонализированная газета",
  shortDescription:
    "Газета, где человек открывает выпуск и видит себя на первой полосе. Подарок, который делает героя главным героем своей истории.",
  coverImage: "https://picsum.photos/seed/retro-newspaper/800/500",
  passingScore: 80,
  sortOrder: 3,
  description:
    "PARTYPAGE — это настоящая персонализированная газета, созданная с нуля под конкретного человека и повод. Главный герой выпуска — сам получатель: с его фотографиями, историями, поздравлениями и даже кроссвордом. Газету можно сделать в электронном формате или напечатать, а готовится она заметно быстрее обычных премиальных подарков.",
  targetAudience:
    "Именинники, юбиляры, пары на свадьбу, выпускники, коллеги, руководители, семьи и команды, которым нужен личный и яркий подарок.",
  clientProblems:
    "Клиент хочет подарок с сильной эмоцией, но без сложной подготовки и пафоса. Нужен формат, который легко персонализировать и который сразу создаёт эффект «это про меня».",
  emotions:
    "Удивление, радость, смех, слёзы от неожиданности, ощущение признания и вовлечённость всех гостей в праздник.",
  purchaseReasons:
    "День рождения, юбилей, свадьба, выпускной, корпоратив, выход на пенсию, гендер-пати, девичник или любой особый повод.",
  objections:
    "«А что туда писать?»\n«У нас мало материала»\n«Не получится ли слишком долго?»\n«А если нужен быстрый подарок?»",
  presentationGuide:
    "Снимайте страх клиента тем, что мы делаем выпуск с нуля по его материалам. Упирайте на то, что человек становится героем собственной газеты, а сам подарок вовлекает всех вокруг и быстро превращается в часть праздника. Обязательно держите фокус на лёгкости персонализации: клиенту не нужно придумывать всё самому.",
  materials: [
    videoMaterial(
      "video-party-page",
      "Видео для менеджеров",
      "Сюда загрузим видео про быстрый сценарий персонализации: как собрать выпуск, где взять фото и как объяснить, что герой будет на первой полосе.",
      1
    ),
    textMaterial(
      "mat-party-page",
      "Как презентовать PARTYPAGE",
      "• Человек видит себя на первой полосе.\n• Внутри можно собрать фото, истории, поздравления и кроссворд.\n• Формат подходит и для электронного, и для печатного подарка.\n• Основной триггер — эффект «это про меня?».\n• Если клиенту нужен быстрый, но очень личный подарок, это одна из самых сильных опций."
    ),
    textMaterial(
      "mat-party-page-sales",
      "Что делать в разговоре",
      "• Сначала объясняем, что человек становится героем своей истории.\n• Дальше показываем, что собрать выпуск можно без лишнего стресса.\n• Подчёркиваем вау-эффект на празднике: газету захотят читать все.\n• Хорошо работает, когда клиент хочет удивить, но не перегрузить подготовкой."
    )
  ],
  questions: [
    {
      id: "retro-newspaper-q1",
      text: "Кто становится главным героем персонализированной газеты?",
      type: "single",
      sortOrder: 1,
      answers: [
        { id: "retro-newspaper-q1-a1", text: "Политик или звезда из архива", isCorrect: false },
        { id: "retro-newspaper-q1-a2", text: "Конкретный человек, для которого делают выпуск", isCorrect: true },
        { id: "retro-newspaper-q1-a3", text: "Редактор газеты", isCorrect: false }
      ]
    },
    {
      id: "retro-newspaper-q2",
      text: "Что можно включить внутрь выпуска?",
      type: "single",
      sortOrder: 2,
      answers: [
        { id: "retro-newspaper-q2-a1", text: "Только один заголовок на первой полосе", isCorrect: false },
        { id: "retro-newspaper-q2-a2", text: "Фото, истории, поздравления и кроссворд", isCorrect: true },
        { id: "retro-newspaper-q2-a3", text: "Только список цен", isCorrect: false }
      ]
    },
    {
      id: "retro-newspaper-q3",
      text: "Какой формат выпуска возможен?",
      type: "single",
      sortOrder: 3,
      answers: [
        { id: "retro-newspaper-q3-a1", text: "Только устный рассказ", isCorrect: false },
        { id: "retro-newspaper-q3-a2", text: "PDF или напечатанная газета", isCorrect: true },
        { id: "retro-newspaper-q3-a3", text: "Только открытка", isCorrect: false }
      ]
    }
  ]
});

export const glossyMagazineProduct = createProductSeed({
  id: "gift-edition",
  title: "Глянцевый журнал о человеке",
  shortDescription:
    "Премиальный журнал про конкретного человека. Подарок, после которого говорят: «Я такого ещё никогда не получал».",
  coverImage: "https://picsum.photos/seed/gift-edition/800/500",
  passingScore: 80,
  sortOrder: 4,
  description:
    "Глянцевый журнал о человеке — это полноценное персональное издание, созданное индивидуально про героя праздника. Внутри — фотографии, интервью, статьи, поздравления и дизайнерские развороты. Это формат для тех случаев, когда обычный подарок выглядит слишком слабо и нужен по-настоящему статусный жест признания.",
  targetAudience:
    "Юбиляры, руководители, сотрудники года, учителя, тренеры, родители, бабушки и дедушки, семьи и корпоративные заказчики.",
  clientProblems:
    "Клиент хочет не вещь, а признание. Нужно показать, что подарок может выглядеть дорого, весомо и по-настоящему лично.",
  emotions:
    "Удивление, гордость, слёзы радости, желание показывать журнал всем вокруг и чувство, что человеку уделили особое внимание.",
  purchaseReasons:
    "Юбилей, день рождения, корпоративное чествование, выход на пенсию, годовщина в компании, семейный праздник, подарок от команды.",
  objections:
    "«Это будет слишком дорого?»\n«А не получится ли слишком пафосно?»\n«Мы успеем к дате?»\n«Сколько материала нужно собрать?»",
  presentationGuide:
    "Продавайте не полиграфию, а ощущение значимости. Подчёркивайте, что это настоящий журнал про человека, а не просто альбом или открытка. Для крупных поводов говорите языком статуса, признания и вау-эффекта. Этот продукт особенно хорошо звучит, когда клиент хочет сделать «дорого и лично» одновременно.",
  materials: [
    videoMaterial(
      "video-glossy-magazine",
      "Видео для менеджеров",
      "Сюда загрузим видео о статусной подаче: как объяснить разницу между обычным подарком и персональным журналом.",
      1
    ),
    textMaterial(
      "mat-glossy-magazine",
      "Ключевые акценты продаж",
      "• Не открытка и не фотоальбом, а настоящий глянец.\n• Минимум 16 страниц.\n• Производство занимает от 10 рабочих дней.\n• Главная формулировка — «о тебе можно написать целый журнал».\n• Важно проговаривать статус: это подарок, который выглядит как полноценное издание."
    ),
    textMaterial(
      "mat-glossy-magazine-sales",
      "Как усиливать ценность",
      "• Показывайте, что в журнале есть структура, интервью, фото и дизайн.\n• Для клиента важен не только объём, но и ощущение персонального признания.\n• Хорошо работает на юбилеях, в командах и в семейных больших поводов.\n• Если нужен премиальный акцент, этот продукт хорошо поднимает чек."
    )
  ],
  questions: [
    {
      id: "gift-edition-q1",
      text: "Какой минимальный объём у глянцевого журнала?",
      type: "single",
      sortOrder: 1,
      answers: [
        { id: "gift-edition-q1-a1", text: "8 страниц", isCorrect: false },
        { id: "gift-edition-q1-a2", text: "От 16 страниц", isCorrect: true },
        { id: "gift-edition-q1-a3", text: "Только 4 страницы", isCorrect: false }
      ]
    },
    {
      id: "gift-edition-q2",
      text: "Что мы продаём по сути?",
      type: "single",
      sortOrder: 2,
      answers: [
        { id: "gift-edition-q2-a1", text: "Просто печать на бумаге", isCorrect: false },
        { id: "gift-edition-q2-a2", text: "Ощущение значимости и признания", isCorrect: true },
        { id: "gift-edition-q2-a3", text: "Стандартный каталог", isCorrect: false }
      ]
    },
    {
      id: "gift-edition-q3",
      text: "Сколько времени обычно занимает производство?",
      type: "single",
      sortOrder: 3,
      answers: [
        { id: "gift-edition-q3-a1", text: "От 10 рабочих дней", isCorrect: true },
        { id: "gift-edition-q3-a2", text: "Один час", isCorrect: false },
        { id: "gift-edition-q3-a3", text: "Только после месяца ожидания", isCorrect: false }
      ]
    }
  ]
});

export const trainingProductsSeed: ProductTrainingModule[] = [
  birthDateNewspaperProduct,
  lifeBookProduct,
  partyPageProduct,
  glossyMagazineProduct
];

export type TrainingCatalog = {
  version: 1;
  products: ProductTrainingModule[];
  updatedAt: string;
};

export function createTrainingCatalogSeed(): TrainingCatalog {
  const withGifts = applyGiftSiteContentToCatalog(trainingProductsSeed);
  const withSheet = applySheetContentToCatalog(withGifts);

  return {
    version: 1,
    products: applyGiftSiteImagesToCatalog(withSheet),
    updatedAt: now
  };
}
