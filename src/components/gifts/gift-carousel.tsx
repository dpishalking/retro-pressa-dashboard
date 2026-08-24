"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState, type PointerEvent } from "react";

type GiftCarouselProps = {
  images: string[];
  alt: string;
};

export function GiftCarousel({ images, alt }: GiftCarouselProps) {
  const slides = useMemo(
    () => [...new Set(images.filter(Boolean))],
    [images]
  );
  const [index, setIndex] = useState(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const total = slides.length;
  const current = slides[Math.min(index, Math.max(total - 1, 0))] ?? slides[0];
  const hasMany = total > 1;

  const goTo = useCallback(
    (next: number) => {
      if (total < 2) return;
      setIndex((next + total) % total);
    },
    [total]
  );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!hasMany) return;
    setDragStart(event.clientX);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart == null) return;
    const delta = event.clientX - dragStart;
    setDragStart(null);
    if (Math.abs(delta) < 40) return;
    goTo(index + (delta < 0 ? 1 : -1));
  };

  if (!current) return null;

  return (
    <div className="gift-carousel w-full min-w-0">
      <div
        className="relative aspect-[3/4] touch-pan-y select-none overflow-hidden rounded-[30px] bg-[#f3efe6] shadow-[0_7px_19px_rgba(0,11,48,0.11)]"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDragStart(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") goTo(index - 1);
          if (event.key === "ArrowRight") goTo(index + 1);
        }}
        role="region"
        aria-roledescription="Карусель"
        aria-label={`Фото: ${alt}`}
        tabIndex={hasMany ? 0 : undefined}
      >
        <div className="absolute inset-0 p-4 sm:p-6">
          <div className="relative h-full w-full">
            <Image
              src={current}
              alt={alt}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 50vw"
              unoptimized
              draggable={false}
            />
          </div>
        </div>

        {hasMany ? (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--gf-ink)] shadow-[0_4px_12px_rgba(0,11,48,0.12)]"
              onClick={() => goTo(index - 1)}
              aria-label="Предыдущее фото"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--gf-ink)] shadow-[0_4px_12px_rgba(0,11,48,0.12)]"
              onClick={() => goTo(index + 1)}
              aria-label="Следующее фото"
            >
              <ChevronRight size={20} />
            </button>
            <p className="absolute bottom-3 right-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[var(--gf-ink)]">
              {index + 1} / {total}
            </p>
          </>
        ) : null}
      </div>

      {hasMany ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          {slides.map((src, slideIndex) => (
            <button
              key={src}
              type="button"
              className={`h-2 rounded-full transition-all ${
                slideIndex === index
                  ? "w-6 bg-[var(--gf-yellow)]"
                  : "w-2 bg-[var(--gf-line)]"
              }`}
              onClick={() => setIndex(slideIndex)}
              aria-label={`Фото ${slideIndex + 1}`}
              aria-current={slideIndex === index ? "true" : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
