"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { PartnersLayout } from "@/components/partners/partners-layout";
import { readJsonResponse } from "@/lib/api-response";
import { eur } from "@/lib/format";
import type { PartnerCatalogProduct } from "@/types/partners";

export function PartnersCatalogScreen() {
  const [products, setProducts] = useState<PartnerCatalogProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/partners/catalog");
        const payload = await readJsonResponse<{ products: PartnerCatalogProduct[]; error?: string }>(response);
        if (!response.ok) throw new Error(payload.error ?? "Не удалось загрузить каталог");
        if (!cancelled) setProducts(payload.products);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PartnersLayout title="Каталог продуктов" description="То, что удобно рекомендовать клиентам.">
      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <article key={product.id} className="card flex h-full flex-col overflow-hidden">
            <div className="relative h-40 bg-slate-100">
              <Image src={product.image} alt={product.title} fill className="object-cover" unoptimized />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h2 className="text-xl font-black text-slate-950">{product.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{product.description}</p>
              <dl className="mt-4 space-y-1 text-sm text-slate-700">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Цена от</dt>
                  <dd className="font-bold">
                    {product.priceLabel
                      ? product.priceLabel
                      : product.priceFrom > 0
                        ? Number.isInteger(product.priceFrom)
                          ? eur(product.priceFrom)
                          : eur(product.priceFrom, 1)
                        : "по запросу"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Срок</dt>
                  <dd className="font-semibold text-right">{product.productionDays}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Кому подходит</dt>
                  <dd className="mt-1 font-semibold leading-6">{product.audience}</dd>
                </div>
              </dl>
              <a
                href={product.detailsHref ?? "https://retro-pressa.com"}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Подробнее
              </a>
            </div>
          </article>
        ))}
      </section>
    </PartnersLayout>
  );
}
