"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Gift, Trophy } from "lucide-react";
import { OfficeHubBackLink } from "@/components/office-hub";
import { readJsonResponse } from "@/lib/api-response";
import { eur } from "@/lib/format";
import { periodStatusLabel } from "@/lib/motivation/labels";
import type { MotivationBoardPayload } from "@/types/motivation";

type LoadStatus = { state: "idle" | "loading" | "ok" | "error"; message: string };

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
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
            <Trophy size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-950">Мотивация месяца</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Условия бонусов на текущий месяц. Личный прогресс и рейтинг подключим позже — сейчас важно просто знать правила.
            </p>
          </div>
        </div>

        {payload.bonuses.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Условия мотивации на этот месяц пока не опубликованы.
          </p>
        ) : (
          <div className="grid gap-4">
            {payload.bonuses.map((bonus) => (
              <article key={bonus.id} className="rounded-2xl border border-[var(--line)] bg-slate-50/80 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-xl font-black text-slate-950">{bonus.title}</h3>
                  <p className="rounded-full bg-slate-950 px-3 py-1 text-sm font-black text-white">
                    +{eur(bonus.rewardAmount)}
                  </p>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-800">{bonus.condition}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{bonus.description}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5 sm:p-7">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-2xl bg-sky-50 p-3 text-sky-600">
            <Gift size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-950">На чём фокусироваться сейчас</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Продукты и инструменты, которые сейчас лучше всего усиливают продажу.
            </p>
          </div>
        </div>

        {payload.focusProducts.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Список фокус-продуктов пока пуст.
          </p>
        ) : (
          <div className="grid gap-4">
            {payload.focusProducts.map((product) => (
              <article key={product.id} className="rounded-2xl border border-[var(--line)] p-5">
                <h3 className="text-xl font-black text-slate-950">{product.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">{product.summary}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  <span className="font-bold text-slate-900">Почему сейчас:</span> {product.whyNow}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  <span className="font-bold text-slate-900">Как говорить:</span> {product.tip}
                </p>
                {product.linkUrl ? (
                  <a
                    href={product.linkUrl}
                    target={product.linkUrl.startsWith("/") ? undefined : "_blank"}
                    rel={product.linkUrl.startsWith("/") ? undefined : "noreferrer"}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
                  >
                    {product.linkLabel || "Открыть"}
                    {!product.linkUrl.startsWith("/") ? <ExternalLink size={14} /> : null}
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
