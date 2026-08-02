"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  ExternalLink,
  Filter,
  Gift,
  Layers3,
  MessageSquareHeart,
  Music2,
  Sparkles,
  Sticker,
  Trophy,
  type LucideIcon
} from "lucide-react";
import { OfficeHubBackLink } from "@/components/office-hub";
import { readJsonResponse } from "@/lib/api-response";
import { eur } from "@/lib/format";
import { periodStatusLabel } from "@/lib/motivation/labels";
import type { MotivationBoardPayload } from "@/types/motivation";

type LoadStatus = { state: "idle" | "loading" | "ok" | "error"; message: string };

type BonusVisual = {
  icon: LucideIcon;
  accent: string;
  panel: string;
  glow: string;
  label: string;
};

function bonusVisual(metricKey: string | null | undefined, title: string): BonusVisual {
  switch (metricKey) {
    case "average_items_per_order":
      return {
        icon: Layers3,
        accent: "text-violet-700",
        panel: "from-violet-100 via-violet-50 to-white",
        glow: "group-hover:shadow-violet-200/80",
        label: "Наименования"
      };
    case "review_lead_ratio":
      return {
        icon: MessageSquareHeart,
        accent: "text-rose-700",
        panel: "from-rose-100 via-rose-50 to-white",
        glow: "group-hover:shadow-rose-200/80",
        label: "Отзывы"
      };
    case "average_check":
      return {
        icon: Banknote,
        accent: "text-emerald-700",
        panel: "from-emerald-100 via-emerald-50 to-white",
        glow: "group-hover:shadow-emerald-200/80",
        label: "Средний чек"
      };
    case "lead_to_paid_conversion":
      return {
        icon: Filter,
        accent: "text-sky-700",
        panel: "from-sky-100 via-sky-50 to-white",
        glow: "group-hover:shadow-sky-200/80",
        label: "Конверсия"
      };
    default:
      if (/чек/i.test(title)) {
        return bonusVisual("average_check", title);
      }
      if (/отзыв/i.test(title)) {
        return bonusVisual("review_lead_ratio", title);
      }
      if (/конверс/i.test(title)) {
        return bonusVisual("lead_to_paid_conversion", title);
      }
      return {
        icon: Trophy,
        accent: "text-orange-700",
        panel: "from-orange-100 via-orange-50 to-white",
        glow: "group-hover:shadow-orange-200/80",
        label: "Бонус"
      };
  }
}

function focusVisual(productId: string, title: string): BonusVisual {
  if (productId.includes("ozivi") || /оживи/i.test(title)) {
    return {
      icon: Sparkles,
      accent: "text-fuchsia-700",
      panel: "from-fuchsia-100 via-fuchsia-50 to-white",
      glow: "group-hover:shadow-fuchsia-200/80",
      label: "Оживи"
    };
  }
  if (productId.includes("song") || /песн/i.test(title)) {
    return {
      icon: Music2,
      accent: "text-indigo-700",
      panel: "from-indigo-100 via-indigo-50 to-white",
      glow: "group-hover:shadow-indigo-200/80",
      label: "Песня"
    };
  }
  if (productId.includes("sticker") || /наклей/i.test(title)) {
    return {
      icon: Sticker,
      accent: "text-amber-700",
      panel: "from-amber-100 via-amber-50 to-white",
      glow: "group-hover:shadow-amber-200/80",
      label: "Наклейки"
    };
  }
  if (productId.includes("greeting") || /сценари/i.test(title)) {
    return {
      icon: Gift,
      accent: "text-teal-700",
      panel: "from-teal-100 via-teal-50 to-white",
      glow: "group-hover:shadow-teal-200/80",
      label: "Сценарий"
    };
  }
  return {
    icon: Gift,
    accent: "text-sky-700",
    panel: "from-sky-100 via-sky-50 to-white",
    glow: "group-hover:shadow-sky-200/80",
    label: "Фокус"
  };
}

export function MotivationScreen() {
  const [payload, setPayload] = useState<MotivationBoardPayload | null>(null);
  const [status, setStatus] = useState<LoadStatus>({ state: "loading", message: "Загружаю..." });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus({ state: "loading", message: "Загружаю..." });
      try {
        const response = await fetch("/api/motivation", { cache: "no-store" });
        const data = await readJsonResponse<MotivationBoardPayload & { error?: string }>(response);
        if (!response.ok) throw new Error(data.error || "Ошибка загрузки");
        if (!cancelled) {
          setPayload(data);
          setStatus({ state: "ok", message: "" });
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({
            state: "error",
            message: error instanceof Error ? error.message : "Ошибка загрузки"
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status.state === "loading" && !payload) {
    return (
      <main className="mx-auto w-[min(960px,calc(100%-32px))] py-8">
        <OfficeHubBackLink />
        <p className="mt-6 text-sm text-slate-600">Загружаю мотивацию...</p>
      </main>
    );
  }

  if (status.state === "error" && !payload) {
    return (
      <main className="mx-auto w-[min(960px,calc(100%-32px))] py-8">
        <OfficeHubBackLink />
        <section className="card mt-6 p-6">
          <h1 className="text-2xl font-black">Не удалось загрузить раздел</h1>
          <p className="mt-2 text-sm text-rose-700">{status.message}</p>
        </section>
      </main>
    );
  }

  if (!payload) return null;

  return (
    <main className="mx-auto w-[min(960px,calc(100%-32px))] py-8">
      <div className="mb-6">
        <OfficeHubBackLink />
      </div>

      <header className="mb-8">
        <p className="mb-2 text-sm font-extrabold uppercase tracking-normal text-orange-600">Мотивация</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-4xl font-black tracking-normal text-slate-950 lg:text-5xl">{payload.periodTitle}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{payload.intro}</p>
          </div>
          <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold uppercase text-orange-800">
            {periodStatusLabel(payload.periodStatus)}
          </span>
        </div>
      </header>

      <section className="card mb-5 p-5 sm:p-7">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="rounded-2xl bg-orange-50 p-3.5 text-orange-600">
            <Trophy size={28} />
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Мотивация месяца</h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Условия бонусов на текущий месяц. Личный прогресс и рейтинг подключим позже — сейчас важно просто знать правила.
          </p>
        </div>

        {payload.bonuses.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Условия мотивации на этот месяц пока не опубликованы.
          </p>
        ) : (
          <div className="grid gap-4">
            {payload.bonuses.map((bonus) => {
              const visual = bonusVisual(bonus.metricKey, bonus.title);
              const Icon = visual.icon;
              return (
                <article
                  key={bonus.id}
                  className={`group cursor-default overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm transition duration-300 ease-out hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl ${visual.glow}`}
                >
                  <div className="flex flex-col sm:flex-row">
                    <div
                      className={`relative flex min-h-[140px] items-center justify-center bg-gradient-to-br p-6 sm:w-40 sm:min-h-[168px] ${visual.panel}`}
                    >
                      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.9),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(15,23,42,0.06),transparent_40%)]" />
                      <div
                        className={`relative rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-black/5 transition duration-300 group-hover:scale-110 group-hover:rotate-[-3deg] ${visual.accent}`}
                      >
                        <Icon size={36} strokeWidth={1.75} />
                      </div>
                    </div>
                    <div className="flex-1 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3 className="text-xl font-black text-slate-950 transition-colors group-hover:text-slate-800">
                          {bonus.title}
                        </h3>
                        <p className="rounded-full bg-slate-950 px-3 py-1 text-sm font-black text-white transition duration-300 group-hover:scale-105 group-hover:bg-orange-600">
                          +{eur(bonus.rewardAmount)}
                        </p>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-800">{bonus.condition}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{bonus.description}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="card p-5 sm:p-7">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="rounded-2xl bg-sky-50 p-3.5 text-sky-600">
            <Gift size={28} />
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            На чём фокусироваться сейчас
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Продукты и инструменты, которые сейчас лучше всего усиливают продажу.
          </p>
        </div>

        {payload.focusProducts.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Список фокус-продуктов пока пуст.
          </p>
        ) : (
          <div className="grid gap-4">
            {payload.focusProducts.map((product) => {
              const visual = focusVisual(product.id, product.title);
              const Icon = visual.icon;
              return (
                <article
                  key={product.id}
                  className={`group overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm transition duration-300 ease-out hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl ${visual.glow}`}
                >
                  <div className="flex flex-col sm:flex-row">
                    <div
                      className={`relative flex min-h-[120px] items-center justify-center bg-gradient-to-br p-5 sm:w-36 sm:min-h-full ${visual.panel}`}
                    >
                      <div
                        className={`rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-black/5 transition duration-300 group-hover:scale-110 ${visual.accent}`}
                      >
                        <Icon size={32} strokeWidth={1.75} />
                      </div>
                    </div>
                    <div className="flex-1 p-5">
                      <h3 className="text-xl font-black text-slate-950">{product.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{product.summary}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        <span className="font-bold text-slate-900">Почему сейчас:</span> {product.whyNow}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        <span className="font-bold text-slate-900">Как говорить:</span> {product.tip}
                      </p>
                      {product.imageUrls.length > 0 ? (
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {product.imageUrls.map((src) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={src}
                              src={src}
                              alt={product.title}
                              className="aspect-[3/4] w-full rounded-xl border border-[var(--line)] object-cover bg-slate-50 transition duration-300 group-hover:shadow-md"
                            />
                          ))}
                        </div>
                      ) : null}
                      {product.linkUrl ? (
                        <a
                          href={product.linkUrl}
                          target={product.linkUrl.startsWith("/") ? undefined : "_blank"}
                          rel={product.linkUrl.startsWith("/") ? undefined : "noreferrer"}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition duration-300 hover:bg-orange-600 group-hover:translate-x-0.5"
                        >
                          {product.linkLabel || "Открыть"}
                          {!product.linkUrl.startsWith("/") ? <ExternalLink size={14} /> : null}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
