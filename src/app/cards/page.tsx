import type { Metadata } from "next";
import { ProductCardsGalleryScreen } from "@/components/product-cards-screen";
import { listProductCards } from "@/lib/product-cards/catalog";

export const metadata: Metadata = {
  title: "Карточки продуктов | Retro Pressa",
  description: "Публичная подборка карточек продуктов Retro Pressa для клиентов"
};

export default function ProductCardsPage() {
  return <ProductCardsGalleryScreen cards={listProductCards()} />;
}
