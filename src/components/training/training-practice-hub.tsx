"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Bot, ClipboardCheck, ExternalLink } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { useTrainingUser } from "@/components/training/training-context";
import { getStageConfig } from "@/lib/training/stages";
import { resolveTrackModuleStatus } from "@/lib/training/progress";
import { getStatusClass, getStatusLabel } from "@/lib/training/quiz-scoring";
import { TRAINING_TELEGRAM_BOT, trainingTelegramBotUrl } from "@/lib/training/practice-bot";
import type { TrainingTrackModule, TrainingStatus, UserTrainingProgress } from "@/types/training";

function ModuleCard({
  module,
  status,
  onStart
}: {
  module: TrainingTrackModule;
  status: TrainingStatus;
  onStart: () => void;
}) {
  const actionLabel = status === "not_started" ? "Начать" : status === "in_progress" ? "Продолжить" : "Повторить";

  return (
    <article className="card flex h-full flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
          <ClipboardCheck size={22} />
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${getStatusClass(status)}`}>
          {getStatusLabel(status)}
        </span>
      </div>
      <h2 className="text-xl font-black text-slate-950">{module.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{module.shortDescription}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/training/practice/${module.id}`}
          onClick={onStart}
          className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
        >
          {actionLabel}
        </Link>
        {module.questions.length > 0 && status !== "not_started" ? (
          <Link
            href={`/training/practice/${module.id}/quiz`}
            className="inline-flex items-center rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            К тесту
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function PracticeHubContent() {
  const { user, loading: userLoading } = useTrainingUser();
  const [modules, setModules] = useState<TrainingTrackModule[]>([]);
  const [progress, setProgress] = useState<UserTrainingProgress | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/training/modules?stage=practice").then((r) => r.json()),
      fetch(`/api/training/progress?userId=${user.id}`).then((r) => r.json())
    ]).then(([modulesData, progressData]) => {
      if (Array.isArray(modulesData.modules)) setModules(modulesData.modules);
      if (progressData?.progress) setProgress(progressData.progress);
    });
  }, [user]);

  const markStarted = async (moduleId: string) => {
    if (!user) return;
    await fetch("/api/training/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, moduleId, stageId: "practice", action: "start" })
    });
  };

  if (userLoading || !user) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка модулей...</div>;
  }

  return (
    <>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Link href="/training/practice/bot" className="block">
          <article className="card flex h-full items-center gap-4 p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Bot size={28} strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-slate-950">Тренировочный бот</h2>
              <span className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-blue-600">
                Выбрать сценарий
                <ArrowRight size={16} />
              </span>
            </div>
          </article>
        </Link>

        <a href={trainingTelegramBotUrl()} target="_blank" rel="noopener noreferrer" className="block">
          <article className="card flex h-full items-center gap-4 p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#229ED9] text-white">
              <ExternalLink size={28} strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-slate-950">{TRAINING_TELEGRAM_BOT.displayName}</h2>
              <span className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[#229ED9]">
                Открыть в Telegram
                <ExternalLink size={16} />
              </span>
            </div>
          </article>
        </a>
      </div>

      <section className="mb-4">
        <h3 className="text-lg font-black text-slate-950">Тесты</h3>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {modules.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            status={progress ? resolveTrackModuleStatus(progress, "practice", module.id) : "not_started"}
            onStart={() => void markStarted(module.id)}
          />
        ))}
      </section>
    </>
  );
}

export function TrainingPracticeHub() {
  const stage = getStageConfig("practice")!;

  return (
    <TrainingLayout
      title={stage.title.replace(/^Этап \d+\.\s/, "")}
      backHref="/training"
      backLabel="К этапам обучения"
    >
      <PracticeHubContent />
    </TrainingLayout>
  );
}
