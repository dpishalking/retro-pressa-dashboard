"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { TrackVideoPlayer } from "@/components/training/track-video-player";
import type { TrackStageId, TrainingTrackModule } from "@/types/training";

function ModuleVideoContent({
  stageId,
  moduleId,
  videoId
}: {
  stageId: TrackStageId;
  moduleId: string;
  videoId: string;
}) {
  const [module, setModule] = useState<TrainingTrackModule | null>(null);

  useEffect(() => {
    fetch(`/api/training/modules/${stageId}/${moduleId}`)
      .then((response) => response.json())
      .then((data) => {
        if (data?.module) setModule(data.module);
      });
  }, [moduleId, stageId]);

  if (!module) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка видео...</div>;
  }

  const videos = [...(module.videos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const video = videos.find((item) => item.id === videoId);
  const currentIndex = videos.findIndex((item) => item.id === videoId);
  const prevVideo = currentIndex > 0 ? videos[currentIndex - 1] : null;
  const nextVideo = currentIndex >= 0 && currentIndex < videos.length - 1 ? videos[currentIndex + 1] : null;

  if (!video) {
    return (
      <div className="card p-8">
        <p className="text-sm text-slate-600">Видео не найдено.</p>
        <Link
          href={`/training/${stageId}/${moduleId}`}
          className="mt-4 inline-block text-sm font-bold text-blue-600"
        >
          Вернуться к модулю
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{module.title}</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">{video.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Урок {video.sortOrder} из {videos.length}
        </p>
      </section>

      <section className="card p-6">
        <TrackVideoPlayer video={video} />
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-black text-slate-950">Цель урока</h2>
        <p className="mt-3 text-sm leading-7 text-slate-700">{video.goal}</p>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        {prevVideo ? (
          <Link
            href={`/training/${stageId}/${moduleId}/videos/${prevVideo.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            {prevVideo.title}
          </Link>
        ) : (
          <span />
        )}
        {nextVideo ? (
          <Link
            href={`/training/${stageId}/${moduleId}/videos/${nextVideo.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            {nextVideo.title}
            <ArrowRight size={16} />
          </Link>
        ) : (
          <Link
            href={`/training/${stageId}/${moduleId}/quiz`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            К тесту модуля
            <ArrowRight size={16} />
          </Link>
        )}
      </section>
    </div>
  );
}

export function TrainingModuleVideo({
  stageId,
  moduleId,
  videoId
}: {
  stageId: TrackStageId;
  moduleId: string;
  videoId: string;
}) {
  return (
    <TrainingLayout
      backHref={`/training/${stageId}/${moduleId}`}
      backLabel="К материалам модуля"
    >
      <ModuleVideoContent stageId={stageId} moduleId={moduleId} videoId={videoId} />
    </TrainingLayout>
  );
}
