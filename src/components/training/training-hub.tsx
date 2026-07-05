"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Circle } from "lucide-react";
import { createTrainingCatalogSeed } from "@/data/training-seed";
import { HUB_PATH } from "@/lib/auth/routes";
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
  onStart
}: {
  product: ProductTrainingModule;
  status: TrainingStatus;
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
      attempts: []
    };
    return {
      products: fallbackProducts,
      progress: fallbackProgress,
      overview: buildTrainingOverview(fallbackProducts, fallbackProgress)
    };
  }, [user?.id, user?.name]);
  const [data, setData] = useState<HubData>(fallbackData);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      fetch("/api/training/products").then((response) => response.json()),
      fetch(`/api/training/progress?userId=${user.id}`).then((response) => response.json())
    ])
      .then(([productsData, progressData]) => {
        if (Array.isArray(productsData.products) && progressData?.progress && progressData?.overview) {
          setData({
            products: productsData.products,
            progress: progressData.progress,
            overview: progressData.overview
          });
        }
      })
      .catch(() => {
        setData(fallbackData);
      });
  }, [fallbackData, user]);

  const markStarted = async (productId: string) => {
    if (!user) return;
    await fetch("/api/training/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, productId, action: "start" })
    });
  };

  if (userLoading || !user) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка модулей обучения...</div>;
  }

  const remainingProducts = data.products.filter((product) => data.overview.remainingProductIds.includes(product.id));

  return (
    <>
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.products.map((product) => {
          const productProgress = data.progress.products.find((item) => item.productId === product.id);
          const status = productProgress?.status ?? "not_started";
          return (
            <ProductCard
              key={product.id}
              product={product}
              status={status}
              onStart={() => void markStarted(product.id)}
            />
          );
        })}
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
      title="Обучение менеджеров"
      description="Онбординг и тренировочный кабинет: материалы, практика, тесты и контроль прогресса."
      backHref={HUB_PATH}
      backLabel="К рабочему кабинету"
    >
      <TrainingHubContent />
    </TrainingLayout>
  );
}
