"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { TrackVideoPlayer } from "@/components/training/track-video-player";
import { useTrainingUser } from "@/components/training/training-context";
import { getStageConfig } from "@/lib/training/stages";
import type { TrackStageId, TrainingTrackModule } from "@/types/training";

function RichText({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);

  return (
    <div className="whitespace-pre-line text-sm leading-7 text-slate-700">
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index} className="font-bold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        )
      )}
    </div>
  );
}

function SectionBlock({ title, content }: { title: string; content: string }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <h2 className="text-base font-black text-slate-950 sm:text-lg">{title}</h2>
      <div className="mt-3">
        <RichText content={content} />
      </div>
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
  const sections = module.sections.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const stageLabel = getStageConfig(stageId)?.title.split(".")[0];

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <div className="border-b border-[var(--line)] p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{stageLabel}</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{module.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{module.shortDescription}</p>
        </div>

        {videos.length > 0 ? (
          <div className="space-y-5 p-6">
            {videos.map((video) => (
              <div key={video.id} className="space-y-3">
                {videos.length > 1 ? (
                  <p className="text-sm font-bold text-slate-950">
                    {video.sortOrder}. {video.title}
                  </p>
                ) : null}
                <TrackVideoPlayer video={video} />
                {video.goal ? (
                  <p className="text-sm leading-7 text-slate-600">
                    <span className="font-bold text-slate-900">Цель урока: </span>
                    {video.goal}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {sections.length > 0 ? (
        <section className="space-y-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Краткая выжимка</h2>
          <div className="space-y-3">
            {sections.map((section) => (
              <SectionBlock key={section.id} title={section.title} content={section.content} />
            ))}
          </div>
        </section>
      ) : null}

      {hasQuiz ? (
        <section className="card p-6">
          <Link
            href={`/training/${stageId}/${module.id}/quiz`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            <PlayCircle size={18} />
            Перейти к тесту
          </Link>
          <p className="mt-3 text-xs text-slate-500">Проходной балл: {module.passingScore}%</p>
        </section>
      ) : null}
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
