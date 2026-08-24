import Image from "next/image";
import {
  addonGifts,
  coreGifts,
  GIFT_LANDING_ITEMS,
  giftsLandingMeta,
  telegramGiftUrl,
  type GiftLandingItem
} from "@/config/gifts-landing";

function YellowMark({ children }: { children: string }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      <span className="relative z-[1]">{children}</span>
      <span
        aria-hidden
        className="absolute bottom-[0.08em] left-0 right-0 h-[0.22em] bg-[var(--gf-yellow)]"
      />
    </span>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="flex items-center gap-2.5 text-[13px] font-light uppercase tracking-[1.9px] text-[var(--gf-ink)]">
      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--gf-yellow)]" />
      {children}
    </p>
  );
}

function YellowButton({
  href,
  children,
  className = ""
}: {
  href: string;
  children: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className={`inline-flex min-h-14 items-center justify-center rounded-2xl bg-[var(--gf-yellow)] px-8 text-base font-semibold text-[var(--gf-ink)] shadow-[0_10px_20px_rgba(251,213,48,0.25)] transition-colors hover:bg-[var(--gf-yellow-hover)] ${className}`}
    >
      {children}
    </a>
  );
}

function GiftPhoto({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-neutral-100 ${className ?? ""}`}>
      <Image src={src} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" unoptimized />
    </div>
  );
}

function GiftBlock({ gift, reverse }: { gift: GiftLandingItem; reverse: boolean }) {
  return (
    <article id={gift.id} className="scroll-mt-28">
      <div
        className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${reverse ? "lg:[&>div:first-child]:order-2" : ""}`}
      >
        <div>
          <GiftPhoto
            src={gift.image}
            alt={gift.title}
            className="aspect-[4/3] rounded-[30px] shadow-[0_7px_19px_rgba(0,11,48,0.11)]"
          />
          {gift.gallery.length > 0 ? (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {gift.gallery.map((src) => (
                <GiftPhoto
                  key={src}
                  src={src}
                  alt=""
                  className="aspect-[4/3] rounded-2xl shadow-[0_4px_12px_rgba(0,11,48,0.08)]"
                />
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-[13px] font-light uppercase tracking-[1.9px] text-[var(--gf-ink)]">
            № {gift.number} · {gift.kicker}
          </p>
          <h2 className="mt-3 text-[36px] font-black leading-[1.05] tracking-[-0.03em] text-[var(--gf-ink)] sm:text-[46px]">
            {gift.title}
          </h2>
          <p className="mt-5 text-xl font-semibold leading-snug text-[var(--gf-ink)]">{gift.lead}</p>
          <p className="mt-4 text-lg leading-relaxed text-[var(--gf-muted)]">{gift.description}</p>
          <p className="mt-5 text-base leading-relaxed text-[var(--gf-muted)]">
            <span className="font-semibold text-[var(--gf-ink)]">Для кого. </span>
            {gift.forWhom}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {gift.moments.map((moment) => (
              <span
                key={moment}
                className="rounded-full border border-[var(--gf-line)] px-3 py-1.5 text-sm text-[var(--gf-muted)]"
              >
                {moment}
              </span>
            ))}
          </div>
          <ul className="mt-6 space-y-2 text-base text-[var(--gf-ink)]">
            {gift.gets.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--gf-yellow)]" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <YellowButton href={telegramGiftUrl(gift.title)}>Хочу такой подарок</YellowButton>
            <p className="text-lg font-semibold text-[var(--gf-ink)]">{gift.price}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function GiftsLanding() {
  const { brand, telegramUrl, phoneDisplay, phoneHref } = giftsLandingMeta;

  return (
    <div className="gifts-landing min-h-screen bg-white text-[var(--gf-ink)]">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5 text-[var(--gf-ink)]">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--gf-yellow)]" />
            <span className="text-sm font-semibold tracking-tight sm:text-base">{brand}</span>
          </a>
          <div className="flex items-center gap-3">
            <a href={phoneHref} className="hidden text-sm font-medium text-[var(--gf-muted)] sm:inline">
              {phoneDisplay}
            </a>
            <YellowButton href={telegramUrl} className="min-h-11 px-4 text-sm sm:min-h-14 sm:px-8 sm:text-base">
              Написать в Telegram
            </YellowButton>
          </div>
        </div>
      </header>

      <main>
        <section id="top" className="mx-auto w-full max-w-[1200px] px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-16">
          <Eyebrow>Каталог подарков</Eyebrow>
          <h1 className="mt-6 max-w-5xl text-[42px] font-black leading-[0.92] tracking-[-0.04em] text-[var(--gf-ink)] sm:text-[64px] lg:text-[80px]">
            Все подарки Retro Pressa — <YellowMark>в одном месте</YellowMark>
          </h1>
          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-[var(--gf-muted)] sm:text-[22px]">
            Газеты из даты рождения, персональные журналы, книга жизни и тёплые дополнения. Двенадцать форматов из
            паспортов продуктов — с настоящими фотографиями готовых подарков.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <YellowButton href="#catalog">Смотреть все подарки</YellowButton>
            <a
              href={telegramUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-[var(--gf-line)] px-8 text-base font-semibold text-[var(--gf-ink)]"
            >
              Помочь с выбором
            </a>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-5 pb-8 sm:px-8">
          <div className="flex flex-wrap gap-2">
            {GIFT_LANDING_ITEMS.map((gift) => (
              <a
                key={gift.id}
                href={`#${gift.id}`}
                className="rounded-full border border-[var(--gf-line)] px-4 py-2 text-sm text-[var(--gf-ink)] transition-colors hover:border-[var(--gf-yellow)] hover:bg-[var(--gf-yellow)]"
              >
                {gift.title}
              </a>
            ))}
          </div>
        </section>

        <section id="catalog" className="mx-auto w-full max-w-[1200px] scroll-mt-28 space-y-24 px-5 py-12 sm:px-8 sm:py-20">
          {coreGifts.map((gift, index) => (
            <GiftBlock key={gift.id} gift={gift} reverse={index % 2 === 1} />
          ))}
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 sm:py-12">
          <Eyebrow>Дополнения к подарку</Eyebrow>
          <h2 className="mt-4 max-w-3xl text-[36px] font-black leading-[1.05] tracking-[-0.03em] sm:text-[48px]">
            Ещё четыре формата, которые усиливают вручение
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {addonGifts.map((gift) => (
              <article
                key={gift.id}
                id={gift.id}
                className="scroll-mt-28 overflow-hidden rounded-[24px] border border-[var(--gf-line)] shadow-[0_9px_10px_rgba(0,11,48,0.11)]"
              >
                <GiftPhoto src={gift.image} alt={gift.title} className="aspect-[16/10]" />
                <div className="p-6 sm:p-8">
                  <p className="text-[13px] font-light uppercase tracking-[1.9px]">
                    № {gift.number} · {gift.kicker}
                  </p>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-[32px]">{gift.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-[var(--gf-muted)]">{gift.lead}</p>
                  <p className="mt-3 text-base leading-relaxed text-[var(--gf-muted)]">{gift.description}</p>
                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <YellowButton href={telegramGiftUrl(gift.title)}>Хочу такой</YellowButton>
                    <span className="font-semibold">{gift.price}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-5 py-16 sm:px-8 sm:py-24">
          <div className="flex flex-col items-start justify-between gap-8 rounded-[24px] border border-[var(--gf-line)] px-6 py-8 shadow-[0_9px_10px_rgba(0,11,48,0.11)] sm:flex-row sm:items-center sm:px-12 sm:py-12">
            <div className="max-w-xl">
              <Eyebrow>Быстрая связь</Eyebrow>
              <p className="mt-4 text-[28px] font-semibold leading-snug sm:text-[32px]">
                Если дело не терпит — напишите нам прямо сейчас. Подскажем формат под человека и дату.
              </p>
            </div>
            <YellowButton href={telegramUrl}>Написать в Telegram</YellowButton>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--gf-line)] px-5 py-10 text-center text-sm text-[var(--gf-muted)] sm:px-8">
        <p>
          © {new Date().getFullYear()} {brand}. Подарки с историей.{" "}
          <a href={phoneHref} className="text-[var(--gf-ink)]">
            {phoneDisplay}
          </a>
        </p>
      </footer>
    </div>
  );
}
