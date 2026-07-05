"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, PlayCircle } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { useTrainingUser } from "@/components/training/training-context";
import { getStageConfig } from "@/lib/training/stages";
import type { TrackStageId, TrainingTrackModule } from "@/types/training";

function SectionBlock({ title, content }: { title: string; content: string }) {
  return (
    <section className="card p-6">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{content}</div>
    </section>
  );
}

function ModuleDetailContent({ stageId, moduleId }: { stageId: TrackStageId; moduleId: string }) {
  const { user } = useTrainingUser();
  const [module, setModule] = useState<TrainingTrackModule | null>(null);

  useEffect(() => {
    fetch(`/api/training/modules/${stageId}/${moduleId}`)
      .then((response) => response.json())
      .then((data) => {
        if (data?.module) setModule(data.module);
      });
  }, [stageId, moduleId]);

  useEffect(() => {
    if (!user) return;
    void fetch("/api/training/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, moduleId, stageId, action: "start" })
    });
  }, [moduleId, stageId, user]);

  if (!module) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка материала...</div>;
  }

  const hasQuiz = module.questions.length > 0;
  const videos = [...(module.videos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {getStageConfig(stageId)?.title.split(".")[0]}
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">{module.title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">{module.shortDescription}</p>
      </section>

      {videos.length > 0 ? (
        <section className="card p-6">
          <h2 className="text-lg font-black text-slate-950">Видеоуроки</h2>
          <p className="mt-2 text-sm text-slate-600">Четыре урока — у каждого своя цель. Названия можно будет обновить позже.</p>
          <ul className="mt-4 space-y-2">
            {videos.map((video) => (
              <li key={video.id}>
                <Link
                  href={`/training/${stageId}/${module.id}/videos/${video.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-4 py-3 transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-black text-blue-600">
                      {video.sortOrder}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-950">{video.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{video.goal}</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="shrink-0 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {module.sections
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((section) => (
          <SectionBlock key={section.id} title={section.title} content={section.content} />
        ))}

      <section className="card p-6">
        {hasQuiz ? (
          <Link
            href={`/training/${stageId}/${module.id}/quiz`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            <PlayCircle size={18} />
            Перейти к тесту
          </Link>
        ) : (
          <p className="text-sm text-slate-600">Тест для этого модуля ещё не добавлен.</p>
        )}
        <p className="mt-3 text-xs text-slate-500">Проходной балл: {module.passingScore}%</p>
      </section>
    </div>
  );
}

export function TrainingModuleDetail({ stageId, moduleId }: { stageId: TrackStageId; moduleId: string }) {
  const stage = getStageConfig(stageId);

  return (
    <TrainingLayout
      backHref={`/training/${stageId}`}
      backLabel={`К этапу «${stage?.title.replace(/^Этап \d+\.\s/, "") ?? "обучения"}»`}
    >
      <ModuleDetailContent stageId={stageId} moduleId={moduleId} />
    </TrainingLayout>
  );
}
