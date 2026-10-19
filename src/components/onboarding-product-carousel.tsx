"use client";

import { useEffect, useState } from "react";
import styles from "./onboarding-product-carousel.module.css";

const PRODUCTS = [
  {
    title: "Персональный журнал",
    subtitle:
      "Журнал с фотографиями, историями, достижениями, воспоминаниями семьи и тематическими страницами об увлечениях.",
    image: "/training/gift-edition/glamour-tatyana.png"
  },
  {
    title: "Книга жизни",
    subtitle:
      "Подарочная книга, где годы жизни раскрываются через атмосферу времени, заголовки эпохи и личную историю человека.",
    image: "/onboarding/products/life-book.jpg"
  },
  {
    title: "Семейное издание",
    subtitle:
      "Журнал обо всей семье: личные развороты близких, общие истории, фотографии и слова, которые редко произносят вслух.",
    image: "/training/family-edition/vestnik-lyubvi-cover.png"
  },
  {
    title: "Семейная колода карт",
    subtitle: "54 карты с вашими героями: фотографии, любимые фразы, внутренние шутки и роли каждого члена семьи.",
    image: "/onboarding/products/family-card-deck.jpg"
  },
  {
    title: "Поздравительная газета",
    subtitle: "Газета с главным героем на первой полосе, поздравлениями близких и событиями из его жизни.",
    image: "/training/personal-newspaper/muzhskaya-pravda-cover-2026.png"
  },
  {
    title: "Оригинальная газета",
    subtitle:
      "Настоящая газета, выпущенная в день рождения или другую важную дату — фрагмент прошлого в руках.",
    image: "/training/newspaper-from-date/lietuvos-rytas-1990-01-05.png"
  },
  {
    title: "Оригинальный журнал",
    subtitle: "Настоящий журнал из архива, вышедший в нужный месяц и год.",
    image: "/training/magazine-from-date/rabotnitsa-1993-03.png"
  },
  {
    title: "Персональная песня",
    subtitle: "Песня, созданная на основе истории человека и поздравлений семьи.",
    image: "/onboarding/products/personal-song.jpg"
  }
] as const;

const INTERVAL_MS = 4200;

function signedOffset(index: number, active: number, total: number) {
  let delta = index - active;
  if (delta > total / 2) delta -= total;
  if (delta < -total / 2) delta += total;
  return delta;
}

export function OnboardingProductCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const total = PRODUCTS.length;
  const current = PRODUCTS[index]!;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setTimeout(() => {
      setIndex((value) => (value + 1) % total);
    }, INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, reducedMotion, total]);

  const go = (next: number) => {
    setIndex((next + total) % total);
  };

  return (
    <div
      className={styles.root}
      role="region"
      aria-roledescription="карусель"
      aria-label="Продукты Retro Pressa"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className={styles.stage}>
        {PRODUCTS.map((product, productIndex) => {
          const offset = signedOffset(productIndex, index, total);
          const visible = Math.abs(offset) <= 2;
          return (
            <button
              key={product.title}
              type="button"
              className={styles.card}
              style={{
                transform: `translateX(${offset * 58}%) rotateY(${offset * -26}deg) scale(${offset === 0 ? 1 : 0.84})`,
                zIndex: 10 - Math.abs(offset),
                opacity: visible ? (offset === 0 ? 1 : 0.78) : 0,
                pointerEvents: visible ? "auto" : "none"
              }}
              onClick={() => go(productIndex)}
              aria-label={product.title}
              aria-current={offset === 0 ? "true" : undefined}
              tabIndex={offset === 0 ? 0 : -1}
            >
              <img src={product.image} alt="" draggable={false} />
            </button>
          );
        })}
      </div>

      <div className={styles.nav}>
        <button type="button" className={styles.arrow} onClick={() => go(index - 1)} aria-label="Предыдущий продукт">
          ‹
        </button>
        <p className={styles.count} aria-hidden="true">
          {index + 1} / {total}
        </p>
        <button type="button" className={styles.arrow} onClick={() => go(index + 1)} aria-label="Следующий продукт">
          ›
        </button>
      </div>

      <div className={styles.caption} aria-live="polite">
        <p className={styles.title}>{current.title}</p>
        <p className={styles.subtitle}>{current.subtitle}</p>
      </div>
    </div>
  );
}
