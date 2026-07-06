"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { BookOpen, CheckCircle2, Circle } from "lucide-react";
import { createTrainingCatalogSeed } from "@/data/training-seed";
import { createTrackModulesSeed } from "@/data/training-tracks-seed";
import { ClientReviewVideos } from "@/components/training/client-review-videos";
import { TrainingLayout } from "@/components/training/training-layout";
import { useTrainingUser } from "@/components/training/training-context";
import { buildTrainingOverview } from "@/lib/training/progress";
import { getStatusClass, getStatusLabel } from "@/lib/training/quiz-scoring";
import type { ProductTrainingModule, TrainingOverview, TrainingStatus, UserTrainingProgress } from "@/types/training";

type HubData = {
  products: ProductTrainingModule[];
  progress: UserTrainingProgress;
  overview: TrainingOverview;
};

function ProgressRing({ percent }: { percent: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg className="-rotate-90" width="112" height="112" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="#e11d48"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-black text-slate-950">{percent}%</p>
        <p className="text-xs font-semibold text-slate-500">готово</p>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  status,
  bestScorePercent,
  attemptCount,
  onStart
}: {
  product: ProductTrainingModule;
  status: TrainingStatus;
  bestScorePercent?: number;
  attemptCount: number;
  onStart: () => void;
}) {
  const hasQuiz = product.questions.length > 0;
  const actionLabel = status === "not_started" ? "Начать обучение" : status === "in_progress" ? "Продолжить" : "Повторить";

  return (
    <article className="card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-44 w-full bg-slate-100">
        <Image src={product.coverImage} alt={product.title} fill className="object-cover" unoptimized />
      </div>
      <div className="flex h-full flex-col p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
            <BookOpen size={22} />
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${getStatusClass(status)}`}>
              {getStatusLabel(status)}
            </span>
            {attemptCount > 0 ? (
              <span className="text-xs font-semibold text-slate-500">
                Лучший результат: {bestScorePercent ?? 0}% · попыток {attemptCount}
              </span>
            ) : null}
            <Link
              href={`/training/products/${product.id}`}
              onClick={onStart}
              className="inline-flex items-center rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              {actionLabel}
            </Link>
          </div>
        </div>
        <h2 className="text-xl font-black text-slate-950">{product.title}</h2>
        <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{product.shortDescription}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {hasQuiz && status !== "not_started" ? (
            <Link
              href={`/training/products/${product.id}/quiz`}
              className="inline-flex items-center rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              К тесту
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function TrainingHubContent() {
  const { user, isAdmin, loading: userLoading } = useTrainingUser();
  const fallbackData = useMemo<HubData>(() => {
    const fallbackProducts = createTrainingCatalogSeed().products;
    const fallbackProgress: UserTrainingProgress = {
      userId: user?.id ?? "anna",
      userName: user?.name ?? "Анна",
      products: [],
      modules: [],
      attempts: []
    };
    return {
      products: fallbackProducts,
      progress: fallbackProgress,
      overview: buildTrainingOverview(
        fallbackProducts,
        createTrackModulesSeed("crm"),
        createTrackModulesSeed("practice"),
        fallbackProgress
      )
    };
  }, [user?.id, user?.name]);
  const [data, setData] = useState<HubData>(fallbackData);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;

    setLoadError(null);

    try {
      const [productsResponse, progressResponse] = await Promise.all([
        fetch("/api/training/products", { cache: "no-store" }),
        fetch(`/api/training/progress?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" })
      ]);

      const productsData = (await productsResponse.json()) as { products?: ProductTrainingModule[] };
      const progressData = (await progressResponse.json()) as {
        progress?: UserTrainingProgress;
        overview?: TrainingOverview;
        error?: string;
      };

      if (!productsResponse.ok || !progressResponse.ok) {
        throw new Error(progressData.error ?? "Не удалось загрузить прогресс");
      }

      if (Array.isArray(productsData.products) && progressData.progress && progressData.overview) {
        setData({
          products: productsData.products,
          progress: progressData.progress,
          overview: progressData.overview
        });
        return;
      }

      throw new Error("Некорректный ответ сервера");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Не удалось загрузить прогресс");
    }
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const refresh = () => void loadData();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadData]);

  const markStarted = async (productId: string) => {
    if (!user) return;

    const response = await fetch("/api/training/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, productId, action: "start" })
    });

    if (!response.ok) return;

    const payload = (await response.json()) as { progress?: UserTrainingProgress; overview?: TrainingOverview };
    if (payload.progress && payload.overview) {
      setData((current) => ({
        ...current,
        progress: payload.progress!,
        overview: payload.overview!
      }));
    }
  };

  if (userLoading || !user) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка модулей обучения...</div>;
  }

  const remainingProducts = data.products.filter((product) => data.overview.remainingProductIds.includes(product.id));
  const recentAttempts = data.progress.attempts
    .filter((attempt) => attempt.productId)
    .slice(0, 5)
    .map((attempt) => {
      const product = data.products.find((item) => item.id === attempt.productId);
      return { attempt, title: product?.title ?? attempt.productId ?? "Тест" };
    });

  return (
    <>
      {loadError ? (
        <section className="card mb-6 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {loadError}. Обновите страницу или пройдите тест ещё раз.
        </section>
      ) : null}

      <section className="card mb-6 grid gap-6 p-6 lg:grid-cols-[auto_1fr] lg:items-center">
        <ProgressRing percent={data.overview.overallPercent} />
        <div>
          <h2 className="text-2xl font-black text-slate-950">Ваш прогресс</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {user.name}, вы прошли {data.overview.completedProducts} из {data.overview.totalProducts} продуктов и сдали{" "}
            {data.overview.passedTests} тестов.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Изучено</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{data.overview.completedProducts}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">В процессе</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{data.overview.inProgressProducts}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Тесты пройдены</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{data.overview.passedTests}</p>
            </div>
          </div>
        </div>
      </section>

      {recentAttempts.length > 0 ? (
        <section className="card mb-6 p-6">
          <h3 className="text-lg font-black text-slate-950">История тестов</h3>
          <ul className="mt-4 space-y-2">
            {recentAttempts.map(({ attempt, title }) => (
              <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
                <span>{title}</span>
                <span className="font-semibold">
                  {attempt.scorePercent}% · {attempt.passed ? "пройден" : "не пройден"} ·{" "}
                  {format(new Date(attempt.attemptedAt), "d MMM yyyy, HH:mm", { locale: ru })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {remainingProducts.length > 0 ? (
        <section className="card mb-6 p-6">
          <h3 className="text-lg font-black text-slate-950">Что ещё нужно пройти</h3>
          <ul className="mt-4 space-y-2">
            {remainingProducts.map((product) => (
              <li key={product.id} className="flex items-center gap-2 text-sm text-slate-700">
                <Circle size={14} className="text-slate-400" />
                {product.title}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="card mb-6 p-6">
          <div className="flex items-center gap-3 text-emerald-700">
            <CheckCircle2 size={20} />
            <p className="font-bold">Все доступные модули пройдены. Отличная работа!</p>
          </div>
        </section>
      )}

      <ClientReviewVideos />

      <section className="mb-6">
        <h3 className="text-lg font-black text-slate-950">Наши подарки</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.products.map((product) => {
            const productProgress = data.progress.products.find((item) => item.productId === product.id);
            const status = productProgress?.status ?? "not_started";
            return (
              <ProductCard
                key={product.id}
                product={product}
                status={status}
                bestScorePercent={productProgress?.bestScorePercent}
                attemptCount={productProgress?.attemptCount ?? 0}
                onStart={() => void markStarted(product.id)}
              />
            );
          })}
        </div>
      </section>

      {isAdmin ? (
        <section className="mt-8">
          <Link
            href="/training/admin"
            className="inline-flex rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700 hover:bg-violet-100"
          >
            Открыть админ-панель →
          </Link>
        </section>
      ) : null}
    </>
  );
}

export function TrainingHub() {
  return (
    <TrainingLayout
      title="Этап 1. Продукт"
      backHref="/training"
      backLabel="К этапам обучения"
    >
      <TrainingHubContent />
    </TrainingLayout>
  );
}
