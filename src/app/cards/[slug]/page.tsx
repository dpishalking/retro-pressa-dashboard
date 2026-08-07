import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCardScreen } from "@/components/product-cards-screen";
import { findProductCard, listProductCards } from "@/lib/product-cards/catalog";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return listProductCards().map((card) => ({ slug: card.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const card = findProductCard(slug);
  if (!card) return { title: "Карточка продукта | Retro Pressa" };
  return {
    title: `${card.title} | Retro Pressa`,
    description: card.subtitle
  };
}

export default async function ProductCardPage({ params }: Props) {
  const { slug } = await params;
  const card = findProductCard(slug);
  if (!card) notFound();

  return <ProductCardScreen card={card} cards={listProductCards()} />;
}
