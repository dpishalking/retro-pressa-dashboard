import { PRODUCT_CARDS_PUBLIC_PREFIX } from "@/lib/auth/routes";

export type ProductCard = {
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  sortOrder: number;
};

export { PRODUCT_CARDS_PUBLIC_PREFIX };

export const PRODUCT_CARDS: ProductCard[] = [
  {
    slug: "original",
    title: "Оригинал",
    subtitle: "Издание из даты — настоящая газета или журнал из архива",
    image: "/product-cards/original.jpg",
    sortOrder: 1
  },
  {
    slug: "original-magazines",
    title: "Оригинальные журналы",
    subtitle: "Издание из даты — настоящие журналы со склада",
    image: "/product-cards/original-magazines.jpg",
    sortOrder: 2
  },
  {
    slug: "original-magazine-page-posters",
    title: "Постер из оригинальной журнальной страницы",
    subtitle: "Подлинный журнальный лист в паспарту и рамке",
    image: "/product-cards/original-magazine-page-posters.jpg",
    sortOrder: 2.5
  },
  {
    slug: "congratulatory-newspaper",
    title: "Поздравительная газета",
    subtitle: "Ретро + личное — архив с фото и текстом",
    image: "/product-cards/congratulatory-newspaper.jpg",
    sortOrder: 3
  },
  {
    slug: "congratulatory-magazine",
    title: "Поздравительный журнал",
    subtitle: "Ретро + личное — обложка и 2 разворота",
    image: "/product-cards/congratulatory-magazine.jpg",
    sortOrder: 4
  },
  {
    slug: "family-edition",
    title: "Семейное издание",
    subtitle: "Семейный журнал воспоминаний",
    image: "/product-cards/family-edition.jpg",
    sortOrder: 5
  },
  {
    slug: "family-card-deck",
    title: "Семейная колода карт",
    subtitle: "54 карты семейной истории — интервью, сюжеты, печать",
    image: "/product-cards/family-card-deck.png",
    sortOrder: 5.5
  },
  {
    slug: "life-book",
    title: "Книга жизни в заголовках газет",
    subtitle: "Архив истории — газета за каждый год жизни",
    image: "/product-cards/life-book.jpg",
    sortOrder: 6
  },
  {
    slug: "life-story",
    title: "Книга жизни",
    subtitle: "Записанная жизнь одного человека — интервью, материалы, книга",
    image: "/product-cards/life-story.jpg",
    sortOrder: 6.5
  },
  {
    slug: "personal-magazine",
    title: "Журнал о человеке",
    subtitle: "Персональный глянцевый подарок",
    image: "/product-cards/personal-magazine.jpg",
    sortOrder: 7
  },
  {
    slug: "congratulatory-song",
    title: "Поздравительная песня",
    subtitle: "Музыкальное поздравление",
    image: "/product-cards/congratulatory-song.jpg",
    sortOrder: 8
  },
  {
    slug: "delivery",
    title: "Доставка",
    subtitle: "Информация по отправке заказов",
    image: "/product-cards/delivery.jpg",
    sortOrder: 9
  }
];

export function listProductCards(): ProductCard[] {
  return [...PRODUCT_CARDS].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function findProductCard(slug: string): ProductCard | undefined {
  return PRODUCT_CARDS.find((card) => card.slug === slug);
}

export function productCardHref(slug: string): string {
  return `${PRODUCT_CARDS_PUBLIC_PREFIX}/${encodeURIComponent(slug)}`;
}
