import type { Metadata } from "next";
import { ProductViewScreen } from "@/components/product-view-screen";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Выпуск ${slug} — Retro Pressa`,
    description: "Просмотр готового издания Retro Pressa"
  };
}

export default async function ProductViewPage({ params }: PageProps) {
  const { slug } = await params;
  return <ProductViewScreen slug={decodeURIComponent(slug)} />;
}
