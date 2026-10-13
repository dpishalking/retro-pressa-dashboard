import type { ClientMaterial } from "@/types/training";

type KnowledgePhoto = {
  id: string;
  title: string;
  url: string;
  category: string;
  description: string;
};

type KnowledgeArticle = {
  id: string;
  title: string;
  photos: KnowledgePhoto[];
};

const ARTICLES: KnowledgeArticle[] = [
  {
    id: "reproduction",
    title: "Оригинал и репродукция",
    photos: [
      {
        id: "reproduction-izvestiya-1962",
        title: "Репродукция — «Известия», 21 июня 1962",
        url: "/training/reproduction/izvestiya-1962.jpg",
        category: "Репродукция",
        description: "Пример газетной репродукции: «Известия», 21 июня 1962."
      },
      {
        id: "reproduction-molodezh-1953",
        title: "Репродукция — «Советская молодёжь», 10 февраля 1953",
        url: "/training/reproduction/sovetskaya-molodezh-1953.jpg",
        category: "Репродукция",
        description: "Пример газетной репродукции: «Советская молодёжь», 10 февраля 1953."
      },
      {
        id: "reproduction-ichkeria-1993",
        title: "Репродукция — «Ичкерия», 2 сентября 1993",
        url: "/training/reproduction/ichkeria-1993.jpg",
        category: "Репродукция",
        description: "Пример газетной репродукции: «Ичкерия», 2 сентября 1993."
      }
    ]
  },
  {
    id: "life-book",
    title: "Книга жизни в заголовках газет",
    photos: [
      {
        id: "life-book-papa-pravda-cover",
        title: "«Папина правда, или 80 лет через прессу» — обложка",
        url: "/training/life-book/papa-pravda-cover.jpg",
        category: "Книга жизни в заголовках газет",
        description: "Обложка книги «Папина правда»."
      },
      {
        id: "life-book-papa-pravda-title",
        title: "«Папина правда» — титульный лист",
        url: "/training/life-book/papa-pravda-title-page.jpg",
        category: "Книга жизни в заголовках газет",
        description: "Титульный лист книги «Папина правда»."
      },
      {
        id: "life-book-papa-pravda-page",
        title: "«Папина правда» — газетный разворот",
        url: "/training/life-book/papa-pravda-newspaper-page.jpg",
        category: "Книга жизни в заголовках газет",
        description: "Газетный разворот из книги «Папина правда»."
      }
    ]
  },
  {
    id: "packaging",
    title: "Упаковка",
    photos: [
      {
        id: "packaging-mailbox-folder",
        title: "Папка «почтовый ящик» Retro Pressa",
        url: "/training/packaging/mailbox-folder.jpg",
        category: "Упаковка",
        description: "Красная подарочная папка в виде почтового ящика."
      },
      {
        id: "packaging-airmail-envelope",
        title: "Почтовый конверт Retro Pressa",
        url: "/training/packaging/airmail-envelope.jpg",
        category: "Упаковка",
        description: "Подарочный конверт в стиле авиапочты."
      },
      {
        id: "packaging-davinam-jaunibas-atminas",
        title: "Упаковка «Dāvinām jaunības atmiņas»",
        url: "/training/packaging/davinam-jaunibas-atminas.jpg",
        category: "Упаковка",
        description: "Подарочная упаковка Retro Pressa на латышском."
      }
    ]
  },
  {
    id: "first-letter",
    title: "Первое письмо",
    photos: [
      {
        id: "pervoe-pismo-amira-pair",
        title: "Первое письмо — две открытки, 5 месяцев",
        url: "/training/pervoe-pismo/amira-5-months-pair.jpg",
        category: "Первое письмо",
        description: "Открытки родственникам на русском и французском."
      },
      {
        id: "pervoe-pismo-amira-open",
        title: "Первое письмо — разворот с фото и текстом",
        url: "/training/pervoe-pismo/amira-5-months-open.jpg",
        category: "Первое письмо",
        description: "Открытая открытка с фото малыша и письмом родным."
      }
    ]
  },
  {
    id: "retro-poster",
    title: "Ретро-постер",
    photos: [
      {
        id: "retro-poster-semeynaya-pravda",
        title: "Ретро-постер — «Семейная правда» в рамке",
        url: "/training/retro-poster/semeynaya-pravda.jpg",
        category: "Ретро-постер",
        description: "Пример передовицы исторической газеты на стене."
      },
      {
        id: "retro-poster-gazeta-zhizni",
        title: "Ретро-постер — «Газета жизни» на стене",
        url: "/training/retro-poster/gazeta-zhizni.jpg",
        category: "Ретро-постер",
        description: "Пример индивидуального макета на одной странице."
      },
      {
        id: "retro-poster-sovetskaya-molodezh",
        title: "Ретро-постер — «Советская молодёжь» на стене",
        url: "/training/retro-poster/sovetskaya-molodezh.jpg",
        category: "Ретро-постер",
        description: "Пример передовицы исторической газеты в рамке на стене."
      },
      {
        id: "retro-poster-offer-sheet",
        title: "Ретро-постер — описание форматов",
        url: "/training/retro-poster/offer-sheet.png",
        category: "Ретро-постер",
        description: "Два размера: 30 × 40 см и A3."
      }
    ]
  }
];

export function listProductKnowledgeClientMaterials(): ClientMaterial[] {
  return ARTICLES.flatMap((article, articleIndex) =>
    article.photos.map((photo, photoIndex) => ({
      id: photo.id,
      title: photo.title,
      description: photo.description,
      category: photo.category,
      type: "image" as const,
      url: photo.url,
      sortOrder: articleIndex * 10 + photoIndex + 1
    }))
  );
}
