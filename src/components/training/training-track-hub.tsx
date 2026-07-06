"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Database, ExternalLink } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { useTrainingUser } from "@/components/training/training-context";
import { getStageConfig } from "@/lib/training/stages";
import { resolveTrackModuleStatus } from "@/lib/training/progress";
import { getStatusClass, getStatusLabel } from "@/lib/training/quiz-scoring";
import type { TrackStageId, TrainingTrackModule, TrainingStatus, UserTrainingProgress } from "@/types/training";

const CRM_PLAYBOOK_URL =
  "https://docs.google.com/document/d/1EpXyf7ss_oToJImZx66BMfZK_1FWjJn6AISCfn7ObZY/edit?tab=t.0";
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

  const loadData = useCallback(async () => {
    if (!user) return;

    const [modulesResponse, progressResponse] = await Promise.all([
      fetch(`/api/training/modules?stage=${stageId}`, { cache: "no-store" }),
      fetch(`/api/training/progress?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" })
    ]);

    const modulesData = (await modulesResponse.json()) as { modules?: TrainingTrackModule[] };
    const progressData = (await progressResponse.json()) as { progress?: UserTrainingProgress };

    if (Array.isArray(modulesData.modules)) setModules(modulesData.modules);
    if (progressData.progress) setProgress(progressData.progress);
  }, [stageId, user]);

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

      {stageId === "crm" ? (
        <section className="mt-5">
          <a
            href={CRM_PLAYBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="card flex items-center justify-between gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6"
          >
            <div>
              <p className="text-base font-black text-slate-950 sm:text-lg">Плейбук Работа в CRM Bitrix</p>
              <p className="mt-1 text-sm text-slate-600">Подробные этапы, зоны ответственности и регламенты по воронкам</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-bold text-slate-700">
              Открыть
              <ExternalLink size={16} />
            </span>
          </a>
        </section>
      ) : null}
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
