import Image from "next/image";
import Link from "next/link";
import type { ProductCard } from "@/lib/product-cards/catalog";
import { PRODUCT_CARDS_PUBLIC_PREFIX, productCardHref } from "@/lib/product-cards/catalog";

export function ProductCardsGalleryScreen({ cards }: { cards: ProductCard[] }) {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-800/80">Retro Pressa</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Карточки продуктов</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Откройте карточку целиком или отправьте клиенту ссылку на всю подборку.
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.slug}
              href={productCardHref(card.slug)}
              className="group overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[819/1024] bg-slate-100">
                <Image
                  src={card.image}
                  alt={card.title}
                  fill
                  className="object-cover transition duration-300 group-hover:scale-[1.02]"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  unoptimized
                />
              </div>
              <div className="border-t border-black/5 px-4 py-3">
                <h2 className="text-base font-semibold text-slate-900">{card.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{card.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

export function ProductCardScreen({
  card,
  cards
}: {
  card: ProductCard;
  cards: ProductCard[];
}) {
  const index = cards.findIndex((item) => item.slug === card.slug);
  const prev = index > 0 ? cards[index - 1] : null;
  const next = index >= 0 && index < cards.length - 1 ? cards[index + 1] : null;

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={PRODUCT_CARDS_PUBLIC_PREFIX}
            className="text-sm font-medium text-amber-900/80 underline-offset-4 hover:underline"
          >
            ← Все карточки
          </Link>
          <div className="flex gap-3 text-sm">
            {prev ? (
              <Link href={productCardHref(prev.slug)} className="text-slate-600 hover:text-slate-900">
                ← {prev.title}
              </Link>
            ) : null}
            {next ? (
              <Link href={productCardHref(next.slug)} className="text-slate-600 hover:text-slate-900">
                {next.title} →
              </Link>
            ) : null}
          </div>
        </div>

        <header className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-800/80">Retro Pressa</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{card.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{card.subtitle}</p>
        </header>

        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <Image
            src={card.image}
            alt={card.title}
            width={819}
            height={1024}
            className="h-auto w-full"
            priority
            unoptimized
          />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Ссылка на эту карточку: <span className="font-mono text-slate-700">/cards/{card.slug}</span>
        </p>
      </div>
    </main>
  );
}
