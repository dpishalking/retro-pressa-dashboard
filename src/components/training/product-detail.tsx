"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Link2, PlayCircle } from "lucide-react";
import { createTrainingCatalogSeed } from "@/data/training-seed";
import { TrainingLayout } from "@/components/training/training-layout";
import { useTrainingUser } from "@/components/training/training-context";
import {
  buildProductSections,
  presentationEmbedUrl,
  splitProductMaterials,
  type ProductContentSection
} from "@/lib/training/product-sections";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";
import type { ProductMaterial, ProductTrainingModule } from "@/types/training";

function RichText({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index} className="font-bold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        )
      )}
    </>
  );
}

function ContentSection({ title, content, emoji }: ProductContentSection) {
  return (
    <section className="card overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex items-center justify-center border-b border-[var(--line)] bg-slate-50 px-6 py-6 md:border-b-0 md:border-r md:px-8 md:py-8">
          <span className="text-5xl leading-none" aria-hidden="true">{emoji}</span>
        </div>
        <div className="p-6">
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          <div className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
            <RichText content={content} />
          </div>
        </div>
      </div>
    </section>
  );
}

function GiftGallerySection({ materials }: { materials: ProductMaterial[] }) {
  const photos = materials.filter((material) => material.url);
  if (!photos.length) return null;

  return (
    <section className="card p-6">
      <h2 className="text-lg font-black text-slate-950">Как выглядит подарок</h2>
      <p className="mt-1 text-sm text-slate-600">Примеры готовых изданий — чтобы менеджер видел, что получает клиент.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {photos.map((material) => {
          const isWide = material.content === "wide";
          const isLandscape = material.content === "landscape";
          return (
          <figure
            key={material.id}
            className={`overflow-hidden rounded-xl border border-[var(--line)] bg-white ${isWide ? "sm:col-span-2 lg:col-span-3 xl:col-span-4" : ""}`}
          >
            <div className={`relative w-full bg-white ${isWide ? "aspect-[3/2]" : isLandscape ? "aspect-[4/3]" : "aspect-[3/4]"}`}>
              <Image src={material.url!} alt={material.title} fill className="object-contain p-2" unoptimized />
            </div>
            <figcaption className="border-t border-[var(--line)] px-4 py-3 text-sm font-semibold text-slate-700">
              {material.title}
            </figcaption>
          </figure>
          );
        })}
      </div>
    </section>
  );
}

function VideoBlock({ material }: { material: ProductMaterial }) {
  const embedUrl = normalizeVideoEmbedUrl(material.embedUrl ?? material.url);
  const isShorts =
    (material.url ?? material.embedUrl ?? "").includes("/shorts/") || material.content === "shorts";

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)]">
      <div className="border-b border-[var(--line)] bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
        {material.title}
      </div>
      {embedUrl ? (
        <div className={`bg-black ${isShorts ? "mx-auto aspect-[9/16] max-w-sm" : "aspect-video"}`}>
          <iframe
            src={embedUrl}
            title={material.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center bg-slate-50 px-6 text-center">
          <PlayCircle size={34} className="text-rose-500" />
          <p className="mt-3 text-base font-black text-slate-900">{material.title}</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            {material.content ?? "Сюда добавим видеоразбор для учеников и менеджеров."}
          </p>
          <p className="mt-4 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Видео скоро появится
          </p>
        </div>
      )}
    </div>
  );
}

function VideoSection({ materials }: { materials: ProductMaterial[] }) {
  if (!materials.length) return null;

  return (
    <section className="card p-6">
      <h2 className="text-lg font-black text-slate-950">Видеообучение</h2>
      <div className="mt-4 space-y-4">
        {materials.map((material) => (
          <VideoBlock key={material.id} material={material} />
        ))}
      </div>
    </section>
  );
}

function ReviewsSection({ materials }: { materials: ProductMaterial[] }) {
  if (!materials.length) return null;

  return (
    <section className="card p-6">
      <h2 className="text-lg font-black text-slate-950">Отзывы</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {materials.map((material) => (
          <VideoBlock key={material.id} material={material} />
        ))}
      </div>
    </section>
  );
}

function PresentationSection({ product }: { product: ProductTrainingModule }) {
  const embedUrl = presentationEmbedUrl(product.presentationUrl);
  if (!embedUrl) return null;

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--line)] px-6 py-4">
        <h2 className="text-lg font-black text-slate-950">Презентация продукта</h2>
        <p className="mt-1 text-sm text-slate-600">Слайды из Google Presentations для этого продукта.</p>
      </div>
      <div className="aspect-[16/10] bg-slate-100">
        <iframe
          src={embedUrl}
          title={`Презентация: ${product.title}`}
          className="h-full w-full"
          allowFullScreen
        />
      </div>
      {product.presentationUrl ? (
        <div className="border-t border-[var(--line)] px-6 py-3">
          <a
            href={product.presentationUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            Открыть презентацию в Google Slides
            <ExternalLink size={14} />
          </a>
        </div>
      ) : null}
    </section>
  );
}

function ExtraMaterialItem({ material }: { material: ProductMaterial }) {
  if (material.type === "image" && material.url) {
    return (
      <figure className="overflow-hidden rounded-xl border border-[var(--line)]">
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
      <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
        <p className="text-sm font-bold text-slate-900">{material.title}</p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">{material.content}</pre>
      </div>
    );
  }

  return null;
}

function ExtraMaterialsSection({ materials }: { materials: ProductMaterial[] }) {
  if (!materials.length) return null;

  const images = materials.filter((material) => material.type === "image");
  const others = materials.filter((material) => material.type !== "image");

  return (
    <section className="card p-6">
      <h2 className="text-lg font-black text-slate-950">Дополнительные материалы</h2>
      {images.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {images.map((material) => (
            <ExtraMaterialItem key={material.id} material={material} />
          ))}
        </div>
      ) : null}
      {others.length ? (
        <div className={`space-y-4 ${images.length ? "mt-4" : "mt-4"}`}>
          {others.map((material) => (
            <ExtraMaterialItem key={material.id} material={material} />
          ))}
        </div>
      ) : null}
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
    fetch(`/api/training/products/${productId}`, { cache: "no-store" })
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

  const sections = buildProductSections(product);
  const { videos, reviews, gallery, extras } = splitProductMaterials(product.materials);
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

      <VideoSection materials={videos} />

      <GiftGallerySection materials={gallery} />

      <ReviewsSection materials={reviews} />

      {sections.map((section) => (
        <ContentSection key={section.sectionKey} {...section} />
      ))}

      <PresentationSection product={product} />
      <ExtraMaterialsSection materials={extras} />

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
    <TrainingLayout backHref="/training/products" backLabel="К списку продуктов">
      <ProductDetailContent productId={productId} />
    </TrainingLayout>
  );
}
