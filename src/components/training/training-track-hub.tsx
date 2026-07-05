"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardCheck, Database } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { useTrainingUser } from "@/components/training/training-context";
import { getStageConfig } from "@/lib/training/stages";
import { resolveTrackModuleStatus } from "@/lib/training/progress";
import { getStatusClass, getStatusLabel } from "@/lib/training/quiz-scoring";
import type { TrackStageId, TrainingTrackModule, TrainingStatus, UserTrainingProgress } from "@/types/training";

const stageIcons = {
  crm: Database,
  practice: ClipboardCheck
} as const;

function ModuleCard({
  module,
  status,
  stageId,
  onStart
}: {
  module: TrainingTrackModule;
  status: TrainingStatus;
  stageId: TrackStageId;
  onStart: () => void;
}) {
  const actionLabel = status === "not_started" ? "Начать" : status === "in_progress" ? "Продолжить" : "Повторить";
  const Icon = stageIcons[stageId];

  return (
    <article className="card flex h-full flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className={`rounded-xl p-3 ${stageId === "crm" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
          <Icon size={22} />
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${getStatusClass(status)}`}>
          {getStatusLabel(status)}
        </span>
      </div>
      <h2 className="text-xl font-black text-slate-950">{module.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{module.shortDescription}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/training/${stageId}/${module.id}`}
          onClick={onStart}
          className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
        >
          {actionLabel}
        </Link>
        {module.questions.length > 0 && status !== "not_started" ? (
          <Link
            href={`/training/${stageId}/${module.id}/quiz`}
            className="inline-flex items-center rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            К тесту
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function TrackHubContent({ stageId }: { stageId: TrackStageId }) {
  const { user, loading: userLoading } = useTrainingUser();
  const [modules, setModules] = useState<TrainingTrackModule[]>([]);
  const [progress, setProgress] = useState<UserTrainingProgress | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch(`/api/training/modules?stage=${stageId}`).then((r) => r.json()),
      fetch(`/api/training/progress?userId=${user.id}`).then((r) => r.json())
    ]).then(([modulesData, progressData]) => {
      if (Array.isArray(modulesData.modules)) setModules(modulesData.modules);
      if (progressData?.progress) setProgress(progressData.progress);
    });
  }, [stageId, user]);

  const markStarted = async (moduleId: string) => {
    if (!user) return;
    await fetch("/api/training/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, moduleId, stageId, action: "start" })
    });
  };

  if (userLoading || !user) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка модулей...</div>;
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2">
        {modules.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            stageId={stageId}
            status={progress ? resolveTrackModuleStatus(progress, stageId, module.id) : "not_started"}
            onStart={() => void markStarted(module.id)}
          />
        ))}
      </section>
    </>
  );
}

export function TrainingTrackHub({ stageId }: { stageId: TrackStageId }) {
  const stage = getStageConfig(stageId)!;

  return (
    <TrainingLayout
      title={stage.title.replace(/^Этап \d+\.\s/, "")}
      backHref="/training"
      backLabel="К этапам обучения"
    >
      <TrackHubContent stageId={stageId} />
    </TrainingLayout>
  );
}
