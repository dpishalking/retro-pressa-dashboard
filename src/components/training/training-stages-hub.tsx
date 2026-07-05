"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, LockOpen } from "lucide-react";
import { HUB_PATH } from "@/lib/auth/routes";
import { TRAINING_STAGES } from "@/lib/training/stages";
import { TRAINING_TELEGRAM_BOT } from "@/lib/training/practice-bot";
import { TrainingLayout } from "@/components/training/training-layout";
import { useTrainingUser } from "@/components/training/training-context";
import { getStatusClass, getStatusLabel } from "@/lib/training/quiz-scoring";
import type { TrainingOverview, TrainingStageOverview } from "@/types/training";

function StageCard({ stage, index }: { stage: TrainingStageOverview; index: number }) {
  const config = TRAINING_STAGES.find((item) => item.id === stage.id);
  const accent = config?.accent ?? "text-slate-600 bg-slate-50";

  return (
    <Link href={stage.href} className="block h-full">
      <article className="card flex h-full flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className={`rounded-xl p-3 text-sm font-black ${accent}`}>{index + 1}</div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${getStatusClass(stage.status)}`}>
            {getStatusLabel(stage.status)}
          </span>
        </div>
        <h2 className="text-xl font-black text-slate-950">{stage.title}</h2>
        <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{stage.description}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Пройдено</p>
            <p className="mt-1 text-lg font-black text-slate-950">
              {stage.completedModules} / {stage.totalModules}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Готовность</p>
            <p className="mt-1 text-lg font-black text-slate-950">{stage.percent}%</p>
          </div>
        </div>
        <p className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-600">
          Перейти к этапу
          <ArrowRight size={16} />
        </p>
      </article>
    </Link>
  );
}

function StagesContent() {
  const { user, isAdmin, loading: userLoading } = useTrainingUser();
  const [overview, setOverview] = useState<TrainingOverview | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/training/progress?userId=${user.id}`)
      .then((response) => response.json())
      .then((data) => {
        if (data?.overview) setOverview(data.overview);
      })
      .catch(() => setOverview(null));
  }, [user]);

  if (userLoading || !user) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка программы обучения...</div>;
  }

  const stages = overview?.stages ?? TRAINING_STAGES.map((stage) => ({
    id: stage.id,
    title: stage.title,
    description: stage.description,
    href: stage.href,
    totalModules: 0,
    completedModules: 0,
    inProgressModules: 0,
    percent: 0,
    status: "not_started" as const
  }));

  return (
    <>
      <section className="card mb-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Путь нового менеджера</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {user.name}, обучение идёт в три этапа: сначала продукт и смысл подарков, затем работа в CRM
              (Битрикс24), и в конце — практика с ботом {TRAINING_TELEGRAM_BOT.displayName} в Telegram: прогрев роли и диалоги в сценариях.
            </p>
          </div>
          <div className="rounded-2xl bg-rose-50 px-6 py-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-600">Общий прогресс</p>
            <p className="mt-1 text-3xl font-black text-slate-950">{overview?.totalStagesPercent ?? 0}%</p>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        {stages.map((stage, index) => (
          <StageCard key={stage.id} stage={stage} index={index} />
        ))}
      </section>

      <section className="card p-6">
        <div className="flex items-start gap-3 text-slate-700">
          <LockOpen size={20} className="mt-0.5 shrink-0 text-emerald-600" />
          <div className="text-sm leading-6">
            <p className="font-bold text-slate-950">Как проходить</p>
            <p className="mt-1">
              Этапы можно открывать по порядку или возвращаться к любому блоку. На каждом модуле — материалы и
              тест. Для CRM не нужно знать все технические настройки: главное — не терять клиента и фиксировать
              смысл разговора.
            </p>
          </div>
        </div>
        {overview && overview.totalStagesPercent === 100 ? (
          <div className="mt-4 flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={18} />
            <p className="text-sm font-bold">Все этапы пройдены. Можно повторять для закрепления.</p>
          </div>
        ) : null}
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

export function TrainingStagesHub() {
  return (
    <TrainingLayout
      title="Обучение менеджеров"
      description="Три этапа: продукт → CRM → практика. Проходите блоки по порядку или возвращайтесь к нужному разделу."
      backHref={HUB_PATH}
      backLabel="К рабочему кабинету"
    >
      <StagesContent />
    </TrainingLayout>
  );
}
