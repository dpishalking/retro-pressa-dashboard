"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Link2, PlayCircle } from "lucide-react";
import { createTrainingCatalogSeed } from "@/data/training-seed";
import { TrainingLayout } from "@/components/training/training-layout";
import { useTrainingUser } from "@/components/training/training-context";
import type { ProductTrainingModule } from "@/types/training";

function ContentBlock({ title, content }: { title: string; content: string }) {
  return (
    <section className="card p-6">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{content}</div>
    </section>
  );
}

function MaterialsSection({ product }: { product: ProductTrainingModule }) {
  if (!product.materials.length) return null;

  return (
    <section className="card p-6">
      <h2 className="text-lg font-black text-slate-950">Материалы</h2>
      <div className="mt-4 space-y-4">
        {product.materials
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((material) => {
            if (material.type === "video" && material.embedUrl) {
              return (
                <div key={material.id} className="overflow-hidden rounded-xl border border-[var(--line)]">
                  <div className="border-b border-[var(--line)] bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
                    {material.title}
                  </div>
                  <div className="aspect-video bg-black">
                    <iframe
                      src={material.embedUrl}
                      title={material.title}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              );
            }

            if (material.type === "image" && material.url) {
              return (
                <figure key={material.id} className="overflow-hidden rounded-xl border border-[var(--line)]">
                  <div className="relative h-64 w-full bg-slate-100">
                    <Image src={material.url} alt={material.title} fill className="object-cover" unoptimized />
                  </div>
                  <figcaption className="px-4 py-3 text-sm font-semibold text-slate-700">{material.title}</figcaption>
                </figure>
              );
            }

            if (material.type === "document" && material.url) {
              return (
                <a
                  key={material.id}
                  href={material.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-[var(--line)] px-4 py-3 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                    <FileText size={18} className="text-blue-600" />
                    {material.title}
                  </span>
                  <ExternalLink size={16} className="text-slate-400" />
                </a>
              );
            }

            if (material.type === "link" && material.url) {
              return (
                <a
                  key={material.id}
                  href={material.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-[var(--line)] px-4 py-3 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                    <Link2 size={18} className="text-violet-600" />
                    {material.title}
                  </span>
                  <ExternalLink size={16} className="text-slate-400" />
                </a>
              );
            }

            if (material.type === "text" && material.content) {
              return (
                <div key={material.id} className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-900">{material.title}</p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">{material.content}</pre>
                </div>
              );
            }

            return null;
          })}
      </div>
    </section>
  );
}

function ProductDetailContent({ productId }: { productId: string }) {
  const { user } = useTrainingUser();
  const fallbackProduct = useMemo(
    () => createTrainingCatalogSeed().products.find((item) => item.id === productId) ?? null,
    [productId]
  );
  const [product, setProduct] = useState<ProductTrainingModule | null>(fallbackProduct);

  useEffect(() => {
    fetch(`/api/training/products/${productId}`)
      .then((response) => response.json())
      .then((data: { product: ProductTrainingModule }) => {
        if (data?.product) {
          setProduct(data.product);
        }
      })
      .catch(() => {
        if (fallbackProduct) {
          setProduct(fallbackProduct);
        }
      });
  }, [fallbackProduct, productId]);

  useEffect(() => {
    if (!user) return;
    void fetch("/api/training/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, productId, action: "start" })
    });
  }, [productId, user]);

  if (!product) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка материала...</div>;
  }

  const hasQuiz = product.questions.length > 0;

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className="relative h-56 w-full bg-slate-100 md:h-72">
          <Image src={product.coverImage} alt={product.title} fill className="object-cover" unoptimized />
        </div>
        <div className="p-6">
          <h1 className="text-3xl font-black text-slate-950">{product.title}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">{product.shortDescription}</p>
        </div>
      </section>

      <ContentBlock title="Что это за продукт" content={product.description} />
      <ContentBlock title="Для кого подходит" content={product.targetAudience} />
      <ContentBlock title="Какие задачи клиента закрывает" content={product.clientProblems} />
      <ContentBlock title="Какие эмоции вызывает" content={product.emotions} />
      <ContentBlock title="Основные поводы для покупки" content={product.purchaseReasons} />
      <ContentBlock title="Частые возражения клиентов" content={product.objections} />
      <ContentBlock title="Как правильно презентовать продукт" content={product.presentationGuide} />

      <MaterialsSection product={product} />

      <section className="card p-6">
        {hasQuiz ? (
          <Link
            href={`/training/products/${product.id}/quiz`}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white hover:bg-rose-700"
          >
            <PlayCircle size={18} />
            Перейти к тесту
          </Link>
        ) : (
          <p className="text-sm text-slate-600">Тест для этого продукта ещё не добавлен администратором.</p>
        )}
        <p className="mt-3 text-xs text-slate-500">Проходной балл: {product.passingScore}%</p>
      </section>
    </div>
  );
}

export function ProductDetail({ productId }: { productId: string }) {
  return (
    <TrainingLayout backHref="/training" backLabel="К списку продуктов">
      <ProductDetailContent productId={productId} />
    </TrainingLayout>
  );
}
