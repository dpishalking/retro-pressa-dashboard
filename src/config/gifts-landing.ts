export type GiftKind = "core" | "addon";

export type GiftLandingItem = {
  id: string;
  kind: GiftKind;
  passportId: string;
  number: string;
  kicker: string;
  title: string;
  lead: string;
  description: string;
  forWhom: string;
  moments: string[];
  gets: string[];
  price: string;
  image: string;
  gallery: string[];
};

export const giftsLandingMeta = {
  brand: "Retro Pressa",
  telegramUrl: "https://t.me/Retro_Pressa",
  phoneDisplay: "+371 28 373 939",
  phoneHref: "tel:+37128373939",
  whatsappUrl: "https://wa.me/37128373939",
  seoTitle: "Все подарки Retro Pressa",
  seoDescription:
    "Газета из даты рождения, персональный журнал, книга жизни, семейное издание и другие подарки Retro Pressa — с фотографиями из паспортов продуктов."
};

export function telegramGiftUrl(title: string): string {
  const text = `Здравствуйте! Хочу подобрать подарок: ${title}`;
  return `${giftsLandingMeta.telegramUrl}?text=${encodeURIComponent(text)}`;
}

export const GIFT_LANDING_ITEMS: GiftLandingItem[] = [
  {
    id: "original",
    kind: "core",
    passportId: "PRODUCT_ORIGINAL",
    number: "01",
    kicker: "Издание из даты",
    title: "Оригинал",
    lead: "Настоящая газета или журнал, которые вышли в день рождения человека.",
    description:
      "Это не стилизация и не сувенир — физический фрагмент прошлого. Человек берёт издание в руки, читает заголовки того дня и на несколько минут возвращается туда, где всё только начиналось.",
    forWhom: "Маме, папе, бабушке, дедушке, руководителю и человеку, у которого «уже всё есть».",
    moments: ["день рождения", "юбилей", "годовщина", "подарок коллеге"],
    gets: ["настоящее издание из архива", "момент за праздничным столом", "повод для семейных историй"],
    price: "25–51 €",
    image: "/training/newspaper-from-date/pravda-izvestiya-stack.png",
    gallery: [
      "/training/newspaper-from-date/moscow-news-1986-07-06.png",
      "/training/newspaper-from-date/krasny-sport-1938-01-09.png",
      "/training/magazine-from-date/krokodil-1987-02-05.png"
    ]
  },
  {
    id: "reproduction",
    kind: "core",
    passportId: "PRODUCT_REPRODUCTION",
    number: "02",
    kicker: "Издание из даты",
    title: "Репродукция",
    lead: "Точная печатная копия газеты или журнала из нужной даты — когда оригинала на складе нет.",
    description:
      "Сохраняем ту же эмоцию «газеты из того дня»: натуральный размер, атмосфера эпохи, возможность читать и показывать гостям. Без вставок фото и текста — чистая машина времени.",
    forWhom: "Когда важна дата, а архивного экземпляра уже нет, или нужен аккуратный современный тираж.",
    moments: ["день рождения", "юбилей компании", "дата, которой нет в складе"],
    gets: ["точная копия издания", "тактильный вау без ожидания оригинала", "можно красиво упаковать"],
    price: "50 €",
    image: "/training/magazine-from-date/za-rulem-1993-03.png",
    gallery: [
      "/training/magazine-from-date/semya-i-shkola-1987-02.png",
      "/training/magazine-from-date/krokodil-1987-02-04.png",
      "/training/magazine-from-date/dadzis-1979-09.png"
    ]
  },
  {
    id: "congrats-newspaper",
    kind: "core",
    passportId: "PRODUCT_CONGRATS_NEWSPAPER",
    number: "03",
    kicker: "Ретро + личное",
    title: "Поздравительная газета",
    lead: "Скан настоящей газеты из даты рождения — а внутри спрятаны фото и текст про человека.",
    description:
      "Сначала ностальгия: знакомые заголовки, эпоха, новости того дня. Потом второе вау — на внутренней странице человек находит себя. До 7 фото и поздравление. Остальной выпуск остаётся как в оригинале.",
    forWhom: "Тем, кому нравится газета из даты, но хочется добавить личное поздравление.",
    moments: ["день рождения", "юбилей", "когда хочется двойной эффект"],
    gets: ["ретро-издание из своего дня", "личное открытие внутри", "газету передают из рук в руки"],
    price: "72 €",
    image: "/training/retro-newspaper/pravda-arvit-1965.png",
    gallery: [
      "/training/retro-newspaper/izvestiya-den-rozhdeniya.png",
      "/training/retro-newspaper/pravda-rebenok.png",
      "/training/retro-newspaper/izvestiya-ali-kerimov-1975.png"
    ]
  },
  {
    id: "congrats-magazine",
    kind: "core",
    passportId: "PRODUCT_CONGRATS_MAGAZINE",
    number: "04",
    kicker: "Ретро + личное",
    title: "Поздравительный журнал",
    lead: "Тот же принцип, что у газеты: архивный журнал месяца рождения — и личные страницы внутри.",
    description:
      "За основу берём скан журнала вроде «Науки и жизни» или «Крестьянки». Человек листает эпоху своего месяца — и неожиданно находит фото и текст про себя.",
    forWhom: "Для тех, кто любит журналы и хочет подарок, который хочется листать, а не только развернуть.",
    moments: ["день рождения", "юбилей", "подарок человеку, который любит читать"],
    gets: ["ретро-журнал из своего месяца", "личное поздравление внутри", "формат, который сохраняют"],
    price: "135 €",
    image: "/training/congratulatory-magazine/karavan-istoriy-georgiy-cover.jpg",
    gallery: [
      "/training/congratulatory-magazine/nauka-i-zhizn-alexander-cover.jpg",
      "/training/magazine-from-date/krestyanka-1993-03.png",
      "/training/magazine-from-date/rabotnitsa-1993-03.png"
    ]
  },
  {
    id: "personal-newspaper",
    kind: "core",
    passportId: "PRODUCT_PERSONAL_NEWSPAPER",
    number: "05",
    kicker: "Про человека с нуля",
    title: "Персональная газета",
    lead: "Газета, созданная с нуля: человек — герой первой полосы, статьи, факты и поздравления.",
    description:
      "Не архив, а новый выпуск специально про вашего человека или повод. Первая полоса, заголовки, фото, истории гостей. Быстрый вау: хочется читать за столом и показывать всем.",
    forWhom: "Когда нужен яркий личный подарок к дате — день рождения, свадьба, корпоратив, выпускной.",
    moments: ["день рождения", "свадьба", "корпоратив", "когда нужно быстро"],
    gets: ["герой собственной газеты", "макет за 1–2 дня", "праздник, который можно подержать"],
    price: "от 55 €",
    image: "/training/personal-newspaper/muzhskaya-pravda-cover-2026.png",
    gallery: [
      "/training/personal-newspaper/muzhskaya-pravda-open-spread.png",
      "/training/personal-newspaper/muzhskaya-pravda-spread-2024.png",
      "/training/personal-newspaper/love-times-semya-gazeta.png"
    ]
  },
  {
    id: "personal-magazine",
    kind: "core",
    passportId: "PRODUCT_PERSONAL_MAGAZINE",
    number: "06",
    kicker: "Про человека с нуля",
    title: "Журнал о человеке",
    lead: "Глянцевый журнал, где близкий человек становится героем обложки и всех страниц.",
    description:
      "Истории, фото, интервью, воспоминания и пожелания — настоящее издание про человека. Не альбом и не фотокнига: статус глянца, который хочется листать снова.",
    forWhom: "На большой юбилей, когда подарок должен выглядеть дорого, лично и «про него целиком».",
    moments: ["юбилей", "день рождения", "подарок супругу", "чествование"],
    gets: ["персональная концепция", "глянец с нуля", "подарок, который не ставят в шкаф"],
    price: "от 240 €",
    image: "/training/gift-edition/forbes-vitaliy.png",
    gallery: [
      "/training/gift-edition/glamour-tatyana.png",
      "/training/gift-edition/muzhchina-goda-igor.png",
      "/training/gift-edition/zhenschina-goda-marina.png"
    ]
  },
  {
    id: "life-book",
    kind: "core",
    passportId: "PRODUCT_LIFE_BOOK",
    number: "07",
    kicker: "Масштаб жизни",
    title: "Книга жизни",
    lead: "Газеты за каждый год жизни — от года рождения и дальше, в одной книге.",
    description:
      "Именинник листает год за годом: заголовки, события, атмосфера времени. Можно начать с издания из места, где человек родился. Это не фотоальбом — ощущение «моя жизнь была целой эпохой».",
    forWhom: "Родителям, бабушке, дедушке и юбиляру 50, 60, 70, 80, 90 лет.",
    moments: ["большой юбилей", "подарок папе или маме", "торжественное поздравление"],
    gets: ["книга, которую листает вся семья", "сильный вау на юбилее", "история жизни через газеты"],
    price: "от 240 €",
    image: "/training/life-book/diana-kanberg-cover.png",
    gallery: [
      "/training/newspaper-from-date/pravda-izvestiya-stack.png",
      "/training/newspaper-from-date/moscow-news-1986-07-06.png",
      "/training/newspaper-from-date/lietuvos-rytas-1990-01-05.png"
    ]
  },
  {
    id: "family-edition",
    kind: "core",
    passportId: "PRODUCT_FAMILY_EDITION",
    number: "08",
    kicker: "Семейная память",
    title: "Семейное издание",
    lead: "Книга воспоминаний в твёрдом переплёте: живые слова, фото и история семьи.",
    description:
      "Пока истории живут только в разговорах за чаем, они могут исчезнуть. В книге они становятся наследием — для детей, внуков и тех, кто ещё не родился.",
    forWhom: "Семьям, которые хотят сохранить голос бабушки, историю любви или родовую память.",
    moments: ["юбилей старших", "годовщина", "когда «надо бы записать, пока рассказывают»"],
    gets: ["твёрдый переплёт", "связный текст из воспоминаний", "книга, которую передают дальше"],
    price: "по запросу",
    image: "/training/family-edition/love-times-cover.png",
    gallery: [
      "/training/family-edition/love-times-spread.png",
      "/training/family-edition/veselaya-semeika-spread.png",
      "/training/family-edition/vestnik-lyubvi-cover.png"
    ]
  },
  {
    id: "animate",
    kind: "addon",
    passportId: "PRODUCT_ANIMATE",
    number: "09",
    kicker: "Второй вау",
    title: "Оживи",
    lead: "Гости наводят телефон — и фото или издание оживает.",
    description:
      "Цифровой слой поверх печатного подарка. Второй сюрприз за столом: его снимают, отправляют в сторис и пересылают.",
    forWhom: "К любому печатному подарку, когда хочется ещё один момент удивления.",
    moments: ["вручение за столом", "когда гости достают телефоны"],
    gets: ["ожившее фото или издание", "легко показать гостям", "усиливает любой печатный формат"],
    price: "4 €",
    image: "/training/ozivi/cover.jpg",
    gallery: [
      "/training/gift-edition/forbes-adlet.png",
      "/training/personal-newspaper/muzhskaya-pravda-cover-2026.png",
      "/training/life-book/diana-kanberg-cover.png"
    ]
  },
  {
    id: "song",
    kind: "addon",
    passportId: "PRODUCT_CONGRATS_SONG",
    number: "10",
    kicker: "Музыкальное поздравление",
    title: "Поздравительная песня",
    lead: "Личные слова превращаются в готовую песню — с именем, историей и нужным жанром.",
    description:
      "Вы рассказываете, кого поздравляете и что хотите сказать. Мы делаем композицию, которую можно включить на празднике или отправить лично.",
    forWhom: "Когда обычный тост не вмещает то, что хочется сказать.",
    moments: ["день рождения", "юбилей", "свадьба", "поздравление на расстоянии"],
    gets: ["персональный трек", "жанр и вокал на выбор", "момент, который включают ещё раз"],
    price: "20 €",
    image: "/training/congratulatory-song/cover.jpg",
    gallery: []
  },
  {
    id: "sticker",
    kind: "addon",
    passportId: "PRODUCT_STICKER",
    number: "11",
    kicker: "К комплекту",
    title: "Наклейка",
    lead: "Праздничная наклейка, которая делает вручение собранным.",
    description:
      "Готовые дизайны на русском и латышском — без отдельного производства «под клиента». Мелочь, от которой комплект выглядит законченным.",
    forWhom: "К любому печатному заказу, где важно красивое вручение.",
    moments: ["упаковка", "момент, когда разворачивают подарок"],
    gets: ["готовый дизайн", "праздничный вид комплекта", "8 вариантов без ожидания"],
    price: "3,5 €",
    image: "/training/stickers/cover.png",
    gallery: [
      "/training/stickers/spravka-osvobozhdenie.png",
      "/training/stickers/spravka-otgul-48h-blue.png",
      "/training/stickers/mixtura-sport.png"
    ]
  },
  {
    id: "digital",
    kind: "addon",
    passportId: "PRODUCT_DIGITAL",
    number: "12",
    kicker: "Быстрый формат",
    title: "Дигитальная версия",
    lead: "Электронное издание из нужной даты — когда важна скорость или получатель далеко.",
    description:
      "Та же идея машины времени, без печати и доставки. Можно отправить сразу — и позже сделать физическую версию.",
    forWhom: "Когда нужно сегодня, за границу, или как первый шаг к печатному подарку.",
    moments: ["срочный подарок", "получатель в другой стране", "предпросмотр даты"],
    gets: ["файл без ожидания типографии", "удобно отправить", "можно позже заказать печать"],
    price: "17 €",
    image: "/training/newspaper-from-date/cina-latvia.png",
    gallery: [
      "/training/magazine-from-date/za-rulem-1993-03.png",
      "/training/newspaper-from-date/lietuvos-rytas-1990-01-05.png",
      "/training/newspaper-from-date/moscow-news-1986-07-06.png"
    ]
  }
];

export const coreGifts = GIFT_LANDING_ITEMS.filter((item) => item.kind === "core");
export const addonGifts = GIFT_LANDING_ITEMS.filter((item) => item.kind === "addon");
