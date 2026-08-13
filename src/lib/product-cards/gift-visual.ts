import { PRODUCT_CARDS, findProductCard, productCardHref, type ProductCard } from "@/lib/product-cards/catalog";

export type GiftVisual = {
  image: string;
  href: string | null;
  subtitle: string;
};

function norm(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function visualFromCard(card: ProductCard, href: string | null = productCardHref(card.slug)): GiftVisual {
  return { image: card.image, href, subtitle: card.subtitle };
}

/** Map a Bitrix gift/product name to the client visual card. */
export function matchGiftVisual(productName: string): GiftVisual | null {
  const n = norm(productName);
  if (!n) return null;

  const exact = PRODUCT_CARDS.find((card) => norm(card.title) === n);
  if (exact) return visualFromCard(exact);

  if (/поздрав/.test(n) && /журнал/.test(n)) {
    const card = findProductCard("congratulatory-magazine");
    return card ? visualFromCard(card) : null;
  }
  if (/поздрав|congrat/.test(n)) {
    const card = findProductCard("congratulatory-newspaper");
    return card ? visualFromCard(card) : null;
  }
  if (/книг/.test(n) && /жизн/.test(n)) {
    const card = findProductCard("life-book");
    return card ? visualFromCard(card) : null;
  }
  if (/семейн/.test(n)) {
    const card = findProductCard("family-edition");
    return card ? visualFromCard(card) : null;
  }
  if ((/персонал/.test(n) && /журнал/.test(n)) || /журнал о человеке/.test(n)) {
    const card = findProductCard("personal-magazine");
    return card ? visualFromCard(card) : null;
  }
  if (/песн|song/.test(n)) {
    const card = findProductCard("congratulatory-song");
    return card ? visualFromCard(card) : null;
  }
  if (/оригинальн/.test(n) && /журнал/.test(n)) {
    const card = findProductCard("original-magazines");
    return card ? visualFromCard(card) : null;
  }
  if (/репродук/.test(n)) {
    const card = findProductCard("original");
    return card
      ? { image: card.image, href: null, subtitle: "Печатная копия архивной газеты" }
      : null;
  }
  if (/оригинал|original/.test(n)) {
    const card = findProductCard("original");
    return card ? visualFromCard(card) : null;
  }
  if (/доставк/.test(n)) {
    const card = findProductCard("delivery");
    return card ? visualFromCard(card) : null;
  }
  return null;
}
