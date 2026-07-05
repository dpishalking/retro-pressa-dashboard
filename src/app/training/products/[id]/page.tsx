import { ProductDetail } from "@/components/training/product-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TrainingProductPage({ params }: PageProps) {
  const { id } = await params;
  return <ProductDetail productId={id} />;
}
