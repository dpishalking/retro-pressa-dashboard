import { ProductEditor } from "@/components/training/product-editor";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TrainingAdminProductPage({ params }: PageProps) {
  const { id } = await params;
  return <ProductEditor productId={id} />;
}
